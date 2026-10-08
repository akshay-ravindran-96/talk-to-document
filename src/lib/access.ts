import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export function accessError(request: Request): NextResponse | null {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Set DEMO_ACCESS_CODE on the server before hosting this demo." }, { status: 503 });
    return null;
  }
  const supplied = request.headers.get("x-demo-access-code") ?? "";
  const a = Buffer.from(code), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Enter the demo access code at the top of the page." }, { status: 401 });
  return null;
}
