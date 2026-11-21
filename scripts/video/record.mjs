import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rename, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { setTimeout as pause } from "node:timers/promises";
import { promisify } from "node:util";
import { contextOptions, launchChromium, outputDir, size } from "./browser.mjs";

const stepTimeout = 12_000;
const resultTimeout = 45_000;
const callTimeout = 240_000;
const glideMs = 500;
const beat = 850;
const heatingClaim = "The heating is cold in every room since this morning.";
const locksmithClaim = "The balcony door doesn't close properly anymore, the handle is loose.";
const knockSummary = "Radiator knocking in the living room; bleed and check the valve.";
const panes = {
  tenant: "Tenant · Lena Hoffmann",
  partner: "Partner · WarmHaus Heizungstechnik",
  owner: "Owner · Maria Becker",
  operations: "reltix Operations",
};
const markers = { scenes: [], events: [] };

let browser;
let context;
let page;
let startTime;
let lastFrame;
let scene = "Setup";

const seconds = () => Number(((performance.now() - startTime) / 1000).toFixed(3));
const mark = (name) => markers.events.push({ name, t_s: seconds() });

async function step(name, action) {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${scene} / ${name}: ${error.message}`, { cause: error });
  }
}

async function recordScene(id, name, action) {
  scene = `${id} ${name}`;
  console.log(scene);
  const start_s = seconds();
  await action();
  markers.scenes.push({ id, start_s, end_s: seconds() });
}

function localOrigin() {
  const url = new URL(process.env.BASE_URL || "http://localhost:3155");
  if (!["http:", "https:"].includes(url.protocol)
    || (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && process.env.REAL_TAKE !== "1")
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("BASE_URL must be a loopback origin, such as http://localhost:3155.");
  }
  return url.origin;
}

async function resetSeed(origin) {
  const deadline = performance.now() + 30_000;
  const request = async (path, method) => {
    const response = await fetch(origin + path, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(3000, Math.max(1, Math.floor(deadline - performance.now())))),
    });
    if (!response.ok) throw new Error(`${method} ${path} returned HTTP ${response.status}`);
    return response.json();
  };

  let lastError;
  while (performance.now() < deadline) {
    try {
      await request("/api/reset", "POST");
      const ticket = await request("/api/tickets/t_knock", "GET");
      if (ticket.id === "t_knock" && ticket.status === "scheduled") return;
      throw new Error("Seed ticket t_knock is missing or no longer scheduled.");
    } catch (error) {
      lastError = error;
      await pause(Math.min(500, Math.max(0, deadline - performance.now())));
    }
  }
  throw new Error(`Seed was unavailable after 30 seconds. Last attempt: ${lastError?.message}`);
}

function pane(id) {
  const label = panes[id];
  const iframe = `iframe[aria-label="${label}"]`;
  return {
    button: page.getByRole("button", { name: label, exact: true }),
    iframe: page.locator(iframe),
    view: page.frameLocator(iframe),
  };
}

const visible = (target, timeout = stepTimeout) => target.waitFor({ state: "visible", timeout });

async function installCursor() {
  // Keep the focused phone tall enough to show the booking sheet and its context.
  await page.addStyleTag({ content: `
    section[aria-label="${panes.tenant}"]:has(> button[aria-pressed="true"]) {
      width: min(660px, 100%); justify-self: center;
    }
  ` });
  await page.evaluate(() => {
    const dot = document.createElement("div");
    dot.id = "recording-cursor";
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = `
      position:fixed; z-index:2147483647; pointer-events:none;
      left:72px; top:80px; transform:translate(-50%,-50%); width:22px; height:22px;
      border-radius:50%; border:2px solid #fff; background:rgba(29,29,31,.84);
      box-shadow:0 1px 7px #0005;
      transition:left 500ms ease-in-out, top 500ms ease-in-out;
    `;
    document.body.append(dot);
  });
}

async function reveal(target) {
  await visible(target);
  const scrolling = await target.evaluate((element) => {
    const { top, bottom, left, right } = element.getBoundingClientRect();
    if (top >= 12 && bottom <= innerHeight - 12 && left >= 0 && right <= innerWidth) return false;
    element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    return true;
  }, undefined, { timeout: stepTimeout });
  if (scrolling) await pause(650);
}

async function center(target, checkHit) {
  return target.evaluate((element, checkHit) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (checkHit && (!element.contains(hit) || element.matches(":disabled,[aria-disabled=true]"))) {
      throw new Error("Click target is disabled, obscured or outside its viewport.");
    }

    const iframe = window.frameElement;
    if (!iframe) return { x, y };
    // The demo scales each borderless iframe about its top-left origin.
    const frame = iframe.getBoundingClientRect();
    return {
      x: frame.left + (x * frame.width) / iframe.clientWidth,
      y: frame.top + (y * frame.height) / iframe.clientHeight,
    };
  }, checkHit, { timeout: stepTimeout });
}

async function glide(point) {
  await page.locator("#recording-cursor").evaluate((dot, { x, y }) => {
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  }, point, { timeout: stepTimeout });
  await pause(glideMs + 30);
}

async function pointAt(target, hold, offsetX = 0) {
  await reveal(target);
  const { x, y } = await center(target, false);
  await glide({ x: x + offsetX, y });
  await pause(hold);
}

async function click(target, onClick) {
  await reveal(target);
  await glide(await center(target, true));
  const { x, y } = await center(target, true);
  await page.locator("#recording-cursor").evaluate((dot) => {
    dot.animate([
      { transform: "translate(-50%,-50%) scale(1)" },
      { transform: "translate(-50%,-50%) scale(.78)", boxShadow: "0 0 0 2px #0071e388" },
      { transform: "translate(-50%,-50%) scale(1)", boxShadow: "0 0 0 14px #0071e300" },
    ], { duration: 380, easing: "ease-out" });
  }, undefined, { timeout: stepTimeout });
  await page.mouse.click(x, y);
  onClick?.();
}

async function type(target, text, replace = false) {
  await click(target);
  await pause(600);
  if (replace) await target.press("ControlOrMeta+a");
  await target.pressSequentially(text, { delay: 45 });
  await pause(beat);
}

async function toggle(id, focused) {
  const { button, iframe } = pane(id);
  await click(button);
  await button.and(page.locator(`[aria-pressed="${focused}"]`)).waitFor({ timeout: stepTimeout });
  if (!focused) await pane("operations").iframe.waitFor({ timeout: stepTimeout });
  await iframe.waitFor({ timeout: stepTimeout });
  await pause(beat);
}

async function reportRepair(claim, event) {
  const { view } = pane("tenant");
  await step("enlarge tenant pane", () => toggle("tenant", true));
  await step("open report sheet", async () => {
    await click(view.getByRole("button", { name: "Report a problem", exact: true }));
    await pause(beat);
  });
  const sheet = view.getByRole("dialog");
  await step("type report", () => type(sheet.getByRole("textbox", { name: "What's wrong?" }), claim));
  return step("send report and read ticket", async () => {
    const [response] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/tickets"
        && response.request().method() === "POST", { timeout: resultTimeout }),
      click(sheet.getByRole("button", { name: "Send", exact: true }), () => mark(event)),
    ]);
    if (!response.ok()) throw new Error(`Ticket creation returned HTTP ${response.status()}`);
    const ticket = await response.json();
    if (ticket.status !== "matched") {
      await pause(beat);
      throw new Error(`Ticket ${ticket.id} returned status "${ticket.status}". ${ticket.triage?.reason || ""}`.trim());
    }
    return ticket;
  });
}

const tenantSheet = () => pane("tenant").view.getByRole("dialog");
const firstSlot = () => tenantSheet().getByRole("region", { name: "Pick a time" }).getByRole("button").first();
const slotHeading = () => tenantSheet().getByRole("heading", { name: "Pick a time", exact: true });

async function bookFirstSlot() {
  await step("choose first time and show consent", async () => {
    await click(firstSlot());
    const consent = tenantSheet().getByText(/^Share your name, phone, address and access notes/);
    await reveal(consent);
    await pause(1600);
  });
  await step("confirm booking and hold confirmation", async () => {
    await click(tenantSheet().getByRole("button", { name: "Confirm booking" }));
    await visible(tenantSheet().getByRole("heading", { name: "Appointment confirmed" }), resultTimeout);
    mark("appointment_confirmed");
    await pause(2400);
  });
  await step("close booking sheet and restore grid", async () => {
    await click(tenantSheet().getByRole("button", { name: "Close", exact: true }));
    await tenantSheet().waitFor({ state: "hidden", timeout: stepTimeout });
    await pause(beat);
    await toggle("tenant", false);
  });
}

async function overview() {
  for (const id of Object.keys(panes)) {
    await step(`hover ${id} pane`, () => pointAt(pane(id).iframe, 2000));
  }
}

async function heating() {
  const ticket = await reportRepair(heatingClaim, "heating_sent");
  await step("show WarmHaus and the first available time", async () => {
    await visible(tenantSheet().getByText("WarmHaus Heizungstechnik", { exact: true }), resultTimeout);
    await visible(firstSlot(), resultTimeout);
    mark("slots_shown");
    await pointAt(slotHeading(), 2300);
  });
  await bookFirstSlot();
  await step("show the new booking in the partner and owner panes", async () => {
    const heading = pane("partner").view.getByRole("heading", { name: ticket.triage.summary, exact: true });
    const repair = pane("owner").view.locator(`#owner-repair-${ticket.id}`);
    await pointAt(heading, 2000);
    await pointAt(repair, 2000);
    await pause(1000);
  });
}

