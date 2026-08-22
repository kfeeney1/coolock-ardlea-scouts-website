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
