export type MonitorState = "Healthy" | "Warning" | "Critical" | "Missing" | "Unknown" | "Unavailable" | "Not applicable" | "Notice" | "Exhausted";

export type OperationalObservation = {
  id: string;
  service: string;
  environment: "TEST" | "PRODUCTION" | "BOTH" | "Unknown";
  metric: string;
  state: MonitorState;
  observedAt: string | null;
  source: string;
  sourceType: "authoritative-live" | "provider-alert" | "local" | "manual" | "unavailable";
  current?: number | null;
  limit?: number | null;
  unit?: string;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  reason?: string;
  recovery?: string;
  managementUrl?: string;
  maxAgeHours?: number | null;
  resetsAt?: string | null;
  limitKind?: "hard-cap" | "allowance" | "reference";
  limitSource?: "provider-retrieved" | "configured-reference" | "unknown";
  evidence?: "available" | "unconfigured" | "unsupported" | "failed" | "stale" | "unknown";
};

export const BACKUP_POLICY = {
  warningAgeHours: 168,
  criticalAgeHours: 192,
  monitorMaxAgeHours: 26,
  policy: "Technical defaults pending organisational approval"
} as const;

export function classifyBackup(input: { latestSuccessAt?: string | null; lastAttemptAt?: string | null; lastAttemptOutcome?: string | null; observedAt?: string | null }, now = Date.now()): MonitorState {
  const observed = input.observedAt ? Date.parse(input.observedAt) : NaN;
  if (!Number.isFinite(observed) || observed > now + 5 * 60_000) return "Unknown";
  if (now - observed > BACKUP_POLICY.monitorMaxAgeHours * 3_600_000) return "Unavailable";
  if (input.lastAttemptOutcome === "failed" && input.lastAttemptAt) return "Critical";
  if (!input.latestSuccessAt) return "Missing";
  const success = Date.parse(input.latestSuccessAt);
  if (!Number.isFinite(success) || success > now + 5 * 60_000) return "Unknown";
  const ageHours = (now - success) / 3_600_000;
  if (ageHours > BACKUP_POLICY.criticalAgeHours) return "Critical";
  if (ageHours > BACKUP_POLICY.warningAgeHours) return "Warning";
  return "Healthy";
}

export function classifyQuota(current?: number | null, limit?: number | null, warning = 0.85, critical = 0.95): MonitorState {
  if (current == null || limit == null || !Number.isFinite(current) || !Number.isFinite(limit)) return "Unknown";
  if (limit <= 0 || current < 0 || !Number.isFinite(warning) || !Number.isFinite(critical) || warning < 0.7 || critical <= warning || critical > 1) return "Unknown";
  const ratio = current / limit;
  if (ratio >= 1) return "Exhausted";
  if (ratio >= critical) return "Critical";
  if (ratio >= warning) return "Warning";
  if (ratio >= 0.7) return "Notice";
  return "Healthy";
}

export function aggregateOperationalState(states: MonitorState[]): MonitorState {
  if (states.includes("Exhausted")) return "Exhausted";
  if (states.includes("Critical") || states.includes("Missing")) return "Critical";
  if (states.includes("Warning")) return "Warning";
  if (states.includes("Unknown") || states.includes("Unavailable")) return "Unknown";
  if (states.includes("Notice")) return "Notice";
  if (states.length && states.every((s) => s === "Not applicable")) return "Not applicable";
  return states.length ? "Healthy" : "Unknown";
}

