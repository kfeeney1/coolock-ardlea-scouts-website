export type MonitorState = "Healthy" | "Warning" | "Critical" | "Missing" | "Unknown" | "Unavailable" | "Not applicable";

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
  maxAgeHours?: number;
  limitSource?: "provider-retrieved" | "configured-reference" | "unknown";
  evidence?: "available" | "unconfigured" | "unsupported" | "failed" | "stale" | "unknown";
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  reason?: string;
  recovery?: string;
  managementUrl?: string;
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
  if (current < 0 || limit <= 0 || warning <= 0 || critical < warning || critical > 1) return "Unknown";
  const ratio = current / limit;
  if (ratio >= critical) return "Critical";
  if (ratio >= warning) return "Warning";
  return "Healthy";
}

export function aggregateOperationalState(states: MonitorState[]): MonitorState {
  if (states.includes("Critical") || states.includes("Missing")) return "Critical";
  if (states.includes("Warning")) return "Warning";
  if (states.includes("Unknown") || states.includes("Unavailable")) return "Unknown";
  if (states.length && states.every((s) => s === "Not applicable")) return "Not applicable";
  return states.length ? "Healthy" : "Unknown";
}

export async function loadOperationalObservations(): Promise<OperationalObservation[]> {
  const [{ collection, getDocs }, { db }] = await Promise.all([import("firebase/firestore"), import("../firebase")]);
  const snapshot = await getDocs(collection(db, "operationalMonitoring"));
  return snapshot.docs.map((entry) => normaliseObservation(entry.id, entry.data()));
}

export function normaliseObservation(id: string, data: Partial<OperationalObservation>, now = Date.now()): OperationalObservation {
    const row: OperationalObservation = {
      id,
      service: typeof data.service === "string" ? data.service : "Unknown service",
      environment: ["TEST", "PRODUCTION", "BOTH"].includes(String(data.environment)) ? data.environment! : "Unknown",
      metric: typeof data.metric === "string" ? data.metric : "Unknown metric",
      state: ["Healthy","Warning","Critical","Missing","Unknown","Unavailable","Not applicable"].includes(String(data.state)) ? data.state as MonitorState : "Unknown",
      observedAt: typeof data.observedAt === "string" ? data.observedAt : null,
      source: typeof data.source === "string" ? data.source : "No authoritative source reported",
      sourceType: ["authoritative-live","provider-alert","local","manual"].includes(String(data.sourceType)) ? data.sourceType as OperationalObservation["sourceType"] : "unavailable",
      current: typeof data.current === "number" && Number.isFinite(data.current) && data.current >= 0 ? data.current : null,
      limit: typeof data.limit === "number" && Number.isFinite(data.limit) && data.limit > 0 ? data.limit : null,
      maxAgeHours: typeof data.maxAgeHours === "number" && Number.isFinite(data.maxAgeHours) && data.maxAgeHours > 0 ? data.maxAgeHours : undefined,
      limitSource: data.limitSource === "provider-retrieved" || data.limitSource === "configured-reference" ? data.limitSource : "unknown",
      evidence: ["unconfigured", "unsupported", "failed"].includes(String(data.evidence)) ? data.evidence : "available",
      unit: typeof data.unit === "string" ? data.unit : undefined,
      warningThreshold: typeof data.warningThreshold === "number" ? data.warningThreshold : null,
      criticalThreshold: typeof data.criticalThreshold === "number" ? data.criticalThreshold : null,
      reason: typeof data.reason === "string" ? data.reason : undefined,
      recovery: typeof data.recovery === "string" ? data.recovery : undefined,
      managementUrl: typeof data.managementUrl === "string" && data.managementUrl.startsWith("https://") ? data.managementUrl : undefined
    };
    const observed = row.observedAt ? Date.parse(row.observedAt) : NaN;
    // Legacy daily backup observations have a known cadence. Weekly execution
    // success is event evidence, never an assertion of current backup freshness.
    const maxAge = row.maxAgeHours ?? (id === "firestore-backup-production" ? 26 : id === "firestore-backup-execution-production" ? 192 : null);
    let issue: string | null = null;
    if (row.environment === "Unknown") issue = "Observation environment is missing or invalid.";
    else if (!Number.isFinite(observed) || observed > now + 300_000) issue = "Observation timestamp is missing, invalid or in the future.";
    else if (maxAge == null) issue = "Observation freshness policy is not configured.";
    else if (now - observed > maxAge * 3_600_000) {
      row.evidence = "stale";
      issue = "Observation is stale; check the publishing workflow or provider.";
    }
    else if (row.sourceType === "unavailable" || row.sourceType === "manual") issue = "No authoritative live health evidence is available.";
    else if (row.evidence !== "available") issue = `Metric is ${row.evidence}.`;
    if (issue) {
      // A known failure remains visible even when its evidence becomes stale.
      if (!["Critical", "Missing", "Warning"].includes(row.state)) row.state = row.evidence === "stale" || row.evidence === "failed" ? "Unavailable" : "Unknown";
      if (!row.reason?.includes(issue)) row.reason = `${issue}${row.reason ? " " + row.reason : ""}`;
    }
    return row;
}

export function observationsForEnvironment(rows: OperationalObservation[], environment: string): OperationalObservation[] {
  const target = environment === "test" ? "TEST" : environment === "production" ? "PRODUCTION" : null;
  return target ? rows.filter(row => row.environment === target || row.environment === "BOTH" || row.environment === "Unknown") : [];
}
