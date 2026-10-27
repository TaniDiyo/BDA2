const Rule = require("../models/Rule");
const Settings = require("../models/Settings");

const DEFAULT_RULES = [
  {
    key: "HIGH_AMOUNT",
    name: "High amount",
    description: "Transaction amount meets or exceeds this threshold.",
    threshold: 50000,
    points: 25
  },
  {
    key: "VERY_HIGH_AMOUNT",
    name: "Very high amount",
    description: "Transaction amount meets or exceeds this threshold.",
    threshold: 100000,
    points: 40
  },
  {
    key: "AMOUNT_VS_AVERAGE",
    name: "Amount vs customer average",
    description: "Transaction exceeds this multiple of the customer's average (minimum 3 past transactions).",
    threshold: 5,
    points: 25
  },
  {
    key: "VELOCITY",
    name: "Card velocity",
    description: "Transactions on the same card within the configured 10-minute window.",
    threshold: 3,
    windowMinutes: 10,
    points: 30
  },
  {
    key: "FOREIGN_COUNTRY",
    name: "Foreign country",
    description: "Transaction country differs from the customer's home country.",
    threshold: 1,
    points: 20
  },
  {
    key: "ODD_HOURS",
    name: "Odd hours",
    description: "Transaction occurs from 1 AM through 4 AM UTC.",
    threshold: 1,
    windowEnd: 4,
    points: 10
  },
  {
    key: "NEW_DEVICE",
    name: "New device",
    description: "A new device is used by an existing customer.",
    threshold: 1,
    points: 15
  },
  {
    key: "ANOMALY_ZSCORE",
    name: "Statistical amount anomaly",
    description: "Amount is unusually high relative to the customer's running transaction history.",
    threshold: 3,
    points: 30
  },
  {
    key: "UNUSUAL_MERCHANT_CATEGORY",
    name: "Unusual merchant category",
    description: "A new category appears after at least 10 previous transactions.",
    threshold: 10,
    points: 15
  }
];

let cachedRules;
let cachedSettings;
let cacheExpiresAt = 0;
let cacheLoad;
let cacheGeneration = 0;

async function seedDefaults() {
  await Rule.bulkWrite(DEFAULT_RULES.map((rule) => ({
    updateOne: {
      filter: { key: rule.key },
      update: { $setOnInsert: rule },
      upsert: true
    }
  })));
  await Settings.updateOne(
    { key: "FRAUD_THRESHOLDS" },
    { $setOnInsert: { reviewThreshold: 40, blockThreshold: 70 } },
    { upsert: true }
  );
}

function clearCache() {
  cacheGeneration += 1;
  cachedRules = undefined;
  cachedSettings = undefined;
  cacheExpiresAt = 0;
  cacheLoad = undefined;
}

async function getConfiguration() {
  if (cachedRules && cachedSettings && Date.now() < cacheExpiresAt) {
    return { rules: cachedRules, settings: cachedSettings };
  }
  if (!cacheLoad) {
    const generation = cacheGeneration;
    const load = Promise.all([
      Rule.find().lean(),
      Settings.findOne({ key: "FRAUD_THRESHOLDS" }).lean()
    ]).then(([rules, settings]) => {
      const configuration = {
        rules,
        settings: settings || { reviewThreshold: 40, blockThreshold: 70 }
      };
      if (generation === cacheGeneration) {
        cachedRules = configuration.rules;
        cachedSettings = configuration.settings;
        cacheExpiresAt = Date.now() + 60_000;
      }
      return configuration;
    }).finally(() => {
      if (cacheLoad === load) cacheLoad = undefined;
    });
    cacheLoad = load;
  }
  return cacheLoad;
}

async function list() {
  const { rules, settings } = await getConfiguration();
  return { rules, thresholds: {
    reviewThreshold: settings.reviewThreshold,
    blockThreshold: settings.blockThreshold
  } };
}

async function updateRule(id, updates, userId) {
  const rule = await Rule.findByIdAndUpdate(
    id,
    { $set: { ...updates, updatedBy: userId } },
    { new: true, runValidators: true }
  );
  if (!rule) {
    const error = new Error("Rule not found.");
    error.status = 404;
    throw error;
  }
  clearCache();
  return rule;
}

async function updateThresholds(updates, userId) {
  const settings = await Settings.findOneAndUpdate(
    { key: "FRAUD_THRESHOLDS" },
    { $set: { ...updates, updatedBy: userId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  clearCache();
  return settings;
}

module.exports = { DEFAULT_RULES, seedDefaults, clearCache, getConfiguration, list, updateRule, updateThresholds };
