const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret, defineString } = require("firebase-functions/params");
const { brandedEmail, escapeHtml } = require("./emailBranding");

initializeApp();

const db = getFirestore();
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const EMAIL_FROM = defineString("EMAIL_FROM", {
  default: "80th 160th Coolock Ardlea Scout Group <onboarding@resend.dev>"
});
const SITE_URL = defineString("SITE_URL", {
  default: "https://coolock-ardlea-scouts.web.app"
});

async function sendEmail(to, subject, html) {
  if (!to) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY.value()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: EMAIL_FROM.value(),
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${detail}`);
  }
}

exports.parentAccessApprovedEmail = onDocumentUpdated(
  {
    document: "parentAccounts/{uid}",
    region: "europe-west1",
    secrets: [RESEND_API_KEY]
  },
  async (event) => {
    const before = event.data && event.data.before.data();
    const after = event.data && event.data.after.data();

    if (!before || !after || before.status === "approved" || after.status !== "approved") {
      return;
    }

    const email = typeof after.email === "string" ? after.email.trim() : "";
    if (!email) return;

    const name = typeof after.displayName === "string" && after.displayName.trim()
      ? after.displayName.trim()
      : "Parent / Guardian";

    const childCount = Array.isArray(after.memberIds) ? after.memberIds.length : 0;
    const bodyHtml = `<p style="font-size:16px;line-height:1.6">Your account has been linked to <strong>${childCount}</strong> member record${childCount === 1 ? "" : "s"}. You can now review and update the consent and medical information available to your account.</p>`;

    await sendEmail(
      email,
      "Parent access approved – Coolock Ardlea Scouts",
      brandedEmail({
        heading: "Parent access approved",
        intro: `Hello ${name}, your Parent Portal access has been approved.`,
        bodyHtml,
        actionLabel: "Open Parent Portal",
        actionUrl: `${SITE_URL.value()}/parent`
      })
    );
  }
);

exports.joinApplicationAdminEmail = onDocumentCreated(
  {
    document: "joinApplications/{applicationId}",
    region: "europe-west1",
    secrets: [RESEND_API_KEY]
  },
  async (event) => {
    const application = event.data && event.data.data();
    if (!application) return;

    const leaders = await db.collection("adminUsers").where("active", "==", true).get();
    const recipients = leaders.docs
      .map((doc) => doc.data())
      .filter((profile) => profile.role === "admin" || profile.role === "super-admin")
      .map((profile) => typeof profile.email === "string" ? profile.email.trim() : "")
      .filter(Boolean);

    if (!recipients.length) return;

    const childName = [application.childFirstName, application.childLastName]
      .filter((value) => typeof value === "string" && value.trim())
      .join(" ") || "New applicant";
    const section = typeof application.section === "string" ? application.section : "Not specified";
    const parentName = typeof application.parentName === "string" ? application.parentName : "Not specified";

    const bodyHtml = `<table role="presentation" style="font-size:15px;line-height:1.6;border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0;font-weight:700">Applicant</td><td>${escapeHtml(childName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:700">Section</td><td>${escapeHtml(section)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:700">Parent / Guardian</td><td>${escapeHtml(parentName)}</td></tr>
    </table>`;

    const html = brandedEmail({
      heading: "New Join Us application",
      intro: "A new application has been submitted through the website.",
      bodyHtml,
      actionLabel: "Review application",
      actionUrl: `${SITE_URL.value()}/leader/join`
    });

    await Promise.all(
      recipients.map((email) =>
        sendEmail(email, `New Join Us application – ${childName}`, html)
      )
    );
  }
);
