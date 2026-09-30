export function canonicalMemberSection(value: string): string;
export function memberSectionStorageAliases(value: string): readonly string[];

export function canonicalMemberSections(value: unknown, legacySection?: string): string[];
export function memberBelongsToSection(member: { sections?: unknown; section?: string } | null | undefined, section: string): boolean;
