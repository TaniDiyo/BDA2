const CustomerProfile = require("../models/CustomerProfile");
const Transaction = require("../models/Transaction");

async function updateProfile(transaction) {
  const amount = Number(transaction.amount);
  await CustomerProfile.updateOne(
    { customerId: transaction.customerId },
    [
    {
      $set: {
        customerId: { $ifNull: ["$customerId", transaction.customerId] },
        totalTransactions: { $add: [{ $ifNull: ["$totalTransactions", 0] }, 1] },
        blockedCount: {
          $add: [
            { $ifNull: ["$blockedCount", 0] },
            transaction.status === "BLOCKED" ? 1 : 0
          ]
        },
        reviewCount: {
          $add: [
            { $ifNull: ["$reviewCount", 0] },
            transaction.status === "REVIEW" ? 1 : 0
          ]
        },
        maxAmount: { $max: [{ $ifNull: ["$maxAmount", 0] }, amount] },
        knownDevices: {
          $setUnion: [{ $ifNull: ["$knownDevices", []] }, [transaction.deviceId]]
        },
        knownCountries: {
          $setUnion: [{ $ifNull: ["$knownCountries", []] }, [transaction.country]]
        },
        knownCategories: {
          $setUnion: [{ $ifNull: ["$knownCategories", []] }, [transaction.category]]
        },
        lastTransactionAt: {
          $max: [
            { $ifNull: ["$lastTransactionAt", new Date(0)] },
            transaction.timestamp
          ]
        },
        sumAmount: { $add: [{ $ifNull: ["$sumAmount", 0] }, amount] }
      }
    },
    {
      $set: {
        amountCount: {
          $let: {
            vars: {
              oldCount: {
                $ifNull: ["$amountCount", { $subtract: ["$totalTransactions", 1] }]
              }
            },
            in: { $add: ["$$oldCount", 1] }
          }
        },
        amountMean: {
          $let: {
            vars: {
              oldCount: {
                $ifNull: ["$amountCount", { $subtract: ["$totalTransactions", 1] }]
              },
              oldMean: { $ifNull: ["$amountMean", "$avgAmount"] }
            },
            in: {
              $let: {
                vars: {
                  delta: { $subtract: [amount, { $ifNull: ["$$oldMean", 0] }] },
                  newCount: { $add: ["$$oldCount", 1] }
                },
                in: {
                  $add: [
                    { $ifNull: ["$$oldMean", 0] },
                    { $divide: ["$$delta", "$$newCount"] }
                  ]
                }
              }
            }
          }
        },
        amountM2: {
          $let: {
            vars: {
              oldCount: {
                $ifNull: ["$amountCount", { $subtract: ["$totalTransactions", 1] }]
              },
              oldMean: { $ifNull: ["$amountMean", "$avgAmount"] },
              oldM2: { $ifNull: ["$amountM2", 0] }
            },
            in: {
              $let: {
                vars: {
                  delta: { $subtract: [amount, { $ifNull: ["$$oldMean", 0] }] },
                  newMean: {
                    $add: [
                      { $ifNull: ["$$oldMean", 0] },
                      {
                        $divide: [
                          { $subtract: [amount, { $ifNull: ["$$oldMean", 0] }] },
                          { $add: ["$$oldCount", 1] }
                        ]
                      }
                    ]
                  }
                },
                in: {
                  $add: [
                    "$$oldM2",
                    {
                      $multiply: [
                        "$$delta",
                        { $subtract: [amount, "$$newMean"] }
                      ]
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
    ],
    { upsert: true }
  );

  await CustomerProfile.updateOne(
    { customerId: transaction.customerId },
    [
    {
      $set: {
        avgAmount: "$amountMean",
          riskLevel: {
            $switch: {
              branches: [
                { case: { $gte: ["$blockedCount", 3] }, then: "HIGH" },
                {
                  case: {
                    $or: [
                      { $gte: ["$blockedCount", 1] },
                      { $gte: ["$reviewCount", 3] }
                    ]
                  },
                  then: "MEDIUM"
                }
              ],
              default: "LOW"
            }
          }
        }
      }
    ]
  );
}

async function getCustomer(customerId) {
  const profile = await CustomerProfile.findOne({ customerId }).lean();
  if (!profile) {
    const error = new Error("Customer profile not found.");
    error.status = 404;
    throw error;
  }
  const transactions = await Transaction.find({ customerId })
    .sort({ timestamp: -1, createdAt: -1 })
    .limit(10)
    .lean();
  return { ...profile, transactions };
}

module.exports = { updateProfile, getCustomer };
