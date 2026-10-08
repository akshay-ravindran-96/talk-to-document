# Talk to a Document

A mobile-first assessment application: extract text from PDFs or captioned YouTube videos, then ask questions by text or live voice. Uses Next.js App Router, React, TypeScript, server-side pdf-parse, and OpenAI Responses / Realtime WebRTC.

## Start on your Mac

1. Use Node.js 24 LTS (`node --version`).
2. Open this folder in VS Code. In its terminal run `npm ci`.
3. Copy `.env.example` to `.env.local`. Add your OpenAI API key privately. Never commit it.
4. For development you can leave `DEMO_ACCESS_CODE` empty. If set, enter it under Demo access code on the page.
5. Run `npm run dev`; open the localhost URL printed by Next.js.

No database, Redis, Docker, YouTube account or YouTube API key is required. OpenAI calls require API billing/credit. Secrets remain in server routes; voice gets only a short-lived token.

## Checks

```
npm run typecheck
npm test
npm run lint
npm run build
npm start
```

`npm start` uses production mode and REQUIRES `DEMO_ACCESS_CODE`; enter that code on the page. Automated tests cover transcript fallback behavior and YouTube URL validation and reject lookalike hosts, embedded credentials, insecure protocols, and malformed video IDs. They do not prove live caption retrieval. See QA.md for integration and browser checks.

## Deployment (Node server)

See DEPLOYMENT.md for the selected Render setup and verification steps.

Use a Node.js web-service host with Node 24, HTTPS, and request bodies large enough for 25 MB PDFs plus multipart overhead. A conventional Node server avoids common serverless body-size ceilings. Do not claim 25 MB hosted support until tested on the chosen host.

- Push to your own GitHub repository, excluding `.env.local`, `node_modules`, `.next`.
- Build command: `npm ci && npm run build`.
- Start command: `npm start -- --hostname 0.0.0.0 --port $PORT` (set PORT if your host does not).
- Set server environment variables `OPENAI_API_KEY`, `DEMO_ACCESS_CODE`, `OPENAI_TEXT_MODEL`, `OPENAI_REALTIME_MODEL` from `.env.example`.
- Share the demo URL and access code separately with reviewers.
- Verify deployed PDF upload and browser voice over HTTPS, including the upper size limit.

The access code gates ingestion and paid API endpoints. It is a simple assessment control, not a replacement for per-user authentication or distributed rate limiting. Per-operation process-local request and concurrency limits now apply; persistent per-user authentication and shared multi-replica limits remain future work. Do not disable the code gate on a public deployment.

## Architecture

- `src/app/page.tsx`: source selection, preview, loading/error states.
- `/api/ingest/pdf`: multipart upload, size/header validation, server-side text extraction, parser cleanup.
- `/api/ingest/youtube`: strict YouTube URL-to-ID validation and server-side caption retrieval.
- `/api/chat`: source and text history sent to OpenAI Responses API; secret stays on server.
- `/api/realtime/token`: source-conditioned Realtime configuration, short-lived client token.
- `VoiceChat`: WebRTC microphone and remote audio tracks; data channel transcript and lifecycle events; stop/unmount releases microphone, connection and pending setup.
- `src/lib/access.ts`: shared server access-code gate.

State is browser memory. Source selection resets both chats and releases active voice resources. Text and voice history are currently separate; each voice start creates a new session. Uploaded PDFs are not written to disk by the app. Full extracted source is sent to OpenAI only when a chat starts. Responses API requests use `store: false`; that does not mean OpenAI has no provider-side retention. Document instructions are treated as untrusted data; this is a prompt-level mitigation, not a guarantee.

## YouTube limitation

`youtube-transcript` uses unofficial caption endpoints. YouTube can block cloud-provider IPs; unavailable captions, private videos and endpoint changes can also cause failure. We return a clear failure instead of fabricated captions. Test actual retrieval locally with a public captioned video and record that demo if the hosted route is blocked, as permitted by the assessment. Automated URL tests and fixture tests are not evidence of successful live retrieval. There is no silent transcript-paste fallback presented as URL ingestion.

## Scope and tradeoffs

- PDF upload limit: 25 MiB; scanned/image-only and password-protected PDFs do not have OCR/decryption support.
- Voice context budget: 60,000 characters; backend text budget: 100,000. Larger sources remain fully previewable and can be explored through user-selected sections of up to 60,000 characters. Both chats use the selected section. Switching sections resets conversations; cross-section reasoning is not supported. Character budgets are conservative application limits, not exact model token counts.
- Voice output cap raised to 2,048 tokens to reduce cutoffs. UI reports incomplete and failed responses separately from cancellation. This change does not establish the cause of the earlier cutoff; inspect response events during QA.
- Transcript text may include generated words not actually heard before an interruption. Transcription can lag and may differ from the audio; generated transcript is not a verbatim guarantee.
- Source prompts favor concise, supported answers and abstention. No retrieval or citations are required in the assessment. Long sources are divided into explicit user-selected sections; no automatic retrieval or summary is claimed.
- No persistent accounts or conversation database. Simple components favor maintainability and reviewability.
- System fonts remove a network dependency at build time.

