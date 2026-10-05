export const MEMBER_PROGRAMME_SECTIONS: readonly ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
export function canonicalMemberSection(value: string): string;
export function memberSectionStorageAliases(value: string): readonly string[];

export function canonicalMemberSections(value: unknown, legacySection?: string): string[];
export function memberBelongsToSection(member: { sections?: unknown; section?: string } | null | undefined, section: string): boolean;

export function isMemberProgrammeSection(value: string): boolean;
export function memberProgrammeSections(value: unknown, legacySection?: string): string[];
