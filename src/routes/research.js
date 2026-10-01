import { Router } from "express";
import { asyncRoute, badRequest } from "../lib/errors.js";
import { resolveWorkspace } from "../middleware/workspace.js";
import { getDocument } from "../repositories/postgres.js";
import { runResearchAgent } from "../services/research-agent.js";

export const researchRouter = Router();
researchRouter.use(resolveWorkspace);
researchRouter.post("/run", asyncRoute(async (request, response) => {
  const topic = request.body.topic?.trim();
  if (!topic || topic.length < 10) throw badRequest("Describe a research question using at least 10 characters.");
  const result = await runResearchAgent({ namespace: request.workspace.slug, topic });
  result.sources = await Promise.all(result.sources.map(async (source) => {
    const document = await getDocument(source.documentId, request.workspace.id);
    return { ...source, fileUrl: document?.localFileName ? `/api/documents/${document.id}/file?namespace=${request.workspace.slug}` : null, sourceUrl: document?.sourceUrl };
  }));
  response.json(result);
}));
