const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { type: String, select: false },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ["ADMIN", "ANALYST"],
      default: "ANALYST",
      set: (value) => (typeof value === "string" ? value.toUpperCase() : value)
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSchema.pre("save", function (next) {
  if (!this.password && this.passwordHash) {
    this.password = this.passwordHash;
  }
  if (!this.password && !this.passwordHash) {
    return next(new Error("Path `password` is required."));
  }
  if (this.role) {
    this.role = this.role.toUpperCase();
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