// No provider calls: evaluate the cached evidence each time it is displayed.
export function evaluateObservation(row: OperationalObservation, environment: "TEST" | "PRODUCTION", now = Date.now()): OperationalObservation {
  const result = { ...row, limitSource: row.limitSource ?? "unknown" as const };
  const fail = (evidence: OperationalObservation["evidence"], reason: string): OperationalObservation => ({ ...result, state: "Unavailable", evidence, reason });
  if (row.environment !== environment && row.environment !== "BOTH") return { ...fail("unknown", "Observation environment does not match this application."), current: null, limit: null };
  if (row.evidence && row.evidence !== "available") return fail(row.evidence, row.reason || "Monitoring data is not available.");
  const observed = row.observedAt ? Date.parse(row.observedAt) : NaN;
  if (!Number.isFinite(observed) || observed > now + 300_000) return fail("unknown", "Observation time is missing, invalid or in the future.");
  // Existing daily assurance and weekly execution records have known cadences.
  const maxAge = row.id === "firestore-backup-production" ? 26
    : row.id === "firestore-backup-execution-production" ? 192 : row.maxAgeHours;
  if (maxAge == null || !Number.isFinite(maxAge) || maxAge <= 0) return fail("unknown", "Monitoring freshness policy is not configured.");
  if (now - observed > maxAge * 3_600_000) return fail("stale", "Monitoring evidence is stale; check its publisher.");
  if (row.resetsAt != null && (!Number.isFinite(Date.parse(row.resetsAt)) || Date.parse(row.resetsAt) <= now || Date.parse(row.resetsAt) <= observed)) return fail("stale", "Quota period has reset or its reset time is invalid; refresh provider evidence.");
  if (row.sourceType === "manual") return fail("unknown", "Configured reference evidence is not a live health observation.");
  if (row.sourceType === "unavailable") return fail("unsupported", row.reason || "No supported usage source is configured.");
  if (row.current != null && (!Number.isFinite(row.current) || row.current < 0)) return fail("failed", "Usage is invalid.");
  if (row.id === "firestore-backup-production" && ["Healthy", "Warning", "Critical"].includes(row.state)) {
    if (row.current == null) return fail("unknown", "Backup age is unavailable.");
    const age = row.current + Math.max(0, now - observed) / 3_600_000;
    result.state = row.state === "Critical" ? "Critical" : age > BACKUP_POLICY.criticalAgeHours ? "Critical" : age > BACKUP_POLICY.warningAgeHours ? "Warning" : "Healthy";
  } else if (row.limit != null) {
    result.state = result.limitSource === "unknown" ? "Unknown" : classifyQuota(row.current, row.limit, row.warningThreshold ?? 0.85, row.criticalThreshold ?? 0.95);
    if (result.state === "Exhausted" && row.limitKind !== "hard-cap") {
      result.state = "Critical";
      result.reason = "Reported allowance/reference reached; service exhaustion is not established.";
    }
    // A collector's explicit failure must not be erased by numerical usage.
    if (["Unknown", "Unavailable", "Missing", "Critical"].includes(row.state)) result.state = row.state;
  }
  return { ...result, evidence: "available" };
}

export function normaliseObservation(id: string, data: Partial<OperationalObservation>): OperationalObservation {
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    id,
    service: typeof data.service === "string" ? data.service : "Unknown service",
    environment: ["TEST", "PRODUCTION", "BOTH"].includes(String(data.environment)) ? data.environment! : "Unknown",
    metric: typeof data.metric === "string" ? data.metric : "Unknown metric",
    state: ["Healthy", "Notice", "Warning", "Critical", "Exhausted", "Missing", "Unknown", "Unavailable", "Not applicable"].includes(String(data.state)) ? data.state! : "Unknown",
    observedAt: typeof data.observedAt === "string" ? data.observedAt : null,
    source: typeof data.source === "string" ? data.source : "No authoritative source reported",
    sourceType: ["authoritative-live", "provider-alert", "local", "manual"].includes(String(data.sourceType)) ? data.sourceType! : "unavailable",
    current: number(data.current), limit: number(data.limit), maxAgeHours: number(data.maxAgeHours),
    warningThreshold: number(data.warningThreshold), criticalThreshold: number(data.criticalThreshold),
    resetsAt: typeof data.resetsAt === "string" ? data.resetsAt : null,
    limitKind: data.limitKind === "hard-cap" || data.limitKind === "allowance" ? data.limitKind : "reference",
    limitSource: ["provider-retrieved", "configured-reference"].includes(String(data.limitSource)) ? data.limitSource! : "unknown",
    evidence: ["available", "unconfigured", "unsupported", "failed", "stale", "unknown"].includes(String(data.evidence)) ? data.evidence : undefined,
    unit: typeof data.unit === "string" ? data.unit : undefined,
    reason: typeof data.reason === "string" ? data.reason : undefined,
    recovery: typeof data.recovery === "string" ? data.recovery : undefined,
    managementUrl: typeof data.managementUrl === "string" && /^https:\/\/(console.firebase.google.com|console.cloud.google.com|github.com|dash.cloudflare.com|resend.com)(\/|$)/.test(data.managementUrl) ? data.managementUrl : undefined
  };
}

export async function loadOperationalObservations(): Promise<OperationalObservation[]> {
  const [{ collection, getDocsFromServer }, { db, appEnvironment }] = await Promise.all([import("firebase/firestore"), import("../firebase")]);
  const snapshot = await getDocsFromServer(collection(db, "operationalMonitoring"));
  const environment = appEnvironment === "production" ? "PRODUCTION" : "TEST";
  return snapshot.docs.map(entry => evaluateObservation(normaliseObservation(entry.id, entry.data()), environment));
}
