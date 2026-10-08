# Render deployment

Use a Node **Web Service**, because this app requires backend routes. Reference:
https://render.com/docs/deploy-nextjs-app and https://render.com/docs/node-version.
Do not use the static-site option.

## Publish the source repository

Create a public GitHub repository. Put the contents of this project at its root
(package.json should be at the top level). Commit the supplied source, lockfile,
tests, docs, .env.example and .github workflow. Exclude .env.local, node_modules,
.next and ZIP archives. Inspect the staged filenames before pushing. Repository
creation/upload and CI execution have not been done from this environment.

## Configure Render

Create a Web Service connected to that repository and choose its main branch.

| Setting | Value |
| --- | --- |
| Runtime / language | Node |
| Root directory | Empty when package.json is at repository root |
| Build command | npm ci && npm run build |
| Start command | npm start -- --hostname 0.0.0.0 --port $PORT |
| Health check path | / |
| NODE_VERSION | 24.19.0 (local verification version) |
| OPENAI_API_KEY | Your permanent key, entered privately |
| SERPAPI_API_KEY | Your fallback key, entered privately (optional) |
| DEMO_ACCESS_CODE | A long private demo code, shared separately |
| OPENAI_TEXT_MODEL | gpt-4.1-mini |
| OPENAI_REALTIME_MODEL | gpt-realtime-2.1 |
| DEMO_FORCE_YOUTUBE_FALLBACK | false |

Choose the instance plan in your account after reviewing its cost and available
memory. No paid resource is provisioned by these files. Budget protection in this
app is process-local; keep one instance for the assessment and inspect usage.

## Verify on the actual host

1. Check build logs and open the HTTPS URL. Enter the demo code.
2. Upload a small PDF and verify the last page in the preview.
3. Test a real near-25-MiB PDF and record upload time and extraction result. Local
   success does not establish host/proxy support or available-memory sufficiency.
4. Load a captioned video. Note whether direct retrieval or SerpApi supplied it.
   The assessment allows a local video demo if cloud retrieval is blocked.
5. On an actual phone: permit microphone use, ask a question, interrupt, follow up,
   stop, restart, and test both short and long network outages while silent.
6. Confirm incorrect access code rejects API requests. Record secret names only,
   with values masked; do not expose ephemeral credentials in the video either.
7. Fill SUBMISSION.md with actual URLs and evidence; record a 10–15 minute video.

A healthy home page only proves the web server responds. It does not verify API
keys, audio, caption provider availability, or large uploads. Redeploy after code
changes, and restart/redeploy after changing environment variables as appropriate.
