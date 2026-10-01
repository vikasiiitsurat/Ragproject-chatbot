# Architecture

## Request flow

```text
Browser dashboard -> Express route -> service -> Gemini / Pinecone -> response
```

`src/routes` contains HTTP handling, `src/services` owns application logic, `src/repositories/postgres.js` handles PostgreSQL data access, and `src/lib` holds shared helpers.

## Ingestion flow

1. A file or public URL is submitted from the dashboard.
2. `documents-v2.js` creates a PostgreSQL document and ingestion-job record, then queues the work.
3. `ingestion-worker.js` calls `extractors.js`, creates sentence-aware chunks, and uses `vector-store.js` to embed and upsert them.
4. PostgreSQL records the final `ready` or `failed` status and chunk count.

## Question-answering flow

1. Gemini embeds the question.
2. Pinecone returns the 15 closest chunks in the active workspace namespace.
3. Weak matches return a grounded `I don't know` response.
4. Gemini reranks the remaining candidates to five strong excerpts.
5. Gemini generates an answer from only those excerpts and adds citations.

## Research-agent flow

1. The user enters a broad research topic in the guided Research Agent workspace.
2. `research-agent.js` asks Gemini to produce two to four focused, evidence-seeking sub-questions.
3. Each sub-question independently retrieves up to 15 Pinecone chunks and applies the same relevance threshold and Gemini reranking.
4. The agent records unsupported questions as evidence gaps instead of inferring an answer.
5. Gemini writes a structured, source-numbered report only from the selected evidence. The dashboard renders the report, research trail, and clickable originals.

## Data ownership

- `uploads/` contains original files for source links.
- PostgreSQL contains users, workspace ownership, document/job state, conversations, and messages.
- Pinecone contains embeddings and retrieval metadata.
- `.env`, runtime data, and uploads are excluded from Git.
