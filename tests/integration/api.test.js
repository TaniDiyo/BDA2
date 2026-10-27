process.env.JWT_SECRET = "fraudlens-jest-integration-secret";

const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const app = require("../../src/app");
const User = require("../../src/models/User");
const Transaction = require("../../src/models/Transaction");
const Alert = require("../../src/models/Alert");
const Rule = require("../../src/models/Rule");
const Settings = require("../../src/models/Settings");
const CustomerProfile = require("../../src/models/CustomerProfile");
const ruleService = require("../../src/services/ruleService");
const { createDemoUsers } = require("../../scripts/seed");

describe("FraudLens API integration", () => {
  let mongo;
  let adminToken;
  let analystToken;
  let admin;
  let analyst;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await ruleService.seedDefaults();
    const adminResponse = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test Admin", email: "admin@example.test", password: "admin-password" });
    const analystResponse = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test Analyst", email: "analyst@example.test", password: "analyst-password" });
    admin = adminResponse.body.user;
    analyst = analystResponse.body.user;
    adminToken = adminResponse.body.token;
    analystToken = analystResponse.body.token;
  }, 120000);

  beforeEach(async () => {
    await Promise.all([
      Transaction.deleteMany({}),
      Alert.deleteMany({}),
      CustomerProfile.deleteMany({})
    ]);
    await Rule.deleteMany({});
    await Settings.deleteMany({});
    await ruleService.seedDefaults();
    ruleService.clearCache();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });
  const normalTransaction = (overrides = {}) => ({
    cardLast4: "4123",
    customerId: "CUST-TEST-1",
    amount: 2500,
    merchant: "Test Store",
    category: "Retail",
    country: "IN",
    homeCountry: "IN",
    deviceId: "DEVICE-1",
    timestamp: "2026-10-27T12:00:00Z",
    ...overrides
  });

  test("registers first user ADMIN and second ANALYST; login, wrong password, and /me auth work", async () => {
    expect(admin.role).toBe("ADMIN");
    expect(analyst.role).toBe("ANALYST");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.test", password: "admin-password" });
    expect(login.status).toBe(200);
    expect(login.body.user).not.toHaveProperty("password");
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.test", password: "wrong-password" });
    expect(wrongPassword.status).toBe(401);
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    const me = await request(app).get("/api/auth/me").set(auth());
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("admin@example.test");
  });

  test("health endpoint reports database connection without authentication", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "connected" });
  });

  test("short-circuits demo account creation to environment-provided credentials", async () => {
    const previousAdminPassword = process.env.DEMO_ADMIN_PASSWORD;
    const previousAnalystPassword = process.env.DEMO_ANALYST_PASSWORD;
    process.env.DEMO_ADMIN_PASSWORD = "memory-admin-password";
    process.env.DEMO_ANALYST_PASSWORD = "memory-analyst-password";
    try {
      await createDemoUsers();
      const demoAdmin = await User.findOne({ email: "admin@fraudlens.com" }).select("+password");
      const demoAnalyst = await User.findOne({ email: "analyst@fraudlens.com" }).select("+password");
      expect(demoAdmin.role).toBe("ADMIN");
      expect(demoAnalyst.role).toBe("ANALYST");
      expect(demoAdmin.password).not.toBe(process.env.DEMO_ADMIN_PASSWORD);
      await createDemoUsers();
      await User.deleteMany({ email: { $in: ["admin@fraudlens.com", "analyst@fraudlens.com"] } });
    } finally {
      if (previousAdminPassword === undefined) delete process.env.DEMO_ADMIN_PASSWORD;
      else process.env.DEMO_ADMIN_PASSWORD = previousAdminPassword;
      if (previousAnalystPassword === undefined) delete process.env.DEMO_ANALYST_PASSWORD;
      else process.env.DEMO_ANALYST_PASSWORD = previousAnalystPassword;
    }
  });

  test("limits JSON request bodies and only returns CORS headers for allowed origins", async () => {
    const oversized = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ payload: "x".repeat(12 * 1024) }));
    expect(oversized.status).toBe(413);

    const allowed = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:3000");
    const denied = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("rejects NoSQL operators in authentication input", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: { $gt: "" }, password: "admin-password" });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  test("creates approved and blocked transactions and automatically creates a blocked alert", async () => {
    const normal = await request(app)
      .post("/api/transactions")
      .set(auth())
      .send(normalTransaction());
    expect(normal.status).toBe(201);
    expect(normal.body.status).toBe("APPROVED");

    const blocked = await request(app)
      .post("/api/transactions")
      .set(auth())
      .send(normalTransaction({
        customerId: "CUST-BLOCKED",
        amount: 120000,
        country: "US",
        timestamp: "2026-10-27T02:00:00Z"
      }));
    expect(blocked.status).toBe(201);
    expect(blocked.body.status).toBe("BLOCKED");
    expect(blocked.body.riskScore).toBe(70);
    const alerts = await request(app).get("/api/alerts?alertStatus=OPEN").set(auth());
    expect(alerts.body.total).toBe(1);
  });

  test("serves paginated transactions, customer history, stats, and admin deletion", async () => {
    const first = await request(app)
      .post("/api/transactions")
      .set(auth())
      .send(normalTransaction({ timestamp: "2026-10-27T12:00:00Z" }));
    await request(app)
      .post("/api/transactions")
      .set(auth())
      .send(normalTransaction({ amount: 3000, timestamp: "2026-10-27T13:00:00Z" }));

    const page = await request(app)
      .get("/api/transactions?page=1&limit=1&status=APPROVED&customerId=CUST-TEST-1")
      .set(auth());
    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(page.body.data).toHaveLength(1);

    const customer = await request(app)
      .get("/api/customers/CUST-TEST-1")
      .set(auth());
    expect(customer.status).toBe(200);
    expect(customer.body.totalTransactions).toBe(2);
    expect(customer.body.amountMean).toBe(2750);
    expect(customer.body.transactions).toHaveLength(2);

    const stats = await request(app).get("/api/stats").set(auth());
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ total: 2, APPROVED: 2, REVIEW: 0, BLOCKED: 0 });
    expect(stats.body.transactionsByDay).toHaveLength(7);

    const deleted = await request(app)
      .delete(`/api/transactions/${first.body._id}`)
      .set(auth());
    expect(deleted.status).toBe(200);
  });

  test("returns validation errors for malformed transaction input", async () => {
    const response = await request(app)
      .post("/api/transactions")
      .set(auth())
      .send(normalTransaction({ cardLast4: "123", country: "USA", amount: 0 }));
    expect(response.status).toBe(400);
    expect(response.body.details.length).toBeGreaterThanOrEqual(3);
  });

  test("denies Analyst transaction deletion and rule edits", async () => {
    const created = await request(app)
      .post("/api/transactions")
      .set(auth())
      .send(normalTransaction());
    const rule = await Rule.findOne({ key: "HIGH_AMOUNT" });
    const deletion = await request(app)
      .delete(`/api/transactions/${created.body._id}`)
      .set(auth(analystToken));
    const update = await request(app)
      .put(`/api/rules/${rule._id}`)
      .set(auth(analystToken))
      .send({ points: 10 });
    expect(deletion.status).toBe(403);
    expect(update.status).toBe(403);
  });

  test("Admin rule threshold update changes the next transaction score", async () => {
    const rule = await Rule.findOne({ key: "HIGH_AMOUNT" });
    const changed = await request(app)
      .put(`/api/rules/${rule._id}`)
      .set(auth())
      .send({ threshold: 60000, points: 33 });
    expect(changed.status).toBe(200);
    const transaction = await request(app)
      .post("/api/transactions")
      .set(auth())
      .send(normalTransaction({ amount: 50000 }));
    expect(transaction.body.riskScore).toBe(0);
  });

  test("runs alert assignment, notes, investigation, and resolution workflow", async () => {
    await request(app)
      .post("/api/transactions")
      .set(auth())
      .send(normalTransaction({
        customerId: "CUST-ALERT",
        amount: 120000,
        country: "US",
        timestamp: "2026-10-27T02:00:00Z"
      }));
    const listed = await request(app).get("/api/alerts").set(auth());
    const alertId = listed.body.data[0]._id;
    const details = await request(app).get(`/api/alerts/${alertId}`).set(auth());
    expect(details.status).toBe(200);
    expect(details.body.transaction.cardLast4).toBe("4123");
    const assigned = await request(app).put(`/api/alerts/${alertId}/assign`).set(auth(analystToken));
    expect(assigned.status).toBe(200);
    const note = await request(app)
      .post(`/api/alerts/${alertId}/notes`)
      .set(auth(analystToken))
      .send({ text: "Contacted customer for verification." });
    expect(note.status).toBe(201);
    const investigating = await request(app)
      .put(`/api/alerts/${alertId}/status`)
      .set(auth(analystToken))
      .send({ alertStatus: "INVESTIGATING" });
    expect(investigating.body.alertStatus).toBe("INVESTIGATING");
    const resolved = await request(app)
      .put(`/api/alerts/${alertId}/status`)
      .set(auth(analystToken))
      .send({ alertStatus: "CONFIRMED_FRAUD" });
    expect(resolved.body.alertStatus).toBe("CONFIRMED_FRAUD");
    expect(resolved.body.resolvedAt).toBeTruthy();
  });

  test("evaluation endpoint compares generated labels and handles no-data state", async () => {
    const empty = await request(app).get("/api/evaluation").set(auth());
    expect(empty.body.hasData).toBe(false);
    await Transaction.create([
      { ...normalTransaction({ customerId: "eval-1" }), status: "BLOCKED", riskScore: 70, reasons: [], isGenerated: true, isFraudulent: true },
      { ...normalTransaction({ customerId: "eval-2" }), status: "APPROVED", riskScore: 0, reasons: [], isGenerated: true, isFraudulent: false }
    ]);
    const result = await request(app).get("/api/evaluation").set(auth());
    expect(result.body).toMatchObject({ truePositives: 1, trueNegatives: 1, falsePositives: 0, falseNegatives: 0, precision: 1, recall: 1, f1: 1, accuracy: 1 });
  });
});
