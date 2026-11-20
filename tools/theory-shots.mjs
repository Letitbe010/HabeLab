// Element screenshots of the theory figures for review (supports, free-body diagrams, shafts).
// Usage: node tools/theory-shots.mjs [baseUrl] [outDir]   (needs a running dev or preview server)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5181/HabeLab/';
const out = process.argv[3] ?? 'screenshots/theory';
mkdirSync(out, { recursive: true });
const SEEN = `localStorage.setItem('habelab.progress.v1', JSON.stringify({ version: 1, attempts: [], theorySeen: [], workedDone: [], introSeen: true, theme: 'auto' }))`;
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
for (const [w, h] of [
  [1280, 900],
  [390, 844],
]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
  await p.addInitScript(SEEN);
  await p.goto(base + '#/teoria/euskarriak');
  await p.locator('.sup-grid svg').first().waitFor();
  await p.locator('.sup-grid').screenshot({ path: `${out}/${w}_supports.png` });
  const ex = p.locator('.example');
  for (let i = 0; i < (await ex.count()); i++) await ex.nth(i).screenshot({ path: `${out}/${w}_fbd_${i + 1}.png` });
  await p.goto(base + '#/teoria/ardatzak');
  await p.locator('.shaft svg').first().waitFor();
  const sh = p.locator('.example');
  for (let i = 0; i < (await sh.count()); i++) await sh.nth(i).screenshot({ path: `${out}/${w}_shaft_${i + 1}.png` });
  await p.close();
}
await browser.close();
console.log(`written to ${out}/`);
