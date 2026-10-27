function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  return next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body must be 10kb or smaller." });
  }
  if (error instanceof SyntaxError && Object.hasOwn(error, "body")) {
    return res.status(400).json({ error: "Request body contains invalid JSON." });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: error.message || "An account with this email already exists." });
  }
  if (
    error.name === "MongoServerSelectionError" ||
    error.name === "MongooseServerSelectionError"
  ) {
    return res.status(503).json({ error: "Database unavailable. Check the MongoDB connection." });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) {
    console.error(`[http] ${req.method} ${req.path} failed (${error.name || "Error"}).`);
  }
  return res.status(status).json({ error: status < 500 ? error.message : "An unexpected server error occurred." });
}

module.exports = { notFound, errorHandler };
