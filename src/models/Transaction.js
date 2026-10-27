const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    cardLast4: {
      type: String,
      required: true,
      match: /^\d{4}$/,
      trim: true
    },
    customerId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    merchant: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    homeCountry: { type: String, default: "IN", trim: true },
    deviceId: { type: String, required: true, trim: true },
    timestamp: { type: Date, required: true, default: Date.now },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    status: {
      type: String,
      required: true,
      enum: ["APPROVED", "REVIEW", "BLOCKED"]
    },
    reasons: { type: [String], default: [] },
    isFraudulent: { type: Boolean, select: false },
    isGenerated: { type: Boolean, default: false, select: false }
  },
  { timestamps: true, collection: "fraudlens_transactions" }
);

transactionSchema.index({ customerId: 1, timestamp: -1, status: 1 });
transactionSchema.index({ status: 1, timestamp: -1 });
transactionSchema.index({ cardLast4: 1, customerId: 1, timestamp: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
