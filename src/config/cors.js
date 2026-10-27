const cors = require("cors");

const defaultDevelopmentOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173"
];

function parseAllowedOrigins(value = "") {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin === "*" ? origin : new URL(origin).origin);
}

function getAllowedOrigins() {
  const configuredOrigins = process.env.CLIENT_URL;
  const origins = configuredOrigins
    ? parseAllowedOrigins(configuredOrigins)
    : process.env.NODE_ENV === "production"
      ? []
      : defaultDevelopmentOrigins;

  if (process.env.NODE_ENV === "production" && origins.includes("*")) {
    throw new Error("CLIENT_URL must not contain a wildcard in production.");
  }
  return origins;
}

const allowedOrigins = getAllowedOrigins();

module.exports = cors({
  origin(origin, callback) {
    let normalizedOrigin = origin;
    try {
      if (origin) normalizedOrigin = new URL(origin).origin;
    } catch {
      return callback(null, false);
    }
    if (!origin || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  optionsSuccessStatus: 204
});
