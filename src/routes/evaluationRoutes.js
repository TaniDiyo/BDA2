const express = require("express");
const { authenticate } = require("../middleware/auth");
const evaluationController = require("../controllers/evaluationController");

const router = express.Router();
router.get("/", authenticate, evaluationController.getEvaluation);

module.exports = router;
