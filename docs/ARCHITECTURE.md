# Architecture

## Request flow

```text
Browser dashboard -> Express route -> service -> Gemini / Pinecone -> response
```

`src/routes` contains HTTP handling, `src/services` owns application logic, `src/repositories/postgres.js` handles PostgreSQL data access, and `src/lib` holds shared helpers.

## Ingestion flow

1. A file or public URL is submitted from the dashboard.
2. `extractors.js` reads text from the source.
3. `ingestion.js` creates sentence-aware chunks.
4. `vector-store.js` embeds chunks with Gemini and upserts them to Pinecone.
5. The dashboard document record becomes `ready` or `failed`.

## Question-answering flow

1. Gemini embeds the question.
2. Pinecone returns the 15 closest chunks in the active workspace namespace.
3. Weak matches return a grounded `I don't know` response.
4. Gemini reranks the remaining candidates to five strong excerpts.
5. Gemini generates an answer from only those excerpts and adds citations.

## Data ownership

- `uploads/` contains original files for source links.
- `data/documents.json` and `data/conversations.json` contain local runtime records.
- Pinecone contains embeddings and retrieval metadata.
- `.env`, runtime data, and uploads are excluded from Git.
