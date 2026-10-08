# Small source-grounding evaluation

Upload tests/fixtures/orion-pilot.pdf, an original synthetic two-page source.
Ask these questions by text; repeat several by voice. Record the observed answer
and compare it with the reference. This is a manual evaluation, not a claimed pass.

| Question | Expected content |
| --- | --- |
| When does the pilot begin? | 2 November 2026 |
| What is the budget? | CAD 12,000 |
| Who owns it? | Maya Chen |
| How long does it last? | Six weeks |
| What languages are supported initially? | English |
| Are scanned PDFs in scope? | No; OCR is outside pilot scope |
| What are the two success targets? | 95% task completion, median answer latency under two seconds |
| Where will it be deployed? | Not chosen; no region invented |
| What is Maya's email? | Source does not provide it |
| Does completing the pilot automatically authorize public launch? | No; approval is required after evaluation |

Score each answer 0 or 1 for correctness and source support. For the two missing
information questions, also record whether the model abstained appropriately.
Record completion and latency separately. Do not equate fluent output with a
correct answer. Include a question referencing the second page to verify extraction
covers the end. This small fixture cannot establish broad model reliability.

Voice: ask for the two targets, interrupt with "Just give me the first target",
then ask "And the other one?". Verify both interruption and follow-up context.
