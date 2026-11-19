/**
 * Global checks (spec §5.4), run on every solution. All of them are EXACT (Rational):
 * a failure is never a rounding issue, it is a bug or an invalid exercise.
 *
 * To be a real cross-check, the resultants of the distributed loads are computed here
 * with the textbook closed formulas (rectangle + triangle, centroid at 1/2 and 2/3),
 * not with the polynomial integration that solver A uses.
 */

import type { Beam, Load } from './model';
import { derivative, evalAt, integrate, peq, pneg } from './poly';
import type { AnalyticSolution } from './solverAnalytic';
import { type Rational, ZERO, add, div, eq, gt, isZero, lt, mul, q, sub, toString } from './rational';

export interface CheckResult {
  ok: boolean;
  failures: string[];
}

/** Downward force and clockwise moment about p, by closed formulas (independent of solver A). */
function resultantClosedForm(ld: Load, p: Rational): { F: Rational; Mp: Rational } {
  switch (ld.kind) {
    case 'point':
      return { F: ld.F, Mp: mul(ld.F, sub(ld.x, p)) };
    case 'moment':
      return { F: ZERO, Mp: ld.M };
    case 'udl': {
      const len = sub(ld.x2, ld.x1);
      const F = mul(ld.q, len);
      const xc = div(add(ld.x1, ld.x2), q(2));
      return { F, Mp: mul(F, sub(xc, p)) };
    }
    case 'linear': {
      // rectangle of height q1 + triangle of height (q2 − q1) with its centroid at x1 + 2·len/3
      const len = sub(ld.x2, ld.x1);
      const Frect = mul(ld.q1, len);
      const xrect = div(add(ld.x1, ld.x2), q(2));
      const Ftri = div(mul(sub(ld.q2, ld.q1), len), q(2));
      const xtri = add(ld.x1, div(mul(q(2), len), q(3)));
      return { F: add(Frect, Ftri), Mp: add(mul(Frect, sub(xrect, p)), mul(Ftri, sub(xtri, p))) };
    }
  }
}

/** Σ(upward forces) and Σ(clockwise moments about p) of loads + reactions: both must be 0. */
function equilibrium(sol: AnalyticSolution, p: Rational): { Fy: Rational; M: Rational } {
  let Fy = ZERO;
  let M = ZERO;
  for (const ld of sol.beam.loads) {
    const r = resultantClosedForm(ld, p);
    Fy = sub(Fy, r.F);
    M = add(M, r.Mp);
  }
  for (const r of sol.reactions) {
    Fy = add(Fy, r.R);
    M = sub(M, mul(r.R, sub(r.x, p)));
    if (r.M) M = add(M, r.M);
  }
  return { Fy, M };
}

function hasSupportAt(beam: Beam, x: Rational) {
  return beam.supports.find((s) => eq(s.x, x));
}

