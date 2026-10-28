import { adventureSkills } from "../src/data/adventureSkills/index";
import { expect,test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { camping,clearBadgeworkProgress,configureBadgework,progressMemberIds,progressMemberName,savedProgressSnapshot,seedBadgeworkProgress } from "./support/badgework-progress-fixtures";
const password=process.env.E2E_TEST_USER_PASSWORD;
test.beforeEach(async()=>{test.skip(!password,"Configure canonical E2E credentials.");await seedBadgeworkProgress();});
test.afterEach(async()=>{await clearBadgeworkProgress();});

for(const redesigned of [false,true]) for(const others of [false,true]) test(`Progress ${redesigned} remains independent of navigation/schedule/meeting ${others}`,async({page},testInfo)=>{
  await configureBadgework(redesigned,others);const before=await savedProgressSnapshot();
  await loginAsLeader(page,{email:others?"modernsuperadmin@example.com":"superadmin@example.com",password:password!});
  if(testInfo.project.name==="mobile-chromium")await page.setViewportSize({width:320,height:800});
  await page.goto("/leader/badgework");
  await expect(page.getByTestId("leader-dashboard-header")).toBeVisible();
  await expect(page.getByRole("heading",{name:redesigned?"Progress":"Badgework Overview",exact:true})).toBeVisible();
  await page.getByRole("textbox",{name:"Search children"}).fill("SW546");
  const member=page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`);
  await expect(member).toBeVisible();
  if(redesigned) {
    const badge=member.getByRole("figure",{name:"Camping stage 2",exact:true});await expect(badge).toContainText(`1/${camping.stages[1].requirements.length} competencies`);
    const swimming=member.getByTestId("badgework-progress-card-swimming-1").getByRole("figure",{name:"Swimming stage 1",exact:true});
    await expect(swimming).toBeVisible();await expect(swimming.getByRole("status")).toHaveCount(0);
    await expect(swimming.locator("img")).toHaveCount(3);
    await expect(swimming.locator("img").first()).toHaveAttribute("src","/badges/adventure-skills/swimming/original-stages.jpg");
    await expect(swimming).toContainText(`0/${adventureSkills.find(skill=>skill.id==="swimming")!.stages[0].requirements.length} competencies`);
    const target=member.getByRole("button",{name:`${progressMemberName} · Camping · Stage 2 · Open stage`,exact:true});
    expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await member.screenshot({path:testInfo.outputPath("leader-progress.png")});
    await target.focus(); await expect(target).toBeFocused(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading",{name:"Record badgework",exact:true})).toBeVisible();
    await expect(page.getByRole("combobox",{name:"Adventure Skill",exact:true})).toBeFocused();
    await expect(page.getByRole("button",{name:/^Stage 2 ·/})).toHaveAttribute("aria-current","step");
  } else await expect(member.getByTestId("badgework-skill-tile-camping")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await savedProgressSnapshot()).toEqual(before);
});

test("Progress retains exact-stage filters, scoped CSV and matrix entry into the same member/skill/stage",async({page})=>{
  await configureBadgework(true);
  await loginAsLeader(page,{email:"superadmin@example.com",password:password!});await page.goto("/leader/badgework");
  await page.getByRole("textbox",{name:"Search children"}).fill("SW546");
  await page.getByRole("button",{name:"Filters",exact:true}).click();
  await page.getByRole("combobox",{name:"Adventure Skill"}).click();await page.getByRole("option",{name:"Camping",exact:true}).click();
  await page.getByRole("combobox",{name:"Level to inspect"}).click();await page.getByRole("option",{name:"Level 3",exact:true}).click();
  await page.getByRole("button",{name:/^Awaiting award ·/}).click();
  const member=page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`);
  await expect(member.getByRole("figure",{name:"Camping stage 3",exact:true})).toContainText("Ready to award");
  await expect(page.getByTestId(`badgework-overview-member-${progressMemberIds[1]}`)).toHaveCount(0);
  const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Export filtered CSV",exact:true}).click();
  const download=await downloadPromise;const csv=await readFile((await download.path())!,"utf8");
  expect(csv).toContain(progressMemberName);expect(csv).not.toContain("SW546 Other Member");expect(csv.trim().split(/\r?\n/)).toHaveLength(10);expect(csv.trim().split(/\r?\n/).slice(1).every(row=>row.includes(',"Camping",'))).toBe(true);
  await page.getByRole("button",{name:"Level matrix",exact:true}).click();const matrix=page.getByTestId("badgework-level-matrix");await expect(matrix).toBeVisible();
  await matrix.getByRole("button",{name:new RegExp(`${progressMemberName} · Camping · Level 3`)}).click();
  await expect(page.getByRole("heading",{name:"Record badgework",exact:true})).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Adventure Skill"})).toHaveText("Camping");
  await expect(page.getByRole("button",{name:/^Stage 3 ·/})).toHaveAttribute("aria-current","step");
  await expect(page.getByText(`${progressMemberName} · Scouts`,{exact:true})).toBeVisible();
});

