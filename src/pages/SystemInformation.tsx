import { Alert, Box, Button, Container, Link, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { SYSTEM_INFORMATION as info, buildAiHandoverPrompt } from "../operations/systemInformation";

const wrap = { overflowWrap: "anywhere", wordBreak: "break-word" } as const;

export default function SystemInformation() {
  const [copyState, setCopyState] = useState<"idle"|"success"|"error">("idle");
  const prompt = buildAiHandoverPrompt();
  const copyPrompt = async () => {
    setCopyState("idle");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(prompt);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  };
  return <Box sx={{ minHeight:"100vh", backgroundColor:"background.default", py:{xs:2,md:5} }}><Container maxWidth="xl">
    <LeaderDashboardHeader/><LeaderPageHeader title="System Information"/>
    <Alert severity="warning" sx={{mb:2}}>Read-only operational documentation. Live GitHub, Firebase and Jira state is authoritative. Production deployment is manual and protected.</Alert>
    <Section title="Project identity"><Typography sx={wrap}><b>{info.project.applicationName}</b> — {info.project.scoutGroup}</Typography><Typography sx={wrap}>Repository: {info.project.repository} · default branch: {info.project.defaultBranch}</Typography><Typography sx={wrap}>Production: {info.project.productionDomain}</Typography><Typography>Documentation last reviewed: {info.lastReviewed}</Typography><BuildInfo/></Section>
    <Section title="Repository and development model"><Typography>Feature branch → pull request → required Quality/E2E/Rules checks → merge → exact-SHA post-merge assurance → TEST verification → Jira reconciliation.</Typography><Typography sx={{mt:1}}><b>Production deployment must remain manual</b> unless project policy is deliberately changed in a separately approved task.</Typography><External href={info.project.repositoryUrl}>Open repository</External></Section>
    <Section title="Environments"><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 1fr"},gap:2}}>{info.environments.map(e=><Paper key={e.name} variant="outlined" sx={{p:2,borderTop:"5px solid",borderTopColor:e.name==="TEST"?"info.main":"warning.main"}}><Typography variant="h6">{e.name}</Typography><Typography sx={wrap}>Firebase: {e.projectId}</Typography><Typography>{e.data}</Typography><Typography>{e.deployment}</Typography><Typography>Email: {e.email}</Typography></Paper>)}</Box></Section>
    <Section title="External services"><Stack spacing={1.5}>{info.services.map(s=><Paper key={s.name} variant="outlined" sx={{p:2}}><Typography variant="h6">{s.name}</Typography><Typography>{s.purpose} · {s.scope}</Typography><Typography sx={wrap}>Identifier: {s.identifier}</Typography><Typography>Owner: {s.owner}</Typography><Typography sx={wrap}>Required secret names only: {s.secrets.length?s.secrets.join(", "):"None recorded"}</Typography><External href={s.url}>Manage {s.name}</External></Paper>)}</Stack></Section>
    <Section title="CI and deployment workflows"><Stack spacing={1.5}>{info.workflows.map(w=><Paper key={w.file} variant="outlined" sx={{p:2}}><Typography variant="h6">{w.name}</Typography><Typography sx={wrap}>{w.file}</Typography><Typography>{w.purpose}</Typography><Typography>Trigger: {w.trigger} · target: {w.target}</Typography><Typography>Pre-merge: {w.preMerge?"yes":"no"} · post-merge: {w.postMerge?"yes":"no"} · manual dispatch: {w.manual?"yes":"no"}</Typography><Typography sx={wrap}>Expected checks/jobs: {w.checks.join(", ")}</Typography></Paper>)}</Stack></Section>
    <Section title="Application architecture">{info.architecture.map(x=><Typography key={x}>• {x}</Typography>)}</Section>
    <Section title="Major functional areas"><Stack spacing={1}>{info.domains.map(d=><Paper key={d[0]} variant="outlined" sx={{p:1.5}}><Typography><b>{d[0]}</b></Typography><Typography sx={wrap}>Routes: {d[1]}</Typography><Typography>Data/services: {d[2]} · boundary: {d[3]}</Typography></Paper>)}</Stack></Section>
    <Section title="Data and security model">{info.security.map(x=><Typography key={x}>• {x}</Typography>)}</Section>
    <Section title="Operations and recovery">{info.operations.map(x=><Typography key={x}>• {x}</Typography>)}</Section>
    <Section title="Known limitations and parked work"><Alert severity="info" sx={{mb:1}}>This is durable guidance, not a replacement for Jira live status.</Alert>{info.parkedWork.map(x=><Typography key={x}>• {x}</Typography>)}</Section>
    <Section title="AI development handover"><Typography sx={{mb:1}}>Copy this prompt when handing development to another authorised developer or AI agent. It contains no credentials and requires live-state verification.</Typography><Button variant="contained" color="secondary" onClick={()=>void copyPrompt()} aria-label="Copy AI development handover prompt">Copy prompt</Button><Box aria-live="polite" sx={{my:1}}>{copyState==="success"&&<Alert severity="success">Complete handover prompt copied.</Alert>}{copyState==="error"&&<Alert severity="error">Clipboard access is unavailable. The prompt remains readable below for manual copying.</Alert>}</Box><Paper component="pre" variant="outlined" tabIndex={0} sx={{p:2,whiteSpace:"pre-wrap",overflowWrap:"anywhere",wordBreak:"break-word",maxWidth:"100%",overflowX:"hidden"}}>{prompt}</Paper></Section>
  </Container></Box>;
}
function Section({title,children}:{title:string;children:React.ReactNode}) { return <Paper component="section" variant="outlined" sx={{p:{xs:2,md:3},mb:2}}><Typography component="h2" variant="h5" sx={{mb:1.5,fontWeight:800}}>{title}</Typography>{children}</Paper>; }
function External({href,children}:{href:string;children:React.ReactNode}) { return <Link href={href} target="_blank" rel="noreferrer" sx={{display:"inline-block",mt:1,overflowWrap:"anywhere"}}>{children} ↗</Link>; }
function BuildInfo(){ const [text,setText]=useState("Build revision: check /build-info.json"); return <Button size="small" sx={{mt:1}} onClick={async()=>{try{const r=await fetch("/build-info.json",{cache:"no-store"});const d=await r.json();setText(`Build: ${d.environment} · ${d.commit}`)}catch{setText("Build revision unavailable — verify deployment evidence.")}}>{text}</Button>; }
