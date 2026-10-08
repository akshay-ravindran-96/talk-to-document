export class RequestBodyError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
// Count actual streamed bytes, including requests without Content-Length.
export async function limitedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    await request.body?.cancel().catch(() => {});
    throw new RequestBodyError("Request is too large.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError("Request body is missing.", 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const deadline = AbortSignal.timeout(30_000);
  const onTimeout = () => { void reader.cancel().catch(() => {}); };
  deadline.addEventListener("abort", onTimeout, { once: true });
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (deadline.aborted) throw new RequestBodyError("Upload timed out. Please retry.", 408);
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    deadline.removeEventListener("abort", onTimeout);
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export async function limitedJson(request: Request, maxBytes = 1024 * 1024) {
  return JSON.parse(new TextDecoder().decode(await limitedBody(request, maxBytes)));
}
