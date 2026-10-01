# Document RAG Workspace

A JavaScript RAG application for asking grounded questions about PDFs, DOCX, TXT, CSV files, and public web pages.

Gemini handles embeddings, reranking, and answer generation. Pinecone provides vector search, while PostgreSQL stores users, workspaces, documents, jobs, conversations, and messages.

## Research agent

Alongside quick document chat, the workspace includes a guided **Document Research Agent** for broad questions. It breaks a request into a small set of evidence-seeking sub-questions, retrieves and reranks chunks for each question, marks weak evidence explicitly, and writes a structured report with numbered, clickable sources. The report is grounded only in indexed workspace documents; it responds with an honest "I don't know" when no sufficiently relevant evidence is found.

## Quick start

1. Use Node.js 20 or later.
2. Copy `.env.example` to `.env` and add newly rotated Gemini and Pinecone credentials.
3. Confirm the Pinecone index uses 3072 dimensions and cosine similarity for `gemini-embedding-001`.
4. Run:

   ```powershell
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Database and worker

Run `npm run db:migrate` once after creating a PostgreSQL database and setting `DATABASE_URL`.

Uploads return immediately with a `queued` state. An in-process worker processes up to two ingestion jobs concurrently. This is intentional for a single-instance deployment without Redis; use a durable queue before horizontally scaling the app.

## Quality checks

```powershell
npm run check
npm test
```

GitHub Actions runs these checks on every push and pull request.

## Project layout

```text
src/
  config.js             Application configuration
  app.js                Express setup
  server.js             Server entry point
  routes/               HTTP endpoints
  services/             Extraction, ingestion, retrieval, reranking, LLM calls
  repositories/         PostgreSQL data access
  lib/                  Shared helpers
public/
  workspace.html        Active dashboard page
  professional.css      Core dashboard styles
  agent.css             Research-agent workspace styles
  workspace.js          Dashboard logic
docs/
  ARCHITECTURE.md       Request and retrieval flow
uploads/                Uploaded sources, ignored by Git
data/                   Runtime records, ignored by Git
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for implementation details.
