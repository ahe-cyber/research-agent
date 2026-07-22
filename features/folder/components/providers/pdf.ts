import { withBasePath } from "@/lib/basePath";
import type { PdfParseResult } from "../../folder.schema";

let workerConfigured = false;

// Client
export async function parsePdf(file: File): Promise<PdfParseResult> {
  const pdfjs = await import("pdfjs-dist");

  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = withBasePath("/pdf.worker.min.mjs");
    workerConfigured = true;
  }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: { page: number; text: string }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ page: i, text });
  }

  const fullText = pages.map((p) => p.text).join("\n\n");

  return {
    type: "pdf",
    fileName: file.name,
    pageCount: pdf.numPages,
    pages,
    fullText,
  };
}
