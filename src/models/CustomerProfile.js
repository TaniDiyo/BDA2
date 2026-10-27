const mongoose = require("mongoose");

const customerProfileSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, trim: true },
    totalTransactions: { type: Number, default: 0, min: 0 },
    sumAmount: { type: Number, default: 0, min: 0, select: false },
    amountCount: { type: Number, default: 0, min: 0 },
    amountMean: { type: Number, default: 0 },
    amountM2: { type: Number, default: 0, min: 0 },
    avgAmount: { type: Number, default: 0, min: 0 },
    maxAmount: { type: Number, default: 0, min: 0 },
    knownDevices: { type: [String], default: [] },
    knownCountries: { type: [String], default: [] },
    knownCategories: { type: [String], default: [] },
    blockedCount: { type: Number, default: 0, min: 0 },
    reviewCount: { type: Number, default: 0, min: 0 },
    lastTransactionAt: { type: Date },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" }
  },
  { timestamps: true, collection: "fraudlens_customer_profiles" }
);

module.exports = mongoose.model("CustomerProfile", customerProfileSchema);
