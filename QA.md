# Verification checklist

Record actual results, browser/device, and date. Do not mark untested items passed.

## Source ingestion
- Text PDF: check first/middle/last pages against original, page count and preview collapse.
- Empty file, renamed non-PDF, corrupted PDF, scanned PDF and password-protected PDF: useful failures.
- Valid PDF near 25 MiB and >25 MiB rejection locally AND on hosted service.
- YouTube: actual public captioned video retrieval locally, then hosted retrieval or documented blocking.
- Supported watch, short, shorts and embed URLs; invalid URL and unavailable video.
- Switching sources during a voice session stops microphone and resets chats.

## AI and voice
- Supported question, synthesis question, follow-up, and missing-information abstention.
- Document containing instructions: assistant should not obey embedded commands.
- Start, microphone denial, no microphone, audio autoplay fallback.
- Speak, hear answer, live user/assistant transcript.
- Interrupt answer, mute/unmute, stop, restart; check microphone indicator.
- Long response: inspect response.done status/status_details; confirm cutoff notice if incomplete.
- Offline/poor network: useful error, no lost source, manual retry/restart.
- Verify denied access code blocks API calls; permanent key absent from browser bundle/network.

## Layout and packaging
- Chrome DevTools at 390 px: no horizontal overflow, reachable controls and readable text.
- Actual phone over hosted HTTPS: microphone and output audio work.
- npm ci in a fresh directory; typecheck, tests, lint, build, production start.
- README and .env.example correct; no credentials in repository/archive.
- Capture demo URL and run all required deployed PDF checks.

## Results from this review
- PASS: TypeScript check, ESLint, production build.
- PASS: two URL-validation test groups.
- PASS: production PDF route with supplied assessment PDF (5 pages), access-code rejection, invalid URL rejection.
- PASS: live YouTube retrieval for https://youtu.be/dQw4w9WgXcQ in this environment. This is one observed success, not a guarantee for all videos/hosts.
- NOT RUN: live OpenAI requests (candidate key was intentionally absent), microphone, mobile browser QA, near-25-MiB hosted upload, deployment, fresh-machine npm ci.
- Previous user reports confirm initial local PDF, text, and voice paths, but updated code needs regression verification.

## SerpApi fallback verification

Seven automated tests pass, including direct success avoiding paid requests, fallback recovery, missing key, HTTP 401/429, provider JSON errors, malformed/empty responses and network/timeout failures. Typecheck, lint and production build pass. Live SerpApi retrieval has not been run: requires the owner’s key.

Controlled fallback demo: nine automated tests pass; demo flag is ignored in production/test environments. Typecheck, lint and production build pass. Live SerpApi and visual browser verification still require local testing.

## Mobile and network review — latest pass

Code fixes: independent setup and reconnection deadlines; stale data-channel open
and audio callbacks guarded during cleanup; microphone errors explained; incomplete
responses distinguished from confirmed output-token limits; voice transcript wraps
long strings; audio control can shrink to narrow container width.

Checks passed: nine unit tests, typecheck, lint, production build. Production-mode
loopback checks passed PDF extraction (five-page assessment), missing-code 401,
invalid YouTube host 400, and live direct YouTube retrieval 200. These are local
production-mode checks, not hosted deployment checks. Browser installation failed;
mobile layout, live voice and poor-network behavior remain unverified.

### Manual pass on candidate machine

Use Chrome DevTools device toolbar at 390 px width. Repeat the core workflow on
an actual phone over a hosted HTTPS URL when available. Device emulation does not
prove mobile microphone permission or audio playback.

| Test | Expected outcome |
| --- | --- |
| PDF + video load and preview | Readable text, no horizontal page scrolling |
| Start voice, ask a question, follow up | Audible answer and live transcript; follow-up uses session context |
| Interrupt while assistant speaks | Audio stops and assistant responds to the new question |
| Mute then speak | No new microphone input; unmute restores it |
| Stop during connection and during speech | Session closes; microphone indicator clears; restart works |
| Deny microphone permission | Clear guidance; text chat still works |
| Disconnect network during active voice | Interruption status; recovery or clear reconnect guidance |
| Slow network during setup | Setup times out after 45 seconds and releases microphone |
| Text request fails while offline | Question stays available for retry |
| Change source during active voice | Old session stops; new chat uses new source |
| Start/stop repeatedly | No duplicate audio or retained microphone capture |

For ingestion/text fetches, DevTools Network throttling can help. WebRTC media may
not follow HTTP throttling; disable the device connection to test real voice loss.
Record observed outcomes and console errors without exposing credential values.

## Explicit network recovery UI

Browser offline/online events now update network availability. An interrupted
voice session gets a 10-second grace period. Online alone does not confirm voice
recovery: incoming session events or WebRTC connection restoration clear the
recovery deadline. Lost sessions show a reconnect action, disabled while offline,
and explain the new conversation/reset. Stop releases resources and clears retry
state. PDF and YouTube inputs use separate React keys to avoid controlled-input
warnings. Live Wi-Fi loss, real-phone audio and recovery checks remain pending.

## V7 regression pass

- 20 unit tests pass (recovery deadlines/probing, stop/late microphone cleanup,
  content-preserving sections, streamed-byte caps, concurrency/rate limits, and
  previous transcript tests).
- Production integration checks pass with generated PDFs: valid extraction;
  empty/fake/corrupt/no-text rejection; near-25-MiB valid file; oversized file and
  whole-request rejection; all route access gates; mocked OpenAI chat/session
  wiring; context validation; token no-store and request budget.
- Typecheck, lint and build checked. Live provider/voice, phone, host and CI are
  separate pending checks in SUBMISSION.md. Docker execution is unverified.
- PDF selection resets when changing source type. Same-source tab clicks do not
  reset a loaded source. Long sources use explicit selected-section context.

A clean online npm ci succeeded, followed by the full unit/lint/typecheck/build/integration pass. This is a clean dependency install in this environment, not a separate-machine or host test.
