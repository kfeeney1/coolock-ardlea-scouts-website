import { spawn } from "node:child_process";

/** Independent of Playwright's own event loop and test timeout machinery. */
export function supervisePlaywright(command, args, {
  env = process.env, startupMs = 60_000, idleMs = 90_000, graceMs = 10_000,
  log = (message) => console.error(message)
} = {}) {
  return new Promise((resolve) => {
    const grouped = process.platform !== "win32";
    const child = spawn(command, args, { env, detached: grouped, stdio: ["inherit", "inherit", "inherit", "ipc"] });
    let timedOut = false;
    let last = "waiting for Playwright discovery/onBegin";
    let deadline;
    let forceKill;
    const signal = (name) => {
      if (!child.pid) return;
      try { if (grouped) process.kill(-child.pid, name); else child.kill(name); }
      catch (error) { if (error.code !== "ESRCH") log(`Playwright process cleanup: ${error.message}`); }
    };
    const expire = () => {
      timedOut = true;
      log(`Playwright watchdog failed: no lifecycle progress. Last event: ${last}. Sending SIGINT for report/trace cleanup; force-kill follows in ${graceMs}ms.`);
      signal("SIGINT");
      forceKill = setTimeout(() => signal("SIGKILL"), graceMs);
    };
    deadline = setTimeout(expire, startupMs);
    child.on("message", (message) => {
      if (timedOut || message?.type !== "playwright-progress") return;
      last = `${message.phase}: ${message.label}`;
      clearTimeout(deadline);
      deadline = setTimeout(expire, idleMs);
    });
    child.on("error", (error) => log(`Unable to start Playwright: ${error.message}`));
    child.on("close", (code, exitSignal) => {
      clearTimeout(deadline);
      clearTimeout(forceKill);
      // A graceful exit after interruption can never convert a watchdog failure
      // to success. Kill any descendants that ignored the graceful signal.
      if (timedOut) signal("SIGKILL");
      resolve({ code: timedOut ? 1 : code ?? 1, timedOut, signal: exitSignal, last });
    });
  });
}
