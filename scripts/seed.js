require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Alert = require("../src/models/Alert");
const CustomerProfile = require("../src/models/CustomerProfile");
const Transaction = require("../src/models/Transaction");
const User = require("../src/models/User");
const transactionService = require("../src/services/transactionService");
const ruleService = require("../src/services/ruleService");

const SEED = 0x5eed1234;
const GENERATED_CUSTOMER_PREFIX = "SYNTH-CUST-";
const countries = ["IN", "GB", "US", "CA", "AU", "SG"];
const categories = ["Retail", "Grocery", "Dining", "Travel", "Fuel", "Utilities", "Electronics"];
const merchants = {
  Retail: ["Everyday Mart", "City Department Store", "Market Square"],
  Grocery: ["Fresh Basket", "Daily Grocer", "Green Market"],
  Dining: ["Copper Table", "Spice House", "Corner Cafe"],
  Travel: ["Northstar Travel", "Metro Tickets", "Skyline Booking"],
  Fuel: ["Roadway Fuel", "Petro Point", "Highway Stop"],
  Utilities: ["Bright Energy", "WaterWorks", "Connect Mobile"],
  Electronics: ["Circuit House", "Pixel Depot", "Tech Corner"]
};

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function integer(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function pick(random, items) {
  return items[integer(random, 0, items.length - 1)];
}

function parseArguments(args) {
  const clear = args.includes("--clear");
  const demo = args.includes("--demo");
  const countArg = args.find((arg) => /^\d+$/.test(arg));
  const count = countArg ? Number(countArg) : 1000;
  if (!Number.isSafeInteger(count) || count < 1 || count > 100000) {
    throw new Error("Transaction count must be between 1 and 100000.");
  }
  return { clear, count, demo };
}

function makeCustomers(random) {
  return Array.from({ length: 50 }, (_, index) => {
    const deviceCount = integer(random, 1, 3);
    return {
      customerId: `${GENERATED_CUSTOMER_PREFIX}${String(index + 1).padStart(3, "0")}`,
      homeCountry: pick(random, countries),
      devices: Array.from({ length: deviceCount }, (_, deviceIndex) =>
        `SYNTH-DEVICE-${String(index + 1).padStart(3, "0")}-${deviceIndex + 1}`
      ),
      minSpend: integer(random, 300, 2500),
      maxSpend: integer(random, 5000, 25000),
      categories: [...new Set(Array.from({ length: integer(random, 2, 4) }, () => pick(random, categories)))]
    };
  });
}

function randomDate(random, start, end) {
  return new Date(start.getTime() + random() * (end.getTime() - start.getTime()));
}

function makeBase(random, customer, timestamp, values = {}) {
  const category = values.category || pick(random, customer.categories);
  return {
    cardLast4: values.cardLast4 || String(integer(random, 0, 9999)).padStart(4, "0"),
    customerId: customer.customerId,
    amount: values.amount ?? integer(random, customer.minSpend, customer.maxSpend),
    merchant: pick(random, merchants[category] || merchants.Retail),
    category,
    country: values.country || customer.homeCountry,
    homeCountry: customer.homeCountry,
    deviceId: values.deviceId || pick(random, customer.devices),
    timestamp,
    isFraudulent: Boolean(values.isFraudulent)
  };
}

function makeDrafts(count, random, customers, now) {
  const fraudulentCount = Math.max(1, Math.round(count * 0.05));
  const normalCount = count - fraudulentCount;
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const drafts = [];

  for (let index = 0; index < normalCount; index += 1) {
    const customer = pick(random, customers);
    const timestamp = randomDate(random, start, now);
    timestamp.setUTCHours(integer(random, 7, 23), integer(random, 0, 59));
    drafts.push(makeBase(random, customer, timestamp));
  }

  let fraudIndex = 0;
  while (fraudIndex < fraudulentCount) {
    const remaining = fraudulentCount - fraudIndex;
    if (remaining >= 4 && random() < 0.35) {
      const burstSize = Math.min(remaining, integer(random, 4, 6));
      const customer = pick(random, customers);
      const timestamp = randomDate(random, start, now);
      timestamp.setUTCHours(integer(random, 7, 23), integer(random, 0, 50));
      const cardLast4 = String(integer(random, 0, 9999)).padStart(4, "0");
      for (let burstIndex = 0; burstIndex < burstSize; burstIndex += 1) {
        drafts.push(makeBase(random, customer, new Date(timestamp.getTime() + burstIndex * 60_000), {
          amount: integer(random, 1000, 9000),
          cardLast4,
          country: pick(random, countries.filter((country) => country !== customer.homeCountry)),
          isFraudulent: true
        }));
      }
      fraudIndex += burstSize;
      continue;
    }

    const customer = pick(random, customers);
    const timestamp = randomDate(random, start, now);
    const pattern = fraudIndex % 4;
    let values;
    if (pattern === 0) {
      timestamp.setUTCHours(integer(random, 1, 4), integer(random, 0, 59));
      values = {
        amount: integer(random, 110000, 180000),
        country: pick(random, countries.filter((country) => country !== customer.homeCountry)),
        isFraudulent: true
      };
    } else if (pattern === 1) {
      values = {
        amount: integer(random, 55000, 95000),
        country: pick(random, countries.filter((country) => country !== customer.homeCountry)),
        isFraudulent: true
      };
    } else if (pattern === 2) {
      timestamp.setUTCHours(integer(random, 1, 4), integer(random, 0, 59));
      values = {
        country: pick(random, countries.filter((country) => country !== customer.homeCountry)),
        deviceId: `SYNTH-NEW-DEVICE-${fraudIndex}`,
        isFraudulent: true
      };
    } else {
      values = {
        amount: integer(random, 75000, 150000),
        isFraudulent: true
      };
    }
    drafts.push(makeBase(random, customer, timestamp, values));
    fraudIndex += 1;
  }

  return drafts
    .map((draft, index) => ({ draft, index }))
    .sort((left, right) =>
      left.draft.timestamp - right.draft.timestamp || left.index - right.index
    )
    .map(({ draft }) => draft);
}

async function clearGeneratedData() {
  const generated = await Transaction.find({ isGenerated: true }, { _id: 1, customerId: 1 }).lean();
  const transactionIds = generated.map((transaction) => transaction._id);
  await Promise.all([
    Alert.deleteMany({ transaction: { $in: transactionIds } }),
    Transaction.deleteMany({ _id: { $in: transactionIds } }),
    CustomerProfile.deleteMany({ customerId: new RegExp(`^${GENERATED_CUSTOMER_PREFIX}`) })
  ]);
}

async function seed(count) {
  const random = createRandom(SEED);
  const customers = makeCustomers(random);
  const drafts = makeDrafts(count, random, customers, new Date());
  const counts = { APPROVED: 0, REVIEW: 0, BLOCKED: 0 };

  for (const draft of drafts) {
    const transaction = await transactionService.create(draft, {
      isGenerated: true,
      isFraudulent: draft.isFraudulent
    });
    counts[transaction.status] += 1;
  }
  return {
    requested: count,
    fraudulent: drafts.filter((draft) => draft.isFraudulent).length,
    normal: drafts.filter((draft) => !draft.isFraudulent).length,
    counts
  };
}

async function createDemoUsers() {
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  const analystPassword = process.env.DEMO_ANALYST_PASSWORD;
  if (!adminPassword || adminPassword.length < 12 || !analystPassword || analystPassword.length < 12) {
    throw new Error("Set DEMO_ADMIN_PASSWORD and DEMO_ANALYST_PASSWORD to values of at least 12 characters.");
  }

  const accounts = [
    { name: "FraudLens Demo Admin", email: "admin@fraudlens.com", role: "ADMIN", password: adminPassword },
    { name: "FraudLens Demo Analyst", email: "analyst@fraudlens.com", role: "ANALYST", password: analystPassword }
  ];

  for (const account of accounts) {
    const user = await User.findOneAndUpdate(
      { email: account.email },
      {
        $setOnInsert: {
          name: account.name,
          email: account.email,
          role: account.role,
          password: await bcrypt.hash(account.password, 12)
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (user.role !== account.role) {
      throw new Error(`Existing demo account ${account.email} has the wrong role.`);
    }
  }
}

async function main() {
  const { clear, count, demo } = parseArguments(process.argv.slice(2));
  if (demo && (
    !process.env.DEMO_ADMIN_PASSWORD ||
    process.env.DEMO_ADMIN_PASSWORD.length < 12 ||
    !process.env.DEMO_ANALYST_PASSWORD ||
    process.env.DEMO_ANALYST_PASSWORD.length < 12
  )) {
    throw new Error("Set DEMO_ADMIN_PASSWORD and DEMO_ANALYST_PASSWORD to values of at least 12 characters.");
  }
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fraudlens");
  await ruleService.seedDefaults();
  ruleService.clearCache();
  if (demo) await createDemoUsers();
  if (clear) await clearGeneratedData();
  const summary = await seed(count);
  console.log(`FraudLens ${demo ? "demo " : ""}synthetic transaction seed complete.`);
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Could not seed FraudLens data:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState) await mongoose.disconnect();
    });
}

module.exports = { createRandom, parseArguments, makeCustomers, makeDrafts, clearGeneratedData, seed, createDemoUsers };