async function locksmith() {
  const ticket = await reportRepair(locksmithClaim, "locksmith_sent");
  await step("wait for the locksmith calling state", async () => {
    if (ticket.proposed_slots.length && ticket.events.some(({ type }) => type === "calling_company")) {
      // Without voice credentials, the server records both events before responding.
      console.log("Call and slot events arrived together in the ticket response.");
    } else {
      await visible(tenantSheet().getByText(/calling .+ for times/i), resultTimeout);
    }
    mark("call_phase_start");
    console.log("\n>>> CALL PHASE: phone should ring now <<<\n");
  });
  if (process.env.INJECT_SLOTS === "1") {
    // Re-shoot mode: replay the result of the real recorded call through the same webhook the voice agent uses.
    await page.waitForTimeout(6000);
    const res = await fetch(new URL("/api/agent/voice-result", process.env.BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": process.env.VOICE_WEBHOOK_SECRET ?? "" },
      body: JSON.stringify({
        ticket_id: ticket.id, company_id: ticket.company_id,
        slots: ["2026-11-23T08:00:00.000Z", "2026-11-23T13:00:00.000Z"],
        summary: "Offered Monday 23 November at 09:00 and 14:00.",
      }),
    });
    console.log(`Injected recorded call result: HTTP ${res.status}`);
  }
  await step("wait up to 240 seconds for locksmith times", async () => {
    await visible(firstSlot(), callTimeout);
    mark("call_slots_arrived");
    console.log("\n>>> CALL DONE <<<\n");
    await pointAt(slotHeading(), 2300);
  });
  await bookFirstSlot();
}

