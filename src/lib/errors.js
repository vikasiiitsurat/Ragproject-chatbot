export function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

export function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}
