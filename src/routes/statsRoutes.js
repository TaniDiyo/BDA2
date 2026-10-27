const express = require("express");
const statsController = require("../controllers/statsController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, statsController.getStats);

module.exports = router;
