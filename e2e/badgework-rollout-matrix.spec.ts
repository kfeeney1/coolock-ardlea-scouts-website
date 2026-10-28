import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { camping, clearBadgeworkProgress, configureBadgework, progressMemberIds, seedBadgeworkProgress } from "./support/badgework-progress-fixtures";
const password=process.env.E2E_TEST_USER_PASSWORD;
const parentUid="TEST_uid_beaver_parent_1";
let previousParent: FirebaseFirestore.DocumentData;
test.beforeEach(async()=>{test.skip(!password,"Configure canonical E2E credentials.");await seedBadgeworkProgress();const ref=scheduleFixtureDb().doc(`parentAccounts/${parentUid}`);previousParent=(await ref.get()).data()!;await ref.update({memberIds:progressMemberIds,linkedSections:["Scouts","Cubs"]});});
test.afterEach(async()=>{if(previousParent)await scheduleFixtureDb().doc(`parentAccounts/${parentUid}`).set(previousParent);await clearBadgeworkProgress();});
for(const badgework of [false,true]) for(let mask=0;mask<8;mask++) {
  const flags={leaderNavigation:Boolean(mask&1),scheduleExperience:Boolean(mask&2),meetingExperience:Boolean(mask&4)};
  test(`Badgework ${badgework} with navigation ${flags.leaderNavigation}, schedule ${flags.scheduleExperience}, meeting ${flags.meetingExperience}`,async({page,browser},testInfo)=>{
    await configureBadgework(badgework);const db=scheduleFixtureDb();const batch=db.batch();
    for(const [name,enabled] of Object.entries(flags))batch.set(db.doc(`siteSettings/${name}`),{version:enabled?"redesigned":"existing"});await batch.commit();
    await loginAsLeader(page,{email:"superadmin@example.com",password:password!});if(testInfo.project.name==="mobile-chromium")await page.setViewportSize({width:320,height:800});
    await page.goto("/leader/badgework");await expect(page.getByTestId("badgework-experience")).toHaveAttribute("data-experience",badgework?"redesigned":"existing");
    await expect(page.getByRole("heading",{name:badgework?"Progress":"Badgework Overview",exact:true})).toBeVisible();await expect(page.getByTestId("leader-dashboard-header")).toBeVisible();
    await page.getByRole("textbox",{name:"Search children"}).fill("SW546");const member=page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`);
    if(badgework)await expect(member.getByRole("figure",{name:"Camping stage 2",exact:true})).toContainText(`1/${camping.stages[1].requirements.length} competencies`);else await expect(member.getByTestId("badgework-skill-tile-camping")).toBeVisible();
    for(const [name,enabled] of Object.entries(flags))expect((await db.doc(`siteSettings/${name}`).get()).get("version")).toBe(enabled?"redesigned":"existing");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const expected=badgework?await member.getByRole("figure",{name:"Camping stage 2",exact:true}).locator("figcaption").innerText():"";
    const mobile=testInfo.project.name==="mobile-chromium";
    const context=await browser.newContext({baseURL:process.env.E2E_BASE_URL??"http://127.0.0.1:4173",isMobile:mobile,hasTouch:mobile,viewport:{width:mobile?320:1280,height:800}});
    try {
      const parent=await context.newPage();await parent.goto(`/parent?child=${progressMemberIds[0]}#parent-adventure-skills`);
      await parent.getByLabel("Email",{exact:true}).fill("test.beaver.parent1@example.com");await parent.getByLabel("Password",{exact:true}).fill(password!);await parent.getByRole("button",{name:"Sign In",exact:true}).click();
      const section=parent.getByTestId("parent-adventure-skills");await expect(section).toHaveAttribute("data-experience",badgework?"redesigned":"existing");
      if(badgework)await expect(section.getByRole("figure",{name:"Camping stage 2",exact:true}).locator("figcaption")).toHaveText(expected,{useInnerText:true});else await expect(section.getByTestId("badgework-skill-tile-camping")).toBeVisible();
      await expect(section.getByRole("button",{name:/^(Save|Discard|Award|Remove award|Record badgework|Export)/})).toHaveCount(0);
      expect(await parent.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    } finally {await context.close();}
  });
}
