# Submission evidence

Fill in observed results before submitting. Do not label pending tests as passed.

- Public application URL: **Pending**
- Public GitHub repository: **Pending**
- 10–15 minute video walkthrough URL: **Pending**
- Demo access code: share separately with reviewer

## Evidence checklist

| Check | Evidence required | Current state |
| --- | --- | --- |
| Build and unit tests | CI run link on public repo | Local pass; CI not run |
| PDF ingestion | Hosted HTTPS upload, preview includes last page | Local server pass; hosted pending |
| Maximum upload | Actual valid near-25-MiB PDF on host | Local server pass; hosted pending |
| YouTube | Recorded URL ingestion and preview | Prior local success; final live check pending |
| Paid fallback | Real SerpApi success with labelled forced failure | Pending owner key |
| Mobile voice | Real phone model/browser, spoken question, audible answer, live transcript | Pending |
| Interruption | Speak over assistant, then follow up naturally | Pending |
| Short outage | Disconnect/reconnect while silent; session restored | Pending |
| Long outage | Microphone released and manual reconnect explained | Pending |
| Security | Masked host secret names, browser request inspection, denied access | Local route gate pass; hosted pending |
| Answer quality | Source-backed facts and absent-information questions | Pending live evaluation |

## Record live results

For each check record: date, source, phone/browser, expected outcome, observed outcome,
pass/fail, and a timestamp in the walkthrough or screenshot reference. Never record
permanent keys or ephemeral credential values.

## Architecture talking points

- Server extraction; browser previews the full source. WebRTC carries voice directly
  to OpenAI; the server supplies an ephemeral session credential.
- Caption provider fallback attempts one paid request only after direct failure.
- A no-op session update produces an incoming acknowledgement after reconnection;
  browser online alone is not treated as proof of service availability.
- Long sources use explicit user-selected sections, preserving full text in preview.
  This enables sectional exploration, not whole-document cross-section reasoning.
- Single-process budgets and concurrency caps protect the demo. Multiple replicas
  would need shared limits. At larger scale, measure extraction load before moving
  parsing to workers, and measure repeat requests before adding a transcript cache.
