import { expect,test } from "@playwright/test";
import { adventureSkills } from "../src/data/adventureSkills/index";
import { mountBadge,updateBadge,compareBadgePixels } from "./support/badge-renderer-harness";
const swimming=adventureSkills.find(skill=>skill.id==="swimming")!;
for(const stage of swimming.stages)test(`Original Swimming stage ${stage.stage} retains its frame and reveals canonical progress`,async({page},testInfo)=>{
  const progress=(completed:number,awarded=false)=>({stage:stage.stage,completedRequirements:completed,totalRequirements:stage.requirements.length,status:awarded?"awarded" as const:completed===stage.requirements.length?"requirements-complete" as const:completed?"in-progress" as const:"not-started" as const});
  await page.setViewportSize({width:320,height:720});
  await page.emulateMedia({reducedMotion:"reduce"});
  await mountBadge(page,{skillId:"swimming",progress:progress(0),size:250});
  const figure=page.getByRole("figure",{name:`Swimming stage ${stage.stage}`,exact:true});await expect(figure).toBeVisible();await expect(figure.getByRole("status")).toHaveCount(0);
  await expect(figure.locator("img").first()).toHaveAttribute("src",`/badges/adventure-skills/swimming/stage-${stage.stage}.png`);
  const art=figure.getByTestId("original-badge-artwork");const zero=await art.screenshot({animations:"disabled"});
  await updateBadge(page,{skillId:"swimming",progress:progress(Math.floor(stage.requirements.length/2)),size:250,unsaved:true});const partial=await art.screenshot({animations:"disabled"});
  await expect(figure).toContainText("Unsaved preview");await updateBadge(page,{skillId:"swimming",progress:progress(stage.requirements.length),size:250});await expect(figure).toContainText("Ready to award");const full=await art.screenshot({animations:"disabled"});
  const pixels=await compareBadgePixels(page,zero,partial,full);expect(pixels.borderChanges).toBe(0);expect(pixels.upperChanges).toBe(0);expect(pixels.lowerChanges).toBe(0);await expect(figure.locator("img").last()).toHaveCSS("transition-duration","0s");expect(pixels.upperColour).toBeGreaterThan(100);expect(pixels.lowerColour).toBeGreaterThan(100);
  await expect(figure.getByRole("button")).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await figure.screenshot({path:testInfo.outputPath(`swimming-stage-${stage.stage}.png`)});
  await updateBadge(page,{skillId:"swimming",progress:progress(0,true),size:250});await expect(figure).toContainText("Awarded");expect(await art.screenshot({animations:"disabled"})).toEqual(full);
});
