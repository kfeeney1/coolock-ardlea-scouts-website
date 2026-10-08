import type { EventAudience } from "./eventAdmin";
import type { MemberRecord } from "./memberAdmin";
import { memberBelongsToSection } from "./memberSectionCore.mjs";

export type EventAudienceMembership = {
  eventId: string;
  eventSection: string;
  memberId: string;
  scopeSection: string;
  selectedBySection: boolean;
  selectedIndividually: boolean;
};

function memberSections(member: MemberRecord): string[] {
  const sections = member.sections?.length ? member.sections : [member.section];
  return [...new Set(sections.filter((section): section is string => typeof section === "string" && Boolean(section.trim())))];
}

export function eventAudienceMembershipPath(eventId: string, memberId: string): string {
  return `events/${eventId}/audienceMembers/${memberId}`;
}

export function buildEventAudienceMemberships(
  eventId: string,
  eventSection: string,
  audience: EventAudience,
  members: MemberRecord[],
  authorisedSections: string[] = []
): EventAudienceMembership[] {
  const selectedById = new Set(audience.memberIds);
  const audienceSections = new Set(audience.sectionIds);
  const resolvedById = new Map(audience.resolvedMemberIds.map((id) => [id, true]));

  return members
    .filter((member) => member.status === "active" && resolvedById.has(member.id))
    .map((member): EventAudienceMembership | null => {
      const sections = memberSections(member);
      const matchingAudienceSection = [...audienceSections].find((section) => memberBelongsToSection(member, section));
      const selectedBySection = Boolean(matchingAudienceSection);
      const authorisedMemberSection = authorisedSections.find((section) => memberBelongsToSection(member, section));
      const scopeSection = matchingAudienceSection ?? authorisedMemberSection ?? (authorisedSections.length === 0 ? sections[0] : undefined);
      if (!scopeSection) return null;
      return {
        eventId,
        eventSection,
        memberId: member.id,
        scopeSection,
        selectedBySection,
        selectedIndividually: selectedById.has(member.id)
      };
    })
    .filter((membership): membership is EventAudienceMembership => membership !== null);
}

export function withPersistedEventAudience(audience: EventAudience): EventAudience {
  return {
    ...audience,
    version: 3,
    memberIds: [],
    resolvedMemberIds: []
  };
}

export function chunkEventAudienceMemberships<T>(memberships: T[], size = 16): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("Membership batch size must be a positive integer.");
  const chunks: T[][] = [];
  for (let offset = 0; offset < memberships.length; offset += size) {
    chunks.push(memberships.slice(offset, offset + size));
  }
  return chunks;
}
