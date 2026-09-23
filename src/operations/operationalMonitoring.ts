import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export type MonitorState = "Healthy" | "Warning" | "Critical" | "Missing" | "Unknown" | "Unavailable" | "Not applicable";

export type OperationalObservation = {
  id: string;
  service: string;
  environment: "TEST" | "PRODUCTION" | "BOTH";
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
  if (limit <= 0) return "Unknown";
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
  const snapshot = await getDocs(collection(db, "operationalMonitoring"));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as Partial<OperationalObservation>;
    return {
      id: entry.id,
      service: typeof data.service === "string" ? data.service : "Unknown service",
      environment: data.environment === "TEST" || data.environment === "BOTH" ? data.environment : "PRODUCTION",
      metric: typeof data.metric === "string" ? data.metric : "Unknown metric",
      state: ["Healthy","Warning","Critical","Missing","Unknown","Unavailable","Not applicable"].includes(String(data.state)) ? data.state as MonitorState : "Unknown",
      observedAt: typeof data.observedAt === "string" ? data.observedAt : null,
      source: typeof data.source === "string" ? data.source : "No authoritative source reported",
      sourceType: ["authoritative-live","provider-alert","local","manual"].includes(String(data.sourceType)) ? data.sourceType as OperationalObservation["sourceType"] : "unavailable",
      current: typeof data.current === "number" ? data.current : null,
      limit: typeof data.limit === "number" ? data.limit : null,
      unit: typeof data.unit === "string" ? data.unit : undefined,
      warningThreshold: typeof data.warningThreshold === "number" ? data.warningThreshold : null,
      criticalThreshold: typeof data.criticalThreshold === "number" ? data.criticalThreshold : null,
      reason: typeof data.reason === "string" ? data.reason : undefined,
      recovery: typeof data.recovery === "string" ? data.recovery : undefined,
      managementUrl: typeof data.managementUrl === "string" && data.managementUrl.startsWith("https://") ? data.managementUrl : undefined
    };
  });
}
