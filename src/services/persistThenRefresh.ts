export type PersistThenRefreshResult =
  | { persisted: true; refreshed: true }
  | { persisted: true; refreshed: false; refreshError: unknown };

export async function persistThenRefresh(
  persist: () => Promise<unknown>,
  refresh: () => Promise<unknown>
): Promise<PersistThenRefreshResult> {
  await persist();
  try {
    await refresh();
    return { persisted: true, refreshed: true };
  } catch (refreshError) {
    return { persisted: true, refreshed: false, refreshError };
  }
}
