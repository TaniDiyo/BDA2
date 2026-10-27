const rulesBody = document.querySelector("#rules-body");
let canEditRules = false;

function showRulesError(error) {
  const element = document.querySelector("#page-error");
  element.textContent = error.message;
  element.hidden = false;
}

function renderRules(result) {
  const { rules, thresholds } = result;
  rulesBody.innerHTML = rules.map((rule) => `
    <tr data-rule-id="${portalEscape(rule._id)}">
      <td><strong>${portalEscape(rule.name)}</strong><span class="rule-key">${portalEscape(rule.key)}</span></td>
      <td class="rule-description">${portalEscape(rule.description)}</td>
      <td><input class="rule-enabled" type="checkbox" ${rule.enabled ? "checked" : ""} ${canEditRules ? "" : "disabled"} aria-label="Enable ${portalEscape(rule.name)}"></td>
      <td><input class="rule-threshold" type="number" min="0.01" step="any" value="${portalEscape(rule.threshold)}" ${canEditRules ? "" : "disabled"} aria-label="${portalEscape(rule.name)} threshold"></td>
      <td><input class="rule-points" type="number" min="0" max="100" step="any" value="${portalEscape(rule.points)}" ${canEditRules ? "" : "disabled"} aria-label="${portalEscape(rule.name)} points"></td>
      <td><button class="delete-button save-rule" ${canEditRules ? "" : "hidden"}>Save</button></td>
    </tr>`).join("");
  document.querySelector("#threshold-form").elements.reviewThreshold.value = thresholds.reviewThreshold;
  document.querySelector("#threshold-form").elements.blockThreshold.value = thresholds.blockThreshold;
  document.querySelectorAll(".save-rule").forEach((button) => {
    button.addEventListener("click", () => saveRule(button.closest("tr")));
  });
  document.querySelectorAll("#threshold-form input").forEach((input) => { input.disabled = !canEditRules; });
  document.querySelector("#threshold-form button").hidden = !canEditRules;
}

async function loadRules() {
  try {
    renderRules(await portalFetch("/api/rules"));
  } catch (error) { showRulesError(error); }
}

async function saveRule(row) {
  const update = {
    enabled: row.querySelector(".rule-enabled").checked,
    threshold: Number(row.querySelector(".rule-threshold").value),
    points: Number(row.querySelector(".rule-points").value)
  };
  try {
    const saved = await portalFetch(`/api/rules/${row.dataset.ruleId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update)
    });
    row.querySelector(".rule-threshold").value = saved.threshold;
    row.querySelector(".rule-points").value = saved.points;
    document.querySelector("#page-error").hidden = true;
  } catch (error) { showRulesError(error); }
}

document.querySelector("#threshold-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    await portalFetch("/api/rules/settings/thresholds", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewThreshold: Number(data.get("reviewThreshold")),
        blockThreshold: Number(data.get("blockThreshold"))
      })
    });
    await loadRules();
  } catch (error) { showRulesError(error); }
});

document.addEventListener("fraudlens:ready", (event) => {
  canEditRules = event.detail.role === "ADMIN";
  document.querySelector("#permission-label").textContent = canEditRules
    ? "Administrator controls enabled"
    : "Read-only · Admin access required to edit";
  loadRules();
});
