const Transaction = require("../models/Transaction");

function calculateMetrics(counts) {
  const truePositives = counts.truePositives || 0;
  const falsePositives = counts.falsePositives || 0;
  const trueNegatives = counts.trueNegatives || 0;
  const falseNegatives = counts.falseNegatives || 0;
  const precisionDenominator = truePositives + falsePositives;
  const recallDenominator = truePositives + falseNegatives;
  const total = truePositives + falsePositives + trueNegatives + falseNegatives;
  const precision = precisionDenominator ? truePositives / precisionDenominator : 0;
  const recall = recallDenominator ? truePositives / recallDenominator : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = total ? (truePositives + trueNegatives) / total : 0;
  return {
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision,
    recall,
    f1,
    accuracy,
    total,
    hasData: total > 0
  };
}

async function evaluate() {
  const [counts] = await Transaction.aggregate([
    {
      $match: {
        isGenerated: true,
        isFraudulent: { $type: "bool" }
      }
    },
    {
      $group: {
        _id: null,
        truePositives: {
          $sum: {
            $cond: [
              {
                $and: [
                  "$isFraudulent",
                  { $in: ["$status", ["REVIEW", "BLOCKED"]] }
                ]
              },
              1,
              0
            ]
          }
        },
        falsePositives: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isFraudulent", false] },
                  { $in: ["$status", ["REVIEW", "BLOCKED"]] }
                ]
              },
              1,
              0
            ]
          }
        },
        trueNegatives: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isFraudulent", false] },
                  { $eq: ["$status", "APPROVED"] }
                ]
              },
              1,
              0
            ]
          }
        },
        falseNegatives: {
          $sum: {
            $cond: [
              {
                $and: [
                  "$isFraudulent",
                  { $eq: ["$status", "APPROVED"] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  return calculateMetrics(counts || {});
}

module.exports = { calculateMetrics, evaluate };
