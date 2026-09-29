export async function trySecondaryRefresh(
  refresh: () => Promise<void>,
  context: string
): Promise<boolean> {
  try {
    await refresh();
    return true;
  } catch (error) {
    console.error(`Unable to refresh ${context} after a successful save:`, error);
    return false;
  }
}
