/**
 * Grader for mode A, "key values" (spec §7.1, §8.1, §8.3). Pure and deterministic:
 * it only compares the user's numbers with the verified solution of solver A.
 * Error diagnosis (spec §8.4) is phase 7 and will be added on top of these results.
 *
 * Tolerances (§8.1, shown in the UI):
 *  - values: relative error ≤ 1 %  OR  absolute error ≤ 0.5 % of the diagram's max |value|
 *    (max |V| for shear forces and reactions, max |M| for moments);
 *  - positions: ±max(0.01 m, 0.5 % of L); points where V = 0: ±0.02 m (or the former if larger).
 *
 * Scoring (§8.3, 0–10):
 *  - reactions + diagrams: reactions 20 %, V 30 %, M 50 %;
 *  - values at a point p: V_p 50 %, M_p 50 %;
 *  - M_max (our choice, the spec gives no split): reactions 20 %, |M|max 50 %, its x 30 %;
 *  - equations (our choice, same split as diagrams): reactions 20 %, V(x) 30 %, M(x) 50 %.
 *  Inside each part: proportion of correct items. Missing items count as wrong; extra
 *  points are not penalised when their values are right (§8.2), and count as wrong when not.
 *
 * Input that cannot be interpreted (e.g. "3,,5") is reported as 'invalid' and the result
 * is flagged so the UI asks to fix it before counting the attempt (§8.1.4). An empty
 * field for a required item is 'missing'.
 */

import type { Exercise } from './model';
import { type KeyPoint, extremes, keyPoints } from './keyPoints';
import { evalNum } from './poly';
import * as R from './rational';
import { type AnalyticSolution, valuesAt } from './solverAnalytic';
import { type GSetting, exerciseToBeam, factorToSI, parseUserNumber } from './units';
import { verifyBeam } from './verify';

export type Status = 'correct' | 'wrong' | 'missing' | 'invalid';
export type ForceUnitA = 'N' | 'kN';
export type MomentUnitA = 'N·m' | 'kN·m';

export interface PointRow {
  x: string;
  Vl?: string;
  Vr?: string;
  Ml?: string;
  Mr?: string;
}

export interface ModeAAnswer {
  forceUnit: ForceUnitA;
  momentUnit: MomentUnitA;
  reactions?: Record<string, { R?: string; M?: string }>;
  points?: PointRow[];
  pointValues?: Record<string, { Vl?: string; Vr?: string; M?: string }>;
  mmax?: { value?: string; x?: string };
  equations?: { x1: string; x2: string; V: string[]; M: string[] }[];
}

export type PartKey = 'reactions' | 'V' | 'M' | 'Vp' | 'Mp' | 'mmax' | 'xmax' | 'Veq' | 'Meq';

export interface Item {
  part: PartKey;
  /** Stable id, e.g. "R:A", "V-:2", "M:3.464", "Vp:p", "mmax", "Veq:0-2". */
  id: string;
  status: Status;
  /** Expected value in SI (N, N·m or m); null when not a single number (equations). */
  expected: number | null;
  /** Given value converted to SI; null when missing or invalid. */
  given: number | null;
  /** x of the point the item belongs to (m), when relevant. */
  x?: number;
  /** Raw text typed by the user (for display). */
  raw?: string;
  /** The item comes from a point the user added that is not a key point. */
  extra?: boolean;
}

export interface Part {
  key: PartKey;
  weight: number;
  correct: number;
  total: number;
  /** correct / total (1 when total = 0). */
  ratio: number;
}

export interface GradeResult {
  items: Item[];
  parts: Part[];
  /** 0–10, one decimal. */
  score: number;
  /** Some non-empty input could not be interpreted: ask the user to fix it first. */
  invalid: boolean;
  /** Key points the user did not give (x in m). */
  missingPoints: number[];
  solution: AnalyticSolution;
}

export interface GradeOptions {
  g?: GSetting;
  /** Alternative V sign convention (§4.1): the user's V values are read with the opposite sign. */
  vFlip?: boolean;
}

// ---------------------------------------------------------------------------

export const relTol = 0.01;
export const absTolFrac = 0.005;

export function valueOk(given: number, expected: number, scale: number): boolean {
  const d = Math.abs(given - expected);
  return d <= relTol * Math.abs(expected) + 1e-12 || d <= absTolFrac * scale + 1e-12;
}

