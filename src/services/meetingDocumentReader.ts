import mammoth from "mammoth";
import { unzipSync, strFromU8 } from "fflate";

export type MeetingDocumentReadResult = {
  text: string;
  warnings: string[];
};

const MAX_PARSE_BYTES = 10 * 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ODT = "application/vnd.oasis.opendocument.text";

function extension(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

function assertSafeSize(file: File): void {
  if (file.size <= 0) throw new Error("The meeting document is empty.");
  if (file.size > MAX_PARSE_BYTES) throw new Error("The meeting document is too large to parse safely.");
}

function xmlText(xml: string): string {
  return xml
    .replace(/<text:(?:line-break|tab)[^>]*\/>/gi, "\n")
    .replace(/<\/text:(?:p|h)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readPdf(file: File): Promise<MeetingDocumentReadResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let document;
  try {
    document = await pdfjs.getDocument({ data: bytes, disableWorker: true, isEvalSupported: false, useSystemFonts: false }).promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/password/i.test(message)) throw new Error("Password-protected or encrypted PDFs cannot be parsed.");
    throw new Error("This PDF is corrupt or cannot be parsed safely.");
  }
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" ").trim());
  }
  const text = pages.filter(Boolean).join("\n\n").trim();
  if (!text) throw new Error("This PDF contains no extractable text. Enter the meeting details manually.");
  return { text, warnings: [] };
}

async function readDocx(file: File): Promise<MeetingDocumentReadResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = result.value.trim();
    if (!text) throw new Error("This Word document contains no extractable text.");
    return { text, warnings: result.messages.map((message) => message.message).filter(Boolean) };
  } catch (error) {
    if (error instanceof Error && /no extractable/i.test(error.message)) throw error;
    throw new Error("This Word document is malformed or cannot be parsed safely.");
  }
}

async function readOdt(file: File): Promise<MeetingDocumentReadResult> {
  try {
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const content = archive["content.xml"];
    if (!content) throw new Error("Missing content.xml");
    const text = xmlText(strFromU8(content));
    if (!text) throw new Error("This OpenDocument file contains no extractable text.");
    return { text, warnings: [] };
  } catch (error) {
    if (error instanceof Error && /no extractable/i.test(error.message)) throw error;
    throw new Error("This OpenDocument file is malformed or cannot be parsed safely.");
  }
}

export function isParseableMeetingDocument(fileName: string, mimeType: string): boolean {
  const ext = extension(fileName);
  return mimeType === "application/pdf" || mimeType === DOCX || mimeType === ODT
    || mimeType.startsWith("text/") || ["pdf", "docx", "odt", "txt", "md", "html", "htm"].includes(ext);
}

export async function readMeetingDocument(file: File): Promise<MeetingDocumentReadResult> {
  assertSafeSize(file);
  const ext = extension(file.name);
  if (file.type === "application/pdf" || ext === "pdf") return readPdf(file);
  if (file.type === DOCX || ext === "docx") return readDocx(file);
  if (file.type === ODT || ext === "odt") return readOdt(file);
  if (file.type.startsWith("text/") || ["txt", "md", "html", "htm"].includes(ext)) {
    const text = (await file.text()).trim();
    if (!text) throw new Error("The meeting document is empty.");
    return { text, warnings: [] };
  }
  throw new Error("This document type can be attached but cannot be parsed. Enter the meeting details manually.");
}
