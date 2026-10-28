import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { camping, clearBadgeworkProgress, configureBadgework, progressMemberIds, progressMemberName, savedProgressSnapshot, seedBadgeworkProgress } from "./support/badgework-progress-fixtures";
const password=process.env.E2E_TEST_USER_PASSWORD;
const parentUid="TEST_uid_beaver_parent_1";
let previousParent: FirebaseFirestore.DocumentData;
test.beforeEach(async()=>{
  test.skip(!password,"Configure canonical E2E credentials.");await seedBadgeworkProgress();
  const ref=scheduleFixtureDb().doc(`parentAccounts/${parentUid}`);previousParent=(await ref.get()).data()!;
  await ref.update({memberIds:progressMemberIds,linkedSections:["Scouts","Cubs"]});
});
test.afterEach(async()=>{await scheduleFixtureDb().doc(`parentAccounts/${parentUid}`).set(previousParent);await clearBadgeworkProgress();});
async function loginParent(page: Page, child=progressMemberIds[0]) {
  await page.goto(`/parent?child=${child}#parent-adventure-skills`);await page.getByLabel("Email",{exact:true}).fill("test.beaver.parent1@example.com");await page.getByLabel("Password",{exact:true}).fill(password!);await page.getByRole("button",{name:"Sign In",exact:true}).click();await expect(page.getByTestId("parent-adventure-skills")).toBeVisible();
}
for(const redesigned of [false,true]) test(`Parent saved-data parity and read-only navigation with redesign ${redesigned}`,async({page,browser},testInfo)=>{
  await configureBadgework(redesigned);await loginAsLeader(page,{email:"superadmin@example.com",password:password!});await page.goto("/leader/badgework");await page.getByRole("textbox",{name:"Search children"}).fill("SW546");
  const leader=page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`);
  const before=await savedProgressSnapshot();
  if(redesigned) {
    await expect(leader.getByRole("figure",{name:"Camping stage 2",exact:true})).toBeVisible();
    await expect(leader.getByRole("figure",{name:"Camping stage 2",exact:true}).getByRole("status")).toHaveCount(0);
  }
  const expected=redesigned ? await leader.getByRole("figure",{name:"Camping stage 2",exact:true}).locator("figcaption").innerText() : "";
  const source=redesigned ? await leader.getByRole("figure",{name:"Camping stage 2",exact:true}).locator("img").first().getAttribute("src") : "";
  await leader.getByRole("button",{name: redesigned ? `${progressMemberName} · Camping · Stage 2 · Open stage` : new RegExp(`${progressMemberName} · Camping`)}).click();
  await page.getByTestId("badgework-save-panel").waitFor();await page.getByRole("checkbox").nth(1).check();
  const mobile=testInfo.project.name==="mobile-chromium";
  const context=await browser.newContext({baseURL:process.env.E2E_BASE_URL??"http://127.0.0.1:4173",isMobile:mobile,hasTouch:mobile,viewport:{width:mobile?320:1280,height:800}});const parent=await context.newPage();
  // Keep parent fallback coverage explicit even when canonical Swimming art is available.
  await parent.route("**/badges/adventure-skills/swimming/original-stages.jpg",route=>route.fulfill({status:404,body:"Unavailable original"}));
  try {
    if(testInfo.project.name==="mobile-chromium")await parent.setViewportSize({width:320,height:800});
    await loginParent(parent);const section=parent.getByTestId("parent-adventure-skills");
    await expect(section).toHaveAttribute("data-experience",redesigned?"redesigned":"existing");
    await expect(section.getByRole("button",{name:/^(Save|Discard|Award|Remove award|Record badgework|Export)/})).toHaveCount(0);
    if(redesigned) {
      const badge=section.getByRole("figure",{name:"Camping stage 2",exact:true});await expect(badge).toBeVisible();await expect(badge.getByRole("status")).toHaveCount(0);expect(await badge.locator("figcaption").innerText()).toBe(expected);await expect(badge.locator("img").first()).toHaveAttribute("src",source!);
      await section.getByRole("button",{name:`${progressMemberName} · Camping · Stage 2 · Open stage`,exact:true}).click();
      await expect(section.getByRole("heading",{name:"Stage 2 competencies",exact:true})).toBeFocused();
      await expect(section.getByTestId("parent-stage-competencies").getByText("Completed",{exact:true})).toHaveCount(1);
      await section.getByRole("button",{name:"Camping · Show all stages",exact:true}).click();
      await expect(section.getByRole("figure",{name:"Camping stage 1",exact:true})).toContainText("Awarded");await expect(section.getByRole("figure",{name:"Camping stage 3",exact:true})).toContainText("Ready to award");
      await section.getByRole("button",{name:/Camping · Stage 3 · Open stage$/}).click();await expect(section.getByRole("heading",{name:"Stage 3 competencies",exact:true})).toBeFocused();
      await section.getByRole("button",{name:"Back to Adventure Skills",exact:true}).click();await section.getByRole("button",{name:/Swimming · Stage 1 · Open stage$/}).click();
      await section.getByRole("button",{name:"Swimming · Show all stages",exact:true}).click();await expect(section.getByRole("figure",{name:"Swimming stage 6",exact:true})).toBeVisible();await expect(section.getByRole("figure",{name:"Swimming stage 7",exact:true})).toHaveCount(0);
      await expect(section).toContainText("Original badge artwork unavailable");
      await parent.screenshot({path:testInfo.outputPath("parent-badgework.png"),fullPage:true});
    } else await expect(section.getByTestId("badgework-skill-tile-camping")).toBeVisible();
    await parent.getByRole("combobox",{name:"Viewing information for",exact:true}).click();await parent.getByRole("option",{name:/SW546 Other Member/}).click();await expect(parent.getByRole("status").filter({hasText:/Viewing SW546 Other Member/})).toBeVisible();
    await expect(section).toContainText("SW546 Other Member");
    if(redesigned) await expect(section.getByRole("figure",{name:"Camping stage 1",exact:true})).toContainText(`0/${camping.stages[0].requirements.length} competencies`);
    expect(await savedProgressSnapshot()).toEqual(before);
    expect(await parent.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {await context.close();await page.getByTestId("badgework-save-panel").getByRole("button",{name:"Discard",exact:true}).click();}
});

test("Forged child links cannot expose unrelated progress; parent writes remain denied",async({page})=>{
  await configureBadgework(true);await loginParent(page,"TEST_member_scout_01");
  await expect(page.getByTestId("parent-adventure-skills")).toContainText("SW546");
  await expect(page.getByRole("combobox",{name:"Viewing information for",exact:true})).not.toContainText("TEST_member_scout_01");
  const response=await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"test.beaver.parent1@example.com",password,returnSecureToken:true})});const {idToken}=await response.json();expect(typeof idToken).toBe("string");
  const base="http://127.0.0.1:8080/v1/projects/demo-coolock-ardlea-scouts/databases/(default)/documents";const headers={Authorization:`Bearer ${idToken}`,"Content-Type":"application/json"};
  expect((await fetch(`${base}/memberAdventureSkillProgress/${progressMemberIds[0]}/requirements/${camping.stages[0].requirements[0].id}`,{headers})).status).toBe(200);
  expect((await fetch(`${base}/memberAdventureSkillProgress/TEST_member_scout_01/requirements`,{headers})).status).toBe(403);
  expect((await fetch(`${base}/memberAdventureSkillProgress/${progressMemberIds[0]}/requirements/${camping.stages[0].requirements[0].id}`,{method:"DELETE",headers})).status).toBe(403);
  expect((await fetch(`${base}/siteSettings/badgeworkExperience`,{method:"PATCH",headers,body:JSON.stringify({fields:{version:{stringValue:"existing"}}})})).status).toBe(403);
  expect((await scheduleFixtureDb().doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/requirements/${camping.stages[0].requirements[0].id}`).get()).exists).toBe(true);
});
