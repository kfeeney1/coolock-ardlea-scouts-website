import { canonicalMemberSection } from "./memberIdentityLogic.ts";
import { canonicalMemberSections } from "./memberSectionCore.mjs";
import type { MemberStatus } from "./memberAdmin";

export type MemberManagementStatusFilter = MemberStatus | "all";

export function filterMemberRecords<T extends {
  section: string;
  sections?: string[];
  status: MemberStatus;
  displayName: string;
  firstName: string;
  lastName: string;
  parentName: string;
  emailAddress: string;
  mobileNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}>(
  members: readonly T[],
  sectionFilter: string,
  statusFilter: MemberManagementStatusFilter,
  search = ""
): T[] {
  const section = sectionFilter === "all" ? "all" : canonicalMemberSection(sectionFilter);
  const query = search.trim().toLowerCase();
  return members.filter((member) => {
    const memberSections = canonicalMemberSections(member.sections, member.section);
    if (section !== "all" && !memberSections.includes(section)) return false;
    if (statusFilter !== "all" && member.status !== statusFilter) return false;
    if (!query) return true;
    return [
      member.displayName, member.firstName, member.lastName, member.parentName, member.emailAddress,
      member.mobileNumber, ...memberSections, member.emergencyContactName, member.emergencyContactPhone
    ].join(" ").toLowerCase().includes(query);
  });
}
