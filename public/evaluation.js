const evaluationButton = document.querySelector("#run-evaluation");
const evaluationEmpty = document.querySelector("#evaluation-empty");
const evaluationResults = document.querySelector("#evaluation-results");
const evaluationError = document.querySelector("#evaluation-error");

function percentage(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

async function runEvaluation() {
  evaluationButton.disabled = true;
  evaluationButton.querySelector("span").textContent = "Evaluating…";
  evaluationError.hidden = true;
  try {
    const result = await portalFetch("/api/evaluation");
    evaluationEmpty.hidden = result.hasData;
    evaluationResults.hidden = !result.hasData;
    if (!result.hasData) return;
    document.querySelector("#matrix-tp").textContent = result.truePositives;
    document.querySelector("#matrix-fp").textContent = result.falsePositives;
    document.querySelector("#matrix-tn").textContent = result.trueNegatives;
    document.querySelector("#matrix-fn").textContent = result.falseNegatives;
    document.querySelector("#metric-precision").textContent = percentage(result.precision);
    document.querySelector("#metric-recall").textContent = percentage(result.recall);
    document.querySelector("#metric-f1").textContent = percentage(result.f1);
    document.querySelector("#metric-accuracy").textContent = percentage(result.accuracy);
    document.querySelector("#evaluation-sample").textContent = `Evaluated ${result.total.toLocaleString("en-IN")} labelled transactions. REVIEW and BLOCKED count as predicted fraud.`;
  } catch (error) {
    evaluationError.textContent = error.message;
    evaluationError.hidden = false;
  } finally {
    evaluationButton.disabled = false;
    evaluationButton.querySelector("span").textContent = "Run Evaluation";
  }
}

evaluationButton.addEventListener("click", runEvaluation);
document.addEventListener("fraudlens:ready", runEvaluation);
