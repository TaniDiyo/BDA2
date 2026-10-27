const evaluationService = require("../services/evaluationService");

async function getEvaluation(req, res) {
  return res.json(await evaluationService.evaluate());
}

module.exports = { getEvaluation };
