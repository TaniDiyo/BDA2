const ruleService = require("../services/ruleService");

async function list(req, res) {
  return res.json(await ruleService.list());
}

async function update(req, res) {
  const updates = {};
  for (const field of ["enabled", "threshold", "points"]) {
    if (Object.hasOwn(req.body, field)) updates[field] = req.body[field];
  }
  const rule = await ruleService.updateRule(req.params.id, updates, req.user.id);
  return res.json(rule);
}

async function updateThresholds(req, res) {
  const { reviewThreshold, blockThreshold } = req.body;
  if (reviewThreshold >= blockThreshold) {
    return res.status(400).json({
      error: "reviewThreshold must be less than blockThreshold."
    });
  }
  return res.json(
    await ruleService.updateThresholds(
      { reviewThreshold, blockThreshold },
      req.user.id
    )
  );
}

module.exports = { list, update, updateThresholds };
