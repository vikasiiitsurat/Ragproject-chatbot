import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = ["GEMINI_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX", "DATABASE_URL", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);

export const config = Object.freeze({
  port: Number(process.env.PORT || 3000),
  projectRoot,
  publicDir: path.join(projectRoot, "public"),
  uploadDir: path.join(projectRoot, "uploads"),
  dataDir: path.join(projectRoot, "data"),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  geminiApiKey: process.env.GEMINI_API_KEY,
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeIndex: process.env.PINECONE_INDEX,
  defaultNamespace: process.env.PINECONE_NAMESPACE || "pdf-rag",
  chatModel: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  embeddingDimension: Number(process.env.EMBEDDING_DIMENSION || 3072),
  retrievalThreshold: Number(process.env.RETRIEVAL_THRESHOLD || 0.55),
  uploadLimitBytes: 10 * 1024 * 1024
});

export function namespaceFor(value) {
  const namespace = (value || config.defaultNamespace).trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(namespace)) {
    const error = new Error("Namespace may contain only letters, numbers, underscores, and hyphens.");
    error.status = 400;
    throw error;
  }
  return namespace;
}
