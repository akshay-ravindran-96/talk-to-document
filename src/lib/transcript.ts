// Server configuration only; never accept this switch from a browser request.
export function forceYoutubeFallback(environment: string | undefined, flag: string | undefined) {
  return environment === "development" && flag === "true";
}

type Attempt = { provider: "youtube-transcript" | "serpapi"; outcome: "success" | "failed"; durationMs: number };
export class TranscriptError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; this.name = "TranscriptError"; }
}

export async function retrieveTranscript(options: {
  id: string;
  primary: (signal: AbortSignal) => Promise<string>;
  apiKey?: string;
  fetcher?: typeof fetch;
}) {
  const attempts: Attempt[] = [];
  async function attempt(provider: Attempt["provider"], run: () => Promise<string>) {
    const started = Date.now();
    try {
      const text = (await run()).trim();
      if (!text) throw new TranscriptError("empty_transcript");
      attempts.push({ provider, outcome: "success", durationMs: Date.now() - started });
      return text;
    } catch {
      attempts.push({ provider, outcome: "failed", durationMs: Date.now() - started });
      return null;
    }
  }
  // One deadline shared across every HTTP request made by the primary library.
  const primary = await attempt("youtube-transcript", () => options.primary(AbortSignal.timeout(12_000)));
  if (primary !== null) return { text: primary, provider: "youtube-transcript", fallbackUsed: false, attempts };
  if (!options.apiKey?.trim()) throw new TranscriptError("fallback_not_configured");
  const fallback = await attempt("serpapi", async () => {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "youtube_video_transcript");
    url.searchParams.set("v", options.id);
    url.searchParams.set("api_key", options.apiKey!.trim());
    const response = await (options.fetcher ?? fetch)(url, {
      signal: AbortSignal.timeout(20_000), cache: "no-store", redirect: "error",
    });
    if (!response.ok) throw new TranscriptError("provider_http_error");
    const data = await response.json();
    if (data.error || data.search_metadata?.status === "Error" || !Array.isArray(data.transcript)) {
      throw new TranscriptError("provider_invalid_response");
    }
    // Reject malformed rows rather than quietly returning a partial transcript.
    if (data.transcript.some((row: unknown) => !row || typeof row !== "object" || !("snippet" in row) || typeof row.snippet !== "string")) {
      throw new TranscriptError("provider_invalid_response");
    }
    return data.transcript.map((row: { snippet: string }) => row.snippet.trim()).filter(Boolean).join("\n");
  });
  if (fallback !== null) return { text: fallback, provider: "serpapi", fallbackUsed: true, attempts };
  throw new TranscriptError("all_providers_failed");
}
