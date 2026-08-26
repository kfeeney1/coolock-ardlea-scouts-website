export type ImportedMeetingDraft = {
  title: string;
  meetingType: "leader" | "group-leaders" | "group";
  section: string;
  meetingDate: string;
  attendees: string[];
  notes: string;
  decisions: string;
  actions: string;
  warnings: string[];
};

const SECTION_NAMES = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"] as const;
const HEADING_ALIASES: Record<string, keyof Pick<ImportedMeetingDraft, "title" | "section" | "attendees" | "notes" | "decisions" | "actions"> | "date" | "type"> = {
  title: "title",
  meeting: "title",
  subject: "title",
  date: "date",
  "meeting date": "date",
  "date and time": "date",
  type: "type",
  "meeting type": "type",
  section: "section",
  attendees: "attendees",
  attendance: "attendees",
  present: "attendees",
  minutes: "notes",
  notes: "notes",
  "notes / minutes": "notes",
  decisions: "decisions",
  actions: "actions",
  "action items": "actions"
};

function cleanLine(value: string): string {
  return value.replace(/^\s*[-*•]\s*/, "").trim();
}

function normalizeText(raw: string): string {
  return raw
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function headingFor(line: string): { key: (typeof HEADING_ALIASES)[string]; inline: string } | null {
  const match = line.match(/^\s*([A-Za-z][A-Za-z /&-]{1,30})\s*:\s*(.*)$/);
  if (!match) return null;
  const key = HEADING_ALIASES[match[1].trim().toLowerCase()];
  return key ? { key, inline: match[2].trim() } : null;
}

function parseMeetingType(value: string): ImportedMeetingDraft["meetingType"] | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("group council")) return "group";
  if (normalized.includes("group leader")) return "group-leaders";
  if (normalized.includes("leader") || normalized.includes("section")) return "leader";
  return null;
}

function parseSection(value: string): string {
  const normalized = value.toLowerCase();
  return SECTION_NAMES.find((section) => normalized.includes(section.toLowerCase())) ?? "";
}

function toLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDate(value: string): string {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T${String(iso[4] ?? "00").padStart(2, "0")}:${iso[5] ?? "00"}`;

  const irish = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (irish) {
    const date = new Date(Number(irish[3]), Number(irish[2]) - 1, Number(irish[1]), Number(irish[4] ?? 0), Number(irish[5] ?? 0));
    if (!Number.isNaN(date.getTime())) return toLocalDateTime(date);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "" : toLocalDateTime(parsed);
}

function splitAttendees(value: string): string[] {
  return value
    .split(/\n|,|;/)
    .map(cleanLine)
    .filter(Boolean);
}

export function parseMeetingDocument(raw: string): ImportedMeetingDraft {
  const text = normalizeText(raw);
  const lines = text.split("\n");
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  const unheaded: string[] = [];

  for (const original of lines) {
    const line = original.trim();
    if (!line) continue;
    const heading = headingFor(line);
    if (heading) {
      current = heading.key;
      if (!sections.has(current)) sections.set(current, []);
      if (heading.inline) sections.get(current)!.push(heading.inline);
      continue;
    }
    if (current) sections.get(current)!.push(line);
    else unheaded.push(line);
  }

  const first = (key: string) => sections.get(key)?.join("\n").trim() ?? "";
  const title = first("title") || cleanLine(unheaded[0] ?? "");
  const meetingType = parseMeetingType(first("type")) ?? "leader";
  const section = parseSection(first("section"));
  const meetingDate = parseDate(first("date"));
  const attendees = splitAttendees(first("attendees"));
  const warnings: string[] = [];

  if (!title) warnings.push("No meeting title was found.");
  if (!meetingDate) warnings.push("No recognisable meeting date was found.");
  if (meetingType === "leader" && !section) warnings.push("No youth section was found for this leader meeting.");
  if (attendees.length === 0) warnings.push("No attendees were found.");

  return {
    title,
    meetingType,
    section,
    meetingDate,
    attendees,
    notes: first("notes"),
    decisions: first("decisions"),
    actions: first("actions"),
    warnings
  };
}

export function isSupportedMeetingImportFile(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  return mimeType.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".html") || lower.endsWith(".htm");
}
