# FraudLens demo checklist

## Screenshots and capture order

1. **Login** — show the bright FraudLens sign-in screen; do not capture passwords or tokens.
2. **Dashboard with charts** — show headline transaction stats, the risk doughnut, seven-day trend, and recent activity.
3. **Blocked transaction result** — submit a high-value transaction from a foreign country and capture the BLOCKED result, risk score, and reasons. Use only a masked card value.
4. **Alerts workflow** — open the alert, assign it to the analyst, add a note, mark it Investigating, then confirm fraud; capture the updated status and note.
5. **Rules page** — show the enabled rules and decision thresholds. If changing a value, restore it after the demo.
6. **Evaluation page** — run evaluation and capture the confusion matrix and precision, recall, F1, and accuracy.
7. **Customer profile** — search for a demo customer and capture risk level, profile statistics, and recent transactions.

## Five-minute demo script

- **0:00–0:30 — Sign in:** Log in with the prepared demo account; point out that the dashboard is protected and roles control actions.
- **0:30–1:15 — Dashboard:** Explain the transaction totals, status breakdown, alerts, blocked amount, fraud rate, and recent trend chart.
- **1:15–2:00 — Score a transaction:** Submit a sample high-value foreign transaction. Explain why the rules add points and show the final BLOCKED score and reasons.
- **2:00–3:00 — Investigate:** Open the alert, assign it, add a note, mark it Investigating, and resolve it as confirmed fraud. Mention the audit trail captured by notes and status.
- **3:00–3:40 — Rules:** Show configurable rule thresholds and explain that administrative changes affect subsequent scoring.
- **3:40–4:20 — Customer:** Open the demo customer profile and explain the incremental statistics and risk level.
- **4:20–5:00 — Evaluation:** Run the evaluation and explain true/false positives and negatives, followed by precision, recall, F1, and accuracy. Clarify that these results compare only generated labelled demo data.
