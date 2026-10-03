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
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new Error(message));

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);

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
