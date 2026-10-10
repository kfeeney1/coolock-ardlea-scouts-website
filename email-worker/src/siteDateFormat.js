const SITE_TIME_ZONE = "Europe/Dublin";

export function formatSiteDate(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: SITE_TIME_ZONE
  }).format(date).replaceAll("/", "-");
}