async function finishRepair() {
  const partner = pane("partner").view;
  const owner = pane("owner").view;
  const tenant = pane("tenant").view;
  const partnerJob = partner.getByRole("article").filter({ hasText: knockSummary });
  const invoice = partner.getByRole("dialog", { name: "Mark repair done" });
  const partnerHeader = partner.getByRole("banner");
  const reviewCount = await step("read WarmHaus’s initial review count", async () => {
    const label = await partnerHeader.getByText(/^\d+ (?:of \d+ )?reviews?$/).innerText();
    return Number.parseInt(label, 10);
  });

  await step("enlarge partner pane and mark the knocking radiator done", async () => {
    await toggle("partner", true);
    await click(partnerJob.getByRole("button", { name: "Mark as done", exact: true }), () => mark("mark_done"));
    await pause(beat);
  });
  await step("enter €95 and send invoice", async () => {
    await type(invoice.getByRole("spinbutton", { name: "Invoice amount (€)" }), "95", true);
    await click(invoice.getByRole("button", { name: "Send invoice" }), () => mark("invoice_sent"));
    await invoice.waitFor({ state: "hidden", timeout: resultTimeout });
    await pause(beat);
    await click(partner.getByRole("tab", { name: "Done", exact: true }));
    await visible(partnerJob.getByText("Invoice sent", { exact: true }));
    await pause(1700);
  });
  await step("restore grid and show the €95 wallet payment", async () => {
    await toggle("partner", false);
    const row = owner.getByRole("row").filter({ hasText: /€\s*95[.,]00|95[.,]00\s*€/ });
    const payment = row.getByText("Paid from wallet", { exact: true });
    await reveal(payment);
    mark("wallet_payment_shown");
    await pointAt(payment, 2700, 56);
  });
  await step("scroll to Finished and set the heating repair rating to 9", async () => {
    await toggle("tenant", true);
    const finished = tenant.getByRole("region", { name: "Finished", exact: true });
    const heatingRepair = finished.getByRole("article").filter({ hasText: "Restore heating to cold radiators throughout the flat." });
    await reveal(finished.getByRole("heading", { name: "Finished", exact: true }));
    await pause(beat);
    const slider = heatingRepair.getByRole("slider");
    await click(slider);
    await slider.press("Home");
    for (let value = 1; value < 9; value += 1) {
      await slider.press("ArrowRight");
      await pause(70);
    }
    if (await slider.getAttribute("aria-valuenow") !== "9") throw new Error("The rating slider did not reach 9.");
    await pause(beat);
    await click(heatingRepair.getByRole("button", { name: "Send rating", exact: true }), () => mark("rating_sent"));
    await visible(tenant.getByText("Thanks! Your rating helps other tenants.", { exact: true }));
    await pause(1800);
  });
  await step("restore grid and hold on the partner rating", async () => {
    await toggle("tenant", false);
    const count = new RegExp(`^${reviewCount + 1} (?:of \\d+ )?reviews?$`);
    await pointAt(partnerHeader.getByText(count), 2700, -35);
  });
}

