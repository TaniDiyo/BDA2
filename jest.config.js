module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  collectCoverageFrom: ["src/services/**/*.js"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"]
};
