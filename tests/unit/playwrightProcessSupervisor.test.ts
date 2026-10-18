import assert from "node:assert/strict";
import test from "node:test";
import { supervisePlaywright } from "../../scripts/playwright-process-supervisor.mjs";

test("a child stuck before discovery fails within the startup bound", async () => {
  const messages: string[] = [];
  const started = Date.now();
  const result = await supervisePlaywright(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    startupMs: 150, graceMs: 100, log: (message: string) => messages.push(message)
  });
  assert.equal(result.code, 1);
  assert.equal(result.timedOut, true);
  assert.match(messages.join("\n"), /waiting for Playwright discovery/);
  assert.ok(Date.now() - started < 3000, "does not wait for the CI job timeout");
});

test("real lifecycle progress permits work longer than the idle interval", async () => {
  const source = `let n=0; const timer=setInterval(()=>{
    process.send({type:'playwright-progress',phase:'step',label:'step '+n});
    if(++n===8){clearInterval(timer);process.disconnect();}
  },40);`;
  const result = await supervisePlaywright(process.execPath, ["-e", source], {
    startupMs: 1500, idleMs: 200, graceMs: 100
  });
  assert.equal(result.code, 0);
  assert.equal(result.timedOut, false);
  assert.equal(result.last, "step: step 7");
});

test("a stalled test reports its last step and cannot pass after graceful interruption", async () => {
  const messages: string[] = [];
  const source = `process.on('SIGINT',()=>process.exit(0));
    process.send({type:'playwright-progress',phase:'step',label:'rover.spec.ts:191 End Rover Membership'});
    setInterval(()=>{},1000);`;
  const result = await supervisePlaywright(process.execPath, ["-e", source], {
    startupMs: 1500, idleMs: 100, graceMs: 500, log: (message: string) => messages.push(message)
  });
  assert.equal(result.code, 1);
  assert.equal(result.timedOut, true);
  assert.match(messages.join("\n"), /rover.spec.ts:191 End Rover Membership/);
});

test("an unresponsive child is force-killed after the reporting grace", async () => {
  const source = `process.on('SIGINT',()=>{});
    process.send({type:'playwright-progress',phase:'test',label:'hung fixture'});
    setInterval(()=>{},1000);`;
  const result = await supervisePlaywright(process.execPath, ["-e", source], {
    startupMs: 1500, idleMs: 100, graceMs: 100, log: () => {}
  });
  assert.equal(result.code, 1);
  assert.equal(result.timedOut, true);
  assert.equal(result.signal, "SIGKILL");
});

test("ordinary child failure retains its nonzero exit code", async () => {
  const result = await supervisePlaywright(process.execPath, ["-e", "process.exit(7)"], { startupMs: 1500 });
  assert.equal(result.code, 7);
  assert.equal(result.timedOut, false);
});
