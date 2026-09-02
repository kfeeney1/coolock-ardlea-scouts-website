export type OperationalExportKind =
  | "member-list"
  | "membership-summary"
  | "event-overview"
  | "attendance-trends"
  | "event-roster"
  | "outstanding-consent";

export type ExportSensitivity = "aggregate" | "operational" | "contact";

export type OperationalExportPolicy = {
  kind: OperationalExportKind;
  sensitivity: ExportSensitivity;
  requiresSectionScope: boolean;
  excludedData: readonly string[];
};

export const OPERATIONAL_EXPORT_POLICIES: Readonly<Record<OperationalExportKind, OperationalExportPolicy>> = Object.freeze({
  "member-list": {
    kind: "member-list",
    sensitivity: "contact",
    requiresSectionScope: true,
    excludedData: ["date-of-birth", "medical", "emergency-contact"]
  },
  "membership-summary": {
    kind: "membership-summary",
    sensitivity: "aggregate",
    requiresSectionScope: true,
    excludedData: ["member-name", "contact", "date-of-birth", "medical", "emergency-contact"]
  },
  "event-overview": {
    kind: "event-overview",
    sensitivity: "aggregate",
    requiresSectionScope: true,
    excludedData: ["member-name", "contact", "date-of-birth", "medical", "emergency-contact"]
  },
  "attendance-trends": {
    kind: "attendance-trends",
    sensitivity: "aggregate",
    requiresSectionScope: true,
    excludedData: ["member-name", "contact", "date-of-birth", "medical", "emergency-contact"]
  },
  "event-roster": {
    kind: "event-roster",
    sensitivity: "operational",
    requiresSectionScope: true,
    excludedData: ["contact", "date-of-birth", "medical", "emergency-contact"]
  },
  "outstanding-consent": {
    kind: "outstanding-consent",
    sensitivity: "operational",
    requiresSectionScope: true,
    excludedData: ["contact", "date-of-birth", "medical", "emergency-contact"]
  }
});

export type ExportScope = {
  isAdmin: boolean;
  sections: readonly string[];
};

export function assertOperationalExportAllowed(kind: OperationalExportKind, scope: ExportScope): OperationalExportPolicy {
  const policy = OPERATIONAL_EXPORT_POLICIES[kind];
  if (!policy) throw new Error(`Unknown operational export: ${kind}`);

  const sections = [...new Set(scope.sections.map((section) => section.trim()).filter(Boolean))];
  if (policy.requiresSectionScope && !scope.isAdmin && sections.length === 0) {
    throw new Error(`Export ${kind} requires at least one permitted section.`);
  }
  return policy;
}
