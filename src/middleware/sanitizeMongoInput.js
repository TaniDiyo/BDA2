const mongoSanitize = require("express-mongo-sanitize");

const sanitizeRequest = mongoSanitize();

function sanitizeMongoInput(req, res, next) {
  Object.defineProperty(req, "query", {
    configurable: true,
    enumerable: true,
    value: req.query,
    writable: true
  });
  return sanitizeRequest(req, res, next);
}

module.exports = sanitizeMongoInput;
