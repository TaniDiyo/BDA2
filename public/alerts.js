const alertRows = document.querySelector("#alerts-body");
const alertFilter = document.querySelector("#alert-filter");
const alertPageSize = 10;
let alertPageNumber = 1;
let alertPages = 1;
let selectedAlertId;

function alertError(error) {
  const target = document.querySelector("#page-error");
  target.textContent = error.message;
  target.hidden = false;
}

function statusBadge(status) {
  const colorClass = status.toLowerCase().replaceAll("_", "-");
  return `<span class="badge badge-${colorClass}">${portalEscape(status.replaceAll("_", " "))}</span>`;
}

async function loadAlerts() {
  document.querySelector("#page-error").hidden = true;
  const query = new URLSearchParams({ page: alertPageNumber, limit: alertPageSize });
  if (alertFilter.value) query.set("alertStatus", alertFilter.value);
  try {
    const result = await portalFetch(`/api/alerts?${query}`);
    alertPages = Math.max(1, result.totalPages);
    alertPageNumber = result.page;
    document.querySelector("#alerts-page").textContent = `Page ${result.page} of ${alertPages}`;
    document.querySelector("#alerts-page-label").textContent = `Page ${result.page} of ${alertPages}`;
    document.querySelector("#alerts-prev").disabled = result.page <= 1;
    document.querySelector("#alerts-next").disabled = result.page >= alertPages;
    if (!result.data.length) {
      alertRows.innerHTML = '<tr><td class="table-state" colspan="8">No alerts found</td></tr>';
      return;
    }
    alertRows.innerHTML = result.data.map((alert) => {
      const transaction = alert.transaction || {};
      return `<tr><td>${portalEscape(alert.customerId)}</td><td>${portalEscape(transaction.merchant || "Transaction unavailable")}</td><td>${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(transaction.amount || 0)}</td><td>${alert.riskScore}</td><td>${statusBadge(alert.status)}</td><td>${statusBadge(alert.alertStatus)}</td><td>${new Date(alert.createdAt).toLocaleString("en-IN")}</td><td><button class="delete-button" data-open-alert="${portalEscape(alert._id)}">Review</button></td></tr>`;
    }).join("");
    alertRows.querySelectorAll("[data-open-alert]").forEach((button) => {
      button.addEventListener("click", () => openAlert(button.dataset.openAlert));
    });
  } catch (error) {
    alertError(error);
  }
}

async function openAlert(id) {
  try {
    const alert = await portalFetch(`/api/alerts/${encodeURIComponent(id)}`);
    selectedAlertId = id;
    const tx = alert.transaction || {};
    document.querySelector("#detail-title").textContent = `${alert.customerId} · ${alert.alertStatus}`;
    document.querySelector("#detail-transaction").innerHTML = [
      ["Merchant", tx.merchant], ["Amount", new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(tx.amount || 0)],
      ["Card", `**** ${tx.cardLast4 || "—"}`], ["Risk score", `${alert.riskScore} / 100`],
      ["Transaction status", alert.status], ["Country", tx.country || "—"]
    ].map(([label, value]) => `<div><span>${label}</span><strong>${portalEscape(value || "—")}</strong></div>`).join("");
    document.querySelector("#detail-reasons").innerHTML = alert.reasons.map((reason) => `<li>${portalEscape(reason)}</li>`).join("") || "<li>No rule reasons.</li>";
    document.querySelector("#detail-notes").innerHTML = alert.notes.map((note) => `<li><strong>${portalEscape(note.author?.name || "Analyst")}</strong> · ${new Date(note.createdAt).toLocaleString("en-IN")}<br>${portalEscape(note.text)}</li>`).join("") || "<li>No notes yet.</li>";
    document.querySelector("#alert-detail").hidden = false;
    document.querySelector("#alert-detail").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    alertError(error);
  }
}

document.querySelector("#close-detail").addEventListener("click", () => {
  document.querySelector("#alert-detail").hidden = true;
});
document.querySelectorAll("[data-alert-status]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!selectedAlertId) return;
    try {
      await portalFetch(`/api/alerts/${selectedAlertId}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertStatus: button.dataset.alertStatus })
      });
      await openAlert(selectedAlertId);
      await loadAlerts();
    } catch (error) { alertError(error); }
  });
});
document.querySelector("#assign-alert").addEventListener("click", async () => {
  try {
    await portalFetch(`/api/alerts/${selectedAlertId}/assign`, { method: "PUT" });
    await openAlert(selectedAlertId);
  } catch (error) { alertError(error); }
});
document.querySelector("#note-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = new FormData(event.currentTarget).get("text").trim();
  if (!text || !selectedAlertId) return;
  try {
    await portalFetch(`/api/alerts/${selectedAlertId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    event.currentTarget.reset();
    await openAlert(selectedAlertId);
  } catch (error) { alertError(error); }
});
alertFilter.addEventListener("change", () => { alertPageNumber = 1; loadAlerts(); });
document.querySelector("#alerts-prev").addEventListener("click", () => { alertPageNumber -= 1; loadAlerts(); });
document.querySelector("#alerts-next").addEventListener("click", () => { alertPageNumber += 1; loadAlerts(); });
document.addEventListener("fraudlens:ready", loadAlerts);
