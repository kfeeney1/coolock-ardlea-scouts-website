import { leaderLegacyRedirects, type LeaderNavGroup, type LeaderNavItem } from "./leaderNavigation.ts";

const base = "https://navigation.invalid";

/** Resolve presentation state only from the caller's permission-filtered menu. */
export function resolveLeaderNavigation(locationPath: string, groups: LeaderNavGroup[], standalone: LeaderNavItem[]) {
  const current = new URL(locationPath, base);
  current.pathname = (leaderLegacyRedirects as Record<string, string>)[current.pathname] ?? current.pathname;
  const candidates = [
    ...standalone.map((item) => ({ item, groupId: null as string | null })),
    ...groups.flatMap((group) => group.items.map((item) => ({ item, groupId: group.id })))
  ];
  const matches = candidates.flatMap((candidate) => {
    const target = new URL(candidate.item.path, base);
    if (current.pathname !== target.pathname && (candidate.item.exactPath || target.pathname === "/leader" || !current.pathname.startsWith(`${target.pathname}/`))) return [];
    // A workspace view changes page identity; filters and query order do not.
    if (current.searchParams.get("view") !== target.searchParams.get("view")) return [];
    if ([...target.searchParams].some(([key, value]) => current.searchParams.get(key) !== value)) return [];
    if (target.hash && current.hash !== target.hash) return [];
    return [{ ...candidate, score: target.pathname.length * 100 + [...target.searchParams].length * 10 + (target.hash ? 1 : 0) }];
  });
  matches.sort((a, b) => b.score - a.score);
  return matches[0] ?? null;
}
