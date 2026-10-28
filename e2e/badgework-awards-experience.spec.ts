import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { camping, clearBadgeworkProgress, configureBadgework, progressMemberIds, progressMemberName, seedBadgeworkProgress } from "./support/badgework-progress-fixtures";
const password=process.env.E2E_TEST_USER_PASSWORD;
test.beforeEach(async()=>{test.skip(!password,"Configure canonical E2E credentials.");await seedBadgeworkProgress();});
test.afterEach(async()=>{await clearBadgeworkProgress();});

test("Awards navigation is available only in the redesigned experience",async({page})=>{
  await configureBadgework(false);await loginAsLeader(page,{email:"superadmin@example.com",password:password!});await page.goto("/leader/badgework");
  await expect(page.getByRole("button",{name:"Awards",exact:true})).toHaveCount(0);
  await configureBadgework(true);await page.reload();await page.getByRole("button",{name:"Awards",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Awards",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:/^Ready to award ·/})).toBeVisible();
});

test("Selective and bulk confirmation create awards separately from completion and retain history/removal confirmation",async({page},testInfo)=>{
  const db=scheduleFixtureDb();const stage=camping.stages[2];const batch=db.batch();
  for(const requirement of stage.requirements){const source=await db.doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/requirements/${requirement.id}`).get();batch.set(db.doc(`memberAdventureSkillProgress/${progressMemberIds[1]}/requirements/${requirement.id}`),{...source.data(),memberId:progressMemberIds[1]});}await batch.commit();
  await configureBadgework(true);await loginAsLeader(page,{email:"modernsuperadmin@example.com",password:password!});
  if(testInfo.project.name==="mobile-chromium")await page.setViewportSize({width:320,height:800});
  await page.goto("/leader/badgework");await page.getByRole("button",{name:"Awards",exact:true}).click();
  await page.getByRole("textbox",{name:"Search children"}).fill("SW546");await page.getByRole("button",{name:"Filters",exact:true}).click();
  await page.getByRole("combobox",{name:"Adventure Skill",exact:true}).click();await page.getByRole("option",{name:"Camping",exact:true}).click();
  const queue=page.getByTestId("badgework-awaiting-award-queue");const awardRef=(index:number)=>db.doc(`memberAdventureSkillProgress/${progressMemberIds[index]}/awards/camping-stage-3`);
  await expect(queue.getByRole("figure",{name:"Camping stage 3",exact:true})).toHaveCount(2);expect((await awardRef(0).get()).exists).toBe(false);
  await queue.getByRole("checkbox",{name:`Select ${progressMemberName} Camping Stage 3 for award`,exact:true}).check();await queue.getByRole("button",{name:"Award selected · 1",exact:true}).click();
  const confirm=page.getByRole("dialog",{name:"Award selected ready badges?",exact:true});await confirm.getByRole("button",{name:"Cancel",exact:true}).click();expect((await awardRef(0).get()).exists).toBe(false);
  await queue.getByRole("button",{name:"Award selected · 1",exact:true}).click();await confirm.getByRole("button",{name:"Award selected · 1",exact:true}).click();
  await expect(queue.getByRole("figure",{name:"Camping stage 3",exact:true})).toHaveCount(1);expect((await awardRef(0).get()).exists).toBe(true);expect((await awardRef(1).get()).exists).toBe(false);
  await queue.getByRole("checkbox",{name:/Select all ready shown/}).check();await queue.getByRole("button",{name:"Award selected · 1",exact:true}).click();await confirm.getByRole("button",{name:"Award selected · 1",exact:true}).click();
  await expect(page.getByText("No saved badgework is currently awaiting an award in the filtered children.")).toBeVisible();expect((await awardRef(1).get()).exists).toBe(true);
  await page.getByRole("button",{name:/^Award history ·/}).click();const history=page.getByTestId("badgework-award-history");await expect(history.getByRole("figure",{name:"Camping stage 3",exact:true})).toHaveCount(2);await expect(history).toContainText("Awarded");
  await history.getByRole("button",{name:"View history and provenance",exact:true}).first().click();
  const skill=page.getByTestId("badgework-member-skill-camping");await skill.getByRole("button",{name:"Camping · Show all stages",exact:true}).click();
  await skill.getByRole("button",{name:new RegExp("Camping · Stage 3 · Open stage$")}).click();
  await page.getByTestId("badge-award-panel").getByRole("button",{name:"Remove award",exact:true}).click();const remove=page.getByRole("dialog",{name:"Remove stage award?",exact:true});await remove.getByRole("button",{name:"Cancel",exact:true}).click();await expect(remove).not.toBeVisible();
  expect((await awardRef(1).get()).exists).toBe(true);expect((await awardRef(0).get()).exists).toBe(true);
  await page.getByTestId("badge-award-panel").getByRole("button",{name:"Remove award",exact:true}).click();await remove.getByRole("button",{name:"Remove award",exact:true}).click();
  await expect(page.getByTestId("badge-award-panel")).toContainText("Not awarded");
  await page.getByRole("button",{name:"Awards",exact:true}).click();await expect(queue.getByRole("figure",{name:"Camping stage 3",exact:true})).toHaveCount(1);
  expect(await db.collection(`memberAdventureSkillProgress/${progressMemberIds[0]}/requirements`).get().then(s=>s.docs.filter(doc=>doc.get("stage")===3).length)).toBe(stage.requirements.length);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test("A single-stage award requires explicit confirmation and keeps saved completion intact",async({page})=>{
  await configureBadgework(true);await loginAsLeader(page,{email:"superadmin@example.com",password:password!});await page.goto("/leader/badgework");
  await page.getByRole("textbox",{name:"Search children"}).fill("SW546");
  const member=page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`);
  await member.getByRole("button",{name:`${progressMemberName} · Camping · Stage 2 · Open stage`,exact:true}).click();await page.getByRole("button",{name:/^Stage 3 ·/}).click();
  const ref=scheduleFixtureDb().doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/awards/camping-stage-3`);
  const panel=page.getByTestId("badge-award-panel");await panel.getByRole("button",{name:"Award badge",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Award stage badge?",exact:true});await expect(dialog).toContainText("Camping Stage 3");
  await dialog.getByRole("button",{name:"Cancel",exact:true}).click();await expect(dialog).not.toBeVisible();expect((await ref.get()).exists).toBe(false);
  await panel.getByRole("button",{name:"Award badge",exact:true}).click();await dialog.getByRole("button",{name:"Confirm award",exact:true}).click();
  await expect(panel).toContainText("Awarded");expect((await ref.get()).exists).toBe(true);
});
