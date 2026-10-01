import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { asyncRoute, badRequest, notFound } from "../lib/errors.js";
import { safeFileName } from "../lib/text.js";
import { resolveWorkspace } from "../middleware/workspace.js";
import { createDocument, createJob, deleteDocument, getDocument, listDocuments } from "../repositories/postgres.js";
import { enqueueIngestion } from "../jobs/ingestion-queue.js";
import { deleteDocumentVectors } from "../services/vector-store.js";
import { supportedExtensions } from "../services/extractors.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.uploadLimitBytes, files: 5 } });
export const documentsV2Router = Router();
documentsV2Router.use(resolveWorkspace);
const view = (document) => ({ ...document, fileUrl: document.localFileName ? `/api/documents/${document.id}/file` : document.sourceUrl });

async function persistFile(id, file) {
  await mkdir(config.uploadDir, { recursive: true });
  const ext = path.extname(file.originalname).toLowerCase();
  if (!supportedExtensions.has(ext)) throw badRequest("Supported files are PDF, DOCX, TXT, and CSV.");
  const stored = `${id}-${safeFileName(path.basename(file.originalname, ext))}${ext}`;
  await writeFile(path.join(config.uploadDir, stored), file.buffer);
  return { stored, type: ext.slice(1) };
}

documentsV2Router.get("/", asyncRoute(async (request, response) => response.json({ documents: (await listDocuments(request.workspace.id)).map(view) })));
documentsV2Router.post("/upload", upload.array("files", 5), asyncRoute(async (request, response) => {
  if (!request.files?.length) throw badRequest("Choose at least one file.");
  const documents = [];
  for (const file of request.files) {
    const id = crypto.randomUUID();
    const saved = await persistFile(id, file);
    const document = await createDocument({ id, workspaceId: request.workspace.id, name: safeFileName(file.originalname), type: saved.type, localFileName: saved.stored, sourceUrl: null, status: "queued" });
    const jobId = await createJob(id);
    enqueueIngestion({ documentId: id, workspaceId: request.workspace.id, namespace: request.workspace.slug, jobId });
    documents.push(view(document));
  }
  response.status(202).json({ documents });
}));
documentsV2Router.post("/url", asyncRoute(async (request, response) => {
  if (!request.body.url) throw badRequest("Enter a URL.");
  let url; try { url = new URL(request.body.url); } catch { throw badRequest("Enter a valid public URL."); }
  if (!/^https?:$/.test(url.protocol)) throw badRequest("Only http and https URLs are supported.");
  const id = crypto.randomUUID();
  const document = await createDocument({ id, workspaceId: request.workspace.id, name: url.hostname, type: "url", localFileName: null, sourceUrl: url.toString(), status: "queued" });
  const jobId = await createJob(id);
  enqueueIngestion({ documentId: id, workspaceId: request.workspace.id, namespace: request.workspace.slug, jobId });
  response.status(202).json({ document: view(document) });
}));
documentsV2Router.get("/:id/file", asyncRoute(async (request, response) => {
  const document = await getDocument(request.params.id, request.workspace.id);
  if (!document?.localFileName) throw notFound("Document not found.");
  response.sendFile(path.join(config.uploadDir, document.localFileName));
}));
documentsV2Router.delete("/:id", asyncRoute(async (request, response) => {
  const document = await getDocument(request.params.id, request.workspace.id);
  if (!document) throw notFound("Document not found.");
  await deleteDocumentVectors(request.workspace.slug, document.id);
  if (document.localFileName) await unlink(path.join(config.uploadDir, document.localFileName)).catch((error) => { if (error.code !== "ENOENT") throw error; });
  await deleteDocument(document.id, request.workspace.id);
  response.status(204).end();
}));
