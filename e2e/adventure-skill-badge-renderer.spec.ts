import { expect, test } from "@playwright/test";
import { adventureSkills } from "../src/data/adventureSkills/index";
import { mountBadge, updateBadge, compareBadgePixels } from "./support/badge-renderer-harness";

const stage = adventureSkills.find(skill => skill.id === "camping")!.stages[1];
const total = stage.requirements.length;
const progress = (completed: number, awarded = false) => ({stage: 2, completedRequirements: completed, totalRequirements: total, status: awarded ? "awarded" as const : completed === total ? "requirements-complete" as const : completed ? "in-progress" as const : "not-started" as const});

test("Original stage frame is unchanged while canonical completion reveals interior colour bottom to top", async ({page},testInfo) => {
  await mountBadge(page,{skillId:"camping",progress:progress(0),size:160});
  const figure=page.getByRole("figure",{name:"Camping stage 2",exact:true});
  await expect(figure).toBeVisible();
  await expect(figure.getByRole("status")).toHaveCount(0);
  await expect(figure).toContainText(`0/${total} competencies`);
  await expect(figure).toContainText("Not started");
  const art=figure.getByTestId("original-badge-artwork");
  const zero=await art.screenshot({animations:"disabled"});
  await updateBadge(page,{skillId:"camping",progress:progress(total/2),size:160,unsaved:true});
  await expect(figure).toContainText("Unsaved preview");
  const partial=await art.screenshot({animations:"disabled"});
  await updateBadge(page,{skillId:"camping",progress:progress(total),size:160});
  await expect(figure).toContainText("Ready to award");
  await expect(figure.getByText("Unsaved preview")).toHaveCount(0);
  const full=await art.screenshot({animations:"disabled"});
  const pixels=await compareBadgePixels(page,zero,partial,full);
  expect(pixels.borderChanges).toBe(0); expect(pixels.upperChanges).toBe(0); expect(pixels.lowerChanges).toBe(0);
  expect(pixels.upperColour).toBeGreaterThan(100); expect(pixels.lowerColour).toBeGreaterThan(100);
  await page.screenshot({path:testInfo.outputPath("original-stage-ready.png")});
  await updateBadge(page,{skillId:"camping",progress:progress(0,true),size:160});
  await expect(figure).toContainText("Awarded"); await expect(figure).toContainText(`0/${total} competencies`);
  expect(await art.screenshot({animations:"disabled"})).toEqual(full);
  await expect(figure.getByRole("button")).toHaveCount(0);
});

test("Missing and failed original artwork remain explicit and do not borrow another badge", async ({page}) => {
  const swimming=adventureSkills.find(skill => skill.id === "swimming")!.stages[5];
  await mountBadge(page,{skillId:"swimming",progress:{stage:6,completedRequirements:0,totalRequirements:swimming.requirements.length,status:"not-started"}});
  await expect(page.getByRole("status")).toHaveText("Original badge artwork unavailable");
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.getByRole("figure")).toContainText("Swimming · Stage 6");
  await page.route("**/badges/adventure-skills/camping/stage-2.png",route=>route.fulfill({status:404,body:"Missing original"}));
  await updateBadge(page,{skillId:"camping",progress:progress(0)});
  await expect(page.getByRole("status")).toHaveText("Original badge artwork unavailable");
  await expect(page.locator("img")).toHaveCount(0);
  await page.unroute("**/badges/adventure-skills/camping/stage-2.png");
  await page.getByRole("button",{name:"Retry Camping stage 2 artwork",exact:true}).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator("img")).toHaveCount(3);
});

test("Shared read-only presentation fits 320px in light/dark themes and respects reduced motion", async ({page}) => {
  await page.setViewportSize({width:320,height:700}); await page.emulateMedia({reducedMotion:"reduce"});
  await mountBadge(page,{skillId:"camping",progress:progress(total),size:144});
  for(const dark of [false,true]) {
    await updateBadge(page,{skillId:"camping",progress:progress(total),size:144,dark});
    await expect(page.getByRole("figure").getByRole("status")).toHaveCount(0);
    await expect(page.locator("img").last()).toHaveCSS("transition-duration","0s");
    await expect(page.getByRole("figure")).toContainText("Ready to award");
    const contrast = await page.getByText("Ready to award",{exact:true}).evaluate(element => {
      const rgba=(colour:string)=>colour.match(/[\d.]+/g)!.map(Number);
      let node:Element|null=element; let background=[255,255,255];
      while(node) { const value=rgba(getComputedStyle(node).backgroundColor); if(value.length===3 || value[3]>0) {background=value;break;} node=node.parentElement; }
      const foreground=rgba(getComputedStyle(element).color); const alpha=foreground[3]??1;
      const effective=foreground.slice(0,3).map((value,index)=>value*alpha+background[index]*(1-alpha));
      const luminance=(colour:number[])=>colour.slice(0,3).map(value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
      const values=[luminance(effective),luminance(background)].sort((a,b)=>b-a);
      return (values[0]+.05)/(values[1]+.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole("button")).toHaveCount(0);
  }
});
