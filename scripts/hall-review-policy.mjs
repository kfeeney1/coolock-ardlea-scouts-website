export const sourceKinds = {weeklyMeetings: "meeting", events: "event", "maintenance/group/appointments": "maintenance"};
export const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const equal = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
export const versionOf = timestamp => timestamp ? `${timestamp.seconds}:${timestamp.nanoseconds}` : "";
export function validVersion(value) {return typeof value === "string" && /^\d{1,12}:\d{1,9}$/.test(value) && Number(value.split(":")[1]) < 1_000_000_000;}
export function afterVersion(left, right) {
  if (!validVersion(left) || !validVersion(right)) return false;
  const [ls, ln] = left.split(":").map(Number), [rs, rn] = right.split(":").map(Number);
  return ls > rs || (ls === rs && ln > rn);
}
export async function digest(value) {return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable(value)))))].map(byte => byte.toString(16).padStart(2, "0")).join("");}
export function reviewedNonHall(snapshot, path, reviews) {
  const creation = snapshot.creations?.get(path), baseline = snapshot.collections.get("hall")?.get("group")?.baselineVersion;
  if (afterVersion(creation, baseline)) return true;
  return validVersion(creation) && reviews.some(review => review.path === path && review.createdVersion === creation && review.resource === "none" && Number.isSafeInteger(review.revision) && review.revision > 0 && typeof review.actorUid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(review.actorUid));
}
