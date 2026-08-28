export const THEME_NAMES = ["default", "modern"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export function normalizeThemePreference(value: unknown): ThemeName {
  return value === "modern" ? "modern" : "default";
}
