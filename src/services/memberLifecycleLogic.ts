export type MemberLifecycleStatus = "active" | "inactive" | "left";

export type MemberLifecycleChangeType =
  | "created"
  | "section-transfer"
  | "status-change"
  | "section-and-status-change";

export type LifecycleSnapshot = {
  section: string;
  status: MemberLifecycleStatus;
};

export type CanonicalMemberFields = {
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: string;
  section: string;
};

const REQUIRED_MEMBER_FIELDS: Array<[keyof CanonicalMemberFields, string]> = [
  ["firstName", "first name"],
  ["lastName", "last name"],
  ["displayName", "display name"],
  ["dateOfBirth", "date of birth"],
  ["section", "section"]
];

export function canonicalMemberFieldError(fields: CanonicalMemberFields): string | null {
  const missing = REQUIRED_MEMBER_FIELDS
    .filter(([key]) => !fields[key].trim())
    .map(([, label]) => label);

  if (missing.length === 0) return null;
  if (missing.length === 1) return `Member ${missing[0]} is required.`;
  return `Member ${missing.slice(0, -1).join(", ")} and ${missing.at(-1)} are required.`;
}

export function detectMemberLifecycleChange(
  previous: LifecycleSnapshot | null,
  next: LifecycleSnapshot
): MemberLifecycleChangeType | null {
  if (!previous) return "created";

  const sectionChanged = previous.section !== next.section;
  const statusChanged = previous.status !== next.status;

  if (sectionChanged && statusChanged) return "section-and-status-change";
  if (sectionChanged) return "section-transfer";
  if (statusChanged) return "status-change";
  return null;
}

export function lifecycleChangeLabel(type: MemberLifecycleChangeType): string {
  if (type === "created") return "Member created";
  if (type === "section-transfer") return "Section transfer";
  if (type === "status-change") return "Status change";
  return "Section and status change";
}