export function runChecks(sol: AnalyticSolution): CheckResult {
  const f: string[] = [];
  const { beam } = sol;
  const L = beam.length;
  const S = toString;

  // 1–2. ΣFy = 0 and ΣM = 0 about two different points (x = 0 and x = L).
  for (const p of [ZERO, L]) {
    const e = equilibrium(sol, p);
    if (!isZero(e.Fy)) f.push(`ΣFy = ${S(e.Fy)} N ≠ 0`);
    if (!isZero(e.M)) f.push(`ΣM about x = ${S(p)} is ${S(e.M)} N·m ≠ 0`);
  }

  // 3. After the right end everything must close: V(L⁺) = 0, M(L⁺) = 0. Left limits at 0 are 0.
  if (!isZero(sol.endV)) f.push(`V(L⁺) = ${S(sol.endV)} ≠ 0`);
  if (!isZero(sol.endM)) f.push(`M(L⁺) = ${S(sol.endM)} ≠ 0`);
  const first = sol.breakpoints[0];
  if (!first || !isZero(first.x) || !isZero(first.Vl) || !isZero(first.Ml)) f.push('Left limits at x = 0 are not 0');

  // 4. Jumps: ΔV = ΣR − ΣF at the point, ΔM = ΣM₀ + ΣM_R; elsewhere V and M are continuous.
  for (const bp of sol.breakpoints) {
    let dV = ZERO;
    let dM = ZERO;
    for (const r of sol.reactions) {
      if (!eq(r.x, bp.x)) continue;
      dV = add(dV, r.R);
      if (r.M) dM = add(dM, r.M);
    }
    for (const ld of beam.loads) {
      if (ld.kind === 'point' && eq(ld.x, bp.x)) dV = sub(dV, ld.F);
      if (ld.kind === 'moment' && eq(ld.x, bp.x)) dM = add(dM, ld.M);
    }
    if (!eq(sub(bp.Vr, bp.Vl), dV)) f.push(`V jump at x = ${S(bp.x)} is ${S(sub(bp.Vr, bp.Vl))}, expected ${S(dV)}`);
    if (!eq(sub(bp.Mr, bp.Ml), dM)) f.push(`M jump at x = ${S(bp.x)} is ${S(sub(bp.Mr, bp.Ml))}, expected ${S(dM)}`);
  }

  // 5. Ends: M = 0 at a pin/roller end without a point moment; V = M = 0 at a free end
  //    without a point load or moment (inner side of the end).
  for (const [x, inner] of [
    [ZERO, 'r'],
    [L, 'l'],
  ] as const) {
    const bp = sol.breakpoints.find((b) => eq(b.x, x));
    if (!bp) continue;
    const Min = inner === 'r' ? bp.Mr : bp.Ml;
    const Vin = inner === 'r' ? bp.Vr : bp.Vl;
    const sup = hasSupportAt(beam, x);
    const moment = beam.loads.some((ld) => ld.kind === 'moment' && eq(ld.x, x));
    const point = beam.loads.some((ld) => ld.kind === 'point' && eq(ld.x, x));
    if (sup && sup.type !== 'fixed' && !moment && !isZero(Min)) f.push(`M ≠ 0 at the simple support at x = ${S(x)}`);
    if (!sup && !moment && !isZero(Min)) f.push(`M ≠ 0 at the free end x = ${S(x)}`);
    if (!sup && !point && !isZero(Vin)) f.push(`V ≠ 0 at the free end x = ${S(x)}`);
  }

  // 6. Segments: dV/dx = −q, dM/dx = V, limits match the breakpoints, ∫V dx = ΔM.
  sol.segments.forEach((seg, i) => {
    const a = sol.breakpoints[i];
    const b = sol.breakpoints[i + 1];
    const where = `segment (${S(seg.x1)}, ${S(seg.x2)})`;
    if (!a || !b || !eq(a.x, seg.x1) || !eq(b.x, seg.x2)) {
      f.push(`${where}: breakpoints do not match`);
      return;
    }
    if (!peq(derivative(seg.V), pneg(seg.q))) f.push(`${where}: dV/dx ≠ −q`);
    if (!peq(derivative(seg.M), seg.V)) f.push(`${where}: dM/dx ≠ V`);
    if (!eq(evalAt(seg.V, seg.x1), a.Vr) || !eq(evalAt(seg.V, seg.x2), b.Vl)) f.push(`${where}: V limits do not match`);
    if (!eq(evalAt(seg.M, seg.x1), a.Mr) || !eq(evalAt(seg.M, seg.x2), b.Ml)) f.push(`${where}: M limits do not match`);
    if (!eq(integrate(seg.V, seg.x1, seg.x2), sub(b.Ml, a.Mr))) f.push(`${where}: ∫V dx ≠ ΔM`);
    // load density on the segment must equal the sum of the loads covering it (closed form)
    const mid = div(add(seg.x1, seg.x2), q(2));
    let qMid = ZERO;
    for (const ld of beam.loads) {
      if (ld.kind === 'point' || ld.kind === 'moment' || !gt(mid, ld.x1) || !lt(mid, ld.x2)) continue;
      if (ld.kind === 'udl') qMid = add(qMid, ld.q);
      else {
        qMid = add(qMid, add(ld.q1, mul(sub(ld.q2, ld.q1), div(sub(mid, ld.x1), sub(ld.x2, ld.x1)))));
      }
    }
    if (!eq(evalAt(seg.q, mid), qMid)) f.push(`${where}: load density does not match the loads`);
  });

  return { ok: f.length === 0, failures: f };
}
