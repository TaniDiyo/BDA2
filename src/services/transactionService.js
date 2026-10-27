const Transaction = require("../models/Transaction");
const fraudService = require("./fraudService");
const customerService = require("./customerService");
const alertService = require("./alertService");

async function create(input, evaluationMetadata = {}) {
  const transactionInput = {
    cardLast4: input.cardLast4,
    customerId: input.customerId,
    amount: input.amount,
    merchant: input.merchant,
    category: input.category,
    country: input.country,
    homeCountry: input.homeCountry || "IN",
    deviceId: input.deviceId,
    timestamp: input.timestamp ? new Date(input.timestamp) : new Date()
  };
  const assessment = await fraudService.evaluate(transactionInput);
  const transaction = await Transaction.create({
    ...transactionInput,
    ...assessment,
    ...evaluationMetadata
  });
  await Promise.all([
    customerService.updateProfile(transaction),
    alertService.createForTransaction(transaction)
  ]);
  return transaction;
}

async function list({ page = 1, limit = 10, status, customerId }) {
  const currentPage = Number(page) || 1;
  const pageSize = Number(limit) || 10;
  const filter = {};
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;

  const [data, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ timestamp: -1, createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Transaction.countDocuments(filter)
  ]);
  return {
    data,
    page: currentPage,
    limit: pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  };
}

async function stats() {
  const alertService = require("./alertService");
  const statuses = ["APPROVED", "REVIEW", "BLOCKED"];
  const [total, ...counts] = await Promise.all([
    Transaction.countDocuments(),
    ...statuses.map((status) => Transaction.countDocuments({ status }))
  ]);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const [trend, alertMetrics] = await Promise.all([
    Transaction.aggregate([
      { $match: { timestamp: { $gte: weekStart, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "UTC" } }, count: { $sum: 1 } } }
    ]),
    alertService.metrics()
  ]);
  const countByDay = new Map(trend.map((entry) => [entry._id, entry.count]));
  const transactionsByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: countByDay.get(key) || 0 };
  });
  return {
    total,
    APPROVED: counts[0],
    REVIEW: counts[1],
    BLOCKED: counts[2],
    ...alertMetrics,
    transactionsByDay
  };
}

function remove(id) {
  return Transaction.findByIdAndDelete(id);
}

module.exports = { create, list, stats, remove };
