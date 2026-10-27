const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("./config/cors");
const mongoose = require("mongoose");
const { generalLimiter } = require("./middleware/rateLimits");
const sanitizeMongoInput = require("./middleware/sanitizeMongoInput");
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const statsRoutes = require("./routes/statsRoutes");
const ruleRoutes = require("./routes/ruleRoutes");
const alertRoutes = require("./routes/alertRoutes");
const customerRoutes = require("./routes/customerRoutes");
const evaluationRoutes = require("./routes/evaluationRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS) || 0;
app.set("trust proxy", Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 0);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null
      }
    }
  })
);
app.use(cors);
app.use(morgan(":method :status :response-time ms"));
app.use(express.json({ limit: "10kb" }));
app.use(sanitizeMongoInput);
app.use("/api", generalLimiter);
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  return res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected"
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/evaluation", evaluationRoutes);
for (const [route, page] of Object.entries({
  "/alerts": "alerts.html",
  "/rules": "rules.html",
  "/customers": "customers.html",
  "/evaluation": "evaluation.html"
})) {
  app.get(route, (_req, res) => res.sendFile(path.join(__dirname, "..", "public", page)));
}
app.use(notFound);
app.use(errorHandler);

module.exports = app;
