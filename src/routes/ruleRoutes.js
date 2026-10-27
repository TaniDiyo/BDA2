const express = require("express");
const { body } = require("express-validator");
const ruleController = require("../controllers/ruleController");
const { authenticate } = require("../middleware/auth");
const requireRole = require("../middleware/role");
const validate = require("../middleware/validate");

const router = express.Router();
router.use(authenticate);
router.get("/", ruleController.list);

router.put(
  "/settings/thresholds",
  requireRole("ADMIN"),
  [
    body("reviewThreshold").isFloat({ gt: 0 }).withMessage("reviewThreshold must be a positive number.").toFloat(),
    body("blockThreshold").isFloat({ gt: 0 }).withMessage("blockThreshold must be a positive number.").toFloat()
  ],
  validate,
  ruleController.updateThresholds
);

router.put(
  "/:id",
  requireRole("ADMIN"),
  [
    body("enabled").optional().isBoolean().withMessage("enabled must be a boolean.").toBoolean(),
    body("threshold").optional().isFloat({ gt: 0 }).withMessage("threshold must be a positive number.").toFloat(),
    body("points").optional().isFloat({ min: 0, max: 100 }).withMessage("points must be between 0 and 100.").toFloat(),
    body().custom((value) => Object.keys(value).some((key) => ["enabled", "threshold", "points"].includes(key)))
      .withMessage("Provide enabled, threshold, or points to update.")
  ],
  validate,
  ruleController.update
);

module.exports = router;
