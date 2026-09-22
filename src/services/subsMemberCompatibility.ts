import type { DocumentData } from "firebase/firestore";
import type { MemberRecord, MemberStatus } from "./memberAdmin";

const text = (data: DocumentData, key: string) => typeof data[key] === "string" ? data[key].trim() : "";

/** Finance selectors need only persisted identity, section and lifecycle state.
 * Older valid records pre-date later member-editor fields; blanks are not written back. */
export function mapSubsMember(id: string, data: DocumentData): MemberRecord | null {
  const displayName = text(data, "displayName");
  const section = text(data, "section");
  const status = data.status as MemberStatus;
  if (!displayName || !section || !["active", "inactive", "left"].includes(status)) return null;
  const parts = displayName.split(/\s+/);
  return {
    id, firstName: text(data, "firstName") || parts[0] || "",
    lastName: text(data, "lastName") || (parts.length > 1 ? parts.at(-1)! : ""),
    displayName, displayNameMode: data.displayNameMode === "custom" ? "custom" : "auto", dateOfBirth: text(data, "dateOfBirth"), section,
    parentName: text(data, "parentName"), emailAddress: text(data, "emailAddress"),
    mobileNumber: text(data, "mobileNumber"), emergencyContactName: text(data, "emergencyContactName"),
    emergencyContactPhone: text(data, "emergencyContactPhone"), status,
    familyId: text(data, "familyId"), source: text(data, "source"),
    sourceJoinApplicationId: text(data, "sourceJoinApplicationId"), createdAt: null, updatedAt: null
  };
}
