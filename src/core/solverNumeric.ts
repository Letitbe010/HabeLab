/**
 * Solver B (numeric, independent). Spec §5.3.
 *
 * Deliberately shares NO code with solver A (solverAnalytic.ts / poly.ts / checks.ts):
 *  - plain floating point (numbers), no Rational polynomials;
 *  - the load density is sampled on a fine grid (default 20 000 cells) whose nodes
 *    include every jump point exactly;
 *  - reactions from ΣM about the RIGHT support (solver A uses the left one), with the
 *    distributed loads integrated numerically on the grid (Simpson per cell);
 *  - V and M by cumulative integration from the left end (V: trapezoid, M: Simpson), with the jumps
 *    (point loads, point moments, reactions) applied separately at their nodes.
 *
 * Conventions (spec §4.1): F, q > 0 downwards; M₀ > 0 clockwise; R > 0 upwards;
 * reaction moment > 0 clockwise; V > 0 = left resultant upwards; M > 0 sagging.
 */

import type { Beam, Load } from './model';
import { toNumber } from './rational';

export interface NumericReaction {
  label: string;
  x: number;
  R: number;
  M?: number;
}

export interface NumericSolution {
  L: number;
  reactions: NumericReaction[];
  /** Grid nodes, strictly increasing; every jump point is a node. */
  xs: number[];
  /** Left and right limits of V and M at every node. */
  Vl: number[];
  Vr: number[];
  Ml: number[];
  Mr: number[];
  /** Load density just right (qR) and just left (qL) of every node. */
  qR: number[];
  qL: number[];
  /** V and M just right of x = L (must be ≈ 0). */
  endV: number;
  endM: number;
}

interface NumLoad {
  kind: Load['kind'];
  x: number;
  x1: number;
  x2: number;
  a: number; // F, M, q or q1
  b: number; // q2 (linear) or same as a
}

function toNum(ld: Load): NumLoad {
  switch (ld.kind) {
    case 'point':
      return { kind: 'point', x: toNumber(ld.x), x1: 0, x2: 0, a: toNumber(ld.F), b: 0 };
    case 'moment':
      return { kind: 'moment', x: toNumber(ld.x), x1: 0, x2: 0, a: toNumber(ld.M), b: 0 };
    case 'udl': {
      const q = toNumber(ld.q);
      return { kind: 'udl', x: 0, x1: toNumber(ld.x1), x2: toNumber(ld.x2), a: q, b: q };
    }
    case 'linear':
      return { kind: 'linear', x: 0, x1: toNumber(ld.x1), x2: toNumber(ld.x2), a: toNumber(ld.q1), b: toNumber(ld.q2) };
  }
}

/**
 * Load density at x. side = +1: right limit (load counts on [x1, x2)); side = −1: left
 * limit (load counts on (x1, x2]). Linear interpolation between q1 and q2.
 */
function density(loads: NumLoad[], x: number, side: 1 | -1): number {
  let q = 0;
  for (const l of loads) {
    if (l.kind !== 'udl' && l.kind !== 'linear') continue;
    const inside = side > 0 ? x >= l.x1 && x < l.x2 : x > l.x1 && x <= l.x2;
    if (!inside) continue;
    const t = (x - l.x1) / (l.x2 - l.x1);
    q += l.a + (l.b - l.a) * t;
  }
  return q;
}

function buildGrid(L: number, events: number[], cells: number): number[] {
  const set = new Set<number>([0, L, ...events]);
  for (let i = 1; i < cells; i++) set.add((L * i) / cells);
  const xs = [...set].sort((u, v) => u - v);
  // merge float near-duplicates of event points with uniform nodes (keep the event value)
  const ev = new Set([0, L, ...events]);
  const out: number[] = [];
  const eps = L * 1e-12;
  for (const x of xs) {
    const last = out[out.length - 1];
    if (last !== undefined && x - last < eps) {
      if (ev.has(x)) out[out.length - 1] = x;
      continue;
    }
    out.push(x);
  }
  return out;
}

