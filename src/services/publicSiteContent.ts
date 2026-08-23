import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export type PublicSectionOption = {
  value: "Beavers" | "Cubs" | "Scouts" | "Ventures" | "Rovers" | "Scouter";
  label: string;
  ages: string;
  icon: string;
  youth: boolean;
};

export type PublicSiteContent = {
  contentVersion: 1;
  group: { name: string; headerPrimary: string; headerSecondary: string };
  navigation: Array<{ label: string; path: string }>;
  home: {
    eyebrow: string;
    tagline: string;
    discoverTitle: string;
    discoverIntro: string;
    featureCards: Array<{ title: string; description: string; accent: "coralLight" | "navyLight" | "communityLight" }>;
  };
  about: { title: string; intro: string; whosWhoTitle: string; whosWhoIntro: string };
  activities: { title: string; intro: string; emptyMessage: string };
  contact: { title: string; body: string };
  sections: PublicSectionOption[];
  join: { title: string; intro: string; successTitle: string; successMessage: string; reviewMessage: string };
  consent: { title: string; chooserTitle: string; chooserIntro: string; medicationNotice: string };
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}
function requiredText(record: Record<string, unknown>, key: string, scope: string): string {
  const value = text(record, key);
  if (!value) throw new Error(`publicSiteContent ${scope}.${key} is missing.`);
  return value;
}
function requiredObject(record: Record<string, unknown>, key: string, scope: string): Record<string, unknown> {
  const value = object(record[key]);
  if (!value) throw new Error(`publicSiteContent ${scope}.${key} is invalid.`);
  return value;
}

function parseSiteContent(data: Record<string, unknown>): PublicSiteContent {
  if (data.contentVersion !== 1) throw new Error("Unsupported publicSiteContent contentVersion.");
  if (data.testData !== true || data.testSeed !== "public-site-content-v1" || data.createdBySeed !== "TEST_SEED") {
    throw new Error("publicSiteContent is not the canonical seeded public content document.");
  }

  const group = requiredObject(data, "group", "site");
  const home = requiredObject(data, "home", "site");
  const about = requiredObject(data, "about", "site");
  const activities = requiredObject(data, "activities", "site");
  const contact = requiredObject(data, "contact", "site");
  const join = requiredObject(data, "join", "site");
  const consent = requiredObject(data, "consent", "site");

  if (!Array.isArray(data.navigation) || !Array.isArray(data.sections) || !Array.isArray(home.featureCards)) {
    throw new Error("publicSiteContent list fields are invalid.");
  }

  const navigation = data.navigation.map((entry, index) => {
    const item = object(entry);
    if (!item) throw new Error(`publicSiteContent navigation[${index}] is invalid.`);
    return { label: requiredText(item, "label", `navigation[${index}]`), path: requiredText(item, "path", `navigation[${index}]`) };
  });

  const allowedSectionValues = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Scouter"]);
  const sections = data.sections.map((entry, index) => {
    const item = object(entry);
    if (!item) throw new Error(`publicSiteContent sections[${index}] is invalid.`);
    const value = requiredText(item, "value", `sections[${index}]`);
    if (!allowedSectionValues.has(value) || typeof item.youth !== "boolean") throw new Error(`publicSiteContent sections[${index}] has invalid value/youth.`);
    return {
      value: value as PublicSectionOption["value"],
      label: requiredText(item, "label", `sections[${index}]`),
      ages: requiredText(item, "ages", `sections[${index}]`),
      icon: requiredText(item, "icon", `sections[${index}]`),
      youth: item.youth
    };
  });

  const featureCards = home.featureCards.map((entry, index) => {
    const item = object(entry);
    if (!item) throw new Error(`publicSiteContent home.featureCards[${index}] is invalid.`);
    const accent = requiredText(item, "accent", `home.featureCards[${index}]`);
    if (!new Set(["coralLight", "navyLight", "communityLight"]).has(accent)) throw new Error(`Invalid feature card accent ${accent}.`);
    return {
      title: requiredText(item, "title", `home.featureCards[${index}]`),
      description: requiredText(item, "description", `home.featureCards[${index}]`),
      accent: accent as "coralLight" | "navyLight" | "communityLight"
    };
  });

  return {
    contentVersion: 1,
    group: {
      name: requiredText(group, "name", "group"),
      headerPrimary: requiredText(group, "headerPrimary", "group"),
      headerSecondary: requiredText(group, "headerSecondary", "group")
    },
    navigation,
    home: {
      eyebrow: requiredText(home, "eyebrow", "home"),
      tagline: requiredText(home, "tagline", "home"),
      discoverTitle: requiredText(home, "discoverTitle", "home"),
      discoverIntro: requiredText(home, "discoverIntro", "home"),
      featureCards
    },
    about: {
      title: requiredText(about, "title", "about"),
      intro: requiredText(about, "intro", "about"),
      whosWhoTitle: requiredText(about, "whosWhoTitle", "about"),
      whosWhoIntro: requiredText(about, "whosWhoIntro", "about")
    },
    activities: {
      title: requiredText(activities, "title", "activities"),
      intro: requiredText(activities, "intro", "activities"),
      emptyMessage: requiredText(activities, "emptyMessage", "activities")
    },
    contact: {
      title: requiredText(contact, "title", "contact"),
      body: requiredText(contact, "body", "contact")
    },
    sections,
    join: {
      title: requiredText(join, "title", "join"),
      intro: requiredText(join, "intro", "join"),
      successTitle: requiredText(join, "successTitle", "join"),
      successMessage: requiredText(join, "successMessage", "join"),
      reviewMessage: requiredText(join, "reviewMessage", "join")
    },
    consent: {
      title: requiredText(consent, "title", "consent"),
      chooserTitle: requiredText(consent, "chooserTitle", "consent"),
      chooserIntro: requiredText(consent, "chooserIntro", "consent"),
      medicationNotice: requiredText(consent, "medicationNotice", "consent")
    }
  };
}

let cached: Promise<PublicSiteContent> | null = null;
export function loadPublicSiteContent(): Promise<PublicSiteContent> {
  if (!cached) {
    cached = getDoc(doc(db, "publicSiteContent", "TEST_site")).then((snapshot) => {
      if (!snapshot.exists()) throw new Error("Canonical public website content is missing from Firestore.");
      return parseSiteContent(snapshot.data());
    }).catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}
