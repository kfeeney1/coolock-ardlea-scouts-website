import { ServiceFailure } from "./applicationErrors.ts";
// Objects can disappear between listing and reading (for example when another
// leader removes a photo). Only that case is recoverable: permission and network
// failures must still reach the gallery's error/retry state.
export async function loadGalleryItems<TItem, TPhoto>(
  items: TItem[],
  load: (item: TItem) => Promise<TPhoto | null>,
  release: (photos: TPhoto[]) => void,
): Promise<TPhoto[]> {
  const photos: TPhoto[] = [];
  try {
    for (const item of items) {
      try {
        const photo = await load(item);
        if (photo !== null) photos.push(photo);
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error
          && error.code === "storage/object-not-found") continue;
        throw error;
      }
    }
    return photos;
  } catch (error) {
    release(photos);
    throw error;
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message = "Operation timed out."): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new ServiceFailure(message, "storage/deadline-exceeded"));

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new ServiceFailure(message, "storage/deadline-exceeded")), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

// Cancel the underlying transfer on expiry: a UI-only timeout would leave an
// upload running and could create duplicates when the user retries.
export function completeGalleryUpload(
  task: { on: (event: "state_changed", next: undefined, error: (error: unknown) => void, complete: () => void) => () => void; cancel: () => boolean },
  deadlineMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      task.cancel();
      reject(new ServiceFailure("Gallery upload timed out.", "storage/upload-timeout"));
    }, deadlineMs);
    const unsubscribe = task.on("state_changed", undefined, (error) => {
      clearTimeout(timer);
      unsubscribe();
      reject(error);
    }, () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}
