const customerService = require("../services/customerService");

async function getById(req, res) {
  return res.json(await customerService.getCustomer(req.params.customerId));
}

module.exports = { getById };
