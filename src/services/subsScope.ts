import { sortScoutSections } from "./sectionOrder.ts";

export const ALL_AUTHORISED_SECTIONS = "all";

export function authorisedSubsSections(sections: readonly string[], canGroupReport: boolean): string[] {
  const sectionRows = sortScoutSections(sections.filter((section) => section !== "Group"));
  return canGroupReport ? sectionRows : sectionRows;
}

export function normaliseSubsSection(
  requested: string | null | undefined,
  authorisedSections: readonly string[],
  canGroupReport: boolean
): string {
  const sections = sortScoutSections(authorisedSections);
  if (sections.length === 1) return sections[0] as string;
  if (requested && sections.includes(requested)) return requested;
  if (canGroupReport || sections.length > 1) return ALL_AUTHORISED_SECTIONS;
  return sections[0] ?? ALL_AUTHORISED_SECTIONS;
}

export function isMemberInSubsScope(section: string, selectedSection: string, authorisedSections: readonly string[]): boolean {
  if (!authorisedSections.includes(section)) return false;
  return selectedSection === ALL_AUTHORISED_SECTIONS || section === selectedSection;
}
