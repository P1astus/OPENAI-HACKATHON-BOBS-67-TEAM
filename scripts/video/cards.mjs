import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { contextOptions, launchChromium, outputDir } from "./browser.mjs";

const styles = `
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #000000; color: #F5F5F7;
    font-family: -apple-system, BlinkMacSystemFont, Inter, "Helvetica Neue", sans-serif;
    text-rendering: optimizeLegibility;
  }
  main {
    width: 100vw; height: 100vh; display: grid; place-content: center;
    justify-items: center; padding: 108px 138px; text-align: center;
  }
  h1, h2, p { margin: 0; }
  h1 { font-size: 152px; line-height: 1; font-weight: 750; letter-spacing: -.025em; }
  .subtitle { margin-top: 38px; font-size: 54px; letter-spacing: -.018em; line-height: 1.15; }
  .credit { margin-top: 82px; font-size: 28px; color: #98989D; font-weight: 500; }
  .domain { margin-top: 30px; color: #0A84FF; font-size: 34px; font-weight: 650; letter-spacing: -.02em; }
  .connector h1 { font-size: 96px; letter-spacing: -.024em; }
  .levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; margin-top: 70px; width: 100%; }
  article {
    display: flex; flex-direction: column; min-height: 318px;
    background: #1C1C1E; border-radius: 34px; padding: 42px;
    box-shadow: 0 12px 35px #1d1d1f0a; text-align: left;
  }
  article h2 { color: #0A84FF; font-size: 44px; letter-spacing: -.025em; }
  article p { margin-top: 17px; font-size: 32px; line-height: 1.28; letter-spacing: -.01em; }
  article small { margin-top: auto; padding-top: 22px; font-size: 23px; color: #98989D; }
  footer { margin-top: 62px; font-size: 29px; color: #98989D; }
`;

const cards = {
  "card-title.png": `
    <main>
      <h1>centrix Fix</h1>
      <p class="subtitle">Something breaks. One sentence. Fixed.</p>
      <p class="credit">Repair matching for centrix · MAIN 2026</p>
    </main>`,
  "card-connector.png": `
    <main class="connector">
      <h1>One connector, three levels</h1>
      <div class="levels">
        <article>
          <h2>Phone only</h2>
          <p>no IT needed. Our AI calls, agrees times, books.</p>
          <small>(live in this demo)</small>
        </article>
        <article>
          <h2>Calendar</h2>
          <p>the partner shares free times; tenants book in one tap.</p>
          <small>(WarmHaus in this demo)</small>
        </article>
        <article>
          <h2>Full API</h2>
          <p>status updates and invoices flow back automatically.</p>
        </article>
      </div>
      <footer>Consent first: partners see personal data only after the tenant confirms.</footer>
    </main>`,
  "card-end.png": `
    <main>
      <h1>centrix Fix</h1>
      <p class="subtitle">Owners pay a subscription. Companies pay nothing.</p>
      <p class="domain">centrix-fix.vercel.app</p>
      <p class="credit">Antoni Potrykowski · Arman Kataria · Timo Aavila · Valentin Nagel</p>
    </main>`,
};

await mkdir(outputDir, { recursive: true });
const browser = await launchChromium();
try {
  const context = await browser.newContext({ ...contextOptions, offline: true });
  const page = await context.newPage();
  for (const [file, body] of Object.entries(cards)) {
    try {
      await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8">
        <title>centrix Fix</title><style>${styles}</style><body>${body}</body></html>`,
      { waitUntil: "load", timeout: 10_000 });
      await page.screenshot({ path: join(outputDir, file), timeout: 10_000 });
      console.log(`Wrote ${join(outputDir, file)}`);
    } catch (error) {
      throw new Error(`Could not render ${file}: ${error.message}`, { cause: error });
    }
  }
} finally {
  await browser.close();
}
