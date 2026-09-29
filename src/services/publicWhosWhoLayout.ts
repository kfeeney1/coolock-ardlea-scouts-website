import type { PublicWhosWhoLeader } from "./publicWhosWho";

export const PUBLIC_WHOS_WHO_SECTION_ORDER = ["Group", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers"] as const;

export function publicSectionsForLeader(leader: PublicWhosWhoLeader): string[] {
  const sections = leader.organisationSections.length > 0
    ? leader.organisationSections
    : [leader.organisationSection];
  return [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
}

export function publicWhosWhoSections(leaders: PublicWhosWhoLeader[]): string[] {
  const values = [...new Set(leaders.flatMap(publicSectionsForLeader))];
  return values.sort((a, b) => {
    const ai = PUBLIC_WHOS_WHO_SECTION_ORDER.indexOf(a as (typeof PUBLIC_WHOS_WHO_SECTION_ORDER)[number]);
    const bi = PUBLIC_WHOS_WHO_SECTION_ORDER.indexOf(b as (typeof PUBLIC_WHOS_WHO_SECTION_ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
}

function isSectionLeaderFor(leader: PublicWhosWhoLeader, section: string): boolean {
  return leader.publicAppointments?.some((appointment) =>
    appointment.section.trim().toLowerCase() === section.trim().toLowerCase()
    && appointment.role.trim().toLowerCase() === "section leader"
  ) ?? false;
}

export function publicLeadersForSection(leaders: PublicWhosWhoLeader[], section: string): PublicWhosWhoLeader[] {
  return leaders
    .filter((leader) => publicSectionsForLeader(leader).includes(section))
    .sort((a, b) =>
      Number(isSectionLeaderFor(b, section)) - Number(isSectionLeaderFor(a, section))
      || a.organisationOrder - b.organisationOrder
      || a.displayName.localeCompare(b.displayName)
      || a.uid.localeCompare(b.uid)
    );
}

export function publicSectionTestId(section: string): string {
  return section.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
}