test("Member stages retain historical awards and live rollback preserves an unsaved recording draft",async({page})=>{
  await configureBadgework(true);const before=await savedProgressSnapshot();
  await loginAsLeader(page,{email:"superadmin@example.com",password:password!});await page.goto("/leader/badgework");
  await page.getByRole("textbox",{name:"Search children"}).fill("SW546 Progress");const member=page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`);
  await member.getByRole("button",{name:"View child progress",exact:true}).click();
  const detail=page.getByTestId("badgework-member-skill-camping");
  await detail.getByRole("button",{name:"Camping · Show all stages",exact:true}).click();
  await expect(detail.getByRole("figure",{name:"Camping stage 1",exact:true})).toContainText("Awarded");
  await expect(detail.getByRole("figure",{name:"Camping stage 2",exact:true})).toContainText("In progress");
  await expect(detail.getByRole("figure",{name:"Camping stage 3",exact:true})).toContainText("Ready to award");
  await expect(detail.getByRole("figure",{name:"Camping stage 4",exact:true})).toContainText("Not started");
  await expect(detail.getByTestId("badgework-award-history-camping-1")).toContainText("TEST_uid_super_admin_01");
  await detail.getByRole("button",{name:`${progressMemberName} · Camping · Stage 2 · Open stage`,exact:true}).click();
  const checkbox=page.getByRole("checkbox").nth(1);await checkbox.check();
  await expect(page.getByTestId("badgework-save-panel")).toContainText("1 unsaved change");
  await scheduleFixtureDb().doc("siteSettings/badgeworkExperience").set({version:"existing"});
  await expect(page.getByText(/This visit keeps its current layout and edits/)).toBeVisible();await expect(checkbox).toBeChecked();
  await expect(page.getByTestId("badgework-experience")).toHaveAttribute("data-experience","redesigned");
  await page.getByRole("button",{name:"Progress",exact:true}).click();await expect(page.getByRole("dialog",{name:"Discard unsaved badgework changes?"})).toBeVisible();
  await page.getByRole("button",{name:"Keep editing",exact:true}).click();await expect(checkbox).toBeChecked();
  await page.getByRole("button",{name:"Discard",exact:true}).click();await expect(page.getByTestId("badgework-save-panel")).toContainText("No unsaved changes");
  expect(await savedProgressSnapshot()).toEqual(before);
  await page.reload();await expect(page.getByRole("heading",{name:"Badgework Overview",exact:true})).toBeVisible();
  await expect(page.getByTestId("badgework-experience")).toHaveAttribute("data-experience","existing");
});

test("Programme Scouter Progress remains limited to assigned sections",async({page})=>{
  await configureBadgework(true);await loginAsLeader(page,{email:"test.scout.programme.scouter@example.com",password:password!});await page.goto("/leader/badgework");
  await page.getByRole("textbox",{name:"Search children"}).fill("SW546");
  await expect(page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`)).toBeVisible();
  await expect(page.getByTestId(`badgework-overview-member-${progressMemberIds[1]}`)).toHaveCount(0);
  await expect(page.getByRole("switch",{name:"Badgework redesign",exact:true})).toHaveCount(0);
});


test("An existing recording draft survives enabling the redesign and the next visit adopts Progress",async({page})=>{
  await configureBadgework(false);const before=await savedProgressSnapshot();
  await loginAsLeader(page,{email:"superadmin@example.com",password:password!});await page.goto("/leader/badgework");
  await page.getByRole("textbox",{name:"Search children"}).fill("SW546 Progress");
  await page.getByTestId(`badgework-overview-member-${progressMemberIds[0]}`).getByTestId("badgework-skill-tile-camping").click();
  const checkbox=page.getByRole("checkbox").nth(1);await checkbox.check();
  await expect(page.getByTestId("badgework-save-panel")).toContainText("1 unsaved change");
  await scheduleFixtureDb().doc("siteSettings/badgeworkExperience").set({version:"redesigned"});
  await expect(page.getByText(/This visit keeps its current layout and edits/)).toBeVisible();
  await expect(page.getByTestId("badgework-experience")).toHaveAttribute("data-experience","existing");await expect(checkbox).toBeChecked();
  await page.getByRole("button",{name:"Discard",exact:true}).click();expect(await savedProgressSnapshot()).toEqual(before);
  await page.reload();await expect(page.getByRole("heading",{name:"Progress",exact:true})).toBeVisible();
  await expect(page.getByTestId("badgework-experience")).toHaveAttribute("data-experience","redesigned");
});
