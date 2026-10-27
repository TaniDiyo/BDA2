const mongoose = require("mongoose");
const transactionService = require("../services/transactionService");

async function create(req, res) {
  const transaction = await transactionService.create(req.body);
  return res.status(201).json(transaction);
}

async function list(req, res) {
  const result = await transactionService.list({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    customerId: req.query.customerId
  });
  return res.json(result);
}

async function remove(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    const error = new Error("Transaction not found.");
    error.status = 404;
    throw error;
  }

  const transaction = await transactionService.remove(req.params.id);
  if (!transaction) {
    const error = new Error("Transaction not found.");
    error.status = 404;
    throw error;
  }
  return res.json({ message: "Transaction deleted successfully." });
}

module.exports = { create, list, remove };