export function solveNumeric(beam: Beam, cells = 20_000): NumericSolution {
  const L = toNumber(beam.length);
  const loads = beam.loads.map(toNum);
  const sup = beam.supports.map((s) => ({ label: s.label, type: s.type, x: toNumber(s.x) })).sort((u, v) => u.x - v.x);

  const events: number[] = sup.map((s) => s.x);
  for (const l of loads) {
    if (l.kind === 'point' || l.kind === 'moment') events.push(l.x);
    else events.push(l.x1, l.x2);
  }
  const xs = buildGrid(L, events, cells);

  // --- Resultants on the grid: total downward force and clockwise moment about p ---
  const resultants = (p: number) => {
    let F = 0;
    let Mp = 0;
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i] as number;
      const b = xs[i + 1] as number;
      // Simpson's rule per cell: q is linear and q·(x − p) quadratic inside a cell, so
      // the result does not depend on how many cells lie under a short load.
      const m = (a + b) / 2;
      const qa = density(loads, a, 1);
      const qb = density(loads, b, -1);
      const qm = density(loads, m, 1);
      F += ((b - a) / 6) * (qa + 4 * qm + qb);
      Mp += ((b - a) / 6) * (qa * (a - p) + 4 * qm * (m - p) + qb * (b - p));
    }
    for (const l of loads) {
      if (l.kind === 'point') {
        F += l.a;
        Mp += l.a * (l.x - p);
      } else if (l.kind === 'moment') Mp += l.a;
    }
    return { F, Mp };
  };

  // --- Reactions ---
  let reactions: NumericReaction[];
  if (sup.length === 1) {
    const f = sup[0]!;
    const { F, Mp } = resultants(f.x);
    reactions = [{ label: f.label, x: f.x, R: F, M: -Mp }];
  } else {
    const [a, b] = [sup[0]!, sup[1]!];
    const { F, Mp } = resultants(b.x);
    // ΣM about b (clockwise +): Mp(loads) − R_a·(x_a − x_b) = 0  →  R_a = Mp / (x_a − x_b)
    const Ra = Mp / (a.x - b.x);
    reactions = [
      { label: a.label, x: a.x, R: Ra },
      { label: b.label, x: b.x, R: F - Ra },
    ];
  }

  // --- Cumulative integration with jumps ---
  const n = xs.length;
  const Vl = new Array<number>(n);
  const Vr = new Array<number>(n);
  const Ml = new Array<number>(n);
  const Mr = new Array<number>(n);
  const qR = new Array<number>(n).fill(0); // q just right of node i (start of cell i)
  const qL = new Array<number>(n).fill(0); // q just left of node i (end of cell i − 1)
  let V = 0;
  let M = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] as number;
    Vl[i] = V;
    Ml[i] = M;
    for (const r of reactions) {
      if (r.x !== x) continue;
      V += r.R;
      if (r.M !== undefined) M += r.M;
    }
    for (const l of loads) {
      if (l.kind === 'point' && l.x === x) V -= l.a;
      if (l.kind === 'moment' && l.x === x) M += l.a;
    }
    Vr[i] = V;
    Mr[i] = M;
    if (i + 1 < n) {
      const b = xs[i + 1] as number;
      const h = b - x;
      const qa = density(loads, x, 1);
      const qb = density(loads, b, -1);
      qR[i] = qa;
      qL[i + 1] = qb;
      const Vb = V - ((qa + qb) / 2) * h; // dV/dx = −q (exact for linear q)
      // dM/dx = V. V is at most quadratic in a cell, so Simpson's rule with the midpoint
      // value is used (the spec suggests trapezoids; Simpson is more accurate, same idea).
      const qm = density(loads, x + h / 2, 1);
      const Vm = V - ((qa + qm) / 2) * (h / 2); // V at the midpoint (trapezoid, exact for linear q)
      M += (h / 6) * (V + 4 * Vm + Vb);
      V = Vb;
    }
  }
  return { L, reactions, xs, Vl, Vr, Ml, Mr, qR, qL, endV: V, endM: M };
}

/** Index of the node at x (exact float match, or within 1e-12·L). −1 if not a node. */
export function nodeIndex(sol: NumericSolution, x: number): number {
  const eps = Math.max(1e-12, sol.L * 1e-12);
  let lo = 0;
  let hi = sol.xs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sol.xs[mid] as number;
    if (Math.abs(v - x) <= eps) return mid;
    if (v < x) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/** Extremes over the inner-side limits of every node (V⁺/M⁺ at 0, V⁻/M⁻ at L). */
export function numericExtremes(sol: NumericSolution) {
  let Mmax = -Infinity;
  let Mmin = Infinity;
  let absVmax = 0;
  let xMmax = 0;
  let xMmin = 0;
  const n = sol.xs.length;
  for (let i = 0; i < n; i++) {
    const ms = i === 0 ? [sol.Mr[i]!] : i === n - 1 ? [sol.Ml[i]!] : [sol.Ml[i]!, sol.Mr[i]!];
    const vs = i === 0 ? [sol.Vr[i]!] : i === n - 1 ? [sol.Vl[i]!] : [sol.Vl[i]!, sol.Vr[i]!];
    for (const m of ms) {
      if (m > Mmax) [Mmax, xMmax] = [m, sol.xs[i]!];
      if (m < Mmin) [Mmin, xMmin] = [m, sol.xs[i]!];
    }
    for (const v of vs) absVmax = Math.max(absVmax, Math.abs(v));
    // Inside cell i the load is linear, so V(x_i + t) = V⁺ − qa·t − (qb − qa)·t²/(2h).
    // Where V changes sign in the cell, find that t (bisection) and integrate M up to it.
    if (i + 1 < n) {
      const h = sol.xs[i + 1]! - sol.xs[i]!;
      const V0 = sol.Vr[i]!;
      const V1 = sol.Vl[i + 1]!;
      const qa = sol.qR[i]!;
      const k = (sol.qL[i + 1]! - qa) / h;
      // |V| peaks inside the cell where q = 0 changes sign (dV/dx = −q)
      if (qa * sol.qL[i + 1]! < 0) {
        const t0 = -qa / k;
        absVmax = Math.max(absVmax, Math.abs(V0 - qa * t0 - (k * t0 * t0) / 2));
      }
      if (V0 * V1 < 0) {
        const Vt = (t: number) => V0 - qa * t - (k * t * t) / 2;
        let lo = 0;
        let hi = h;
        for (let it = 0; it < 80; it++) {
          const mid = (lo + hi) / 2;
          if (Vt(mid) * V0 > 0) lo = mid;
          else hi = mid;
        }
        const t = (lo + hi) / 2;
        const m = sol.Mr[i]! + V0 * t - (qa * t * t) / 2 - (k * t * t * t) / 6;
        if (m > Mmax) [Mmax, xMmax] = [m, sol.xs[i]! + t];
        if (m < Mmin) [Mmin, xMmin] = [m, sol.xs[i]! + t];
      }
    }
  }
  return { Mmax, xMmax, Mmin, xMmin, absVmax };
}
