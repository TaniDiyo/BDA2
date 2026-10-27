require("dotenv").config();

const connectDatabase = require("./src/config/db");
const app = require("./src/app");
const ruleService = require("./src/services/ruleService");
const mongoose = require("mongoose");

const port = Number(process.env.PORT) || 3000;

async function start() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || (process.env.NODE_ENV === "production" && jwtSecret.length < 32)) {
    throw new Error(
      process.env.NODE_ENV === "production"
        ? "JWT_SECRET must be at least 32 characters in production."
        : "JWT_SECRET must be set in the environment."
    );
  }
  if (process.env.NODE_ENV === "production" && !process.env.CLIENT_URL) {
    throw new Error("CLIENT_URL must contain the allowed frontend origin(s) in production.");
  }
  await connectDatabase();
  await ruleService.seedDefaults();
  const server = app.listen(port, () => {
    console.log(`FraudLens is running at http://localhost:${port}`);
  });
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received; closing server and database.`);
    server.close(async (error) => {
      if (error) {
        console.error("[server] HTTP server shutdown failed.");
        process.exitCode = 1;
      }
      try {
        await mongoose.disconnect();
        console.log("[server] Shutdown complete.");
      } catch {
        console.error("[server] Database shutdown failed.");
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return server;
}

if (require.main === module) {
  process.on("unhandledRejection", (reason) => {
    const reasonName = reason instanceof Error ? reason.name : typeof reason;
    console.error(`[process] Unhandled promise rejection (${reasonName}).`);
  });
  start().catch((error) => {
    console.error("Could not start FraudLens:", error.message || error.name);
    process.exitCode = 1;
  });
}

module.exports = { start };
