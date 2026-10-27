const express = require("express");
const { body, query } = require("express-validator");
const alertController = require("../controllers/alertController");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();
router.use(authenticate);

router.get(
  "/",
  [
    query("alertStatus")
      .optional()
      .isIn(["OPEN", "INVESTIGATING", "CONFIRMED_FRAUD", "FALSE_POSITIVE"])
      .withMessage("Invalid alertStatus."),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer.").toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100.").toInt()
  ],
  validate,
  alertController.list
);
router.get("/:id", alertController.getById);
router.put(
  "/:id/status",
  [body("alertStatus").isIn(["OPEN", "INVESTIGATING", "CONFIRMED_FRAUD", "FALSE_POSITIVE"]).withMessage("Invalid alertStatus.")],
  validate,
  alertController.updateStatus
);
router.put("/:id/assign", alertController.assign);
router.post(
  "/:id/notes",
  [body("text").isString().trim().notEmpty().isLength({ max: 2000 }).withMessage("Note text is required and must be at most 2000 characters.")],
  validate,
  alertController.addNote
);

module.exports = router;
