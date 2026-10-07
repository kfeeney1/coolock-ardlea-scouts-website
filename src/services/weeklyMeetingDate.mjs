const MEETING_DAY_BY_SECTION = Object.freeze({
  Cubs: 2,
  Ventures: 2,
  Beavers: 3,
  Scouts: 3
});

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextSectionMeetingDate(section, from = new Date()) {
  const targetDay = MEETING_DAY_BY_SECTION[section];
  if (targetDay === undefined) return localDateValue(from);
  const result = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let daysAhead = (targetDay - result.getDay() + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  result.setDate(result.getDate() + daysAhead);
  return localDateValue(result);
}

export { MEETING_DAY_BY_SECTION };
