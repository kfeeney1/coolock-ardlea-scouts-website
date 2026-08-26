import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

export type ParentProgrammeItem = {
  name: string;
  durationMinutes: number;
};

export type ParentWeeklyMeetingProgramme = {
  id: string;
  section: string;
  meetingDate: string;
  status: "open" | "closed";
  location: string;
  theme: string;
  activities: ParentProgrammeItem[];
  badgework: ParentProgrammeItem[];
};

type WeeklyProgrammeSource = {
  section: string;
  meetingDate: string;
  status: "open" | "closed";
  location: string;
  theme: string;
  activities: Array<{ activity: string; durationMinutes: number }>;
  badgeworkPlan: Array<{ badge: string; durationMinutes: number }>;
};

const clean = (value: string, max: number) => value.trim().slice(0, max);
const cleanDuration = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(360, Math.round(value))) : 0;

export function buildParentWeeklyMeetingProgramme(source: WeeklyProgrammeSource): Omit<ParentWeeklyMeetingProgramme, "id"> {
  return {
    section: clean(source.section, 80),
    meetingDate: clean(source.meetingDate, 20),
    status: source.status === "closed" ? "closed" : "open",
    location: clean(source.location, 240),
    theme: clean(source.theme, 240),
    activities: source.activities
      .map((item) => ({ name: clean(item.activity, 240), durationMinutes: cleanDuration(item.durationMinutes) }))
      .filter((item) => item.name)
      .slice(0, 30),
    badgework: source.badgeworkPlan
      .map((item) => ({ name: clean(item.badge, 240), durationMinutes: cleanDuration(item.durationMinutes) }))
      .filter((item) => item.name)
      .slice(0, 30)
  };
}

function mapProgramme(snapshot: QueryDocumentSnapshot<DocumentData>): ParentWeeklyMeetingProgramme | null {
  const data = snapshot.data();
  const section = typeof data.section === "string" ? data.section.trim() : "";
  const meetingDate = typeof data.meetingDate === "string" ? data.meetingDate.trim() : "";
  if (!section || !meetingDate || !Array.isArray(data.activities) || !Array.isArray(data.badgework)) return null;
  const mapItems = (items: unknown[]) => items
    .map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const item = value as Record<string, unknown>;
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) return null;
      return { name, durationMinutes: typeof item.durationMinutes === "number" ? cleanDuration(item.durationMinutes) : 0 };
    })
    .filter((item): item is ParentProgrammeItem => item !== null);
  return {
    id: snapshot.id,
    section,
    meetingDate,
    status: data.status === "closed" ? "closed" : "open",
    location: typeof data.location === "string" ? data.location.trim() : "",
    theme: typeof data.theme === "string" ? data.theme.trim() : "",
    activities: mapItems(data.activities),
    badgework: mapItems(data.badgework)
  };
}

export async function loadParentWeeklyMeetingProgrammes(sections: string[]): Promise<ParentWeeklyMeetingProgramme[]> {
  const requested = [...new Set(sections.map((section) => section.trim()).filter(Boolean))];
  if (!requested.length) return [];
  const [{ collection, getDocs, query, where }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../firebase")
  ]);
  const snapshots = await Promise.all(requested.map((section) => getDocs(query(collection(db, "parentWeeklyMeetings"), where("section", "==", section)))));
  return snapshots
    .flatMap((snapshot) => snapshot.docs)
    .map(mapProgramme)
    .filter((record): record is ParentWeeklyMeetingProgramme => record !== null)
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export function buildWeeklyMeetingWhatsAppText(programme: Omit<ParentWeeklyMeetingProgramme, "id">): string {
  const lines = [`${programme.section} Weekly Meeting · ${programme.meetingDate}`];
  if (programme.location) lines.push(`Location: ${programme.location}`);
  if (programme.theme) lines.push(`Theme: ${programme.theme}`);
  if (programme.activities.length) {
    lines.push("", "Activities / Games:");
    for (const item of programme.activities) lines.push(`• ${item.name}${item.durationMinutes ? ` (${item.durationMinutes} min)` : ""}`);
  }
  if (programme.badgework.length) {
    lines.push("", "Badgework:");
    for (const item of programme.badgework) lines.push(`• ${item.name}${item.durationMinutes ? ` (${item.durationMinutes} min)` : ""}`);
  }
  return lines.join("\n");
}

export function buildWeeklyMeetingWhatsAppUrl(programme: Omit<ParentWeeklyMeetingProgramme, "id">): string {
  return `https://wa.me/?text=${encodeURIComponent(buildWeeklyMeetingWhatsAppText(programme))}`;
}
