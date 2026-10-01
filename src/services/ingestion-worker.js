import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { chunkText } from "../lib/text.js";
import { getDocument, updateDocument, updateJob } from "../repositories/postgres.js";
import { extractFile, extractUrl } from "./extractors.js";
import { upsertChunks } from "./vector-store.js";

function chunksFromPages(pages) { return pages.flatMap(({ page, text }) => chunkText(text).map((chunk, chunkIndex) => ({ page, chunkIndex, text: chunk }))); }

export async function processQueuedDocument({ documentId, workspaceId, namespace, jobId }) {
  await updateJob(jobId, "processing");
  await updateDocument(documentId, workspaceId, { status: "processing", error: null });
  try {
    const document = await getDocument(documentId, workspaceId);
    if (!document) throw new Error("Document no longer exists.");
    const extracted = document.sourceUrl
      ? await extractUrl(document.sourceUrl)
      : await extractFile({ originalname: document.name, buffer: await readFile(path.join(config.uploadDir, document.localFileName)) });
    const chunks = chunksFromPages(extracted.pages);
    if (!chunks.length) throw new Error("No readable text was found in this source.");
    await upsertChunks(namespace, { ...document, type: extracted.type }, chunks);
    await updateDocument(documentId, workspaceId, { status: "ready", type: extracted.type, chunkCount: chunks.length, pageCount: extracted.pages.length, error: null });
    await updateJob(jobId, "completed");
  } catch (error) {
    await updateDocument(documentId, workspaceId, { status: "failed", error: error.message });
    await updateJob(jobId, "failed", error.message);
  }
}