export function positionTol(L: number, shearZero = false): number {
  const base = Math.max(0.01, 0.005 * L);
  return shearZero ? Math.max(0.02, base) : base;
}

type Parsed = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ok'; value: number; exact: R.Rational };

function parse(text: string | undefined): Parsed {
  if (text === undefined || text.trim() === '') return { kind: 'empty' };
  try {
    const r = parseUserNumber(text);
    return { kind: 'ok', value: R.toNumber(r), exact: r };
  } catch {
    return { kind: 'invalid' };
  }
}

// ---------------------------------------------------------------------------

export function grade(ex: Exercise, ans: ModeAAnswer, opts: GradeOptions = {}): GradeResult {
  const g = opts.g ?? '9.81';
  const v = verifyBeam(exerciseToBeam(ex, g));
  if (!v.ok || !v.a) throw new Error(`grade: the exercise did not pass verification (${v.failures.join('; ')})`);
  const sol = v.a;
  const kps = keyPoints(sol);
  const ext = extremes(sol, kps);
  const L = R.toNumber(sol.beam.length);
  const fF = R.toNumber(factorToSI(ans.forceUnit, g));
  const fM = R.toNumber(factorToSI(ans.momentUnit, g));
  const vSign = opts.vFlip ? -1 : 1;
  const Vscale = Math.max(1e-9, ext.absVmax.value, ...sol.reactions.map((r) => Math.abs(R.toNumber(r.R))));
  const Mscale = Math.max(1e-9, ext.absMmax.value, ...sol.reactions.map((r) => Math.abs(R.toNumber(r.M ?? R.ZERO))));

  const items: Item[] = [];
  let invalid = false;

  /** Compare one typed value (in the user's unit) with an SI expectation. */
  const judge = (part: PartKey, id: string, raw: string | undefined, expected: number, factor: number, scale: number, extra = {}): Item => {
    const p = parse(raw);
    if (p.kind === 'invalid') {
      invalid = true;
      return { part, id, status: 'invalid', expected, given: null, raw, ...extra };
    }
    if (p.kind === 'empty') return { part, id, status: 'missing', expected, given: null, raw, ...extra };
    const given = p.value * factor;
    return { part, id, status: valueOk(given, expected, scale) ? 'correct' : 'wrong', expected, given, raw, ...extra };
  };

  // --- reactions -------------------------------------------------------------------
  if (ex.ask.reactions) {
    for (const r of sol.reactions) {
      const a = ans.reactions?.[r.label];
      items.push(judge('reactions', `R:${r.label}`, a?.R, R.toNumber(r.R), fF, Vscale, { x: R.toNumber(r.x) }));
      if (r.M) items.push(judge('reactions', `M:${r.label}`, a?.M, R.toNumber(r.M), fM, Mscale, { x: R.toNumber(r.x) }));
    }
  }

  // --- diagrams: key values at the user's points -------------------------------------
  const missingPoints: number[] = [];
  if (ex.ask.diagrams) {
    const matched = new Set<number>();
    for (const row of ans.points ?? []) {
      const px = parse(row.x);
      if (px.kind === 'invalid') {
        invalid = true;
        items.push({ part: 'V', id: `x:${row.x}`, status: 'invalid', expected: null, given: null, raw: row.x });
        continue;
      }
      if (px.kind === 'empty') {
        if ([row.Vl, row.Vr, row.Ml, row.Mr].some((s) => s && s.trim() !== '')) {
          invalid = true;
          items.push({ part: 'V', id: 'x:?', status: 'invalid', expected: null, given: null, raw: '' });
        }
        continue;
      }
      const x = px.value;
      // nearest key point within tolerance
      let best = -1;
      let bestD = Infinity;
      kps.forEach((k, i) => {
        const d = Math.abs(k.x.value - x);
        if (d <= positionTol(L, k.tags.includes('shear-zero')) && d < bestD) [best, bestD] = [i, d];
      });
      if (best >= 0 && !matched.has(best)) {
        matched.add(best);
        items.push(...pointItems(kps[best]!, row, false));
      } else if (x >= -1e-12 && x <= L + 1e-12) {
        // an extra point (not a key point, or a duplicate): judged at the user's x
        const ex_ = extraPoint(sol, px.exact, x);
        items.push(...pointItems(ex_, row, true));
      } else {
        items.push({ part: 'V', id: `x:${row.x}`, status: 'wrong', expected: null, given: x, raw: row.x, extra: true });
      }
    }
    kps.forEach((k, i) => {
      if (matched.has(i)) return;
      missingPoints.push(k.x.value);
      items.push(...pointItems(k, { x: '' }, false));
    });
  }

  function extraPoint(s: AnalyticSolution, exact: R.Rational, x: number): KeyPoint {
    const vals = valuesAt(s, R.max(R.ZERO, R.min(exact, s.beam.length)));
    const kv = (r: R.Rational) => ({ exact: r, value: R.toNumber(r) });
    return { x: { value: x }, tags: ['point'], Vl: kv(vals.Vl), Vr: kv(vals.Vr), Ml: kv(vals.Ml), Mr: kv(vals.Mr) };
  }

  /** Items for one point: only the limits inside the beam; one item when there is no jump. */
  function pointItems(k: KeyPoint, row: PointRow, extra: boolean): Item[] {
    const x = k.x.value;
    const atStart = Math.abs(x) < 1e-12;
    const atEnd = Math.abs(x - L) < 1e-12;
    const out: Item[] = [];
    const tag = x.toFixed(4);
    const one = (part: 'V' | 'M', l: number, r: number, rawL?: string, rawR?: string): void => {
      const f = part === 'V' ? fF * vSign : fM;
      const scale = part === 'V' ? Vscale : Mscale;
      const has = (t?: string) => t !== undefined && t.trim() !== '';
      const id = (suffix: string) => `${part}${suffix}:${tag}`;
      // ends: only the limit inside the beam exists; the value may be typed in either field
      if (atStart) {
        out.push(judge(part, id(''), has(rawR) ? rawR : rawL, r, f, scale, { x, extra }));
        return;
      }
      if (atEnd) {
        out.push(judge(part, id(''), has(rawL) ? rawL : rawR, l, f, scale, { x, extra }));
        return;
      }
      const jump = Math.abs(l - r) > 1e-9 * Math.max(1, scale);
      if (!jump) {
        // one value; if both fields are filled, both must be right
        const first = judge(part, id(''), has(rawL) ? rawL : rawR, l, f, scale, { x, extra });
        out.push(first.status === 'correct' && has(rawL) && has(rawR) ? judge(part, id(''), rawR, l, f, scale, { x, extra }) : first);
        return;
      }
      out.push(judge(part, id('-'), rawL, l, f, scale, { x, extra }));
      out.push(judge(part, id('+'), rawR, r, f, scale, { x, extra }));
    };
    one('V', k.Vl.value, k.Vr.value, row.Vl, row.Vr);
    one('M', k.Ml.value, k.Mr.value, row.Ml, row.Mr);
    // a correct extra point is not counted (no reward, no penalty); a wrong one counts as wrong
    return extra ? out.filter((it) => it.status !== 'missing') : out;
  }

  // --- values at named points ----------------------------------------------------------
  for (const label of ex.ask.pointValues ?? []) {
    const pt = ex.points?.find((p) => p.label === label);
    if (!pt) continue;
    const vals = valuesAt(sol, R.parse(pt.x));
    const a = ans.pointValues?.[label];
    const x = R.toNumber(vals.x);
    if (R.eq(vals.Vl, vals.Vr)) {
      items.push(judge('Vp', `Vp:${label}`, a?.Vl?.trim() ? a.Vl : a?.Vr, R.toNumber(vals.Vl), fF * vSign, Vscale, { x }));
    } else {
      items.push(judge('Vp', `Vp-:${label}`, a?.Vl, R.toNumber(vals.Vl), fF * vSign, Vscale, { x }));
      items.push(judge('Vp', `Vp+:${label}`, a?.Vr, R.toNumber(vals.Vr), fF * vSign, Vscale, { x }));
    }
    items.push(judge('Mp', `Mp:${label}`, a?.M, R.toNumber(vals.Ml), fM, Mscale, { x }));
  }

  // --- |M|max and its position -----------------------------------------------------------
  if (ex.ask.mmax) {
    const it = judge('mmax', 'mmax', ans.mmax?.value, ext.absMmax.value, fM, Mscale);
    if (it.status === 'wrong' && it.given !== null && valueOk(Math.abs(it.given), ext.absMmax.value, Mscale)) it.status = 'correct'; // sign not asked
    items.push(it);
    const px = parse(ans.mmax?.x);
    const where = kps.filter((k) => {
      const ms = Math.abs(k.x.value) < 1e-12 ? [k.Mr] : Math.abs(k.x.value - L) < 1e-12 ? [k.Ml] : [k.Ml, k.Mr];
      return ms.some((m) => Math.abs(Math.abs(m.value) - ext.absMmax.value) <= 1e-9 * Mscale);
    });
    if (px.kind === 'invalid') {
      invalid = true;
      items.push({ part: 'xmax', id: 'xmax', status: 'invalid', expected: ext.xAbsMmax.value, given: null, raw: ans.mmax?.x });
    } else if (px.kind === 'empty') items.push({ part: 'xmax', id: 'xmax', status: 'missing', expected: ext.xAbsMmax.value, given: null });
    else {
      const ok = where.some((k) => Math.abs(k.x.value - px.value) <= positionTol(L, k.tags.includes('shear-zero')));
      items.push({ part: 'xmax', id: 'xmax', status: ok ? 'correct' : 'wrong', expected: ext.xAbsMmax.value, given: px.value, raw: ans.mmax?.x });
    }
  }

  // --- equations per segment --------------------------------------------------------------
  if (ex.ask.equations) {
    for (const seg of sol.segments) {
      const x1 = R.toNumber(seg.x1);
      const x2 = R.toNumber(seg.x2);
      const tol = positionTol(L);
      const row = ans.equations?.find((e) => {
        const a = parse(e.x1);
        const b = parse(e.x2);
        return a.kind === 'ok' && b.kind === 'ok' && Math.abs(a.value - x1) <= tol && Math.abs(b.value - x2) <= tol;
      });
      const tag = `${x1}-${x2}`;
      for (const [part, coefs, poly, f, scale] of [
        ['Veq', row?.V, seg.V, fF * vSign, Vscale],
        ['Meq', row?.M, seg.M, fM, Mscale],
      ] as const) {
        const parsed = (coefs ?? []).map(parse);
        if (parsed.some((p) => p.kind === 'invalid')) {
          invalid = true;
          items.push({ part, id: `${part}:${tag}`, status: 'invalid', expected: null, given: null, x: x1 });
          continue;
        }
        if (!row || parsed.every((p) => p.kind === 'empty')) {
          items.push({ part, id: `${part}:${tag}`, status: 'missing', expected: null, given: null, x: x1 });
          continue;
        }
        // compare the polynomials at 51 points of the segment (empty coefficient = 0)
        const c = parsed.map((p) => (p.kind === 'ok' ? p.value * f : 0));
        let ok = true;
        for (let i = 0; i <= 50 && ok; i++) {
          const x = x1 + ((x2 - x1) * i) / 50;
          const user = c.reduceRight((acc, ci) => acc * x + ci, 0);
          ok = valueOk(user, evalNum(poly, x), scale);
        }
        items.push({ part, id: `${part}:${tag}`, status: ok ? 'correct' : 'wrong', expected: null, given: null, x: x1 });
      }
    }
  }

  // --- parts and score ------------------------------------------------------------------
  const weights: Partial<Record<PartKey, number>> = ex.ask.pointValues?.length
    ? { Vp: 0.5, Mp: 0.5 }
    : ex.ask.mmax
      ? { reactions: 0.2, mmax: 0.5, xmax: 0.3 }
      : ex.ask.equations
        ? { reactions: 0.2, Veq: 0.3, Meq: 0.5 }
        : { reactions: 0.2, V: 0.3, M: 0.5 };
  if (!ex.ask.reactions) delete weights.reactions;
  const sumW = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
  const parts: Part[] = (Object.entries(weights) as [PartKey, number][]).map(([key, w]) => {
    const its = items.filter((i) => i.part === key && !(i.extra && i.status === 'correct'));
    const correct = its.filter((i) => i.status === 'correct').length;
    return { key, weight: w / sumW, correct, total: its.length, ratio: its.length ? correct / its.length : 1 };
  });
  const score = Math.round(parts.reduce((a, p) => a + p.weight * p.ratio, 0) * 100) / 10;
  return { items, parts, score, invalid, missingPoints, solution: sol };
}
