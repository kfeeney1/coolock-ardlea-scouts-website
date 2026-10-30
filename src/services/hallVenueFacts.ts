export type HallVenueFacts = {confirmed: true; name: string; introduction: string; facilities: string[]; address: string; accessibility: string; imageUrl: string; imageAlt: string};
/** Only an explicitly confirmed, strictly public projection may supply venue claims. */
export function hallVenueFacts(value?: Record<string, unknown>): HallVenueFacts | null {
  if (!value || value.confirmed !== true || Object.keys(value).some(key => !["confirmed", "name", "introduction", "facilities", "address", "accessibility", "imageUrl", "imageAlt"].includes(key))) return null;
  const text = (key: string, max: number) => value[key] === undefined ? "" : typeof value[key] === "string" && value[key].length <= max ? value[key].trim() : null;
  const name = text("name", 200), introduction = text("introduction", 1500), address = text("address", 1000), accessibility = text("accessibility", 1000), imageUrl = text("imageUrl", 1500), imageAlt = text("imageAlt", 300);
  if ([name, introduction, address, accessibility, imageUrl, imageAlt].some(field => field === null)) return null;
  if (value.facilities !== undefined && (!Array.isArray(value.facilities) || value.facilities.length > 30 || value.facilities.some(item => typeof item !== "string" || item.length > 200))) return null;
  if (imageUrl && (!/^https:\/\/[^\s]+$/.test(imageUrl) || !imageAlt)) return null;
  return {confirmed: true, name: name!, introduction: introduction!, address: address!, accessibility: accessibility!, imageUrl: imageUrl!, imageAlt: imageAlt!, facilities: (value.facilities ?? []) as string[]};
}
