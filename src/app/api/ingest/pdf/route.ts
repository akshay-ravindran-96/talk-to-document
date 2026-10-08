import { protectedRoute } from "@/lib/protected-route";
import { limitedBody, RequestBodyError } from "@/lib/request-body";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { NextResponse } from "next/server";



const MAX_BYTES = 25 * 1024 * 1024;

async function handle(request: Request) {
  let parser: PDFParse | undefined;

  try {
    const bytes = await limitedBody(request, MAX_BYTES + 1024 * 1024);
    const form = await new Response(bytes as BodyInit, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a PDF file." },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Choose a non-empty PDF no larger than 25 MB." },
        { status: 400 },
      );
    }

    const data = new Uint8Array(await file.arrayBuffer());

    // Check the file contents rather than trusting its filename.
    const header = new TextDecoder().decode(data.slice(0, 1024));

    if (!header.includes("%PDF-")) {
      return NextResponse.json(
        { error: "This file does not appear to be a PDF." },
        { status: 400 },
      );
    }

    parser = new PDFParse({ data });
    const result = await parser.getText();

    // Use page text so generated page separators do not count as content.
    const text = result.pages
      .map((page) => page.text.trim())
      .filter(Boolean)
      .join("\n\n");

    if (!text) {
      return NextResponse.json(
        {
          error:
            "No readable text was found. This may be a scanned PDF that needs OCR.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      name: file.name,
      kind: "pdf",
      id: crypto.randomUUID(),
      text,
      pages: result.total,
      characters: text.length,
    });
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    console.error(
      "PDF extraction failed:",
      error instanceof Error ? error.name : "UnknownError",
    );

    return NextResponse.json(
      {
        error:
          "Could not read this PDF. It may be damaged or password-protected.",
      },
      { status: 422 },
    );
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {
        console.error("PDF parser cleanup failed.");
      });
    }
  }
}
export const POST = protectedRoute("pdf", handle);
