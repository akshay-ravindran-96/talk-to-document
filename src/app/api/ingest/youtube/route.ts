import { NextResponse } from "next/server";
import { fetchTranscript } from "youtube-transcript";
import { youtubeId } from "@/lib/youtube";
import { retrieveTranscript, TranscriptError, forceYoutubeFallback } from "@/lib/transcript";
import { protectedRoute } from "@/lib/protected-route";
import { limitedJson, RequestBodyError } from "@/lib/request-body";

async function handle(request: Request) {
  let id: string;
  try {
    const body = await limitedJson(request, 4096);
    if (typeof body?.url !== "string") throw new Error("Enter a YouTube URL.");
    id = youtubeId(body.url);
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid URL." }, { status: 400 });
  }
  const demoForcedFallback = forceYoutubeFallback(process.env.NODE_ENV, process.env.DEMO_FORCE_YOUTUBE_FALLBACK);
  try {
    const result = await retrieveTranscript({
      id,
      apiKey: process.env.SERPAPI_API_KEY,
      primary: async (signal) => {
        if (demoForcedFallback) throw new TranscriptError("demo_simulated_primary_failure");
        const transcript = await fetchTranscript(id, {
          fetch: (input, init) => fetch(input, { ...init, signal }),
        });
        return transcript.map((item) => item.text.trim()).filter(Boolean).join("\n");
      },
    });
    const { text, provider, fallbackUsed, attempts } = result;
    console.info("YouTube transcript retrieval", { provider, fallbackUsed, demoForcedFallback, attempts });
    if (text.length > 250_000) return NextResponse.json({ error: "This transcript is too large for this demo." }, { status: 413 });
    return NextResponse.json({ name: `YouTube video ${id}`, text, characters: text.length, sourceUrl: `https://www.youtube.com/watch?v=${id}`, kind: "youtube", provider, fallbackUsed, demoForcedFallback, attempts, id: crypto.randomUUID() });
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    console.error("YouTube ingestion failed:", error instanceof TranscriptError ? error.code : "UnknownError");
    return NextResponse.json({ error: "Captions could not be retrieved. Try a public captioned video. The transcript providers may be unavailable or the video may not have accessible captions." }, { status: 422 });
  }
}

export const POST = protectedRoute("youtube", handle);
