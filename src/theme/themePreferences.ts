export const THEME_NAMES = ["default", "modern", "irish-adventure", "uk-campaign", "programme-led"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export function normalizeThemePreference(value: unknown): ThemeName {
  return typeof value === "string" && (THEME_NAMES as readonly string[]).includes(value)
    ? value as ThemeName
    : "default";
}

export const THEME_OPTIONS: ReadonlyArray<{ name: ThemeName; label: string; description: string; isNew?: boolean }> = [
  { name: "default", label: "Current", description: "The existing Coolock-Ardlea look, unchanged." },
  { name: "modern", label: "Modern Scout", description: "The existing clean alternate theme." },
  { name: "irish-adventure", label: "Irish Adventure", description: "Image-led, welcoming and community-focused.", isNew: true },
  { name: "uk-campaign", label: "Bold Campaign", description: "Strong editorial headings and energetic calls to action.", isNew: true },
  { name: "programme-led", label: "Programme Explorer", description: "Clear cards, practical information and activity-first structure.", isNew: true }
];
