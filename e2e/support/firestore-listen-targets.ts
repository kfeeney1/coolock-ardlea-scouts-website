import { isDeepStrictEqual } from "node:util";

type Query = {
  parent?: string;
  structuredQuery?: { from?: Array<{ collectionId: string; allDescendants?: boolean }>; where?: unknown };
};
export type ListenQueryTarget = { database: string; targetId: number; query: Query };

/** Count logical query targets, not WebChannel's replayable HTTP envelopes. */
export class FirestoreListenTargets {
  private readonly collectionId: string;
  private readonly targets = new Map<string, ListenQueryTarget>();
  constructor(collectionId: string) { this.collectionId = collectionId; }

  record(postData: string | null) {
    for (const value of new URLSearchParams(postData ?? "").values()) {
      if (!value.includes('"addTarget"')) continue;
      const message = JSON.parse(value) as { database?: string; addTarget?: { targetId?: number; query?: Query } };
      const target = message.addTarget;
      if (!target?.query?.structuredQuery?.from?.some(from => from.collectionId === this.collectionId)) continue;
      if (typeof message.database !== "string" || typeof target.targetId !== "number") throw new Error("Query target is missing its database or target ID.");
      const key = JSON.stringify([message.database, target.targetId]);
      const previous = this.targets.get(key);
      if (previous && !isDeepStrictEqual(previous.query, target.query)) throw new Error(`Query changed for existing Firestore target ${target.targetId}.`);
      this.targets.set(key, { database: message.database, targetId: target.targetId, query: target.query });
    }
  }

  values(): ListenQueryTarget[] { return [...this.targets.values()]; }
}
