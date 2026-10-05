export type AuthorisedScouterOption = { uid: string; displayName: string; sections: string[]; scoutingRole: string };

export function orderAuthorisedScouters(options: AuthorisedScouterOption[], memberSection = ""): AuthorisedScouterOption[] {
  const unique = new Map<string, AuthorisedScouterOption>();
  for (const option of options) if (!unique.has(option.uid)) unique.set(option.uid, option);
  return [...unique.values()].sort((left, right) => {
    const leftRelevant = memberSection && left.sections.includes(memberSection) ? 0 : 1;
    const rightRelevant = memberSection && right.sections.includes(memberSection) ? 0 : 1;
    return leftRelevant - rightRelevant || left.displayName.localeCompare(right.displayName) || left.uid.localeCompare(right.uid);
  });
}
