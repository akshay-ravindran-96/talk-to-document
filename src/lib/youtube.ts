export function youtubeId(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Enter a complete YouTube URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Use an HTTPS YouTube URL.");
  let id: string | null = null;
  if (url.hostname === "youtu.be") id = url.pathname.split("/")[1];
  else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (/^\/(shorts|embed|live)\//.test(url.pathname)) id = url.pathname.split("/")[2];
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error("Enter a valid YouTube video URL.");
  return id;
}
