export const SCOUT_SECTION_ORDER = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"] as const;

const SECTION_RANK = new Map<string, number>(
  SCOUT_SECTION_ORDER.map((section, index) => [section.toLowerCase(), index])
);

export function sortScoutSections(sections: readonly string[]): string[] {
  const uniqueSections = [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
  return uniqueSections.sort((left, right) => {
    const leftRank = SECTION_RANK.get(left.toLowerCase());
    const rightRank = SECTION_RANK.get(right.toLowerCase());
    if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
    if (leftRank !== undefined) return -1;
    if (rightRank !== undefined) return 1;
    return left.localeCompare(right, "en", { sensitivity: "base" });
  });
}

export function sectionFilterOptions(sections: readonly string[]): string[] {
  return ["all", ...sortScoutSections(sections.filter((section) => section.toLowerCase() !== "all"))];
}
