const Transaction = require("../../src/models/Transaction");
const Alert = require("../../src/models/Alert");
const User = require("../../src/models/User");

function indexKeys(schema) {
  return schema.indexes().map(([keys]) => JSON.stringify(keys));
}

describe("MongoDB indexes", () => {
  test("transaction query indexes are declared once", () => {
    const indexes = indexKeys(Transaction.schema);
    expect(new Set(indexes).size).toBe(indexes.length);
    expect(indexes).toContain(JSON.stringify({ customerId: 1, timestamp: -1, status: 1 }));
    expect(indexes).toContain(JSON.stringify({ status: 1, timestamp: -1 }));
  });

  test("alert queue and unique user email indexes are declared once", () => {
    const alertIndexes = indexKeys(Alert.schema);
    const userIndexes = indexKeys(User.schema);
    expect(new Set(alertIndexes).size).toBe(alertIndexes.length);
    expect(new Set(userIndexes).size).toBe(userIndexes.length);
    expect(alertIndexes).toContain(JSON.stringify({ alertStatus: 1, createdAt: -1 }));
    expect(User.schema.indexes()).toContainEqual([
      { email: 1 },
      expect.objectContaining({ unique: true })
    ]);
  });
});
