type DateInput = Date | number | string;

const SITE_DATE_LOCALE = "en-GB";
let installed = false;

const intlFormatDescriptor = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format");
const nativeIntlFormatGetter = intlFormatDescriptor?.get;
const nativeToLocaleDateString = Date.prototype.toLocaleDateString;
const nativeToLocaleString = Date.prototype.toLocaleString;
const nativeToLocaleTimeString = Date.prototype.toLocaleTimeString;

function asDate(value: DateInput | undefined): Date {
  if (value === undefined) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function nativeFormat(formatter: Intl.DateTimeFormat, value: Date): string {
  if (!nativeIntlFormatGetter) return formatter.format(value);
  return nativeIntlFormatGetter.call(formatter)(value);
}

export function formatSiteDate(value: DateInput, timeZone?: string): string {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "";
  const formatter = new Intl.DateTimeFormat(SITE_DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(timeZone ? { timeZone } : {})
  });
  return nativeFormat(formatter, date).replaceAll("/", "-");
}

function numericDateTimePart(value: string | undefined): "numeric" | "2-digit" | undefined {
  return value === "numeric" || value === "2-digit" ? value : undefined;
}

function timeZoneNamePart(value: string | undefined): Intl.DateTimeFormatOptions["timeZoneName"] {
  if (
    value === "long"
    || value === "short"
    || value === "shortOffset"
    || value === "longOffset"
    || value === "shortGeneric"
    || value === "longGeneric"
  ) return value;
  return undefined;
}

function timeOptionsFromResolved(options: Intl.ResolvedDateTimeFormatOptions): Intl.DateTimeFormatOptions {
  const result: Intl.DateTimeFormatOptions = {};
  const hour = numericDateTimePart(options.hour);
  const minute = numericDateTimePart(options.minute);
  const second = numericDateTimePart(options.second);
  const timeZoneName = timeZoneNamePart(options.timeZoneName);
  if (hour) result.hour = hour;
  if (minute) result.minute = minute;
  if (second) result.second = second;
  if (timeZoneName) result.timeZoneName = timeZoneName;
  if (options.hourCycle) result.hourCycle = options.hourCycle;
  if (options.timeZone) result.timeZone = options.timeZone;
  return result;
}

function resolvedIncludesDate(options: Intl.ResolvedDateTimeFormatOptions): boolean {
  return Boolean(options.year || options.month || options.day || options.weekday);
}

function resolvedIncludesTime(options: Intl.ResolvedDateTimeFormatOptions): boolean {
  return Boolean(options.hour || options.minute || options.second || options.timeZoneName);
}

export function installSitewideDateFormat(): void {
  if (installed || !nativeIntlFormatGetter) return;
  installed = true;

  Object.defineProperty(Intl.DateTimeFormat.prototype, "format", {
    configurable: true,
    get(this: Intl.DateTimeFormat) {
      const originalFormat = nativeIntlFormatGetter.call(this);
      const resolved = this.resolvedOptions();
      if (!resolvedIncludesDate(resolved)) return originalFormat;

      return (value?: Date | number) => {
        const date = asDate(value);
        if (Number.isNaN(date.getTime())) return originalFormat(value);
        const dateText = formatSiteDate(date, resolved.timeZone);
        if (!resolvedIncludesTime(resolved)) return dateText;
        const timeFormatter = new Intl.DateTimeFormat(resolved.locale, timeOptionsFromResolved(resolved));
        return `${dateText}, ${nativeFormat(timeFormatter, date)}`;
      };
    }
  });

  Date.prototype.toLocaleDateString = function (_locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions): string {
    if (Number.isNaN(this.getTime())) return nativeToLocaleDateString.call(this, _locales, options);
    return formatSiteDate(this, options?.timeZone);
  };

  Date.prototype.toLocaleString = function (locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions): string {
    if (Number.isNaN(this.getTime())) return nativeToLocaleString.call(this, locales, options);
    const dateText = formatSiteDate(this, options?.timeZone);
    const timeOptions: Intl.DateTimeFormatOptions = options
      ? {
          hour: options.hour,
          minute: options.minute,
          second: options.second,
          timeZoneName: options.timeZoneName,
          hour12: options.hour12,
          hourCycle: options.hourCycle,
          timeZone: options.timeZone
        }
      : { hour: "2-digit", minute: "2-digit", second: "2-digit" };
    const hasExplicitTime = !options || Boolean(options.hour || options.minute || options.second || options.timeZoneName || options.timeStyle);
    if (!hasExplicitTime) return dateText;
    return `${dateText}, ${nativeToLocaleTimeString.call(this, locales, timeOptions)}`;
  };
}
