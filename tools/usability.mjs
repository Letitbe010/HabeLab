// Phase 10 checks on the production build (spec §10, §11.4), adapted from KateLab:
//  - PWA: manifest, service worker, works offline after the first visit;
//  - usability: screenshots of every screen at 390 px and 1280 px; active section
//    visible, home one tap away, no horizontal page scroll, no clipped text.
// Usage: npm run build && npx vite preview --port 4181 ; node tools/usability.mjs [baseUrl] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4181/HabeLab/';
const out = process.argv[3] ?? 'screenshots/usability';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};
const SEEN = `localStorage.setItem('habelab.progress.v1', JSON.stringify({ version: 1, attempts: [], theorySeen: [], workedDone: [], introSeen: true, theme: 'auto' }))`;

// ---------------- PWA ----------------
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.addInitScript(SEEN);
  await p.goto(base);
  const man = await p.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    if (!href) return null;
    return (await fetch(href)).json();
  });
  check(!!man && man.start_url === '/HabeLab/' && man.scope === '/HabeLab/' && man.display === 'standalone' && man.icons?.some((i) => i.sizes === '512x512'), 'manifest: start_url, scope, standalone, 512 px icon');
  const sw = await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  check(sw, 'service worker active');
  await p.reload(); // let the SW control the page
  await p.waitForTimeout(800);
  await ctx.setOffline(true);
  for (const h of ['', '#/praktika/pool/pool-G1', '#/ebatziak/W10', '#/teoria/formulak']) {
    await p.goto(base + h).catch(() => {});
    const ok = await p.locator('h1').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
    check(ok, `offline: ${h || 'home'} renders`);
  }
  await ctx.close();
}

// ---------------- usability (§11.4) ----------------
const SCREENS = [
  ['start', ''],
  ['practice', '#/praktika'],
  ['ex-G1', '#/praktika/pool/pool-G1'],
  ['ex-G4', '#/praktika/pool/pool-G4'],
  ['ex-G7-madrid', '#/praktika/pool/pool-G7'],
  ['worked-list', '#/ebatziak'],
  ['worked-W05', '#/ebatziak/W05'],
  ['theory-list', '#/teoria'],
  ['theory-erlazioak', '#/teoria/erlazioak'],
  ['theory-formulak', '#/teoria/formulak'],
  ['progress', '#/aurrerapena'],
  ['settings', '#/ezarpenak'],
  ['about', '#/honi-buruz'],
];
for (const [w, h] of [
  [390, 844],
  [1280, 900],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(SEEN);
  for (const [name, hash] of SCREENS) {
    await p.goto(base + hash);
    await p.locator('h1').first().waitFor();
    if (name.startsWith('worked-') && name !== 'worked-list') await p.getByRole('button', { name: 'Dena erakutsi' }).click();
    if (name.startsWith('ex-')) await p.getByRole('button', { name: 'Ebazpena ikusi' }).first().click();
    await p.waitForTimeout(250);
    const r = await p.evaluate((wide) => {
      const visible = (el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const nav = document.querySelector(wide ? 'nav.side' : 'nav.bottom');
      const active = [...document.querySelectorAll('[aria-current="page"]')].filter(visible);
      const home = [...document.querySelectorAll('a[href="#/"]')].filter(visible).length;
      const scrollers = '.fig-box, .diag-box, .tex, .block, .katex-display';
      const clipped = [...document.querySelectorAll('h1, h2, h3, p, li, a, button, label, td, th, b, span')]
        .filter((el) => visible(el) && !el.closest(scrollers) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible')
        .map((el) => el.textContent?.slice(0, 40));
      return { overflow: document.documentElement.scrollWidth - window.innerWidth, navVisible: !!nav && visible(nav), active: active.length, home, clipped };
    }, w >= 900);
    const label = `${w}px ${name}`;
    check(r.overflow <= 0, `${label}: no horizontal page scroll (${r.overflow})`);
    check(r.navVisible && (r.active > 0 || name.startsWith('ex-')), `${label}: navigation visible, active section marked (${r.active})`);
    check(r.home > 0, `${label}: home one tap away`);
    check(r.clipped.length === 0, `${label}: no clipped text${r.clipped.length ? ' — ' + r.clipped.join(' | ') : ''}`);
    await p.screenshot({ path: `${out}/${w}_${name}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
