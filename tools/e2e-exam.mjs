// End-to-end check of the exam mode (spec §11.1): countdown, answers kept across a reload,
// manual submission, and automatic grading when the time runs out.
// Usage: node tools/e2e-exam.mjs [baseUrl]   (needs a running dev or preview server)
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5181/HabeLab/';
const SEEN = `localStorage.setItem('habelab.progress.v1', JSON.stringify({ version: 1, attempts: [], theorySeen: [], workedDone: [], introSeen: true, theme: 'auto' }))`;
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};
const secs = (s) => {
  const [m, ss] = s.split(':').map(Number);
  return m * 60 + ss;
};

{
  const ctx = await browser.newContext();
  await ctx.addInitScript(SEEN);
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(base + '#/azterketa');
  await p.getByRole('button', { name: 'Hasi azterketa' }).click();
  await p.locator('.exam-bar .clock').waitFor();
  const t1 = secs(await p.locator('.exam-bar .clock').innerText());
  check(t1 > 44 * 60 && t1 <= 45 * 60, `countdown starts at 45 min (${t1} s)`);
  check((await p.getByRole('tab').count()) === 3, 'three exercises');
  const first = p.locator('.asks input').first();
  await first.fill('12,5');
  await p.waitForTimeout(1500);
  await p.reload();
  await p.locator('.exam-bar .clock').waitFor();
  check((await p.locator('.asks input').first().inputValue()) === '12,5', 'answer kept after reload');
  const t2 = secs(await p.locator('.exam-bar .clock').innerText());
  check(t2 < t1, `clock does not restart after reload (${t1} → ${t2} s)`);
  await p.getByRole('button', { name: 'Bidali azterketa' }).click();
  await p.getByText(/Nota: [\d,]+ \/ 10/).waitFor();
  check((await p.locator('.ask header .chip').count()) === 3, 'results: one score per exercise');
  await p.getByRole('button', { name: 'Ebazpena ikusi' }).first().click();
  check(await p.getByText('Ebazpena pausoz pauso').first().isVisible(), 'solution can be opened');
  const progress = await p.evaluate(() => JSON.parse(localStorage.getItem('habelab.progress.v1')).attempts.length);
  check(progress === 3, `three attempts recorded (${progress})`);
  await ctx.close();
}

{
  const ctx = await browser.newContext();
  await ctx.addInitScript(SEEN);
  const p = await ctx.newPage();
  await p.goto(base + '#/azterketa/4242/1');
  await p.locator('.exam-bar .clock').waitFor();
  await p.getByText(/Nota: [\d,]+ \/ 10/).waitFor({ timeout: 75_000 });
  check(await p.getByText('denbora amaitu da').isVisible(), 'time up: graded automatically');
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
