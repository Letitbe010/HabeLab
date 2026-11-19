/**
 * Units (spec §4.2).
 *
 * "kg" as a force means kgf: F[N] = m[kg] · g. g is a setting in {9.81 (default), 9.8, 10},
 * always used as an exact Rational (981/100, 49/5, 10).
 * Internal units: N, N/m, N·m, m.
 */

import type { Beam, Exercise, ExerciseLoad, ForceUnit, LineUnit, Load, MomentUnit } from './model';
import { type Rational, mul, div, parse, q, toFixed, toNumber, isZero } from './rational';

export type GSetting = '9.81' | '9.8' | '10';
export const G_DEFAULT: GSetting = '9.81';

export function gValue(g: GSetting): Rational {
  switch (g) {
    case '9.81':
      return q(981, 100);
    case '9.8':
      return q(49, 5);
    case '10':
      return q(10);
  }
}

export type AnyUnit = ForceUnit | LineUnit | MomentUnit;

/** Factor to convert a value in `unit` into the internal unit (N, N/m or N·m). */
export function factorToSI(unit: AnyUnit, g: GSetting): Rational {
  switch (unit) {
    case 'N':
    case 'N/m':
    case 'N·m':
      return q(1);
    case 'kN':
    case 'kN/m':
    case 'kN·m':
      return q(1000);
    case 'kg':
    case 'kg/m':
    case 'kg·m':
      return gValue(g);
  }
}

export const toSI = (value: Rational, unit: AnyUnit, g: GSetting): Rational => mul(value, factorToSI(unit, g));
export const fromSI = (value: Rational, unit: AnyUnit, g: GSetting): Rational => div(value, factorToSI(unit, g));

function loadToSI(ld: ExerciseLoad, g: GSetting): Load {
  const f = factorToSI(ld.unit, g);
  switch (ld.kind) {
    case 'point':
      return { kind: 'point', x: parse(ld.x), F: mul(parse(ld.F), f) };
    case 'udl':
      return { kind: 'udl', x1: parse(ld.x1), x2: parse(ld.x2), q: mul(parse(ld.q), f) };
    case 'linear':
      return { kind: 'linear', x1: parse(ld.x1), x2: parse(ld.x2), q1: mul(parse(ld.q1), f), q2: mul(parse(ld.q2), f) };
    case 'moment':
      return { kind: 'moment', x: parse(ld.x), M: mul(parse(ld.M), f) };
  }
}

/** Exam statement → solver input in N and m, with the chosen g. */
export function exerciseToBeam(ex: Exercise, g: GSetting = G_DEFAULT): Beam {
  return {
    length: parse(ex.beam.length),
    supports: ex.beam.supports.map((s, i) => ({ id: `S${i}`, type: s.type, x: parse(s.x), label: s.label })),
    loads: ex.loads.map((ld) => loadToSI(ld, g)),
  };
}

// ---------------------------------------------------------------------------
// Number formatting for eu/es (spec §4.2): decimal comma, thin space for thousands.
// ---------------------------------------------------------------------------

/** U+202F NARROW NO-BREAK SPACE: thin, and never splits "19 620" across lines. */
export const THIN_SPACE = ' ';

function groupThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}

/**
 * Format a value with a fixed number of decimals: 19620 → "19 620", 27.7128 → "27,71".
 * Accepts an exact Rational (rounded exactly) or a number. "-0" is printed as "0".
 * Four-digit integers are grouped too ("4 000"), as in the spec's examples of SI style.
 */
export function formatNumber(value: Rational | number, decimals = 2): string {
  const s = typeof value === 'number' ? value.toFixed(decimals) : toFixed(value, decimals);
  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;
  const [intPart = '0', frac] = body.split('.');
  const isZeroStr = /^[0.]*$/.test(body);
  const out = groupThousands(intPart) + (frac !== undefined ? `,${frac}` : '');
  return (negative && !isZeroStr ? '−' : '') + out; // U+2212 minus sign
}

/**
 * Shortest sensible display: integers without decimals, otherwise up to `maxDecimals`
 * with trailing zeros removed (19620 → "19 620"; 27.713 → "27,713"; 2.5 → "2,5").
 */
export function formatSmart(value: Rational | number, maxDecimals = 3): string {
  const v = typeof value === 'number' ? value : toNumber(value);
  if (typeof value !== 'number' && (value.d === 1n || isZero(value))) return formatNumber(value, 0);
  let s = formatNumber(value, maxDecimals);
  if (s.includes(',')) s = s.replace(/0+$/, '').replace(/,$/, '');
  return Number.isFinite(v) ? s : String(v);
}

/**
 * Parse user input: decimal comma or point, spaces (any Unicode space, including the
 * thin space used for thousands) are ignored, and the U+2212 minus sign is accepted.
 */
export function parseUserNumber(input: string): Rational {
  return parse(input.replace(/\s/g, '').replace(/−/g, '-'));
}
