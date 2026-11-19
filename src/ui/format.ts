/** Display helpers: units chosen for an exercise, number formatting (decimal comma), figure width. */
import { useEffect, useState } from 'react';
import type { Exercise } from '../core/model';
import * as R from '../core/rational';
import { formatSmart } from '../core/units';

export interface DisplayUnits {
  force: 'N' | 'kN';
  moment: 'N·m' | 'kN·m';
  /** factor SI → display */
  fk: number;
}

/** kN when the statement uses kN, otherwise N (kg statements are answered in N, as in the OPE). */
export function displayUnits(ex: Exercise): DisplayUnits {
  const kN = ex.loads.some((l) => l.unit.startsWith('kN'));
  return kN ? { force: 'kN', moment: 'kN·m', fk: 1000 } : { force: 'N', moment: 'N·m', fk: 1 };
}

/** Number with up to `d` decimals, decimal comma, thin-space thousands, "−" sign. */
export const num = (v: number, d = 3): string => formatSmart(Math.abs(v) < 1e-9 ? 0 : v, d);
export const fmtF = (vSI: number, u: DisplayUnits, d = 3) => `${num(vSI / u.fk, d)} ${u.force}`;
export const fmtM = (vSI: number, u: DisplayUnits, d = 3) => `${num(vSI / u.fk, d)} ${u.moment}`;
export const fmtX = (x: number) => num(x, 3);
export const fmtR = (r: R.Rational, d = 3) => formatSmart(r, d);

/**
 * Width of the figures in SVG units = their real width in CSS pixels (so 13 px text stays
 * 13 px on a phone). Between 330 and 640.
 */
export function figWidthFor(viewport: number): number {
  const side = viewport >= 900 ? 230 + 56 : 0; // sidebar + paddings on desktop
  return Math.round(Math.min(640, Math.max(330, viewport - side - 60)));
}
export function useFigWidth(): number {
  const [w, setW] = useState(() => figWidthFor(typeof window === 'undefined' ? 1024 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(figWidthFor(window.innerWidth));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}
