import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";

const documentFields = `id, workspace_id AS "workspaceId", name, type, local_file_name AS "localFileName", source_url AS "sourceUrl", status, chunk_count AS "chunkCount", page_count AS "pageCount", error, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function createUser(email, passwordHash) {
  const user = { id: crypto.randomUUID(), email: email.toLowerCase(), passwordHash };
  await withTransaction(async (client) => {
    await client.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [user.id, user.email, user.passwordHash]);
    await client.query("INSERT INTO workspaces (id, user_id, slug) VALUES ($1, $2, $3)", [crypto.randomUUID(), user.id, "pdf-rag"]);
  });
  return { id: user.id, email: user.email };
}

export async function findUserByEmail(email) {
  const result = await query("SELECT id, email, password_hash AS \"passwordHash\" FROM users WHERE email = $1", [email.toLowerCase()]);
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await query("SELECT id, email FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function getWorkspace(userId, slug) {
  const result = await query("SELECT id, slug FROM workspaces WHERE user_id = $1 AND slug = $2", [userId, slug]);
  return result.rows[0] || null;
}

export async function createWorkspace(userId, slug) {
  const result = await query("INSERT INTO workspaces (id, user_id, slug) VALUES ($1, $2, $3) ON CONFLICT (user_id, slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id, slug", [crypto.randomUUID(), userId, slug]);
  return result.rows[0];
}

export async function listDocuments(workspaceId) {
  const result = await query(`SELECT ${documentFields} FROM documents WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]);
  return result.rows;
}

export async function getDocument(id, workspaceId) {
  const result = await query(`SELECT ${documentFields} FROM documents WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
  return result.rows[0] || null;
}

export async function createDocument(document) {
  const result = await query(`INSERT INTO documents (id, workspace_id, name, type, local_file_name, source_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${documentFields}`, [document.id, document.workspaceId, document.name, document.type, document.localFileName, document.sourceUrl, document.status]);
  return result.rows[0];
}

export async function updateDocument(id, workspaceId, changes) {
  const fields = Object.entries(changes);
  const columns = { status: "status", type: "type", chunkCount: "chunk_count", pageCount: "page_count", error: "error" };
  const values = fields.map(([, value]) => value);
  const sets = fields.map(([key], index) => `${columns[key]} = $${index + 1}`).join(", ");
  const result = await query(`UPDATE documents SET ${sets}, updated_at = NOW() WHERE id = $${values.length + 1} AND workspace_id = $${values.length + 2} RETURNING ${documentFields}`, [...values, id, workspaceId]);
  return result.rows[0] || null;
}

export async function deleteDocument(id, workspaceId) {
  const result = await query(`DELETE FROM documents WHERE id = $1 AND workspace_id = $2 RETURNING ${documentFields}`, [id, workspaceId]);
  return result.rows[0] || null;
}

export async function createJob(documentId) {
  const id = crypto.randomUUID();
  await query("INSERT INTO ingestion_jobs (id, document_id, status) VALUES ($1, $2, 'queued')", [id, documentId]);
  return id;
}

export async function updateJob(id, status, error = null) {
  await query("UPDATE ingestion_jobs SET status = $1, attempts = attempts + 1, error = $2, updated_at = NOW() WHERE id = $3", [status, error, id]);
}

export async function listConversations(workspaceId) {
  const result = await query("SELECT id, title, created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM conversations WHERE workspace_id = $1 ORDER BY updated_at DESC", [workspaceId]);
  return result.rows;
}

export async function getConversation(id, workspaceId) {
  const conversation = await query("SELECT id, title, created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM conversations WHERE id = $1 AND workspace_id = $2", [id, workspaceId]);
  if (!conversation.rows[0]) return null;
  const messages = await query("SELECT id, role, text, sources, low_confidence AS \"lowConfidence\", created_at AS \"createdAt\" FROM messages WHERE conversation_id = $1 ORDER BY created_at", [id]);
  return { ...conversation.rows[0], messages: messages.rows };
}

export async function createConversation(workspaceId, title) {
  const id = crypto.randomUUID();
  await query("INSERT INTO conversations (id, workspace_id, title) VALUES ($1, $2, $3)", [id, workspaceId, title]);
  return getConversation(id, workspaceId);
}

export async function appendMessages(conversationId, workspaceId, messages) {
  await withTransaction(async (client) => {
    for (const message of messages) await client.query("INSERT INTO messages (id, conversation_id, role, text, sources, low_confidence) VALUES ($1,$2,$3,$4,$5,$6)", [crypto.randomUUID(), conversationId, message.role, message.text, JSON.stringify(message.sources || null), Boolean(message.lowConfidence)]);
    await client.query("UPDATE conversations SET updated_at = NOW() WHERE id = $1 AND workspace_id = $2", [conversationId, workspaceId]);
  });
  return getConversation(conversationId, workspaceId);
}
