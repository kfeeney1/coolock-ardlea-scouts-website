const BRAND = {
  groupName: "80th 160th Coolock Ardlea Scout Group",
  navy: "#17324D",
  coral: "#E76F51",
  background: "#F5F7FA",
  text: "#243447",
  muted: "#667085"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function brandedEmail({ heading, intro, bodyHtml = "", actionLabel, actionUrl, footer = "This message was sent by the Coolock Ardlea Scout Group website." }) {
  const action = actionLabel && actionUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:${BRAND.coral};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">${escapeHtml(actionLabel)}</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:${BRAND.background};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:${BRAND.background}"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:10px;overflow:hidden">
      <tr><td style="padding:28px;background:linear-gradient(135deg,${BRAND.coral},${BRAND.navy});color:#fff;text-align:center">
        <div style="font-size:24px;font-weight:800">${BRAND.groupName}</div>
        <div style="font-size:14px;margin-top:6px;opacity:.92">Scout Group Communications</div>
      </td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 16px;font-size:26px;color:${BRAND.navy}">${escapeHtml(heading)}</h1>
        <p style="font-size:16px;line-height:1.6;margin:0 0 16px">${escapeHtml(intro)}</p>
        ${bodyHtml}
        ${action}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;color:${BRAND.muted};font-size:12px;line-height:1.5">${escapeHtml(footer)}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

module.exports = { BRAND, brandedEmail, escapeHtml };
