const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const alertSchema = new mongoose.Schema(
  {
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      unique: true
    },
    customerId: { type: String, required: true, index: true },
    riskScore: { type: Number, required: true },
    status: { type: String, enum: ["APPROVED", "REVIEW", "BLOCKED"], required: true },
    reasons: { type: [String], default: [] },
    alertStatus: {
      type: String,
      enum: ["OPEN", "INVESTIGATING", "CONFIRMED_FRAUD", "FALSE_POSITIVE"],
      default: "OPEN"
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: [noteSchema], default: [] },
    resolvedAt: { type: Date }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "fraudlens_alerts" }
);

alertSchema.index({ alertStatus: 1, createdAt: -1 });
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Alert", alertSchema);
