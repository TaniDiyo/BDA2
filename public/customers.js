const customerForm = document.querySelector("#customer-search");
const customerResult = document.querySelector("#customer-result");
const moneyFormat = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const customerDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function customerError(error) {
  const box = document.querySelector("#page-error");
  box.textContent = error.message;
  box.hidden = false;
}

function renderCustomer(profile) {
  customerResult.hidden = false;
  document.querySelector("#profile-customer-id").textContent = profile.customerId;
  const risk = document.querySelector("#risk-level");
  risk.textContent = profile.riskLevel;
  risk.className = `badge badge-risk-${profile.riskLevel.toLowerCase()}`;
  document.querySelector("#profile-total").textContent = profile.totalTransactions;
  document.querySelector("#profile-average").textContent = moneyFormat.format(profile.avgAmount);
  document.querySelector("#profile-maximum").textContent = moneyFormat.format(profile.maxAmount);
  document.querySelector("#profile-blocked").textContent = profile.blockedCount;
  document.querySelector("#profile-review").textContent = profile.reviewCount;
  document.querySelector("#profile-last").textContent = profile.lastTransactionAt
    ? customerDate.format(new Date(profile.lastTransactionAt))
    : "—";
  document.querySelector("#known-devices").innerHTML = (profile.knownDevices || []).map((device) => `<span class="profile-chip">${portalEscape(device)}</span>`).join("") || "None";
  document.querySelector("#known-countries").innerHTML = (profile.knownCountries || []).map((country) => `<span class="profile-chip">${portalEscape(country)}</span>`).join("") || "None";
  const body = document.querySelector("#customer-transactions");
  if (!profile.transactions.length) {
    body.innerHTML = '<tr><td class="table-state" colspan="6">No transactions yet</td></tr>';
    return;
  }
  body.innerHTML = profile.transactions.map((transaction) => `
    <tr><td>**** ${portalEscape(transaction.cardLast4)}</td><td>${portalEscape(transaction.merchant)}</td><td>${moneyFormat.format(transaction.amount)}</td><td>${transaction.riskScore}</td><td><span class="badge badge-${transaction.status.toLowerCase()}">${portalEscape(transaction.status)}</span></td><td>${customerDate.format(new Date(transaction.timestamp))}</td></tr>
  `).join("");
}

customerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  document.querySelector("#page-error").hidden = true;
  const customerId = new FormData(event.currentTarget).get("customerId").trim();
  try {
    renderCustomer(await portalFetch(`/api/customers/${encodeURIComponent(customerId)}`));
  } catch (error) {
    customerResult.hidden = true;
    customerError(error);
  }
});
