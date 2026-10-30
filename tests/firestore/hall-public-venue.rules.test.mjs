import {readFile} from "node:fs/promises";
import {before, after, beforeEach, test} from "node:test";
import {assertFails, assertSucceeds, initializeTestEnvironment} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc} from "firebase/firestore";
let env;
before(async () => {env = await initializeTestEnvironment({projectId: "demo-hall-public-venue", firestore: {host: "127.0.0.1", port: Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080), rules: await readFile("firestore.rules", "utf8")}});});
beforeEach(async () => {await env.clearFirestore();}); after(async () => {await env.cleanup();});
async function facts(value) {await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), "siteSettings/hallHireVenue"), value));}
test("anonymous users read confirmed public venue facts only; unconfirmed or private fields are denied", async () => {
  const ref = doc(env.unauthenticatedContext().firestore(), "siteSettings/hallHireVenue");
  await facts({confirmed: false, name: "Illustrative hall"}); await assertFails(getDoc(ref));
  await facts({confirmed: true, name: "Confirmed hall", facilities: ["Confirmed facility"]}); await assertSucceeds(getDoc(ref));
  await facts({confirmed: true, name: "Confirmed hall", leaderNotes: "Private"}); await assertFails(getDoc(ref));
  await assertFails(setDoc(ref, {confirmed: true, name: "Forged venue"}));
});
