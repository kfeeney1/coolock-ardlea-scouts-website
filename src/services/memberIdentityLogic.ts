import { resolveScoutSectionName } from "../theme/sectionColours.ts";

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function automaticDisplayName(firstName: string, lastName: string): string {
  return [clean(firstName, 100), clean(lastName, 100)].filter(Boolean).join(" ");
}

export function canonicalMemberSection(value: string): string {
  return resolveScoutSectionName(value) ?? value.trim();
}
