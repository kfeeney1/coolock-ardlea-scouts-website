const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value) {
  const normalised = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (base64Url(bytes) !== String(value || "")) throw new Error("Non-canonical base64url encoding.");
  return bytes;
}

async function actionKey(secret) {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(String(secret || "")));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function requireSecret(env) {
  const secret = String(env.ACTION_LINK_SECRET || "");
  if (secret.length < 32) throw new Error("ACTION_LINK_SECRET is not configured.");
  return secret;
}

export async function issueMemberInactivationToken(env, memberId, ttlSeconds = 7 * 24 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    purpose: "member-inactivation",
    memberId: String(memberId || ""),
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ttlSeconds
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await actionKey(requireSecret(env)),
    encoder.encode(JSON.stringify(payload))
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function verifyMemberInactivationToken(env, token) {
  try {
    const [version, ivPart, ciphertextPart] = String(token || "").split(".");
    if (version !== "v1" || !ivPart || !ciphertextPart) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivPart) },
      await actionKey(requireSecret(env)),
      fromBase64Url(ciphertextPart)
    );
    const payload = JSON.parse(decoder.decode(plaintext));
    const now = Math.floor(Date.now() / 1000);
    if (
      payload?.v !== 1 ||
      payload?.purpose !== "member-inactivation" ||
      typeof payload.memberId !== "string" ||
      !payload.memberId ||
      typeof payload.jti !== "string" ||
      !payload.jti ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
