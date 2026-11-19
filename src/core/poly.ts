/**
 * Polynomials with exact Rational coefficients, in the GLOBAL coordinate x.
 * p = [c0, c1, c2, ...] means c0 + c1·x + c2·x² + ...
 */

import { type Rational, ZERO, add, div, isZero, mul, neg, q, sub, toNumber } from './rational';

export type Poly = readonly Rational[];

export function trim(p: Poly): Poly {
  let n = p.length;
  while (n > 0 && isZero(p[n - 1] as Rational)) n--;
  return p.slice(0, n);
}

/** Degree of the polynomial; -1 for the zero polynomial. */
export const degree = (p: Poly): number => trim(p).length - 1;

export const coef = (p: Poly, i: number): Rational => p[i] ?? ZERO;

export function padd(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  return trim(Array.from({ length: n }, (_, i) => add(coef(a, i), coef(b, i))));
}

export const pneg = (a: Poly): Poly => a.map(neg);
export const psub = (a: Poly, b: Poly): Poly => padd(a, pneg(b));
export const pscale = (a: Poly, k: Rational): Poly => trim(a.map((c) => mul(c, k)));

export function pmul(a: Poly, b: Poly): Poly {
  if (a.length === 0 || b.length === 0) return [];
  const out: Rational[] = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
  a.forEach((ai, i) => b.forEach((bj, j) => (out[i + j] = add(out[i + j] as Rational, mul(ai, bj)))));
  return trim(out);
}

/** Exact evaluation (Horner). */
export function evalAt(p: Poly, x: Rational): Rational {
  let r = ZERO;
  for (let i = p.length - 1; i >= 0; i--) r = add(mul(r, x), p[i] as Rational);
  return r;
}

/** Floating evaluation, used only at irrational points (roots of quadratics). */
export function evalNum(p: Poly, x: number): number {
  let r = 0;
  for (let i = p.length - 1; i >= 0; i--) r = r * x + toNumber(p[i] as Rational);
  return r;
}

export function derivative(p: Poly): Poly {
  return trim(p.slice(1).map((c, i) => mul(c, q(i + 1))));
}

/** Antiderivative with zero constant term. */
export function antiderivative(p: Poly): Poly {
  return trim([ZERO, ...p.map((c, i) => div(c, q(i + 1)))]);
}

/** ∫_a^b p(x) dx, exact. */
export function integrate(p: Poly, a: Rational, b: Rational): Rational {
  const P = antiderivative(p);
  return sub(evalAt(P, b), evalAt(P, a));
}

export const peq = (a: Poly, b: Poly): boolean => degree(psub(a, b)) === -1;

/** Constant polynomial. */
export const pconst = (c: Rational): Poly => trim([c]);
