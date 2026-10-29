export function hallHireEnabled(setting?: Record<string, unknown> | null, readiness?: Record<string, unknown> | null): boolean {
  return setting?.enabled === true && readiness?.ready === true;
}
