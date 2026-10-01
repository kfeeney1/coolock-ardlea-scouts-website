import { canonicalMemberSection } from "./memberIdentityLogic.ts";
import { canonicalMemberSections } from "./memberSectionCore.mjs";
import type { MemberStatus } from "./memberAdmin";

export type MemberManagementStatusFilter = MemberStatus | "all";

function normalizedNamePart(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

const surnameCollator = new Intl.Collator("en-IE", { sensitivity: "base", usage: "sort", ignorePunctuation: false });
const firstNameCollator = new Intl.Collator("en-IE", { sensitivity: "base", usage: "sort", ignorePunctuation: false });

export function compareMembersBySurname<T extends { id?: string; displayName: string; firstName: string; lastName: string }>(left: T, right: T): number {
  const leftSurname = normalizedNamePart(left.lastName);
  const rightSurname = normalizedNamePart(right.lastName);
  if (leftSurname && !rightSurname) return -1;
  if (!leftSurname && rightSurname) return 1;
  const surnameOrder = surnameCollator.compare(leftSurname, rightSurname);
  if (surnameOrder !== 0) return surnameOrder;
  const firstNameOrder = firstNameCollator.compare(
    normalizedNamePart(left.firstName) || normalizedNamePart(left.displayName),
    normalizedNamePart(right.firstName) || normalizedNamePart(right.displayName)
  );
  if (firstNameOrder !== 0) return firstNameOrder;
  return (left.id || "").localeCompare(right.id || "");
}

export function filterMemberRecords<T extends {
  id?: string;
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
  }).sort(compareMembersBySurname);
}
