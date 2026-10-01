import express from "express";
import path from "node:path";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { config } from "./config.js";
import { documentsV2Router } from "./routes/documents-v2.js";
import { chatV2Router } from "./routes/chat-v2.js";
import { authRouter } from "./routes/auth.js";
import { researchRouter } from "./routes/research.js";
import { requireAuth } from "./middleware/auth.js";

export const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }), authRouter);
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));
app.use("/api/documents", requireAuth, documentsV2Router);
app.use("/api/chat", requireAuth, chatV2Router);
app.use("/api/research", requireAuth, researchRouter);
app.get("/", (_request, response) => response.sendFile(path.join(config.publicDir, "workspace.html")));
app.use(express.static(config.publicDir));
app.use((error, _request, response, _next) => {
  const status = error.status || (error.name === "MulterError" ? 400 : 500);
  if (status >= 500) console.error(error);
  response.status(status).json({ error: error.message || "Something went wrong." });
});
