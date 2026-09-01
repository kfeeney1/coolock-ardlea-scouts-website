import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("leader dashboard header geometry", () => {
  it("owns a viewport-based width instead of inheriting each page container width", () => {
    const header = source("src/components/admin/LeaderDashboardHeader.tsx");
    expect(header).toContain('data-testid="leader-dashboard-header"');
    expect(header).toContain('"calc(100vw - 32px)"');
    expect(header).toContain('"calc(100vw - 48px)"');
    expect(header).toContain('maxWidth: 1536');
    expect(header).toContain('transform: "translateX(-50%)"');
  });

  it("keeps nested record routes matched to their parent navigation item", () => {
    const header = source("src/components/admin/LeaderDashboardHeader.tsx");
    expect(header).toContain('pathname.startsWith(`${itemPath}/`)');
  });
});
