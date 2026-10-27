const express = require("express");
const customerController = require("../controllers/customerController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.get("/:customerId", authenticate, customerController.getById);

module.exports = router;
