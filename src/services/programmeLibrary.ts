import type { WeeklyActivityPlan, WeeklyBadgeworkPlan } from "./weeklyTracker";

export type ProgrammeLibraryKind = "activity" | "badgework";

export type ProgrammeLibraryItem = {
  id: string;
  kind: ProgrammeLibraryKind;
  section: string;
  name: string;
  leader: string;
  notes: string;
  equipment: string;
  durationMinutes: number;
};

export type ProgrammeLibraryInput = Omit<ProgrammeLibraryItem, "id">;

const clean = (value: string, max: number) => value.trim().slice(0, max);
const cleanDuration = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(360, Math.round(value))) : 0;

export function cleanProgrammeLibraryInput(input: ProgrammeLibraryInput): ProgrammeLibraryInput {
  return {
    kind: input.kind === "badgework" ? "badgework" : "activity",
    section: clean(input.section, 80),
    name: clean(input.name, 240),
    leader: clean(input.leader, 160),
    notes: clean(input.notes, 2000),
    equipment: clean(input.equipment, 1000),
    durationMinutes: cleanDuration(input.durationMinutes)
  };
}

export function programmeLibraryItemToActivity(item: ProgrammeLibraryItem): WeeklyActivityPlan {
  return {
    id: crypto.randomUUID(),
    activity: item.name,
    leader: item.leader,
    notes: item.notes,
    equipment: item.equipment,
    durationMinutes: item.durationMinutes
  };
}

export function programmeLibraryItemToBadgework(item: ProgrammeLibraryItem): WeeklyBadgeworkPlan {
  return {
    id: crypto.randomUUID(),
    badge: item.name,
    leader: item.leader,
    notes: item.notes,
    equipment: item.equipment,
    durationMinutes: item.durationMinutes
  };
}

export function isProgrammeLibraryItemForSection(item: ProgrammeLibraryItem, section: string): boolean {
  return item.section === section.trim();
}

export function sortProgrammeLibrary(items: ProgrammeLibraryItem[]): ProgrammeLibraryItem[] {
  return [...items].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}
