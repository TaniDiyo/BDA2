const alertService = require("../services/alertService");

async function list(req, res) {
  return res.json(await alertService.list({
    alertStatus: req.query.alertStatus,
    page: req.query.page || 1,
    limit: req.query.limit || 10
  }));
}

async function getById(req, res) {
  return res.json(await alertService.getById(req.params.id));
}

async function updateStatus(req, res) {
  return res.json(await alertService.updateStatus(req.params.id, req.body.alertStatus));
}

async function assign(req, res) {
  return res.json(await alertService.assign(req.params.id, req.user.id));
}

async function addNote(req, res) {
  return res.status(201).json(
    await alertService.addNote(req.params.id, req.user.id, req.body.text)
  );
}

module.exports = { list, getById, updateStatus, assign, addNote };
