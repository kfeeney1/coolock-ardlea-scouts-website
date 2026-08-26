import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { auth, db } from "../firebase";
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

function mapProgrammeLibraryItem(id: string, value: Record<string, unknown>): ProgrammeLibraryItem | null {
  const kind = value.kind === "activity" || value.kind === "badgework" ? value.kind : null;
  const section = typeof value.section === "string" ? value.section.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!kind || !section || !name) return null;
  return cleanProgrammeLibraryInput({
    kind,
    section,
    name,
    leader: typeof value.leader === "string" ? value.leader : "",
    notes: typeof value.notes === "string" ? value.notes : "",
    equipment: typeof value.equipment === "string" ? value.equipment : "",
    durationMinutes: typeof value.durationMinutes === "number" ? value.durationMinutes : 0
  }) as ProgrammeLibraryItem;
}

export async function loadProgrammeLibrary(sections: string[]): Promise<ProgrammeLibraryItem[]> {
  const requested = [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
  if (!requested.length) return [];
  const snapshots = await Promise.all(requested.map((section) => getDocs(query(collection(db, "programmeLibrary"), where("section", "==", section)))));
  const items = snapshots.flatMap((snapshot) => snapshot.docs)
    .map((snapshot) => {
      const mapped = mapProgrammeLibraryItem(snapshot.id, snapshot.data());
      return mapped ? { ...mapped, id: snapshot.id } : null;
    })
    .filter((item): item is ProgrammeLibraryItem => item !== null);
  return sortProgrammeLibrary(items);
}

export async function createProgrammeLibraryItem(input: ProgrammeLibraryInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const cleaned = cleanProgrammeLibraryInput(input);
  if (!cleaned.section || !cleaned.name) throw new Error("Section and name are required.");
  const ref = await addDoc(collection(db, "programmeLibrary"), {
    ...cleaned,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateProgrammeLibraryItem(id: string, input: ProgrammeLibraryInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const cleaned = cleanProgrammeLibraryInput(input);
  if (!cleaned.section || !cleaned.name) throw new Error("Section and name are required.");
  await updateDoc(doc(db, "programmeLibrary", id), { ...cleaned, updatedBy: user.uid, updatedAt: serverTimestamp() });
}

export async function deleteProgrammeLibraryItem(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  await deleteDoc(doc(db, "programmeLibrary", id));
}
