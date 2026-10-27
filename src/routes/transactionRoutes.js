const express = require("express");
const { body, query } = require("express-validator");
const transactionController = require("../controllers/transactionController");
const { authenticate } = require("../middleware/auth");
const requireRole = require("../middleware/role");
const validate = require("../middleware/validate");

const router = express.Router();

router.use(authenticate);
router.post(
  "/",
  [
    body("cardLast4")
      .isString()
      .matches(/^\d{4}$/)
      .withMessage("cardLast4 must contain exactly 4 digits."),
    body("customerId").isString().trim().notEmpty().withMessage("customerId is required."),
    body("amount").isFloat({ gt: 0 }).withMessage("amount must be a positive number.").toFloat(),
    body("merchant").isString().trim().notEmpty().withMessage("merchant is required."),
    body("category").isString().trim().notEmpty().withMessage("category is required."),
    body("country")
      .isString()
      .matches(/^[A-Za-z]{2}$/)
      .withMessage("country must be a 2-letter country code.")
      .toUpperCase(),
    body("homeCountry")
      .optional()
      .isString()
      .matches(/^[A-Za-z]{2}$/)
      .withMessage("homeCountry must be a 2-letter country code.")
      .toUpperCase(),
    body("deviceId").isString().trim().notEmpty().withMessage("deviceId is required."),
    body("timestamp")
      .optional()
      .isISO8601()
      .withMessage("timestamp must be a valid ISO-8601 date.")
      .toDate()
  ],
  validate,
  transactionController.create
);

router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer.").toInt(),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be an integer between 1 and 100.")
      .toInt(),
    query("status")
      .optional()
      .isIn(["APPROVED", "REVIEW", "BLOCKED"])
      .withMessage("status must be APPROVED, REVIEW, or BLOCKED."),
    query("customerId").optional().isString().trim()
  ],
  validate,
  transactionController.list
);

router.delete("/:id", requireRole("ADMIN"), transactionController.remove);

module.exports = router;
