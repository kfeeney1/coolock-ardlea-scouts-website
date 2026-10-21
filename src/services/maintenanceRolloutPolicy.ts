export type MaintenanceExperienceVersion = "existing" | "redesigned";
/** Legacy configuration cannot opt members into the migrated SDK implementation. */
export function maintenanceVersion(data?: Record<string, unknown>): MaintenanceExperienceVersion {
  return data?.sdkRevision === 1 && data?.version === "redesigned" ? "redesigned" : "existing";
}
