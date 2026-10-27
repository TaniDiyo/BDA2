const statusNames = {
  APPROVED: "Approved",
  REVIEW: "Review",
  BLOCKED: "Blocked"
};
const statusSymbols = { APPROVED: "✓", REVIEW: "!", BLOCKED: "×" };
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

const form = document.querySelector("#transaction-form");
const formError = document.querySelector("#form-error");
const dashboardError = document.querySelector("#dashboard-error");
const submitButton = document.querySelector("#submit-button");
const transactionsBody = document.querySelector("#transactions-body");
const statusFilter = document.querySelector("#status-filter");
const resultBanner = document.querySelector("#result-banner");
const chartCanvas = document.querySelector("#risk-chart");
const chartEmpty = document.querySelector("#chart-empty");
const pageLabel = document.querySelector("#page-label");
const pageCount = document.querySelector("#page-count");
const previousPage = document.querySelector("#previous-page");
const nextPage = document.querySelector("#next-page");
const pageSize = 10;
let currentPage = 1;
let totalPages = 1;
let currentUser;
let riskChart;
let trendChart;

const token = localStorage.getItem("fraudlensToken");
if (!token) {
  window.location.replace("/login.html");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function hideError(element) {
  element.textContent = "";
  element.hidden = true;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${localStorage.getItem("fraudlensToken") || ""}`
    }
  });
  if (response.status === 401) {
    localStorage.removeItem("fraudlensToken");
    if (typeof window.fraudLensSessionExpired === "function") {
      window.fraudLensSessionExpired();
    } else {
      window.location.replace("/login.html");
    }
    throw new Error("Your session has expired. Please sign in again.");
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

function renderStats(stats) {
  document.querySelector("#stat-total").textContent = stats.total.toLocaleString("en-IN");
  document.querySelector("#stat-approved").textContent = stats.APPROVED.toLocaleString("en-IN");
  document.querySelector("#stat-review").textContent = stats.REVIEW.toLocaleString("en-IN");
  document.querySelector("#stat-blocked").textContent = stats.BLOCKED.toLocaleString("en-IN");
  document.querySelector("#chart-total").textContent = stats.total.toLocaleString("en-IN");
  document.querySelector("#stat-open-alerts").textContent = Number(stats.openAlerts || 0).toLocaleString("en-IN");
  document.querySelector("#stat-fraud-rate").textContent = `${Number(stats.fraudRate || 0).toFixed(1)}%`;
  document.querySelector("#stat-amount-blocked").textContent = currency.format(Number(stats.totalAmountBlocked || 0));

  const values = [stats.APPROVED, stats.REVIEW, stats.BLOCKED];
  chartEmpty.hidden = stats.total !== 0;
  chartCanvas.hidden = stats.total === 0;
  if (!window.Chart) {
    showError(dashboardError, "The chart library could not be loaded. Other dashboard data is still available.");
    return;
  }

  if (!riskChart) {
    riskChart = new Chart(chartCanvas, {
      type: "doughnut",
      data: {
        labels: ["Approved", "Review", "Blocked"],
        datasets: [{
          data: values,
          backgroundColor: ["#16a34a", "#f59e0b", "#dc2626"],
          borderWidth: 0,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "76%",
        plugins: {
          legend: { display: false },
          tooltip: { padding: 10, cornerRadius: 8 }
        }
      }
    });
  } else {
    riskChart.data.datasets[0].data = values;
    riskChart.update();
  }

  const trend = stats.transactionsByDay || [];
  const trendCanvas = document.querySelector("#trend-chart");
  if (!trendChart) {
    trendChart = new Chart(trendCanvas, {
      type: "line",
      data: {
        labels: trend.map((entry) => new Date(`${entry.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })),
        datasets: [{
          label: "Transactions",
          data: trend.map((entry) => entry.count),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, .12)",
          fill: true,
          tension: .35,
          pointRadius: 4,
          pointBackgroundColor: "#2563eb"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eef1f6" } },
          x: { grid: { display: false } }
        }
      }
    });
  } else {
    trendChart.data.labels = trend.map((entry) => new Date(`${entry.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }));
    trendChart.data.datasets[0].data = trend.map((entry) => entry.count);
    trendChart.update();
  }
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    transactionsBody.innerHTML = '<tr><td class="table-state" colspan="7">No transactions yet</td></tr>';
    return;
  }

  transactionsBody.innerHTML = transactions.map((transaction) => {
    const status = escapeHtml(transaction.status);
    const statusClass = transaction.status.toLowerCase();
    const score = Number(transaction.riskScore);
    const safeScore = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
    const date = new Date(transaction.timestamp);
    const formattedDate = Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
    const action = currentUser.role === "ADMIN"
      ? `<td><button class="delete-button" type="button" data-delete-id="${escapeHtml(transaction._id)}" aria-label="Delete transaction">Delete</button></td>`
      : "";
    return `
      <tr>
        <td><span class="transaction-card">**** ${escapeHtml(transaction.cardLast4)}</span><span class="transaction-customer">${escapeHtml(transaction.customerId)}</span></td>
        <td>${escapeHtml(transaction.merchant)}</td>
        <td class="amount-cell">${currency.format(Number(transaction.amount) || 0)}</td>
        <td class="risk-cell"><span class="risk-number">${safeScore}</span><span class="risk-track"><span class="risk-fill" data-status="${status}" style="width:${safeScore}%"></span></span></td>
        <td><span class="badge badge-${statusClass}">${escapeHtml(statusNames[transaction.status] || transaction.status)}</span></td>
        <td>${escapeHtml(formattedDate)}</td>
        ${action}
      </tr>`;
  }).join("");
  if (currentUser.role === "ADMIN") {
    transactionsBody.querySelectorAll("[data-delete-id]").forEach((button) => {
      button.addEventListener("click", () => deleteTransaction(button.dataset.deleteId));
    });
  }
}

async function refreshDashboard() {
  hideError(dashboardError);
  transactionsBody.innerHTML = '<tr><td class="table-state" colspan="7"><span class="spinner"></span> Loading transactions…</td></tr>';
  try {
    const parameters = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize)
    });
    if (statusFilter.value) parameters.set("status", statusFilter.value);
    const [stats, transactions] = await Promise.all([
      fetchJson("/api/stats"),
      fetchJson(`/api/transactions?${parameters}`)
    ]);
    renderStats(stats);
    totalPages = Math.max(1, transactions.totalPages);
    currentPage = transactions.page;
    pageLabel.textContent = `Page ${transactions.page} of ${totalPages}`;
    pageCount.textContent = `Page ${transactions.page} of ${totalPages}`;
    previousPage.disabled = transactions.page <= 1;
    nextPage.disabled = transactions.page >= totalPages;
    renderTransactions(transactions.data);
  } catch (error) {
    transactionsBody.innerHTML = '<tr><td class="table-state" colspan="7">Could not load transactions.</td></tr>';
    showError(dashboardError, error.message);
  }
}

async function deleteTransaction(id) {
  if (!window.confirm("Delete this transaction? This action cannot be undone.")) return;
  try {
    await fetchJson(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refreshDashboard();
  } catch (error) {
    showError(dashboardError, error.message);
  }
}

function renderResult(transaction) {
  const status = transaction.status;
  resultBanner.dataset.status = status;
  document.querySelector("#result-symbol").textContent = statusSymbols[status] || "!";
  document.querySelector("#result-title").textContent =
    `${statusNames[status] || status} transaction`;
  document.querySelector("#result-summary").textContent =
    `Risk score ${transaction.riskScore} / 100 · ${currency.format(transaction.amount)} at ${transaction.merchant}`;
  const reasons = document.querySelector("#result-reasons");
  reasons.replaceChildren();
  const displayedReasons = transaction.reasons.length
    ? transaction.reasons
    : ["No fraud rules were triggered."];
  for (const reason of displayedReasons) {
    const item = document.createElement("li");
    item.textContent = reason;
    reasons.append(item);
  }
  document.querySelector("#result-score").textContent = transaction.riskScore;
  resultBanner.hidden = false;
  resultBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(formError);
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Assessing…";

  const values = new FormData(form);
  const payload = {
    cardLast4: values.get("cardLast4").trim(),
    customerId: values.get("customerId").trim(),
    amount: Number(values.get("amount")),
    merchant: values.get("merchant").trim(),
    category: values.get("category").trim(),
    country: values.get("country").trim().toUpperCase(),
    homeCountry: values.get("homeCountry").trim().toUpperCase() || "IN",
    deviceId: values.get("deviceId").trim()
  };

  try {
    const transaction = await fetchJson("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    renderResult(transaction);
    form.reset();
    form.elements.country.value = "IN";
    form.elements.homeCountry.value = "IN";
    await refreshDashboard();
  } catch (error) {
    showError(formError, error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Assess transaction";
  }
});

statusFilter.addEventListener("change", () => {
  currentPage = 1;
  refreshDashboard();
});
previousPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    refreshDashboard();
  }
});
nextPage.addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage += 1;
    refreshDashboard();
  }
});
document.querySelector("#logout-button").addEventListener("click", () => {
  localStorage.removeItem("fraudlensToken");
  window.location.replace("/login.html");
});

async function initializeDashboard() {
  try {
    const response = await fetchJson("/api/auth/me");
    currentUser = response.user;
    document.querySelector("#user-name").textContent = currentUser.name;
    document.querySelector("#user-role").textContent = currentUser.role;
    document.querySelector("#admin-column").hidden = currentUser.role !== "ADMIN";
    await refreshDashboard();
  } catch (error) {
    if (localStorage.getItem("fraudlensToken")) {
      showError(dashboardError, error.message);
    }
  }
}

if (token) initializeDashboard();
