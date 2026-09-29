function siteBase(siteUrl) {
  return String(siteUrl || "").replace(/\/$/, "");
}

export function equipmentIncidentActionUrl(siteUrl, incidentId, itemId) {
  const base = siteBase(siteUrl);
  const issue = encodeURIComponent(String(incidentId || ""));
  const item = String(itemId || "").trim();
  return item
    ? `${base}/leader/equipment/${encodeURIComponent(item)}?issue=${issue}`
    : `${base}/leader/equipment?issue=${issue}`;
}

export function joinApplicationActionUrl(siteUrl, applicationId) {
  return `${siteBase(siteUrl)}/leader/join/${encodeURIComponent(String(applicationId || ""))}`;
}

export function leaderRequestActionUrl(siteUrl, requestId) {
  return `${siteBase(siteUrl)}/leader/requests?request=${encodeURIComponent(String(requestId || ""))}`;
}

export function parentAccessActionUrl(siteUrl, parentId) {
  return `${siteBase(siteUrl)}/leader/parent-access?parent=${encodeURIComponent(String(parentId || ""))}`;
}
