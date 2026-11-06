// Allowlisted aggregate payloads only. Never include raw provider errors/paths.
export function backupMonitoringPayload({ kind, state, age, observedAt }) {
  if (!["freshness", "execution"].includes(kind)) throw new Error("Unsupported backup observation kind");
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("Invalid observation timestamp");
  const validAge = typeof age === "number" && Number.isFinite(age) && age >= 0;
  const allowed = kind === "freshness" ? ["Healthy", "Warning", "Critical", "Missing", "Unavailable"] : ["Healthy", "Critical"];
  let safeState = allowed.includes(state) ? state : "Unavailable";
  if (kind === "freshness" && ["Healthy", "Warning", "Critical"].includes(safeState) && !validAge) safeState = "Unavailable";
  const reason = kind === "execution"
    ? safeState === "Healthy" ? "Backup execution completed and export metadata was verified; freshness is monitored separately." : "Backup attempt failed; inspect the existing workflow."
    : safeState === "Unavailable" ? "Backup inspection failed; latest successful backup age is unknown."
    : safeState === "Missing" ? "Successful bucket inspection found no backup export."
    : "Independent scheduled backup freshness assurance.";
  const values = {
    service: "Firestore Backup", environment: "PRODUCTION", metric: `backup ${kind}`,
    state: safeState, observedAt, source: kind === "freshness" ? "Firestore Backup Freshness GitHub Actions workflow" : "Firestore Backup GitHub Actions workflow",
    sourceType: "authoritative-live", evidence: safeState === "Unavailable" ? "failed" : "available",
    maxAgeHours: kind === "freshness" ? 26 : 192,
    reason, recovery: "Inspect Firestore Backup and Firestore Backup Freshness workflows; repair access before relying on backup assurance.",
    managementUrl: "https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions"
  };
  if (kind === "freshness") Object.assign(values, { unit: "hours old", warningThreshold: 168, criticalThreshold: 192 });
  // A failed inspection cannot manufacture zero or retain an earlier numeric age.
  if (kind === "freshness" && validAge && !["Unavailable", "Missing"].includes(safeState)) values.current = age;
  return { fields: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "number" ? { integerValue: String(value) } : { stringValue: value }])) };
}

if (process.argv[1]?.endsWith("backup-monitoring-payload.mjs")) {
  const age = process.env.AGE_HOURS?.trim();
  console.log(JSON.stringify(backupMonitoringPayload({ kind: process.env.OBSERVATION_KIND, state: process.env.STATE, age: age ? Number(age) : undefined, observedAt: process.env.OBSERVED_AT })));
}
