const Transaction = require("../models/Transaction");
const CustomerProfile = require("../models/CustomerProfile");
const ruleService = require("./ruleService");
const { scoreTransaction } = require("./fraudScoring");

async function evaluate(tx) {
  const { rules, settings } = await ruleService.getConfiguration();
  const velocityRule = rules.find((rule) => rule.key === "VELOCITY");
  const timestamp = new Date(tx.timestamp || Date.now());
  const [profile, recentCardCount] = await Promise.all([
    CustomerProfile.findOne({ customerId: tx.customerId }).lean(),
    Transaction.countDocuments({
      customerId: tx.customerId,
      cardLast4: tx.cardLast4,
      timestamp: {
        $gte: new Date(timestamp.getTime() - (velocityRule?.windowMinutes || 10) * 60 * 1000),
        $lte: timestamp
      }
    })
  ]);
  return scoreTransaction({ tx, rules, settings, profile, recentCardCount });
}

module.exports = { evaluate };
