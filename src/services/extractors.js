import path from "node:path";
import mammoth from "mammoth";
import { load } from "cheerio";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { badRequest } from "../lib/errors.js";

export const supportedExtensions = new Set([".pdf", ".docx", ".txt", ".csv"]);

function documentType(name) {
  const extension = path.extname(name).toLowerCase();
  if (!supportedExtensions.has(extension)) throw badRequest("Supported files are PDF, DOCX, TXT, and CSV.");
  return extension.slice(1);
}

async function extractPdf(buffer) {
  if (!buffer.subarray(0, 4).equals(Buffer.from("%PDF"))) throw badRequest("The uploaded PDF is not a valid PDF file.");
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const content = await (await pdf.getPage(page)).getTextContent();
    pages.push({ page, text: content.items.map((item) => item.str).join(" ") });
  }
  await pdf.destroy();
  return pages;
}

function extractCsv(buffer) {
  const lines = buffer.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((value) => value.trim());
  const text = lines.slice(1).map((line, index) => {
    const values = line.split(",");
    return `Row ${index + 1}: ${values.map((value, column) => `${headers[column] || `column ${column + 1}`}: ${value.trim()}`).join("; ")}`;
  }).join("\n");
  return [{ page: 1, text }];
}

export async function extractFile(file) {
  const type = documentType(file.originalname);
  if (type === "pdf") return { type, pages: await extractPdf(file.buffer) };
  if (type === "docx") {
    if (!file.buffer.subarray(0, 2).equals(Buffer.from("PK"))) throw badRequest("The uploaded DOCX file is invalid.");
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { type, pages: [{ page: 1, text: result.value }] };
  }
  if (type === "csv") return { type, pages: extractCsv(file.buffer) };
  return { type, pages: [{ page: 1, text: file.buffer.toString("utf8") }] };
}

export async function extractUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw badRequest("Enter a valid public http(s) URL."); }
  if (!/^https?:$/.test(url.protocol)) throw badRequest("Only http and https URLs are supported.");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw badRequest("Local URLs cannot be indexed.");
  const result = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12_000) });
  if (!result.ok) throw badRequest(`Could not fetch URL (HTTP ${result.status}).`);
  if (Number(result.headers.get("content-length") || 0) > 2_000_000) throw badRequest("The web page is too large to index.");
  const html = await result.text();
  if (html.length > 2_000_000) throw badRequest("The web page is too large to index.");
  const $ = load(html);
  $("script, style, nav, footer, header, noscript").remove();
  return { name: ($("title").first().text().trim() || url.hostname).slice(0, 160), type: "url", sourceUrl: url.toString(), pages: [{ page: 1, text: $("main, article, body").first().text() }] };
}
