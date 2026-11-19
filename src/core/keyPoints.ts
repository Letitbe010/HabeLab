/**
 * Key points (spec §5.2 step 4) and extremes (step 5).
 *
 * Key points = every breakpoint (with left and right limits V⁻, V⁺, M⁻, M⁺)
 *            + every point INSIDE a segment where V changes sign (local extremum of M).
 *
 * Everything is exact except the x of a V = 0 point when V is quadratic and the root is
 * irrational (linear loads). Only there a float is used: stable quadratic formula refined
 * by bisection to 1e-12, and M is then evaluated on the exact polynomial at that x.
 * A double root of V (V touches 0 without changing sign) is not an extremum of M and is
 * not reported.
 */

import type { Beam } from './model';
import { type Poly, coef, degree, evalAt, evalNum } from './poly';
import { type AnalyticSolution, type Breakpoint } from './solverAnalytic';
import { type Rational, ZERO, add, cmp, div, eq, isZero, lt, mul, neg, q, sign, sub, toNumber } from './rational';

/** A value that is exact whenever possible; `value` is always its float. */
export interface KeyValue {
  exact?: Rational;
  value: number;
}

export type KeyTag = 'end' | 'support' | 'point-load' | 'moment' | 'dist-start' | 'dist-end' | 'shear-zero' | 'point';

export interface KeyPoint {
  x: KeyValue;
  tags: KeyTag[];
  Vl: KeyValue;
  Vr: KeyValue;
  Ml: KeyValue;
  Mr: KeyValue;
}

export interface Extremes {
  Mmax: KeyValue;
  xMmax: KeyValue;
  Mmin: KeyValue;
  xMmin: KeyValue;
  absVmax: KeyValue;
  xAbsVmax: KeyValue;
}

const kv = (r: Rational): KeyValue => ({ exact: r, value: toNumber(r) });
const kn = (v: number): KeyValue => ({ value: v });

// ---------------------------------------------------------------------------
// Roots
// ---------------------------------------------------------------------------

function bigSqrt(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  // Newton correction (Number(n) may have lost precision)
  for (;;) {
    const y = (x + n / x) / 2n;
    if (y >= x) break;
    x = y;
  }
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x * x === n ? x : null;
}

/** Exact square root of a rational if it is a perfect square, else null. */
export function sqrtExact(r: Rational): Rational | null {
  const a = bigSqrt(r.n);
  const b = bigSqrt(r.d);
  return a !== null && b !== null ? q(a, b) : null;
}

