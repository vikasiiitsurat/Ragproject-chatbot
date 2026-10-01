import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

export async function embed(texts, taskType) {
  const result = await ai.models.embedContent({ model: config.embeddingModel, contents: texts, config: { taskType, outputDimensionality: config.embeddingDimension } });
  const vectors = result.embeddings.map((embedding) => embedding.values);
  if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== config.embeddingDimension)) throw new Error(`Expected ${config.embeddingDimension}-dimension embeddings. Check index configuration.`);
  return vectors;
}

export async function generateAnswer(prompt) {
  const result = await ai.models.generateContent({ model: config.chatModel, contents: prompt });
  return result.text || "I couldn't generate an answer.";
}

export async function rerank(question, candidates) {
  const excerpts = candidates.map((candidate, index) => `${index + 1}. ${candidate.text}`).join("\n\n");
  const prompt = `You are a retrieval reranker. Select at most 5 excerpts that best answer the question. Return only a JSON array of excerpt numbers in strongest-to-weakest order. Do not answer the question.\n\nQuestion: ${question}\n\nExcerpts:\n${excerpts}`;
  try {
    const ids = JSON.parse((await generateAnswer(prompt)).replace(/```json|```/g, "").trim());
    if (!Array.isArray(ids)) return candidates.slice(0, 5);
    const selected = ids.map((id) => candidates[Number(id) - 1]).filter(Boolean).filter((item, index, items) => items.indexOf(item) === index).slice(0, 5);
    return selected.length ? selected : candidates.slice(0, 5);
  } catch { return candidates.slice(0, 5); }
}
