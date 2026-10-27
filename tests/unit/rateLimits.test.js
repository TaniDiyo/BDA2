const express = require("express");
const request = require("supertest");
const { createRateLimiter } = require("../../src/middleware/rateLimits");
const { start } = require("../../server");

describe("request rate limiter", () => {
  test("limits requests and returns a clear JSON error", async () => {
    const app = express();
    app.use(createRateLimiter({
      windowMs: 60_000,
      max: 2,
      message: "Too many test requests."
    }));
    app.get("/limited", (_req, res) => res.json({ ok: true }));

    expect((await request(app).get("/limited")).status).toBe(200);
    expect((await request(app).get("/limited")).status).toBe(200);
    const limited = await request(app).get("/limited");
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: "Too many test requests." });
  });

  test("refuses production startup with a short JWT secret", async () => {
    const originalEnvironment = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;
    const originalClientUrl = process.env.CLIENT_URL;
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "too-short";
    process.env.CLIENT_URL = "https://dashboard.example";
    try {
      await expect(start()).rejects.toThrow("JWT_SECRET must be at least 32 characters");
    } finally {
      if (originalEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnvironment;
      if (originalSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalSecret;
      if (originalClientUrl === undefined) delete process.env.CLIENT_URL;
      else process.env.CLIENT_URL = originalClientUrl;
    }
  });
});
