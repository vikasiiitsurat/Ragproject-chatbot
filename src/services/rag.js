import { config } from "../config.js";
import { preview } from "../lib/text.js";
import { generateAnswer, rerank } from "./gemini.js";
import { searchChunks } from "./vector-store.js";

export async function answerQuestion({ namespace, question, history }) {
  const candidates = (await searchChunks(namespace, question)).filter((match) => match.metadata?.text).map((match) => ({ fileName: String(match.metadata.fileName), documentId: String(match.metadata.documentId), type: String(match.metadata.type), page: Number(match.metadata.page || 1), text: String(match.metadata.text), score: Number(match.score || 0) }));
  if (!candidates.length || candidates[0].score < config.retrievalThreshold) return { answer: "I don't know based on the uploaded documents. Try rephrasing the question or upload a more relevant document.", sources: [], lowConfidence: true };
  const sources = (await rerank(question, candidates)).map((source, index) => ({ ...source, number: index + 1, preview: preview(source.text) }));
  const previousTurns = history.slice(-6).map((message) => `${message.role.toUpperCase()}: ${message.text}`).join("\n");
  const context = sources.map((source) => `[${source.number}] ${source.fileName}, page ${source.page}\n${source.text}`).join("\n\n");
  const prompt = `Answer only from the retrieved document excerpts. If they do not support an answer, say "I don't know based on the uploaded documents." Cite factual claims with [source number].\n\nConversation history:\n${previousTurns || "(new conversation)"}\n\nRetrieved excerpts:\n${context}\n\nQuestion: ${question}`;
  return { answer: await generateAnswer(prompt), sources, lowConfidence: false };
}
