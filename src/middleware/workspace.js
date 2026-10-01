import { namespaceFor } from "../config.js";
import { createWorkspace, getWorkspace } from "../repositories/postgres.js";

export async function resolveWorkspace(request, _response, next) {
  try {
    const slug = namespaceFor(request.method === "GET" || request.method === "DELETE" ? request.query.namespace : request.body.namespace);
    request.workspace = (await getWorkspace(request.user.id, slug)) || await createWorkspace(request.user.id, slug);
    next();
  } catch (error) { next(error); }
}
