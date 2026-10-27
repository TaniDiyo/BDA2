const { rateLimit } = require("express-rate-limit");

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_req, res) {
      return res.status(429).json({ error: message });
    }
  });
}

const generalLimiter = createRateLimiter({
  windowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: positiveInteger(process.env.RATE_LIMIT_MAX, 100),
  message: "Too many requests. Please try again later."
});

const authLimiter = createRateLimiter({
  windowMs: positiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: positiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 10),
  message: "Too many authentication attempts. Please try again later."
});

module.exports = { createRateLimiter, generalLimiter, authLimiter };