function bisect(p: Poly, lo: number, hi: number): number {
  let flo = evalNum(p, lo);
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    const fm = evalNum(p, mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

export type Root = { exact: Rational; value: number } | { exact?: undefined; value: number };

/**
 * Roots of p strictly inside (a, b) where p CHANGES SIGN. Degree ≤ 2.
 * Throws for degree > 2 (cannot happen with loads of degree ≤ 1).
 */
export function signChangingRoots(p: Poly, a: Rational, b: Rational): Root[] {
  const d = degree(p);
  if (d <= 0) return [];
  const inside = (x: Rational) => lt(a, x) && lt(x, b);
  if (d === 1) {
    const x = neg(div(coef(p, 0), coef(p, 1)));
    return inside(x) ? [{ exact: x, value: toNumber(x) }] : [];
  }
  if (d > 2) throw new RangeError('signChangingRoots: degree > 2');
  const A = coef(p, 2);
  const B = coef(p, 1);
  const C = coef(p, 0);
  const disc = sub(mul(B, B), mul(q(4), mul(A, C)));
  if (sign(disc) <= 0) return []; // no real root, or a double root (no sign change)
  const s = sqrtExact(disc);
  if (s) {
    const twoA = mul(q(2), A);
    const xs = [div(sub(neg(B), s), twoA), div(add(neg(B), s), twoA)].filter(inside).sort(cmp);
    return xs.map((x) => ({ exact: x, value: toNumber(x) }));
  }
  // Irrational roots: stable formula, then bisection on a bracket inside (a, b).
  const An = toNumber(A);
  const Bn = toNumber(B);
  const Cn = toNumber(C);
  const sq = Math.sqrt(toNumber(disc));
  const qq = -0.5 * (Bn + (Bn >= 0 ? sq : -sq));
  const cand = [qq / An, Cn / qq].sort((u, v) => u - v);
  const an = toNumber(a);
  const bn = toNumber(b);
  const out: Root[] = [];
  for (const r of cand) {
    if (!(r > an && r < bn)) continue;
    const h = Math.max(1e-9, Math.abs(r) * 1e-9);
    const lo = Math.max(an, r - h);
    const hi = Math.min(bn, r + h);
    const flo = evalNum(p, lo);
    const fhi = evalNum(p, hi);
    out.push({ value: Math.sign(flo) !== Math.sign(fhi) ? bisect(p, lo, hi) : r });
  }
  return out;
}

// ---------------------------------------------------------------------------

function tagsAt(beam: Beam, x: Rational): KeyTag[] {
  const t: KeyTag[] = [];
  if (isZero(x) || eq(x, beam.length)) t.push('end');
  if (beam.supports.some((s) => eq(s.x, x))) t.push('support');
  for (const ld of beam.loads) {
    if (ld.kind === 'point' && eq(ld.x, x)) t.push('point-load');
    if (ld.kind === 'moment' && eq(ld.x, x)) t.push('moment');
    if ((ld.kind === 'udl' || ld.kind === 'linear') && eq(ld.x1, x)) t.push('dist-start');
    if ((ld.kind === 'udl' || ld.kind === 'linear') && eq(ld.x2, x)) t.push('dist-end');
  }
  return [...new Set(t)];
}

const fromBreakpoint = (bp: Breakpoint, tags: KeyTag[]): KeyPoint => ({
  x: kv(bp.x),
  tags,
  Vl: kv(bp.Vl),
  Vr: kv(bp.Vr),
  Ml: kv(bp.Ml),
  Mr: kv(bp.Mr),
});

/** All key points, sorted by x. */
export function keyPoints(sol: AnalyticSolution): KeyPoint[] {
  const out: KeyPoint[] = [];
  sol.breakpoints.forEach((bp, i) => {
    out.push(fromBreakpoint(bp, tagsAt(sol.beam, bp.x)));
    const seg = sol.segments[i];
    if (!seg) return;
    for (const r of signChangingRoots(seg.V, seg.x1, seg.x2)) {
      const Mv: KeyValue = r.exact ? kv(evalAt(seg.M, r.exact)) : kn(evalNum(seg.M, r.value));
      const zero: KeyValue = { exact: ZERO, value: 0 };
      out.push({ x: r.exact ? kv(r.exact) : kn(r.value), tags: ['shear-zero'], Vl: zero, Vr: zero, Ml: Mv, Mr: Mv });
    }
  });
  return out;
}

/**
 * Extremes of M (signed max and min) and of |V|, with their positions.
 * If the same extreme value occurs at several places, the leftmost one is reported.
 * |V| inside a segment can only peak where q = 0 changes sign (dV/dx = −q), so those
 * points are checked too.
 */
export function extremes(sol: AnalyticSolution, kps: KeyPoint[] = keyPoints(sol)): Extremes {
  let Mmax = kps[0]?.Ml as KeyValue;
  let xMmax = kps[0]?.x as KeyValue;
  let Mmin = Mmax;
  let xMmin = xMmax;
  let absVmax: KeyValue = { exact: ZERO, value: 0 };
  let xAbsVmax: KeyValue = { exact: ZERO, value: 0 };
  const better = (a: KeyValue, b: KeyValue) => (a.exact && b.exact ? cmp(a.exact, b.exact) : Math.sign(a.value - b.value));
  const absOf = (a: KeyValue): KeyValue => (a.exact ? kv(sign(a.exact) < 0 ? neg(a.exact) : a.exact) : kn(Math.abs(a.value)));
  for (const k of kps) {
    for (const m of [k.Ml, k.Mr]) {
      if (better(m, Mmax) > 0) [Mmax, xMmax] = [m, k.x];
      if (better(m, Mmin) < 0) [Mmin, xMmin] = [m, k.x];
    }
    for (const v of [k.Vl, k.Vr]) {
      const a = absOf(v);
      if (better(a, absVmax) > 0) [absVmax, xAbsVmax] = [a, k.x];
    }
  }
  for (const seg of sol.segments) {
    for (const r of signChangingRoots(seg.q, seg.x1, seg.x2)) {
      if (!r.exact) continue; // q has degree ≤ 1, so its roots are always rational
      const a = absOf(kv(evalAt(seg.V, r.exact)));
      if (better(a, absVmax) > 0) [absVmax, xAbsVmax] = [a, kv(r.exact)];
    }
  }
  return { Mmax, xMmax, Mmin, xMmin, absVmax, xAbsVmax };
}
