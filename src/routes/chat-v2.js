import { Router } from "express";
import { asyncRoute, badRequest, notFound } from "../lib/errors.js";
import { resolveWorkspace } from "../middleware/workspace.js";
import { appendMessages, createConversation, getConversation, getDocument, listConversations } from "../repositories/postgres.js";
import { answerQuestion } from "../services/rag.js";

export const chatV2Router = Router();
chatV2Router.use(resolveWorkspace);
chatV2Router.get("/conversations", asyncRoute(async (request, response) => response.json({ conversations: await listConversations(request.workspace.id) })));
chatV2Router.get("/conversations/:id", asyncRoute(async (request, response) => { const conversation = await getConversation(request.params.id, request.workspace.id); if (!conversation) throw notFound("Conversation not found."); response.json({ conversation }); }));
chatV2Router.post("/ask", asyncRoute(async (request, response) => {
  const question = request.body.question?.trim(); if (!question) throw badRequest("Enter a question.");
  let conversation = request.body.conversationId ? await getConversation(request.body.conversationId, request.workspace.id) : await createConversation(request.workspace.id, question.slice(0, 70));
  if (!conversation) throw notFound("Conversation not found.");
  const result = await answerQuestion({ namespace: request.workspace.slug, question, history: conversation.messages });
  result.sources = await Promise.all(result.sources.map(async (source) => { const document = await getDocument(source.documentId, request.workspace.id); return { ...source, fileUrl: document?.localFileName ? `/api/documents/${document.id}/file?namespace=${request.workspace.slug}` : null, sourceUrl: document?.sourceUrl }; }));
  conversation = await appendMessages(conversation.id, request.workspace.id, [{ role: "user", text: question }, { role: "assistant", text: result.answer, sources: result.sources, lowConfidence: result.lowConfidence }]);
  response.json({ conversationId: conversation.id, answer: result.answer, sources: result.sources, lowConfidence: result.lowConfidence, messages: conversation.messages });
}));
