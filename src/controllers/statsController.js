const transactionService = require("../services/transactionService");

async function getStats(req, res) {
  return res.json(await transactionService.stats());
}

module.exports = { getStats };
