export type MeetingDocumentReadResult = { text: string; warnings: string[] };

const MAX_PARSE_BYTES = 10 * 1024 * 1024;

function extension(name: string): string { return name.toLowerCase().split(".").pop() ?? ""; }
function assertSafeSize(file: File): void {
  if (file.size <= 0) throw new Error("The meeting document is empty.");
  if (file.size > MAX_PARSE_BYTES) throw new Error("The meeting document is too large to parse safely.");
}
function decodeEntities(value: string): string {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}
function xmlText(xml: string): string {
  return decodeEntities(xml.replace(/<w:tab\s*\/>|<text:tab[^>]*\/>/gi, " ").replace(/<w:br\s*\/>|<text:line-break[^>]*\/>/gi, "\n").replace(/<\/w:p>|<\/text:(?:p|h)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function utf8(bytes: Uint8Array): string { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
function findZipText(bytes: Uint8Array, entryName: string): string {
  // DOCX/ODT are ZIP containers. This dependency-free reader accepts stored (method 0)
  // XML entries and fails safely for compressed entries rather than executing content.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 30 < bytes.length;) {
    if (view.getUint32(offset, true) !== 0x04034b50) { offset += 1; continue; }
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = utf8(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    if (name === entryName) {
      if (method !== 0) throw new Error("This document uses compressed XML that this browser cannot safely extract. Enter the meeting details manually.");
      return utf8(bytes.subarray(dataStart, dataStart + compressedSize));
    }
    offset = dataStart + compressedSize;
  }
  throw new Error("This document is malformed or missing its main content.");
}
function extractPdfText(bytes: Uint8Array): string {
  const source = new TextDecoder("latin1").decode(bytes);
  if (/\/Encrypt\b/.test(source)) throw new Error("Password-protected or encrypted PDFs cannot be parsed.");
  const chunks: string[] = [];
  for (const stream of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const body = stream[1];
    if (/\/FlateDecode|\/LZWDecode|\/DCTDecode|\/JPXDecode/.test(source.slice(Math.max(0, stream.index! - 300), stream.index))) continue;
    for (const match of body.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[(.*?)\]\s*TJ/gs)) {
      const segment = match[0];
      for (const literal of segment.matchAll(/\(((?:\\.|[^\\)])*)\)/g)) chunks.push(literal[1].replace(/\\([\\()])/g, "$1").replace(/\\n/g, "\n"));
    }
  }
  const text = chunks.join(" ").replace(/\s+/g, " ").trim();
  if (!text) throw new Error("This PDF contains no safely extractable text. It may be scanned or compressed; enter the meeting details manually.");
  return text;
}

export function isParseableMeetingDocument(fileName: string, mimeType: string): boolean {
  const ext = extension(fileName);
  return mimeType === "application/pdf" || mimeType.includes("wordprocessingml") || mimeType.includes("opendocument.text") || mimeType.startsWith("text/") || ["pdf", "docx", "odt", "txt", "md", "html", "htm"].includes(ext);
}

export async function readMeetingDocument(file: File): Promise<MeetingDocumentReadResult> {
  assertSafeSize(file);
  const ext = extension(file.name);
  if (file.type.startsWith("text/") || ["txt", "md", "html", "htm"].includes(ext)) {
    const text = (await file.text()).trim();
    if (!text) throw new Error("The meeting document is empty.");
    return { text, warnings: [] };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf" || ext === "pdf") return { text: extractPdfText(bytes), warnings: [] };
  if (file.type.includes("wordprocessingml") || ext === "docx") return { text: xmlText(findZipText(bytes, "word/document.xml")), warnings: [] };
  if (file.type.includes("opendocument.text") || ext === "odt") return { text: xmlText(findZipText(bytes, "content.xml")), warnings: [] };
  throw new Error("This document type can be attached but cannot be parsed. Enter the meeting details manually.");
}
