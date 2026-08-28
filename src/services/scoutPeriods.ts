export type ScoutPeriod = {
  id: string;
  label: string;
  from: string;
  to: string;
};

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function scoutYearStartYear(reference = new Date()): number {
  const month = reference.getMonth() + 1;
  return month >= 9 ? reference.getFullYear() : reference.getFullYear() - 1;
}

export function buildScoutPeriods(reference = new Date()): ScoutPeriod[] {
  const startYear = scoutYearStartYear(reference);
  const endYear = startYear + 1;
  const shortEndYear = String(endYear).slice(-2);
  return [
    {
      id: "scout-year",
      label: `${startYear}/${shortEndYear} Scout Year`,
      from: isoDate(startYear, 9, 1),
      to: isoDate(endYear, 8, 31)
    },
    {
      id: "autumn",
      label: "Autumn Term",
      from: isoDate(startYear, 9, 1),
      to: isoDate(startYear, 12, 31)
    },
    {
      id: "spring",
      label: "Spring Term",
      from: isoDate(endYear, 1, 1),
      to: isoDate(endYear, 3, 31)
    },
    {
      id: "summer",
      label: "Summer Term",
      from: isoDate(endYear, 4, 1),
      to: isoDate(endYear, 8, 31)
    }
  ];
}

export function findScoutPeriod(periodId: string, reference = new Date()): ScoutPeriod | null {
  return buildScoutPeriods(reference).find((period) => period.id === periodId) ?? null;
}
