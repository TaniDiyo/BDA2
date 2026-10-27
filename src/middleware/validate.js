const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      error: "Request validation failed.",
      details: result.array().map(({ path, msg }) => ({ field: path, message: msg }))
    });
  }
  return next();
}

module.exports = validate;
