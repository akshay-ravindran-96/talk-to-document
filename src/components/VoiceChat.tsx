"use client";

import { releaseVoiceResources, stopLateMicrophone } from "@/lib/voice-resources";
import { createVoiceRecovery } from "@/lib/voice-recovery";
import { accessHeaders, readJson } from "@/lib/client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribeNetwork(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

type Line = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type VoiceEvent = {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
  response?: { status?: string; status_details?: { reason?: string; error?: { message?: string } } };
};

export default function VoiceChat({
  sourceText,
}: {
  sourceText: string;
}) {
  const [status, setStatus] = useState("Idle");
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const offline = useSyncExternalStore(subscribeNetwork, () => !navigator.onLine, () => false);
  const [reconnectNeeded, setReconnectNeeded] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recovery = useRef<ReturnType<typeof createVoiceRecovery> | null>(null);
  const networkChange = useRef<((online: boolean) => void) | null>(null);
  const generation = useRef(0);

  const cleanup = useCallback(() => {
    generation.current += 1;
    networkChange.current = null;
    recovery.current?.dispose();
    recovery.current = null;
    controller.current?.abort();
    controller.current = null;

    if (timer.current) clearTimeout(timer.current);
    timer.current = null;

    releaseVoiceResources({ channel: channel.current, peer: peer.current, microphone: microphone.current, audio: audio.current });
    channel.current = null;
    peer.current = null;
    microphone.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);
  useEffect(() => {
    const offlineHandler = () => { networkChange.current?.(false); };
    const onlineHandler = () => { networkChange.current?.(true); };
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("online", onlineHandler);
    return () => {
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("online", onlineHandler);
    };
  }, []);

  function stop() {
    cleanup();
    setActive(false);
    setConnecting(false);
    setMuted(false);
    setRecovering(false);
    setReconnectNeeded(false);
    setError("");
    setStatus("Stopped");
  }

  function updateLine(
    id: string,
    role: Line["role"],
    text: string,
    append = false,
  ) {
    setLines((current) => {
      const existing = current.find((line) => line.id === id);

      if (!existing) return [...current, { id, role, text }];

      return current.map((line) =>
        line.id === id
          ? { ...line, text: append ? line.text + text : text }
          : line,
      );
    });
  }

  async function start() {
    if (peer.current || controller.current || !navigator.onLine) return;

    setError("");
    setLines([]);
    setRecovering(false);
    setReconnectNeeded(false);
    setMuted(false);
    setConnecting(true);
    setStatus("Requesting microphone");

    const attempt = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;

    function fail(message: string) {
      if (attempt !== generation.current) return;
      cleanup();
      setActive(false);
      setConnecting(false);
      setMuted(false);
      setRecovering(false);
      setReconnectNeeded(true);
      setStatus("Disconnected");
      setError(message);
    }

    recovery.current = createVoiceRecovery({
      probe: () => {
        const dc = channel.current;
        if (attempt !== generation.current || dc?.readyState !== "open") return false;
        try {
          dc.send(JSON.stringify({ type: "session.update", session: { type: "realtime" } }));
          return true;
        } catch { return false; }
      },
      recovering: () => {
        setRecovering(true);
        setStatus("Connection interrupted — waiting to recover");
      },
      restored: () => {
        setRecovering(false);
        setStatus("Connection restored — continue your conversation");
      },
      lost: () => fail("Connection lost. Restore your network, then reconnect. Reconnecting starts a new voice conversation."),
    });
    networkChange.current = (online) => {
      if (attempt !== generation.current) return;
      if (!online) recovery.current?.interrupt();
      else recovery.current?.online();
    };

    timer.current = setTimeout(() => {
      fail("Connection timed out. Try again or use text chat.");
    }, 45_000);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone unavailable. You can use text chat below.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Stop a late microphone response after cancellation or unmount.
      if (stopLateMicrophone(stream, attempt, generation.current)) return;

      microphone.current = stream;
      setStatus("Connecting");

      const tokenResponse = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...accessHeaders() },
        body: JSON.stringify({ sourceText }),
        signal: abort.signal,
      });

      if (!tokenResponse.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          "Voice route unavailable. Check api/realtime/token/route.ts.",
        );
      }

      const token = await readJson(tokenResponse);

      if (!tokenResponse.ok) {
        throw new Error(token.error || "Could not create voice session.");
      }

      if (attempt !== generation.current) return;

      const pc = new RTCPeerConnection();
      peer.current = pc;

      pc.ontrack = (event) => {
        if (attempt !== generation.current || !audio.current) return;
        audio.current.srcObject =
          event.streams[0] ?? new MediaStream([event.track]);
        void audio.current.play().catch(() => {
          if (attempt !== generation.current) return;
          setError("Press play on the audio controls to hear the assistant.");
        });
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      channel.current = dc;

      dc.onopen = () => {
        if (attempt !== generation.current) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setConnecting(false);
        setActive(true);
        if (navigator.onLine) recovery.current?.received();
        setStatus("Connected — ask a question");
      };

      dc.onclose = () => {
        fail("Voice connection closed. Start a new session to reconnect.");
      };

      pc.onconnectionstatechange = () => {
        if (attempt !== generation.current) return;
        if (pc.connectionState === "failed") {
          fail("Voice connection failed. Try again or use text chat.");
        } else if (pc.connectionState === "disconnected") {
          recovery.current?.interrupt();
        } else if (pc.connectionState === "connected") {
          if (navigator.onLine && dc.readyState === "open") recovery.current?.online();
        }
      };

      dc.onmessage = (message) => {
        if (attempt !== generation.current) return;

        let event: VoiceEvent;
        try {
          event = JSON.parse(message.data);
          if (!event || typeof event.type !== "string") return;
          if (navigator.onLine) recovery.current?.received();
        } catch {
          return;
        }

        if (event.type === "input_audio_buffer.speech_started") {
          setError("");
          setStatus("Listening");
        }

        if (event.type === "input_audio_buffer.speech_stopped") {
          setStatus("Thinking");
        }

        if (
          event.type === "conversation.item.input_audio_transcription.delta" &&
          event.item_id
        ) {
          updateLine(event.item_id, "user", event.delta ?? "", true);
        }

        if (
          event.type === "conversation.item.input_audio_transcription.completed" &&
          event.item_id
        ) {
          updateLine(event.item_id, "user", event.transcript ?? "");
        }

        if (
          event.type === "response.output_audio_transcript.delta" &&
          event.item_id
        ) {
          updateLine(event.item_id, "assistant", event.delta ?? "", true);
        }

        if (
          event.type === "response.output_audio_transcript.done" &&
          event.item_id
        ) {
          updateLine(event.item_id, "assistant", event.transcript ?? "");
        }

        if (event.type === "output_audio_buffer.started") {
          setStatus("Assistant speaking");
        }

        if (event.type === "output_audio_buffer.stopped") {
          setStatus("Connected — ask a question");
        }

        if (event.type === "response.done") {
          const result = event.response;
          if (result?.status === "incomplete") setError(result.status_details?.reason === "max_output_tokens"
            ? "The voice answer reached its length limit. Ask for a shorter answer or say continue."
            : "The voice answer was incomplete. Ask again or use text chat.");
          else if (result?.status === "cancelled") setStatus("Answer interrupted — ask a follow-up");
          else if (result?.status === "failed") setError(result.status_details?.error?.message || "Voice answer failed. Please try again.");
        }

        if (event.type === "error") {
          fail(event.error?.message || "Voice session error. Please retry.");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.value}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
          signal: abort.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Voice connection failed (${response.status}).`);
      }

      const sdp = await response.text();
      if (attempt !== generation.current) return;

      await pc.setRemoteDescription({ type: "answer", sdp });
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone permission denied. Allow access or use text chat below."
          : error instanceof DOMException && error.name === "NotFoundError"
            ? "No microphone was found. Connect one or use text chat below."
            : error instanceof DOMException && error.name === "NotReadableError"
              ? "The microphone could not be opened. Check other apps or use text chat below."
              : error instanceof TypeError
                ? "Could not connect. Check your network and retry, or use text chat below."
                : error instanceof Error
            ? error.message
            : "Could not start voice chat.";

      fail(message);
    }
  }

  function toggleMute() {
    const nextMuted = !muted;
    microphone.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Talk by voice</h2>

      <p className="text-sm text-slate-300">
        Speak with an AI assistant about your document. Each start creates
        a new voice conversation.
      </p>

      <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-sky-300">
        {(connecting || recovering) && <span aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-300 motion-reduce:animate-none" />}
        <div>
          <p>{recovering ? "Trying to restore connection…" : offline ? "Network offline — restore your connection" : status}{muted ? " · Microphone muted" : ""}</p>
          {recovering && <p className="mt-1 text-xs text-slate-400">{offline ? "Your network is offline. Waiting briefly for it to return." : "Checking whether your voice session can continue."}</p>}
        </div>
      </div>

      {reconnectNeeded && <p className="text-sm text-amber-300">Reconnect starts a new voice conversation and clears the voice transcript. The source remains loaded.</p>}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={start}
          disabled={active || connecting || offline}
          className="rounded-xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40"
        >
          {connecting ? "Connecting…" : reconnectNeeded ? "Reconnect voice chat" : "Start voice chat"}
        </button>

        <button
          onClick={toggleMute}
          disabled={!active}
          aria-pressed={muted}
          className="rounded-xl bg-slate-700 px-4 py-3 disabled:opacity-40"
        >
          {muted ? "Unmute" : "Mute"}
        </button>

        <button
          onClick={stop}
          disabled={!active && !connecting}
          className="rounded-xl bg-slate-700 px-4 py-3 disabled:opacity-40"
        >
          Stop
        </button>
      </div>

      <audio
        ref={audio}
        autoPlay
        controls
        aria-label="Assistant audio"
        className="w-full min-w-0"
      />

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      <div
        role="log"
        aria-label="Voice transcript"
        aria-live="polite"
        className="max-h-80 space-y-3 overflow-y-auto"
      >
        {lines.map((line) => (
          <div key={line.id} className="rounded-xl bg-slate-800 p-3">
            <p className="mb-1 text-xs font-semibold text-sky-300">
              {line.role === "user" ? "You" : "Assistant"}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {line.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}