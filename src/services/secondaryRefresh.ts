import { reportApplicationError } from "./applicationErrors.ts";
export async function trySecondaryRefresh(
  refresh: () => Promise<void>,
  context: string
): Promise<boolean> {
  try {
    await refresh();
    return true;
  } catch (error) {
    reportApplicationError(error, { area: "secondaryRefresh", operation: `Refresh ${context} after a successful save` });
    return false;
  }
}