## AI assistance disclosure

ChatGPT assisted with initial scaffolding and explaining React/Next.js, integrating ingestion and OpenAI APIs, debugging folder/configuration issues, and generating code/docs/test cases. The candidate should review every change, run the live checks, explain tradeoffs, and record observed limitations before submission.

## Submission

Public GitHub repo, publicly hosted app, and 10–15 minute video walkthrough. Use DEMO.md, QA.md and SUBMISSION.md. Hosting and live YouTube/audio checks remain to be completed on the candidate's machine/account; do not submit as fully validated until these pass.

## Optional SerpApi fallback

Add `SERPAPI_API_KEY="your-key"` to `.env.local` and restart `npm run dev`.
Get a key from your SerpApi account dashboard. Leave it empty to disable the fallback.
Do not use a NEXT_PUBLIC prefix or commit `.env.local`. Add the same secret to your
hosting environment and redeploy for production. No new npm dependency is needed.

Direct youtube-transcript retrieval runs first with a shared 12-second deadline.
If it fails or returns empty text, SerpApi gets one attempt with a 20-second deadline.
Successful direct retrieval and oversized transcripts never trigger a paid fallback.
SerpApi errors, invalid responses and empty captions produce a clear 422 response;
raw provider errors, request URLs and credentials are never logged by this app.
SerpApi receives the video ID and may retain provider-side search records. Its default
cache remains enabled; our server fetch bypasses Next.js caching. There is no app-level
cache, retry loop, distributed rate limiter or guaranteed recovery for captionless videos.

The ingestion response includes `provider`, `fallbackUsed` and `attempts` (outcome and
milliseconds); successful ingestion also writes those fields to the server console.
These timings are request latency, not billing records. Use the SerpApi dashboard for
actual usage/cost. Process-local issuance and request budgets now limit request bursts. These are not
a monetary spending cap or a distributed limiter. Mock tests verify control flow; a real fallback call still needs your key.

For a live check: load a public captioned URL, inspect `/api/ingest/youtube` in the
browser Network panel, and note the provider. A direct success should not consume a
SerpApi request. To validate the paid provider independently, use the SerpApi playground
with the same video ID. Then test a video whose direct retrieval fails from your hosted
app; expect `provider: "serpapi"` and `fallbackUsed: true` if recovery succeeds.

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

## New regression and production checks

Run `npm test`, `npm run lint`, `npm run build`, `npm run typecheck`, then
`npm run test:integration`. Integration tests start an isolated local production
server on port 3198, generate their own PDFs, and use mock OpenAI responses; they
need no keys or API credits. They exercise real extraction, near-25-MiB input,
invalid/no-text inputs, route access gates, request byte limits, and session/chat
wiring. Mock provider success is not evidence of live OpenAI functionality.
The GitHub workflow runs these commands once the repo is published.

### Demo resource budgets (per Node process)

| Operation | Requests/minute | Concurrent requests |
| --- | ---: | ---: |
| PDF | 12 | 2 |
| YouTube | 20 | 4 |
| Text chat | 30 | 4 |
| Voice token issuance | 6 | 2 |

Requests rejected for authorization do not consume these buckets. Authorized
invalid requests do. Limits are shared by demo users and return 429 or busy 503
with Retry-After. Request bodies are counted while streaming, including absent
Content-Length: PDF multipart maximum is 26 MiB, JSON chat/token maximum 1 MiB,
YouTube JSON maximum 4 KiB. Body reading has a 30-second deadline. The PDF file
itself remains capped at 25 MiB. Limits reset on process restart; each replica has
its own budget. They bound ingestion/request pressure, not total Realtime audio
cost: an issued voice session communicates directly with OpenAI.
Host/proxy byte/time limits must also be configured and tested. PDF extraction
currently runs within the Node process; pathological parsing needs further
isolation before broad public use.

### Voice recovery

After a browser/network interruption, a 10-second grace period is allowed. On
network return or WebRTC reconnection, a no-op `session.update` is sent through
the data channel; an incoming valid server event establishes recovery even while
the user is silent. Five seconds are allowed for acknowledgement. Failure closes
the microphone and offers a new session. Reconnect resets voice history. Browser
online events and connection states remain signals, not guarantees: verify on a
real phone and real network. This checks session reachability, not audio quality.

### Container deployment option

The Dockerfile uses Node 24 and runs as an unprivileged user. Build with
`docker build -t talk-to-document .` and run with `docker run --rm -p 3000:3000
--env-file .env.local talk-to-document`. Production requires a demo access code.
No local environment files enter the image build context. Set secrets at runtime
through your host. The container has not been built in this environment.
