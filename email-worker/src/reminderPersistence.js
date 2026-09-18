function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function base64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function reminderDocumentId({ memberId, recipientUid, cycleKey, reminderType = "medical-consent" }) {
  return base64Url([reminderType, memberId, recipientUid, cycleKey].map((value) => clean(value, 500)).join("|"));
}

export function reminderRecord({ memberId, recipientUid, cycleKey, reason, status, attemptCount = 0 }) {
  return {
    memberId: clean(memberId, 100),
    recipientUid: clean(recipientUid, 200),
    formType: "medical-consent",
    cycleKey: clean(cycleKey, 500),
    reason: reason === "expired" ? "expired" : "missing",
    status,
    attemptCount: Math.max(0, Number(attemptCount) || 0),
    actionPath: "/parent",
    deliveryChannel: "email"
  };
}

export function shouldAttemptReminder(existing) {
  if (!existing) return true;
  return existing.status !== "sent" && existing.status !== "sending";
}
