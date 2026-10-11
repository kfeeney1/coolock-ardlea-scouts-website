import type { LeaderMedicalDefaults } from "./leaderProfile";

function text(sources: Array<[Record<string, unknown>, string[]]>): string {
  for (const [source, keys] of sources) {
    for (const key of keys) {
      if (typeof source[key] === "string" && source[key].trim()) return source[key].trim();
    }
  }
  return "";
}

/** Resolve only records already looked up by the authenticated account UID. */
export function leaderMedicalDefaultsFromOwnRecords(
  admin: Record<string, unknown>,
  linkedMember: Record<string, unknown> | null,
  registration: Record<string, unknown>,
  authDisplayName: string
): LeaderMedicalDefaults {
  const member = linkedMember ?? {};
  return {
    name: text([[admin, ["displayName"]], [member, ["displayName"]], [registration, ["fullName"]]]) || authDisplayName || "",
    dob: text([[admin, ["dateOfBirth", "dob"]], [member, ["dateOfBirth"]]]),
    address: text([[admin, ["address", "homeAddress"]], [member, ["address", "homeAddress"]]]),
    mobile: text([[admin, ["mobileNumber", "mobile"]], [member, ["mobileNumber"]], [registration, ["mobileNumber"]]]),
    homePhone: text([[admin, ["homePhone"]]]),
    workPhone: text([[admin, ["workPhone"]]])
  };
}
