import { build } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { AdventureStageOverview } from "../../src/services/adventureSkillOverviewLogic";

type BadgeInput = { skillId: string; progress: AdventureStageOverview; unsaved?: boolean; size?: number; dark?: boolean };
let bundle: Promise<string> | undefined;

/** Bundle the real shared React component; no test-only product route or substitute artwork. */
async function rendererBundle() {
  bundle ??= (async () => {
    const component = `${process.cwd()}/src/components/badgework/AdventureSkillBadge.tsx`;
    const temporaryRoot = join(process.cwd(), "node_modules/.tmp");
    await mkdir(temporaryRoot,{recursive:true});
    const temporary = await mkdtemp(join(temporaryRoot,"badge-renderer-"));
    const entry = join(temporary,"entry.tsx");
    await writeFile(entry, `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ThemeProvider,createTheme,Box} from '@mui/material'; import Badge from ${JSON.stringify(component)};
      const root=createRoot(document.getElementById('badge-root')); window.renderBadge=({dark,...props})=>root.render(React.createElement(ThemeProvider,{theme:createTheme({palette:{mode:dark?'dark':'light'}})},React.createElement(Box,{sx:{backgroundColor:"background.default",color:"text.primary",padding:1,width:"fit-content"}},React.createElement(Badge,props))));`);
    let result;
    try {
      result = await build({configFile:false, logLevel:"silent", define:{"process.env.NODE_ENV":JSON.stringify("production")}, plugins:[react()],
        build:{write:false,minify:false,lib:{entry,name:"BadgeRendererTest",formats:["iife"]}}});
    } finally { await rm(temporary,{recursive:true,force:true}); }
    const output = Array.isArray(result) ? result[0].output : "output" in result ? result.output : [];
    const chunk = output.find(item => item.type === "chunk");
    if (!chunk || chunk.type !== "chunk") throw new Error("Badge renderer test bundle was not produced.");
    return chunk.code;
  })();
  return bundle;
}

export async function mountBadge(page: Page, input: BadgeInput) {
  await page.setContent(`<base href="${process.env.E2E_BASE_URL || "http://127.0.0.1:4173"}/"><div id="badge-root"></div>`);
  await page.addScriptTag({ content: await rendererBundle() });
  await updateBadge(page,input);
}
export async function updateBadge(page: Page, input: BadgeInput) {
  await page.evaluate(props => (window as typeof window & { renderBadge: (value: BadgeInput) => void }).renderBadge(props),input);
}

export async function compareBadgePixels(page: Page, zero: Buffer, partial: Buffer, full: Buffer) {
  return page.evaluate(async encoded => {
    async function pixels(data: string) {
      const image = new Image(); image.src=`data:image/png;base64,${data}`; await image.decode();
      const canvas=document.createElement("canvas"); canvas.width=image.width; canvas.height=image.height;
      const context=canvas.getContext("2d")!; context.drawImage(image,0,0);
      return context.getImageData(0,0,image.width,image.height);
    }
    const [z,p,f]=await Promise.all(encoded.map(pixels));
    let borderChanges=0, upperChanges=0, lowerChanges=0, upperColour=0, lowerColour=0;
    const different=(a: ImageData,b: ImageData,x: number,y: number) => {
      const i=(y*a.width+x)*4; return a.data[i]!==b.data[i] || a.data[i+1]!==b.data[i+1] || a.data[i+2]!==b.data[i+2];
    };
    for(let y=0;y<z.height;y++) for(let x=0;x<z.width;x++) {
      if(x<8 || x>=z.width-8 || y<8 || y>=z.height-8) borderChanges+=Number(different(z,f,x,y) || different(p,f,x,y));
      if(x>=20 && x<z.width-20 && y>=20 && y<z.height*.4) { upperChanges+=Number(different(z,p,x,y)); upperColour+=Number(different(z,f,x,y)); }
      if(x>=20 && x<z.width-20 && y>=z.height*.6 && y<z.height-20) { lowerChanges+=Number(different(p,f,x,y)); lowerColour+=Number(different(z,f,x,y)); }
    }
    return {borderChanges,upperChanges,lowerChanges,upperColour,lowerColour};
  }, [zero.toString("base64"),partial.toString("base64"),full.toString("base64")]);
}
