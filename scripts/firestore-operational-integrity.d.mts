export type OperationalIntegrityCollections = Map<string, Map<string, Record<string, unknown>>>;

export function validateOperationalIntegrity(collections: OperationalIntegrityCollections): string[];
