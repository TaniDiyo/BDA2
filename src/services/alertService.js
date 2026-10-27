const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const Transaction = require("../models/Transaction");

const alertStatuses = ["OPEN", "INVESTIGATING", "CONFIRMED_FRAUD", "FALSE_POSITIVE"];

function validateId(id) {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error("Alert not found.");
    error.status = 404;
    throw error;
  }
}

async function createForTransaction(transaction) {
  if (!["REVIEW", "BLOCKED"].includes(transaction.status)) return null;
  return Alert.create({
    transaction: transaction._id,
    customerId: transaction.customerId,
    riskScore: transaction.riskScore,
    status: transaction.status,
    reasons: transaction.reasons
  });
}

async function list({ alertStatus, page = 1, limit = 10 }) {
  const currentPage = Number(page);
  const pageSize = Number(limit);
  const filter = alertStatus ? { alertStatus } : {};
  const [data, total] = await Promise.all([
    Alert.find(filter)
      .populate({ path: "transaction", select: "cardLast4 amount merchant category country timestamp" })
      .populate({ path: "assignedTo", select: "name email role" })
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Alert.countDocuments(filter)
  ]);
  return { data, page: currentPage, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

async function getById(id) {
  validateId(id);
  const alert = await Alert.findById(id)
    .populate("transaction")
    .populate({ path: "assignedTo", select: "name email role" })
    .populate({ path: "notes.author", select: "name email role" });
  if (!alert) {
    const error = new Error("Alert not found.");
    error.status = 404;
    throw error;
  }
  return alert;
}

async function updateStatus(id, alertStatus) {
  validateId(id);
  if (!alertStatuses.includes(alertStatus)) {
    const error = new Error(`alertStatus must be one of: ${alertStatuses.join(", ")}.`);
    error.status = 400;
    throw error;
  }
  const resolvedAt = ["CONFIRMED_FRAUD", "FALSE_POSITIVE"].includes(alertStatus)
    ? new Date()
    : null;
  const alert = await Alert.findByIdAndUpdate(
    id,
    { $set: { alertStatus, resolvedAt } },
    { new: true, runValidators: true }
  );
  if (!alert) {
    const error = new Error("Alert not found.");
    error.status = 404;
    throw error;
  }
  return alert;
}

async function assign(id, userId) {
  validateId(id);
  const alert = await Alert.findByIdAndUpdate(
    id,
    { $set: { assignedTo: userId } },
    { new: true }
  );
  if (!alert) {
    const error = new Error("Alert not found.");
    error.status = 404;
    throw error;
  }
  return alert;
}

async function addNote(id, userId, text) {
  validateId(id);
  const alert = await Alert.findByIdAndUpdate(
    id,
    { $push: { notes: { text, author: userId } } },
    { new: true, runValidators: true }
  );
  if (!alert) {
    const error = new Error("Alert not found.");
    error.status = 404;
    throw error;
  }
  return alert;
}

async function metrics() {
  const [openAlerts, total, blocked, amountResult] = await Promise.all([
    Alert.countDocuments({ alertStatus: { $in: ["OPEN", "INVESTIGATING"] } }),
    Transaction.countDocuments(),
    Transaction.countDocuments({ status: "BLOCKED" }),
    Transaction.aggregate([
      { $match: { status: "BLOCKED" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);
  return {
    openAlerts,
    fraudRate: total === 0 ? 0 : (blocked / total) * 100,
    totalAmountBlocked: amountResult[0]?.total || 0
  };
}

module.exports = { createForTransaction, list, getById, updateStatus, assign, addNote, metrics };
