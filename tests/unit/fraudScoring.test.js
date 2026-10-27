const {
  nextWelfordState,
  sampleStandardDeviation,
  amountPoints,
  averagePoints,
  velocityPoints,
  foreignCountryPoints,
  oddHoursPoints,
  newDevicePoints,
  anomalyPoints,
  unusualCategoryPoints,
  decideStatus,
  scoreTransaction
} = require("../../src/services/fraudScoring");

const rule = (key, threshold, points, extra = {}) => ({
  key,
  enabled: true,
  threshold,
  points,
  ...extra
});

describe("pure fraud scoring rules", () => {
  test("high amount triggers exactly at its threshold", () => {
    const result = amountPoints(50000, new Map([
      ["HIGH_AMOUNT", rule("HIGH_AMOUNT", 50000, 25)],
      ["VERY_HIGH_AMOUNT", rule("VERY_HIGH_AMOUNT", 100000, 40)]
    ]));
    expect(result).toHaveLength(1);
    expect(result[0].rule.key).toBe("HIGH_AMOUNT");
  });

  test("very high amount takes precedence at its exact threshold", () => {
    const result = amountPoints(100000, new Map([
      ["HIGH_AMOUNT", rule("HIGH_AMOUNT", 50000, 25)],
      ["VERY_HIGH_AMOUNT", rule("VERY_HIGH_AMOUNT", 100000, 40)]
    ]));
    expect(result).toHaveLength(1);
    expect(result[0].rule.key).toBe("VERY_HIGH_AMOUNT");
  });

  test("amount-vs-average requires three past transactions and exceeds the multiple", () => {
    const averageRule = rule("AMOUNT_VS_AVERAGE", 5, 25);
    expect(averagePoints(5001, { totalTransactions: 3, avgAmount: 1000 }, averageRule)).toHaveLength(1);
    expect(averagePoints(5000, { totalTransactions: 3, avgAmount: 1000 }, averageRule)).toHaveLength(0);
    expect(averagePoints(9000, { totalTransactions: 2, avgAmount: 1000 }, averageRule)).toHaveLength(0);
  });

  test("velocity includes the current transaction at the configured boundary", () => {
    const velocityRule = rule("VELOCITY", 3, 30, { windowMinutes: 10 });
    expect(velocityPoints(2, velocityRule)).toHaveLength(1);
    expect(velocityPoints(1, velocityRule)).toHaveLength(0);
  });

  test("foreign country comparison is case-insensitive", () => {
    const foreignRule = rule("FOREIGN_COUNTRY", 1, 20);
    expect(foreignCountryPoints({ country: "us", homeCountry: "US" }, foreignRule)).toHaveLength(0);
    expect(foreignCountryPoints({ country: "US", homeCountry: "IN" }, foreignRule)).toHaveLength(1);
  });

  test("odd-hours rule includes 1 AM and 4 AM UTC boundary hours", () => {
    const nightRule = rule("ODD_HOURS", 1, 10, { windowEnd: 4 });
    expect(oddHoursPoints({ timestamp: "2026-10-27T01:00:00Z" }, nightRule)).toHaveLength(1);
    expect(oddHoursPoints({ timestamp: "2026-10-27T04:59:00Z" }, nightRule)).toHaveLength(1);
    expect(oddHoursPoints({ timestamp: "2026-10-27T05:00:00Z" }, nightRule)).toHaveLength(0);
  });

  test("new device only triggers for existing profiles", () => {
    const deviceRule = rule("NEW_DEVICE", 1, 15);
    expect(newDevicePoints({ deviceId: "new" }, { totalTransactions: 0 }, deviceRule)).toHaveLength(0);
    expect(newDevicePoints({ deviceId: "new" }, { totalTransactions: 2, knownDevices: ["old"] }, deviceRule)).toHaveLength(1);
    expect(newDevicePoints({ deviceId: "old" }, { totalTransactions: 2, knownDevices: ["old"] }, deviceRule)).toHaveLength(0);
  });

  test("Welford update matches manually computed mean, M2, and sample standard deviation", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const state = values.reduce(nextWelfordState, { count: 0, mean: 0, m2: 0 });
    expect(state.count).toBe(8);
    expect(state.mean).toBeCloseTo(5, 10);
    expect(state.m2).toBeCloseTo(32, 10);
    expect(sampleStandardDeviation(state)).toBeCloseTo(Math.sqrt(32 / 7), 10);
  });

  test("z-score anomaly requires five prior transactions and positive standard deviation", () => {
    const anomalyRule = rule("ANOMALY_ZSCORE", 3, 30);
    const history = { amountCount: 8, amountMean: 100, amountM2: 7 * 10 * 10 };
    expect(anomalyPoints(history, anomalyRule, 130)).toHaveLength(0);
    const matches = anomalyPoints(history, anomalyRule, 131);
    expect(matches).toHaveLength(1);
    expect(matches[0].reason).toContain("3.1 standard deviations");
    expect(anomalyPoints({ ...history, amountCount: 4 }, anomalyRule, 1000)).toHaveLength(0);
    expect(anomalyPoints({ amountCount: 6, amountMean: 100, amountM2: 0 }, anomalyRule, 1000)).toHaveLength(0);
  });

  test("unusual merchant category requires ten prior transactions and a new category", () => {
    const categoryRule = rule("UNUSUAL_MERCHANT_CATEGORY", 10, 15);
    expect(unusualCategoryPoints({ totalTransactions: 9, knownCategories: [] }, categoryRule, "Travel")).toHaveLength(0);
    expect(unusualCategoryPoints({ totalTransactions: 10, knownCategories: ["Retail"] }, categoryRule, "Travel")).toHaveLength(1);
    expect(unusualCategoryPoints({ totalTransactions: 10, knownCategories: ["Travel"] }, categoryRule, "Travel")).toHaveLength(0);
  });

  test.each([
    [39, "APPROVED"],
    [40, "REVIEW"],
    [69, "REVIEW"],
    [70, "BLOCKED"]
  ])("status score boundary %i resolves to %s", (score, expected) => {
    expect(decideStatus(score, { reviewThreshold: 40, blockThreshold: 70 })).toBe(expected);
  });

  test("composed scoring caps at 100 and returns reasons for each matching rule", () => {
    const result = scoreTransaction({
      tx: { amount: 120000, country: "US", homeCountry: "IN", timestamp: "2026-10-27T02:00:00Z" },
      rules: [
        rule("VERY_HIGH_AMOUNT", 100000, 40),
        rule("FOREIGN_COUNTRY", 1, 20),
        rule("ODD_HOURS", 1, 50, { windowEnd: 4 })
      ],
      settings: { reviewThreshold: 40, blockThreshold: 70 },
      profile: null,
      recentCardCount: 0
    });
    expect(result).toMatchObject({ riskScore: 100, status: "BLOCKED" });
    expect(result.reasons).toHaveLength(3);
  });
});
