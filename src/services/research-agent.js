import { config } from "../config.js";
import { preview } from "../lib/text.js";
import { generateAnswer, rerank } from "./gemini.js";
import { searchChunks } from "./vector-store.js";

function candidatesFrom(matches) {
  return matches.filter((match) => match.metadata?.text).map((match) => ({
    fileName: String(match.metadata.fileName), documentId: String(match.metadata.documentId), type: String(match.metadata.type), page: Number(match.metadata.page || 1), text: String(match.metadata.text), score: Number(match.score || 0)
  }));
}

function parsePlan(raw, topic) {
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === "string" && item.length > 5).slice(0, 4);
  } catch { /* fall back to one focused retrieval */ }
  return [topic];
}

export async function runResearchAgent({ namespace, topic }) {
  const plannerPrompt = `You are a research-planning agent. Break this research request into 2 to 4 focused evidence-seeking questions. Return only a JSON array of strings.\n\nRequest: ${topic}`;
  const plan = parsePlan(await generateAnswer(plannerPrompt), topic);
  const investigations = [];
  const selectedSources = [];

  for (const question of plan) {
    const candidates = candidatesFrom(await searchChunks(namespace, question));
    const strongestScore = candidates[0]?.score || 0;
    if (!candidates.length || strongestScore < config.retrievalThreshold) {
      investigations.push({ question, status: "insufficient", sources: [] });
      continue;
    }
    const evidence = (await rerank(question, candidates)).slice(0, 2);
    investigations.push({ question, status: "supported", sources: evidence.map((source) => ({ ...source, preview: preview(source.text) })) });
    selectedSources.push(...evidence);
  }

  const uniqueSources = selectedSources.filter((source, index, sources) => sources.findIndex((item) => item.documentId === source.documentId && item.page === source.page && item.text === source.text) === index)
    .map((source, index) => ({ ...source, number: index + 1, preview: preview(source.text) }));
  if (!uniqueSources.length) return { plan: investigations, report: "I don't know based on the uploaded documents. None of the planned research questions had sufficiently strong evidence.", sources: [], lowConfidence: true };

  const evidence = uniqueSources.map((source) => `[${source.number}] ${source.fileName}, page ${source.page}\n${source.text}`).join("\n\n");
  const reportPrompt = `You are a document research agent. Answer the research request using only the evidence below. Structure your response with: Executive summary, Key findings, Evidence gaps, and Recommended next steps. Cite every factual claim with [source number]. Clearly state when the evidence is incomplete.\n\nResearch request: ${topic}\n\nEvidence:\n${evidence}`;
  return { plan: investigations, report: await generateAnswer(reportPrompt), sources: uniqueSources, lowConfidence: investigations.some((item) => item.status === "insufficient") };
}
