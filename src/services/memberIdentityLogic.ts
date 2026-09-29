import { canonicalMemberSection } from "./memberSectionCore.mjs";

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function automaticDisplayName(firstName: string, lastName: string): string {
  return [clean(firstName, 100), clean(lastName, 100)].filter(Boolean).join(" ");
}

export { canonicalMemberSection };
