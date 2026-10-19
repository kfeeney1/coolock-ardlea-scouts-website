/** Text-only calendar captions. Full numeric dates still use formatSiteDate. */
export function scheduleCalendarParts(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  // The site deliberately overrides .format()/toLocaleDateString() for full
  // numeric dates. Read named parts so MON/OCT remain calendar captions.
  const parts = new Intl.DateTimeFormat("en-IE", { weekday: "short", month: "short", day: "2-digit", timeZone: "UTC" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return { weekday: part("weekday"), day: part("day"), month: part("month") };
}
