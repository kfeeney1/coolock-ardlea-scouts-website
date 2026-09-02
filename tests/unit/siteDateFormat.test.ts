import { describe, expect, it } from "vitest";

import { formatSiteDate } from "../../src/services/siteDateFormat";

describe("site date formatting", () => {
  it("formats date-only values as dd-mm-yyyy without timezone drift", () => {
    expect(formatSiteDate("2026-09-02")).toBe("02-09-2026");
  });

  it("zero-pads single digit days and months", () => {
    expect(formatSiteDate("2026-01-05")).toBe("05-01-2026");
  });

  it("leaves invalid string values available for legacy fallbacks", () => {
    expect(formatSiteDate("not-a-date")).toBe("not-a-date");
  });
});