async function clarify() {
  const owner = pane("owner").view;
  const sheet = owner.getByRole("dialog", { name: "Repair details" });
  await step("enlarge owner pane and open the unclear hallway repair", async () => {
    await toggle("owner", true);
    await click(owner.getByRole("button", { name: "View repair details: Unclear problem in the hallway.", exact: true }));
    await pause(beat);
  });
  await step("hold on Lena's contact block", () => pointAt(sheet.getByRole("region", { name: "Contact the tenant" }), 2300));
  await step("type the hallway clarification", () => type(
    sheet.getByRole("textbox", { name: "What's the actual problem?" }),
    "Called Lena: the hallway radiator is ice cold.",
  ));
  await step("find WarmHaus and hold on the result", async () => {
    await click(sheet.getByRole("button", { name: "Find the right company" }), () => mark("clarify_sent"));
    const result = sheet.getByText(/^Clear now:.*WarmHaus Heizungstechnik was chosen/);
    await visible(result, resultTimeout);
    mark("clarify_result");
    await reveal(result);
    await pause(3000);
  });
  await step("close the repair details and restore the grid", async () => {
    await click(sheet.getByRole("button", { name: "Close", exact: true }));
    await sheet.waitFor({ state: "hidden", timeout: stepTimeout });
    await pause(beat);
    await toggle("owner", false);
    await pause(1100);
  });
}

