# 10–15 minute walkthrough

1. Customer problem (1 minute): understand an unfamiliar source using natural follow-ups.
2. PDF (2 minutes): upload, inspect extracted text, ask by text, ask unsupported question.
3. Voice (3 minutes): start, speak, interrupt, follow-up, transcript, mute/stop.
4. YouTube (2 minutes): URL ingestion and conversation; local demo and explain cloud blocking if needed.
5. Mobile / resilience (2 minutes): 390 px view, invalid input, denied mic or failed request, retry.
6. Architecture / judgment (3 minutes): server secrets, ephemeral tokens, WebRTC, extraction, prompt grounding, explicit context limits, cleanup and tests.
7. Close (1 minute): measured outcomes, observed limitations, future work; explain AI assistance and what you personally reviewed.

Show a real end-to-end flow before code. Never claim a test passed without evidence. Text and voice history are separate in this version.

## Controlled fallback demo (local development)

1. Add `DEMO_FORCE_YOUTUBE_FALLBACK="true"` and your `SERPAPI_API_KEY` to `.env.local`.
2. Restart `npm run dev` and load a public captioned video.
3. The source preview labels the simulated primary failure. The backup call is real.
   In Network > /api/ingest/youtube > Response, show `provider: "serpapi"`,
   `fallbackUsed: true`, `demoForcedFallback: true`, and attempt timings.
4. Ask a question to show the recovered transcript works with chat.
5. Remove the SerpApi key temporarily and restart to show a clear failure message.
6. Restore the key, set the demo flag to `false`, and restart for normal operation.

The flag is server-only, requires exactly `true`, and applies only to `npm run dev`.
It is ignored by `npm start` and production deployments. No query parameter or
browser request can activate it. Simulated recovery is not evidence of a measured
production reliability improvement. SerpApi requests may consume account credits.
