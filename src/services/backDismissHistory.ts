export const BACK_DISMISS_STATE_KEY = "__coolockArdleaBackDismissStack";

export type BackDismissLocationState = Record<string, unknown> & {
  [BACK_DISMISS_STATE_KEY]?: string[];
};

export function backDismissStack(state: unknown): string[] {
  if (!state || typeof state !== "object" || Array.isArray(state)) return [];
  const value = (state as BackDismissLocationState)[BACK_DISMISS_STATE_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function withBackDismissMarker(state: unknown, marker: string): BackDismissLocationState {
  const base = state && typeof state === "object" && !Array.isArray(state)
    ? { ...(state as Record<string, unknown>) }
    : {};
  const stack = backDismissStack(state);
  if (stack.at(-1) === marker) return base as BackDismissLocationState;
  return {
    ...base,
    [BACK_DISMISS_STATE_KEY]: [...stack.filter((item) => item !== marker), marker]
  };
}

export function hasBackDismissMarker(state: unknown, marker: string): boolean {
  return backDismissStack(state).includes(marker);
}

export function isTopBackDismissMarker(state: unknown, marker: string): boolean {
  return backDismissStack(state).at(-1) === marker;
}
