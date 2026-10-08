export const VOICE_CONTEXT_CHARS = 60_000;
// Explicit user-selected sections; no summarization, retrieval or omitted source text.
export function contextSections(text: string, limit = VOICE_CONTEXT_CHARS): string[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid context limit");
  const sections: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + limit, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end - 1);
      if (boundary > start + limit / 2) end = boundary + 1;
      // Keep surrogate pairs together; a section must not corrupt Unicode.
      const code = text.charCodeAt(end - 1);
      if (code >= 0xd800 && code <= 0xdbff && limit > 1) end--;
    }
    sections.push(text.slice(start, end));
    start = end;
  }
  return sections;
}
