import { SCOUT_SECTION_ORDER } from "../services/sectionOrder.ts";

export type ScoutSectionName = (typeof SCOUT_SECTION_ORDER)[number];

export type SectionVisualTokens = Readonly<{
  section: ScoutSectionName | null;
  accent: string;
  subtleBackground: string;
  border: string;
  foreground: string;
  hoverBackground: string;
  selectedBackground: string;
  focusRing: string;
  disabledBackground: string;
  disabledForeground: string;
}>;

const SECTION_ALIASES = new Map<string, ScoutSectionName>([
  ["beaver", "Beavers"],
  ["beavers", "Beavers"],
  ["beaver scout", "Beavers"],
  ["beaver scouts", "Beavers"],
  ["cub", "Cubs"],
  ["cubs", "Cubs"],
  ["cub scout", "Cubs"],
  ["cub scouts", "Cubs"],
  ["scout", "Scouts"],
  ["scouts", "Scouts"],
  ["venture", "Ventures"],
  ["ventures", "Ventures"],
  ["venture scout", "Ventures"],
  ["venture scouts", "Ventures"],
  ["rover", "Rovers"],
  ["rovers", "Rovers"],
  ["rover scout", "Rovers"],
  ["rover scouts", "Rovers"]
]);

/**
 * Semantic section colours for the application.
 *
 * The hue identities follow the approved ONE Programme section reference:
 * Beavers red, Cubs green, Scouts orange, Ventures purple and Rovers lime.
 * These values are deliberately accessibility-adjusted application colours rather than
 * claims about unpublished Scouting Ireland brand hex specifications.
 */
export const SECTION_VISUAL_TOKENS: Readonly<Record<ScoutSectionName, SectionVisualTokens>> = {
  Beavers: {
    section: "Beavers",
    accent: "#C62828",
    subtleBackground: "#FDECEC",
    border: "#EF9A9A",
    foreground: "#7F1D1D",
    hoverBackground: "#FAD7D7",
    selectedBackground: "#F5BDBD",
    focusRing: "#9B1C1C",
    disabledBackground: "#F3E4E4",
    disabledForeground: "#7A6666"
  },
  Cubs: {
    section: "Cubs",
    accent: "#2E7D32",
    subtleBackground: "#EDF7ED",
    border: "#A5D6A7",
    foreground: "#1B5E20",
    hoverBackground: "#DDF0DE",
    selectedBackground: "#C8E6C9",
    focusRing: "#1B5E20",
    disabledBackground: "#E7EFE7",
    disabledForeground: "#667566"
  },
  Scouts: {
    section: "Scouts",
    accent: "#B45309",
    subtleBackground: "#FFF4E5",
    border: "#F6C98D",
    foreground: "#7C2D12",
    hoverBackground: "#FFE8C7",
    selectedBackground: "#FFD7A0",
    focusRing: "#9A3E00",
    disabledBackground: "#F2EBE3",
    disabledForeground: "#75695E"
  },
  Ventures: {
    section: "Ventures",
    accent: "#7B1FA2",
    subtleBackground: "#F6ECF8",
    border: "#CE93D8",
    foreground: "#581C63",
    hoverBackground: "#EFDDF3",
    selectedBackground: "#E1BEE7",
    focusRing: "#6A1B9A",
    disabledBackground: "#EEE6F0",
    disabledForeground: "#726675"
  },
  Rovers: {
    section: "Rovers",
    accent: "#6A8A1F",
    subtleBackground: "#F4F8E8",
    border: "#C5D98D",
    foreground: "#3F5F00",
    hoverBackground: "#EBF3D6",
    selectedBackground: "#DDEBB4",
    focusRing: "#526D00",
    disabledBackground: "#EBEEE3",
    disabledForeground: "#6B705F"
  }
};

export const NEUTRAL_SECTION_VISUAL_TOKENS: SectionVisualTokens = {
  section: null,
  accent: "#64748B",
  subtleBackground: "#F8FAFC",
  border: "#CBD5E1",
  foreground: "#334155",
  hoverBackground: "#F1F5F9",
  selectedBackground: "#E2E8F0",
  focusRing: "#475569",
  disabledBackground: "#F1F5F9",
  disabledForeground: "#94A3B8"
};

export function resolveScoutSectionName(section: string | null | undefined): ScoutSectionName | null {
  if (!section) return null;
  return SECTION_ALIASES.get(section.trim().toLowerCase()) ?? null;
}

export function sectionVisualTokens(section: string | null | undefined): SectionVisualTokens {
  const canonicalSection = resolveScoutSectionName(section);
  return canonicalSection ? SECTION_VISUAL_TOKENS[canonicalSection] : NEUTRAL_SECTION_VISUAL_TOKENS;
}
