/** SW-595: canonical event visibility policy.
 * Legacy events are visible. A hidden event is available only to the
 * canonical active Super Admin; clients must also enforce this on every
 * parent/leader list, direct route and derived event projection.
 */
export function isEventHidden(event: unknown): boolean {
  return Boolean(event && typeof event === "object"
    && "hidden" in event && (event as { hidden?: unknown }).hidden === true);
}

export function isCanonicalEventVisibilityAdmin(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const value = profile as { active?: unknown; role?: unknown };
  // Mirror the authoritative Firestore isSuperAdmin() predicate. Do not
  // require optional profile fields: legacy Super Admin accounts may omit them.
  return value.active === true && value.role === "super-admin";
}

export function canViewEventByVisibility(event: unknown, profile: unknown): boolean {
  return !isEventHidden(event) || isCanonicalEventVisibilityAdmin(profile);
}
