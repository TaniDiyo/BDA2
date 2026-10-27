function isEnabled(rule) {
  return Boolean(rule && rule.enabled);
}

function nextWelfordState({ count = 0, mean = 0, m2 = 0 }, value) {
  const nextCount = count + 1;
  const delta = value - mean;
  const nextMean = mean + delta / nextCount;
  const nextM2 = m2 + delta * (value - nextMean);
  return { count: nextCount, mean: nextMean, m2: nextM2 };
}

function sampleStandardDeviation({ count = 0, m2 = 0 }) {
  if (count < 2) return 0;
  return Math.sqrt(Math.max(0, m2 / (count - 1)));
}

function amountPoints(amount, rules) {
  const veryHigh = rules.get("VERY_HIGH_AMOUNT");
  const high = rules.get("HIGH_AMOUNT");
  if (isEnabled(veryHigh) && amount >= veryHigh.threshold) {
    return [{ rule: veryHigh, reason: `Very high transaction amount (₹${veryHigh.threshold.toLocaleString("en-IN")} or more).` }];
  }
  if (isEnabled(high) && amount >= high.threshold) {
    return [{ rule: high, reason: `High transaction amount (₹${high.threshold.toLocaleString("en-IN")} or more).` }];
  }
  return [];
}

function averagePoints(amount, profile, rule) {
  if (!isEnabled(rule) || !profile || profile.totalTransactions < 3) return [];
  return amount > rule.threshold * profile.avgAmount
    ? [{ rule, reason: `Amount is more than ${rule.threshold}× the customer's average.` }]
    : [];
}

function velocityPoints(recentCount, rule) {
  return isEnabled(rule) && recentCount + 1 >= rule.threshold
    ? [{ rule, reason: `${rule.threshold} or more transactions on this card within ${rule.windowMinutes || 10} minutes.` }]
    : [];
}

function foreignCountryPoints(tx, rule) {
  return isEnabled(rule) &&
    (tx.country || "").toUpperCase() !== (tx.homeCountry || "IN").toUpperCase()
    ? [{ rule, reason: "Transaction country differs from home country." }]
    : [];
}

function oddHoursPoints(tx, rule) {
  const hour = new Date(tx.timestamp || Date.now()).getUTCHours();
  const end = rule?.windowEnd ?? 4;
  return isEnabled(rule) && hour >= rule.threshold && hour <= end
    ? [{ rule, reason: `Transaction occurred between ${rule.threshold} AM and ${end} AM UTC.` }]
    : [];
}

function newDevicePoints(tx, profile, rule) {
  return isEnabled(rule) &&
    profile?.totalTransactions > 0 &&
    !(profile.knownDevices || []).includes(tx.deviceId)
    ? [{ rule, reason: "New device detected for an existing customer." }]
    : [];
}

function anomalyPoints(profile, rule, amount) {
  const count = profile?.amountCount ?? profile?.totalTransactions ?? 0;
  const mean = profile?.amountMean ?? profile?.avgAmount ?? 0;
  const m2 = profile?.amountM2 ?? 0;
  if (!isEnabled(rule) || count < 5) return [];
  const stdDev = sampleStandardDeviation({ count, m2 });
  if (stdDev === 0) return [];
  const zScore = (amount - mean) / stdDev;
  return zScore > rule.threshold
    ? [{
        rule,
        reason: `Amount is ${zScore.toFixed(1)} standard deviations above this customer's average.`
      }]
    : [];
}

function unusualCategoryPoints(profile, rule, category) {
  const knownCategories = profile?.knownCategories || [];
  return isEnabled(rule) &&
    profile?.totalTransactions >= 10 &&
    !knownCategories.includes(category)
    ? [{ rule, reason: "New merchant category for a customer with at least 10 past transactions." }]
    : [];
}

function decideStatus(score, settings) {
  if (score >= settings.blockThreshold) return "BLOCKED";
  if (score >= settings.reviewThreshold) return "REVIEW";
  return "APPROVED";
}

function scoreTransaction({ tx, rules: ruleList, settings, profile, recentCardCount }) {
  const rules = new Map(ruleList.map((rule) => [rule.key, rule]));
  const matches = [
    ...amountPoints(tx.amount, rules),
    ...averagePoints(tx.amount, profile, rules.get("AMOUNT_VS_AVERAGE")),
    ...velocityPoints(recentCardCount, rules.get("VELOCITY")),
    ...foreignCountryPoints(tx, rules.get("FOREIGN_COUNTRY")),
    ...oddHoursPoints(tx, rules.get("ODD_HOURS")),
    ...newDevicePoints(tx, profile, rules.get("NEW_DEVICE")),
    ...anomalyPoints(profile, rules.get("ANOMALY_ZSCORE"), tx.amount),
    ...unusualCategoryPoints(profile, rules.get("UNUSUAL_MERCHANT_CATEGORY"), tx.category)
  ];
  const riskScore = Math.min(100, matches.reduce((total, match) => total + match.rule.points, 0));
  return {
    riskScore,
    status: decideStatus(riskScore, settings),
    reasons: matches.map(({ reason }) => reason)
  };
}

module.exports = {
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
};
