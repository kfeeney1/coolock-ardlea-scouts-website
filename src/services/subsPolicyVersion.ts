import type { SubsRatePolicy } from "./subsLogic.ts";

/** A correction is a new immutable version, including when a later version is
 * future-dated and not yet the currently active policy. Never edit an old ID.
 */
export function nextSubsPolicyVersion(policies: readonly SubsRatePolicy[], period: string): number {
  return policies.reduce((highest, policy) => policy.period === period && Number.isSafeInteger(policy.version)
    ? Math.max(highest, policy.version) : highest, 0) + 1;
}
