import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const action = process.argv[2] || "seed";
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!["seed", "cleanup"].includes(action)) throw new Error("Usage: node scripts/seed-public-site-content.mjs seed|cleanup");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const ref = db.collection("publicSiteContent").doc("TEST_site");
const marker = { testData: true, testSeed: "public-site-content-v1", createdBySeed: "TEST_SEED" };

const content = {
  contentVersion: 1,
  group: {
    name: "80th 160th Coolock Ardlea Scout Group",
    headerPrimary: "80th 160th",
    headerSecondary: "Coolock Ardlea Scout Group"
  },
  navigation: [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Activities", path: "/activities" },
    { label: "Consent Form", path: "/activities/consent" },
    { label: "Contact", path: "/contact" }
  ],
  home: {
    eyebrow: "Welcome to",
    tagline: "Adventure • Skills • Community",
    discoverTitle: "Discover Scouting",
    discoverIntro: "Scouting gives young people the chance to explore, learn, make friends and play an active part in their community.",
    featureCards: [
      { title: "Adventure", description: "Take part in camps, hikes, outdoor challenges and unforgettable experiences.", accent: "coralLight" },
      { title: "Learn Skills", description: "Build confidence, teamwork, leadership and practical life skills through Scouting.", accent: "navyLight" },
      { title: "Community", description: "Make friends, help others and become part of a welcoming local Scout community.", accent: "communityLight" }
    ]
  },
  about: {
    title: "About Us",
    intro: "Welcome to 80th 160th Coolock Ardlea Scout Group.",
    whosWhoTitle: "Who’s Who",
    whosWhoIntro: "Meet the leaders who have chosen to be listed publicly."
  },
  activities: {
    title: "Upcoming Activities",
    intro: "Upcoming camps, trips and activities currently open in the Scout Group.",
    emptyMessage: "There are no upcoming activities published at the moment. Please check back soon."
  },
  contact: {
    title: "Contact Us",
    body: "Contact details will be added soon."
  },
  sections: [
    { value: "Beavers", label: "Beavers", ages: "Ages 6–9", icon: "🦫", youth: true },
    { value: "Cubs", label: "Cubs", ages: "Ages 9–12", icon: "🐯", youth: true },
    { value: "Scouts", label: "Scouts", ages: "Ages 12–15", icon: "⚜️", youth: true },
    { value: "Ventures", label: "Ventures", ages: "Ages 15–18", icon: "🧭", youth: true },
    { value: "Rovers", label: "Rover Scouts", ages: "Ages 18–26", icon: "🌍", youth: true },
    { value: "Scouter", label: "Scouter", ages: "18+ ES3", icon: "👤", youth: false }
  ],
  join: {
    title: "Join Us",
    intro: "Register your interest in joining our Scout group.",
    successTitle: "Thank You",
    successMessage: "Your joining enquiry has been received successfully.",
    reviewMessage: "A Scout leader will review the enquiry and contact you about the next steps."
  },
  consent: {
    title: "Scouting Ireland Consent Forms",
    chooserTitle: "Choose a Section",
    chooserIntro: "Youth sections use the Activities Consent Form. Scouters use the ES3 18+ Medical Advice Form.",
    medicationNotice: "The Managing Medications SIF 20/10 section is available within both form types when required."
  }
};

if (action === "seed") {
  await ref.set({ ...content, ...marker, updatedAt: FieldValue.serverTimestamp() });
  console.log("Seeded canonical public website content/configuration.");
} else {
  const snapshot = await ref.get();
  if (snapshot.exists) {
    const data = snapshot.data();
    if (data?.testData !== true || data?.testSeed !== marker.testSeed) throw new Error("Refusing to delete publicSiteContent/TEST_site without canonical seed marker.");
    await ref.delete();
  }
  console.log("Removed canonical public website content/configuration.");
}
