import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { camping, clearBadgeworkProgress, configureBadgework, progressMemberIds, progressMemberName, savedProgressSnapshot, seedBadgeworkProgress } from "./support/badgework-progress-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
test.beforeEach(async () => { test.skip(!password,"Configure canonical E2E credentials."); await seedBadgeworkProgress(); await configureBadgework(true); });
test.afterEach(async () => { await clearBadgeworkProgress(); });
async function openRecording(page: Page, multi = false, email = "superadmin@example.com") {
  await loginAsLeader(page,{email,password:password!});
  await page.goto("/leader/badgework");
  await page.getByRole("button",{name:"Record badgework",exact:true}).click();
  await page.getByRole("textbox",{name:"Search children"}).fill("SW546");
  await page.getByRole("checkbox",{name:progressMemberName,exact:false}).check();
  if(multi) await page.getByRole("checkbox",{name:"SW546 Other Member",exact:false}).check();
  await page.getByRole("button",{name:/Select \d+ members? and continue/}).click();
  await page.getByRole("combobox",{name:"Adventure Skill",exact:true}).click();
  await page.getByRole("option",{name:"Camping",exact:true}).click();
}
const card = (page: Page,index=0) => page.getByTestId(`badgework-stage-member-${progressMemberIds[index]}`);

test("Mixed member previews reflect individual exceptions; Discard restores saved artwork and counts",async({page},testInfo)=>{
  if(testInfo.project.name==="mobile-chromium") await page.setViewportSize({width:320,height:800});
  await openRecording(page,true);
  const before=await savedProgressSnapshot();const total=camping.stages[0].requirements.length;
  await expect(card(page)).toContainText("Awarded");await expect(card(page,1)).toContainText(`0/${total} competencies`);
  await page.getByRole("button",{name:"Mark full stage complete"}).click();
  await expect(card(page,1)).toContainText(`${total}/${total} competencies`);await expect(card(page,1)).toContainText("Ready to award");
  const matrix=page.getByTestId(testInfo.project.name==="mobile-chromium"?"badgework-mobile-competency-exceptions":"badgework-desktop-competency-matrix");
  await matrix.getByRole("checkbox",{name:/SW546 Other Member · competency 1 ·/}).uncheck();
  await expect(card(page,1)).toContainText(`${total-1}/${total} competencies`);await expect(card(page,1)).toContainText("Unsaved preview");
  await expect(page.getByText("Completed by some selected children.",{exact:false}).first()).toBeVisible();
  await expect(page.getByTestId("badge-award-panel").getByRole("button",{name:"Award badge",exact:true})).toBeDisabled();
  expect(await savedProgressSnapshot()).toEqual(before);
  await page.getByTestId("badgework-save-panel").getByRole("button",{name:"Discard",exact:true}).click();
  await expect(card(page,1)).toContainText(`0/${total} competencies`);await expect(card(page,1).getByText("Unsaved preview")).toHaveCount(0);
  expect(await savedProgressSnapshot()).toEqual(before);
});

test("A rejected multi-member save writes nothing; retry persists counts without awarding",async({page})=>{
  const second=scheduleFixtureDb().doc(`members/${progressMemberIds[1]}`);
  await second.update({section:"Scouts",sections:["Scouts"]});
  await openRecording(page,true,"test.scout.programme.scouter@example.com");await page.getByRole("button",{name:/^Stage 4 ·/}).click();
  const before=await savedProgressSnapshot();const ref=scheduleFixtureDb().doc(`members/${progressMemberIds[1]}`);const member=(await ref.get()).data()!;
  await page.getByRole("button",{name:"Mark full stage complete"}).click();
  await ref.update({section:"Cubs",sections:["Cubs"]});
  try {
    await page.getByTestId("badgework-save-panel").getByRole("button",{name:"Save changes",exact:true}).click();
    await expect(page.getByRole("alert").filter({hasText:/Unable to save badgework changes/})).toBeVisible();
    await expect(card(page)).toContainText("Unsaved preview");
    expect(await savedProgressSnapshot()).toEqual(before);
    expect((await scheduleFixtureDb().collection(`memberAdventureSkillProgress/${progressMemberIds[1]}/requirements`).get()).size).toBe(0);
  } finally { await ref.set(member); }
  await page.getByTestId("badgework-save-panel").getByRole("button",{name:"Save changes",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:/badgework changes saved/})).toBeVisible();
  await expect(card(page)).toContainText("Ready to award");await expect(card(page).getByText("Unsaved preview")).toHaveCount(0);
  expect((await scheduleFixtureDb().doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/awards/camping-stage-4`).get()).exists).toBe(false);
  await page.reload();await page.getByRole("textbox",{name:"Search children"}).fill("SW546");
  await page.getByRole("button",{name:"Filters",exact:true}).click();
  await page.getByRole("combobox",{name:"Adventure Skill",exact:true}).click();await page.getByRole("option",{name:"Camping",exact:true}).click();
  await page.getByRole("combobox",{name:"Level to inspect",exact:true}).click();await page.getByRole("option",{name:"Level 4",exact:true}).click();
  await expect(page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`).getByRole("figure",{name:"Camping stage 4",exact:true})).toContainText("Ready to award");
});

