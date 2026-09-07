import { createHash } from "node:crypto";

const SECTION_NAMES = new Set(["Beavers", "Cubs", "Scouts"]);

export function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function normalizeIdentityText(value) {
  return cleanText(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeDate(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? "" : text;
}

export function splitDisplayName(displayName) {
  const parts = cleanText(displayName).split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) };
}

export function identityKey(record) {
  return `${normalizeIdentityText(record.displayName)}|${normalizeDate(record.dateOfBirth)}`;
}

export function deterministicMemberId(record) {
  const digest = createHash("sha256").update(`${identityKey(record)}|${record.section}`).digest("hex").slice(0, 24);
  return `import_member_${digest}`;
}

export function validateCandidate(candidate) {
  const errors = [];
  const displayName = cleanText(candidate.displayName);
  const dateOfBirth = normalizeDate(candidate.dateOfBirth);
  const section = cleanText(candidate.section);
  const name = splitDisplayName(displayName);
  if (!displayName) errors.push("display-name-required");
  if (!name) errors.push("name-needs-at-least-two-parts");
  if (!dateOfBirth) errors.push("invalid-date-of-birth");
  if (!SECTION_NAMES.has(section)) errors.push("invalid-section");
  return { errors, displayName, dateOfBirth, section, name };
}

export function planMemberImport(candidates, existingMembers = []) {
  const existingByIdentity = new Map();
  for (const member of existingMembers) {
    const key = identityKey(member);
    if (!key.startsWith("|")) existingByIdentity.set(key, [...(existingByIdentity.get(key) || []), member]);
  }

  const candidateByIdentity = new Map();
  const rejected = [];
  for (const candidate of candidates) {
    const validated = validateCandidate(candidate);
    if (validated.errors.length) {
      rejected.push({ sourceRef: candidate.sourceRef || "", reasons: validated.errors });
      continue;
    }
    const normalized = {
      ...candidate,
      displayName: validated.displayName,
      dateOfBirth: validated.dateOfBirth,
      section: validated.section,
      firstName: validated.name.firstName,
      lastName: validated.name.lastName
    };
    const key = identityKey(normalized);
    candidateByIdentity.set(key, [...(candidateByIdentity.get(key) || []), normalized]);
  }

  const creates = [];
  const matches = [];
  const conflicts = [];
  for (const [key, rows] of candidateByIdentity) {
    const sections = [...new Set(rows.map((row) => row.section))];
    if (rows.length > 1) {
      conflicts.push({ identityKey: key, sourceRefs: rows.map((row) => row.sourceRef || ""), sections, reason: sections.length > 1 ? "source-cross-section-duplicate" : "source-duplicate" });
      continue;
    }
    const row = rows[0];
    const existing = existingByIdentity.get(key) || [];
    if (existing.length > 1) {
      conflicts.push({ identityKey: key, sourceRefs: [row.sourceRef || ""], sections: [row.section], reason: "multiple-existing-matches", existingIds: existing.map((item) => item.id) });
      continue;
    }
    if (existing.length === 1) {
      const member = existing[0];
      if (cleanText(member.section) !== row.section) {
        conflicts.push({ identityKey: key, sourceRefs: [row.sourceRef || ""], sections: [row.section, cleanText(member.section)], reason: "existing-section-conflict", existingIds: [member.id] });
      } else {
        matches.push({ sourceRef: row.sourceRef || "", existingId: member.id, section: row.section });
      }
      continue;
    }
    creates.push({
      id: deterministicMemberId(row),
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      dateOfBirth: row.dateOfBirth,
      section: row.section,
      parentName: "",
      emailAddress: "",
      mobileNumber: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      status: "active",
      source: "spreadsheet-import",
      sourceJoinApplicationId: "",
      importBatch: cleanText(row.importBatch),
      importSourceRef: cleanText(row.sourceRef)
    });
  }

  return { creates, matches, conflicts, rejected };
}

export function aggregatePlan(plan) {
  const bySection = Object.fromEntries([...SECTION_NAMES].map((section) => [section, plan.creates.filter((item) => item.section === section).length]));
  return { proposedCreatesBySection: bySection, creates: plan.creates.length, existingMatches: plan.matches.length, conflicts: plan.conflicts.length, rejected: plan.rejected.length };
}
