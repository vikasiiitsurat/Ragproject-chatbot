import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { asyncRoute, badRequest } from "../lib/errors.js";
import { createUser, findUserByEmail } from "../repositories/postgres.js";
import { requireAuth, signAccessToken } from "../middleware/auth.js";

const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
export const authRouter = Router();

authRouter.post("/register", asyncRoute(async (request, response) => {
  const parsed = credentials.safeParse(request.body);
  if (!parsed.success) throw badRequest("Use a valid email and a password of at least 8 characters.");
  if (await findUserByEmail(parsed.data.email)) throw badRequest("An account already exists for this email.");
  const user = await createUser(parsed.data.email, await bcrypt.hash(parsed.data.password, 12));
  response.status(201).json({ user, accessToken: signAccessToken(user), workspace: "pdf-rag" });
}));

authRouter.post("/login", asyncRoute(async (request, response) => {
  const parsed = credentials.safeParse(request.body);
  if (!parsed.success) throw badRequest("Invalid email or password.");
  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    const error = new Error("Invalid email or password."); error.status = 401; throw error;
  }
  response.json({ user: { id: user.id, email: user.email }, accessToken: signAccessToken(user), workspace: "pdf-rag" });
}));

authRouter.get("/me", requireAuth, (request, response) => response.json({ user: request.user }));