async function waitForOperator() {
  if (process.env.PAUSE_BEFORE_CALL !== "1") return;
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ended = new Promise((_, reject) => {
      terminal.once("close", () => reject(new Error("stdin closed before Enter was pressed.")));
    });
    await Promise.race([
      terminal.question("Press Enter to start the locksmith scene\n", { signal: AbortSignal.timeout(600_000) }),
      ended,
    ]);
  } finally {
    terminal.close();
  }
}

async function record() {
  const origin = await step("validate local BASE_URL", localOrigin);
  await mkdir(outputDir, { recursive: true });
  await step("reset and verify seed t_knock", () => resetSeed(origin));
  browser = await step("launch Chromium", launchChromium);
  const stagingDir = await mkdtemp(join(outputDir, ".take-"));
  context = await browser.newContext({
    ...contextOptions,
    recordVideo: { dir: stagingDir, size },
    serviceWorkers: "block",
  });
  context.setDefaultTimeout(stepTimeout);
  // Keep browser requests on the same local origin as the demo.
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== origin) await route.abort();
    else await route.continue();
  });
  await step("open the demo and wait for all four iframes", async () => {
    page = await context.newPage();
    startTime = performance.now();
    const response = await page.goto(origin + "/demo", { waitUntil: "load", timeout: resultTimeout });
    if (!response?.ok()) throw new Error(`Demo returned HTTP ${response?.status()}`);
    await Promise.all([
      visible(pane("tenant").view.getByRole("button", { name: "Report a problem" })),
      visible(pane("partner").view.getByRole("heading", { name: "Active jobs" })),
      visible(pane("owner").view.getByRole("link", { name: "Wallet payments" })),
      visible(pane("operations").view.getByRole("tab", { name: "Tickets", exact: true })),
    ]);
    await installCursor();
    await pause(beat);
  });
  await recordScene("S1", "Overview", overview);
  await recordScene("S2", "Heating", heating);
  scene = "S3 Locksmith";
  await step("wait for Enter", waitForOperator);
  await recordScene("S3", "Locksmith", locksmith);
  await recordScene("S4", "Done, paid and rated", finishRepair);
  await recordScene("S5", "Clarify", clarify);

  scene = "Export";
  const video = page.video();
  await step("capture the final overview", async () => {
    await pause(600);
    lastFrame = await page.screenshot({ timeout: 5000 });
  });
  await step("finalize Playwright video", () => context.close());
  const webm = join(stagingDir, "raw.webm");
  const mp4 = join(stagingDir, "raw.mp4");
  await step("rename recording to raw.webm", async () => rename(await video.path(), webm));
  await step("convert raw.webm to H.264 at 30 fps", () => promisify(execFile)("/opt/homebrew/bin/ffmpeg", [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", webm,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-crf", "18",
    "-movflags", "+faststart", mp4,
  ], { timeout: 300_000 }));
  await step("save take and markers", async () => {
    await rename(webm, join(outputDir, "raw.webm"));
    await rename(mp4, join(outputDir, "raw.mp4"));
    await writeFile(join(outputDir, "markers.json"), JSON.stringify(markers, null, 2) + "\n");
    await rmdir(stagingDir);
  });
  console.log(`Wrote raw.webm, raw.mp4 and markers.json to ${outputDir}`);
}

try {
  await record();
} catch (error) {
  console.error(error.message);
  if (lastFrame || (page && !page.isClosed())) {
    const screenshot = join(outputDir, "failure.png");
    try {
      if (page?.isClosed()) await writeFile(screenshot, lastFrame);
      else await page.screenshot({ path: screenshot, timeout: 5000 });
      console.error(`Failure screenshot: ${screenshot}`);
    } catch (screenshotError) {
      console.error(`Failure screenshot unavailable: ${screenshotError.message}`);
    }
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
}
