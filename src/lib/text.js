const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

export function chunkText(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const tentativeEnd = Math.min(start + CHUNK_SIZE, normalized.length);
    let end = tentativeEnd;
    if (tentativeEnd < normalized.length) {
      const candidate = normalized.slice(start, tentativeEnd);
      const sentenceEnd = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "));
      if (sentenceEnd > CHUNK_SIZE * 0.55) end = start + sentenceEnd + 1;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 30) chunks.push(chunk);
    if (end === normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

export function preview(text, length = 280) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= length ? compact : `${compact.slice(0, length).trimEnd()}...`;
}

export function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "document";
}
