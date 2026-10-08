export async function readJson(response: Response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`The server returned an unexpected response (${response.status}). Please try again.`);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}
export function accessHeaders(): Record<string, string> {
  return { "x-demo-access-code": sessionStorage.getItem("demo-access-code") ?? "" };
}
