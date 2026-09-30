const text = (data: Record<string, unknown>, key: string) => typeof data[key] === "string" ? String(data[key]).trim() : "";
const YOUTH_SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]);

export type ConsentMemberDraft = {
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: string;
  section: string;
  parentName: string;
  emailAddress: string;
  mobileNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export function memberDraftFromYouthConsent(data: Record<string, unknown>): ConsentMemberDraft {
  const displayName = text(data, "childName");
  const parts = displayName.split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");
  const section = text(data, "section");
  const dateOfBirth = text(data, "childDOB");
  if (!firstName || !lastName) throw new Error("The consent child name must include a first name and surname before a member can be created.");
  if (!dateOfBirth) throw new Error("The consent date of birth is required before a member can be created.");
  if (!YOUTH_SECTIONS.has(section)) throw new Error("The consent must have a canonical youth section before a member can be created.");
  return {
    firstName, lastName, displayName, dateOfBirth, section,
    parentName: text(data, "parent1Name"),
    emailAddress: text(data, "email").toLowerCase(),
    mobileNumber: text(data, "mobile1"),
    emergencyContactName: text(data, "altContactName"),
    emergencyContactPhone: text(data, "altContactPhone")
  };
}
