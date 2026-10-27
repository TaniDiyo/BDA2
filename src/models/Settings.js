const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "FRAUD_THRESHOLDS" },
    reviewThreshold: { type: Number, required: true, min: 0 },
    blockThreshold: { type: Number, required: true, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