for(const action of ["Discard","Save"] as const) test(`Link navigation retains draft after Stay, then ${action} leaves safely`,async({page})=>{
  await openRecording(page);await page.getByRole("button",{name:/^Stage 4 ·/}).click();
  await page.getByRole("button",{name:"Mark full stage complete"}).click();const before=await savedProgressSnapshot();
  await page.getByRole("button",{name:/^(Menu ·|Open Leader Menu)/}).click();
  const back=page.getByTestId("leader-nav-dashboard");
  await back.click();const dialog=page.getByRole("alertdialog",{name:"Unsaved badgework changes",exact:true});
  await expect(dialog).toBeVisible();await dialog.getByRole("button",{name:"Stay",exact:true}).click();
  await expect(card(page)).toContainText("Unsaved preview");await expect(back).toBeFocused();
  expect(await savedProgressSnapshot()).toEqual(before);
  await back.click();await dialog.getByRole("button",{name:action,exact:true}).click();
  await expect(page).toHaveURL(/\/leader$/);
  if(action==="Discard") expect(await savedProgressSnapshot()).toEqual(before);
  else { expect(await savedProgressSnapshot()).not.toEqual(before); expect((await scheduleFixtureDb().doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/awards/camping-stage-4`).get()).exists).toBe(false); }
});


test("Android Back closes an open menu before asking to leave a dirty recording",async({page})=>{
  await openRecording(page);await page.getByRole("button",{name:/^Stage 4 ·/}).click();
  await page.getByRole("button",{name:"Mark full stage complete"}).click();
  await page.getByRole("button",{name:/^(Menu ·|Open Leader Menu)/}).click();
  await expect(page.getByTestId("leader-nav-dashboard")).toBeVisible();
  await page.evaluate(()=>history.back());
  await expect(page.getByTestId("leader-nav-dashboard")).not.toBeVisible();
  const dialog=page.getByRole("alertdialog",{name:"Unsaved badgework changes",exact:true});
  await expect(dialog).toHaveCount(0);
  await page.evaluate(()=>history.back());await expect(dialog).toBeVisible();
  await dialog.getByRole("button",{name:"Stay",exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(card(page)).toContainText("Unsaved preview");
});


test("An offline pending Save protects context until the backend acknowledges it",async({page})=>{
  await openRecording(page);await page.getByRole("button",{name:/^Stage 4 ·/}).click();
  await page.getByRole("button",{name:"Mark full stage complete"}).click();const before=await savedProgressSnapshot();
  await page.context().setOffline(true);
  try {
    await page.getByTestId("badgework-save-panel").getByRole("button",{name:"Save changes",exact:true}).click();
    await expect(page.getByRole("button",{name:"Saving…",exact:true})).toBeDisabled();
    await expect(page.getByRole("button",{name:"Progress",exact:true})).toBeDisabled();
    await expect(page.getByRole("button",{name:"Awards",exact:true})).toBeDisabled();
    await expect(page.getByRole("button",{name:"Record badgework",exact:true})).toBeDisabled();
    await expect(page.getByRole("button",{name:"Change members",exact:true})).toBeDisabled();
    await expect(page.getByRole("combobox",{name:"Adventure Skill",exact:true})).toBeDisabled();
    expect(await savedProgressSnapshot()).toEqual(before);
  } finally {await page.context().setOffline(false);}
  await expect(page.getByTestId("badgework-save-panel")).toContainText("No unsaved changes");
  await expect(page.getByRole("button",{name:"Progress",exact:true})).toBeEnabled();
  expect(await savedProgressSnapshot()).not.toEqual(before);
  expect((await scheduleFixtureDb().doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/awards/camping-stage-4`).get()).exists).toBe(false);
});
