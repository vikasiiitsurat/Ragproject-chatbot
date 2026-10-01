import { Pinecone } from "@pinecone-database/pinecone";
import { config } from "../config.js";
import { embed } from "./gemini.js";

const pinecone = new Pinecone({ apiKey: config.pineconeApiKey });
const index = pinecone.index(config.pineconeIndex);
const BATCH_SIZE = 40;

export async function upsertChunks(namespace, document, chunks) {
  const target = index.namespace(namespace);
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const vectors = await embed(batch.map((chunk) => chunk.text), "RETRIEVAL_DOCUMENT");
    await target.upsert(vectors.map((values, position) => ({ id: `${document.id}-${batch[position].chunkIndex}`, values, metadata: { documentId: document.id, fileName: document.name, type: document.type, page: batch[position].page, text: batch[position].text } })));
  }
}

export async function searchChunks(namespace, question) {
  const [vector] = await embed([question], "RETRIEVAL_QUERY");
  return (await index.namespace(namespace).query({ vector, topK: 15, includeMetadata: true })).matches || [];
}

export async function deleteDocumentVectors(namespace, documentId) {
  // Pinecone's Node SDK receives the metadata filter itself, not a { filter: ... } wrapper.
  await index.namespace(namespace).deleteMany({ documentId: { $eq: documentId } });
}
