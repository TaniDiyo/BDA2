const mongoose = require("mongoose");

const ruleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    threshold: { type: Number, required: true, min: 0 },
    points: { type: Number, required: true, min: 0, max: 100 },
    windowEnd: { type: Number, min: 0, max: 23 },
    windowMinutes: { type: Number, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

module.exports = mongoose.model("Rule", ruleSchema);
