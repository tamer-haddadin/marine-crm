// Import direct implementation to avoid pdf-parse debug mode requiring test assets
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function parsePDF(
  buffer: Buffer,
  mimeType: string | undefined,
  originalName: string | undefined,
): Promise<string> {
  const extension = originalName?.toLowerCase() ?? "";
  const isPdf =
    mimeType === "application/pdf" ||
    extension.endsWith(".pdf");

  if (!isPdf) {
    return buffer.toString("utf8");
  }

  const parsed = await pdfParse(buffer);
  return parsed.text;
}

