/**
 * Template variables for worked exercises and theory texts (spec §12.3, §13.3): every
 * number shown in an explanation comes from here, i.e. from solver A, never typed by hand.
 *
 *   {{L}}                 beam length (m)
 *   {{g}}                 g of the settings (m/s²)
 *   {{R_A}}, {{M_A}} ...  reactions per support label (display units)
 *   {{Mmax}}, {{xMmax}}   |M|max and its x
 *   {{Vmax}}              |V|max
 *   {{W1}}, {{xW1}} ...   resultant of the i-th load of the statement (distributed loads),
 *                         and the x of its line of action
 *   {{xp}}, {{Vp}}, {{Mp}} named point p: position and values (no jump at p)
 *   {{pR}}, {{pV}}, {{pM}} OPE score split used by the grader (reactions/V/M)
 */

import type { Exercise } from './model';
import { extremes } from './keyPoints';
import * as R from './rational';
import { type AnalyticSolution, loadResultant, solveAnalytic, valuesAt } from './solverAnalytic';
import { type GSetting, exerciseToBeam, formatSmart, gValue } from './units';

export interface VarUnits {
  force: string; // 'N' | 'kN'
  moment: string;
  fk: number; // SI → display factor
}

export function workedVars(ex: Exercise, g: GSetting, u: VarUnits, sol?: AnalyticSolution): Record<string, string> {
  const beam = exerciseToBeam(ex, g);
  const s = sol ?? solveAnalytic(beam);
  const e = extremes(s);
  const f = (v: number, unit: string) => `${formatSmart(v / u.fk, 3)} ${unit}`;
  const m = (v: number) => formatSmart(v, 3);
  const vars: Record<string, string> = {
    L: m(R.toNumber(s.beam.length)),
    g: formatSmart(gValue(g)),
    Mmax: f(e.absMmax.value, u.moment),
    xMmax: m(e.xAbsMmax.value),
    Vmax: f(e.absVmax.value, u.force),
    pR: '% 20',
    pV: '% 30',
    pM: '% 50',
  };
  for (const r of s.reactions) {
    vars[`R_${r.label}`] = f(R.toNumber(r.R), u.force);
    if (r.M) vars[`M_${r.label}`] = f(R.toNumber(r.M), u.moment);
  }
  beam.loads.forEach((ld, i) => {
    const res = loadResultant(ld, R.ZERO);
    const F = R.toNumber(res.F);
    if (ld.kind === 'udl' || ld.kind === 'linear') {
      vars[`W${i + 1}`] = f(F, u.force);
      if (F !== 0) vars[`xW${i + 1}`] = m(R.toNumber(res.Mp) / F); // moment about x = 0 / force
    }
  });
  const p = ex.points?.[0];
  if (p) {
    const v = valuesAt(s, R.parse(p.x));
    vars.xp = m(R.toNumber(R.parse(p.x)));
    vars.Vp = f(R.toNumber(v.Vl), u.force);
    vars.Mp = f(R.toNumber(v.Ml), u.moment);
  }
  return vars;
}

/** Replace {{name}}; an unknown variable is left visible as {{name}} (and caught by the tests). */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (all, k: string) => vars[k] ?? all);
}
