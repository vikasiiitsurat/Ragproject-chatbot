import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findUserById } from "../repositories/postgres.js";

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export async function requireAuth(request, _response, next) {
  try {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Authentication required.");
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user) throw new Error("User not found.");
    request.user = user;
    next();
  } catch (error) {
    error.status = 401;
    next(error);
  }
}
