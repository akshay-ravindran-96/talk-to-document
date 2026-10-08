"use client";

import { contextSections } from "@/lib/context";
import { useState, type FormEvent } from "react";
import DocumentChat from "@/components/DocumentChat";
import VoiceChat from "@/components/VoiceChat";
import { accessHeaders, readJson } from "@/lib/client";

type Source = { id: string; name: string; text: string; pages?: number; characters: number; kind: "pdf" | "youtube"; sourceUrl?: string; provider?: string; fallbackUsed?: boolean; demoForcedFallback?: boolean };

export default function Home() {
  const [mode, setMode] = useState<"pdf" | "youtube">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function changeSource(next: "pdf" | "youtube") {
    if (next === mode) return;
    setMode(next); setFile(null); setSource(null); setSectionIndex(0); setError("");
  }

  async function ingest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSource(null); setSectionIndex(0);
    if (mode === "pdf" && (!file || !file.size || file.size > 25 * 1024 * 1024)) {
      setError("Choose a non-empty PDF no larger than 25 MB."); return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      const response = await fetch(`/api/ingest/${mode}`, {
        method: "POST",
        headers: mode === "youtube" ? { "Content-Type": "application/json", ...accessHeaders() } : accessHeaders(),
        body: mode === "pdf" ? form : JSON.stringify({ url }),
        signal: AbortSignal.timeout(60_000),
      });
      setSource(await readJson(response));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load the source. Please retry.");
    } finally { setLoading(false); }
  }

  const sections = source ? contextSections(source.text) : [];
  const selectedContext = sections[sectionIndex] ?? "";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <p className="mb-2 text-sm font-medium text-sky-400">Read less. Ask more.</p>
          <h1 className="text-3xl font-semibold">Talk to a Document</h1>
          <p className="mt-3 text-slate-300">Upload a PDF or share a captioned YouTube video, then explore it through voice or text.</p>
        </header>

        <details className="rounded-xl border border-slate-700 p-3">
          <summary className="text-sm text-slate-300">Demo access code</summary>
          <label htmlFor="access-code" className="mt-3 block text-sm">For hosted demos, enter the code shared by the owner.</label>
          <input id="access-code" type="password" autoComplete="off" placeholder="Not needed for local development unless configured"
            onChange={(event) => sessionStorage.setItem("demo-access-code", event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm" />
        </details>

        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <div className="flex gap-2" aria-label="Source type">
            {(["pdf", "youtube"] as const).map((value) => (
              <button key={value} disabled={loading} aria-pressed={mode === value} onClick={() => changeSource(value)}
                className={`flex-1 rounded-xl px-3 py-3 font-medium ${mode === value ? "bg-sky-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}>
                {value === "pdf" ? "PDF document" : "YouTube video"}
              </button>
            ))}
          </div>
          <form onSubmit={ingest} className="space-y-4">
            {mode === "pdf" ? <>
              <label htmlFor="pdf" className="block text-sm">PDF up to 25 MB. Text-based documents supported; scans need OCR.</label>
              <input key="pdf-upload" id="pdf" type="file" accept=".pdf,application/pdf" disabled={loading}
                onChange={(event) => { setFile(event.target.files?.[0] ?? null); setSource(null); setError(""); }}
                className="block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-3 file:text-white" />
            </> : <>
              <label htmlFor="youtube" className="block text-sm">Public YouTube video URL with captions</label>
              <input key="youtube-url" id="youtube" type="url" required value={url} disabled={loading} placeholder="https://www.youtube.com/watch?v=…"
                onChange={(event) => { setUrl(event.target.value); setSource(null); setError(""); }}
                className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3" />
              <p className="text-xs leading-5 text-slate-400">Caption availability varies. If direct retrieval fails, this app can try a backup service. Loading a video may share its ID with SerpApi.</p>
            </>}
            <button disabled={loading || (mode === "pdf" ? !file : !url.trim())}
              className="w-full rounded-xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40">
              {loading ? "Loading source…" : mode === "pdf" ? "Extract text" : "Load captions"}
            </button>
            <p role="status" className="text-sm text-slate-300">{loading ? "Preparing your source. Please wait." : ""}</p>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          </form>
        </section>

        {source && <>
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h2 className="break-words text-lg font-semibold">{source.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{source.pages ? `${source.pages} pages · ` : ""}{source.characters.toLocaleString()} characters</p>
            {source.demoForcedFallback && <p className="mt-2 text-xs text-amber-300">Demo: direct caption retrieval was deliberately failed. Backup retrieval is real.</p>}
            {source.provider && <p className="mt-2 text-xs text-slate-400">Captions retrieved via {source.provider}{source.fallbackUsed ? " (backup service)" : ""}.</p>}
            {source.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-sky-300">Open original video ↗</a>}
            <details className="mt-4">
              <summary className="font-medium text-sky-300">Preview extracted text</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 font-sans text-sm leading-6">{source.text}</pre>
            </details>
            <p className="mt-4 text-xs leading-5 text-slate-400">Starting chat sends the extracted text to OpenAI. Your source and conversations are not saved by this app and clear on reload.</p>
          </section>
          {sections.length > 1 && <section className="space-y-3 rounded-xl border border-amber-700 p-4">
            <label htmlFor="context-section" className="block font-medium">Choose a section to discuss</label>
            <p className="text-sm text-slate-300">This source is larger than the voice context budget. The full preview is above. Chat answers use only your selected section; changing sections starts new conversations.</p>
            <select id="context-section" value={sectionIndex} onChange={(event) => setSectionIndex(Number(event.target.value))} className="w-full rounded-lg bg-slate-800 p-3">
              {sections.map((part, index) => <option key={index} value={index}>Section {index + 1} of {sections.length} · {part.length.toLocaleString()} characters</option>)}
            </select>
            <details><summary className="text-sm text-sky-300">Preview selected section</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm">{selectedContext}</pre></details>
          </section>}
          <VoiceChat key={`voice-${source.id}-${sectionIndex}`} sourceText={selectedContext} />
          <DocumentChat key={`text-${source.id}-${sectionIndex}`} sourceText={selectedContext} />
        </>}
        <footer className="pb-6 text-xs text-slate-500">AI answers may contain mistakes. Verify important details against the source.</footer>
      </div>
    </main>
  );
}
