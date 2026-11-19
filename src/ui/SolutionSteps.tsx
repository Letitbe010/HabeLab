/**
 * Step-by-step solution (spec §8.5). Every number comes from solver A (exact) — nothing
 * is typed by hand. Resultant positions of linear loads are derived from the exact
 * resultant and its moment, never from a formula written here.
 */
import type { Exercise } from '../core/model';
import { type KeyPoint, extremes } from '../core/keyPoints';
import type { Poly } from '../core/poly';
import * as R from '../core/rational';
import { type AnalyticSolution, loadResultant } from '../core/solverAnalytic';
import { type GSetting, exerciseToBeam, factorToSI, formatSmart } from '../core/units';
import { useT } from '../i18n';
import { BeamFigure } from './BeamFigure';
import { DiagramView, type OverlayPoint } from './DiagramView';
import { type DisplayUnits, fmtF, fmtM, num } from './format';

interface Props {
  ex: Exercise;
  sol: AnalyticSolution;
  kps: KeyPoint[];
  units: DisplayUnits;
  g: GSetting;
  vFlip: boolean;
  mBelow: boolean;
  overlay?: OverlayPoint[];
}

const SUP = ['', '', '²', '³'];

/** "30 − 10·x", "12·x − 0,3333·x³" in display units. */
export function polyText(p: Poly, k: number): string {
  const terms: string[] = [];
  p.forEach((c, i) => {
    const v = R.toNumber(c) / k;
    if (Math.abs(v) < 1e-12) return;
    const mag = num(Math.abs(v), 4);
    const body = i === 0 ? mag : `${mag === '1' ? '' : `${mag}·`}x${SUP[i] ?? `^${i}`}`;
    terms.push(`${v < 0 ? '−' : terms.length ? '+' : ''}${terms.length ? ' ' : ''}${body}`);
  });
  return terms.length ? terms.join(' ').replace(/^\+ /, '') : '0';
}

export function SolutionSteps({ ex, sol, kps, units, g, vFlip, mBelow, overlay }: Props) {
  const { t } = useT();
  const beam = exerciseToBeam(ex, g);
  const k = units.fk;
  const vs = vFlip ? -1 : 1;
  const L = R.toNumber(sol.beam.length);
  const ext = extremes(sol, kps);

  // 1. unit conversions
  const conv = ex.loads
    .filter((l) => l.unit.startsWith('kg'))
    .map((l) => {
      const v = l.kind === 'point' ? l.F : l.kind === 'udl' ? l.q : l.kind === 'moment' ? l.M : l.q1;
      const si = R.toNumber(R.mul(R.parse(v), factorToSI(l.unit, g)));
      const siUnit = l.unit === 'kg' ? 'N' : l.unit === 'kg/m' ? 'N/m' : 'N·m';
      const lines = [`${num(R.toNumber(R.parse(v)))} ${l.unit} · ${formatSmart(R.parse(g))} m/s² = ${num(si)} ${siUnit}`];
      if (l.kind === 'linear') {
        const si2 = R.toNumber(R.mul(R.parse(l.q2), factorToSI(l.unit, g)));
        lines.push(`${num(R.toNumber(R.parse(l.q2)))} ${l.unit} · ${formatSmart(R.parse(g))} m/s² = ${num(si2)} ${siUnit}`);
      }
      return lines;
    })
    .flat();

  // 3. equilibrium about the left support (or the fixed support)
  const sup = [...sol.reactions].sort((a, b) => R.cmp(a.x, b.x));
  const a = sup[0]!;
  const xa = R.toNumber(a.x);
  const terms = beam.loads.map((ld) => {
    const r = loadResultant(ld, a.x);
    const F = R.toNumber(r.F);
    const Mp = R.toNumber(r.Mp);
    if (ld.kind === 'moment') return { F: 0, Mp, text: `${Mp >= 0 ? '+' : '−'} ${num(Math.abs(Mp) / k)}` };
    const arm = F !== 0 ? Mp / F : 0;
    const xbar = xa + arm;
    const extra = ld.kind === 'point' ? '' : ` [${t('sol.resultant')}: ${num(F / k)} ${units.force}, x̄ = ${num(xbar)} m]`;
    return { F, Mp, text: `${Mp >= 0 ? '+' : '−'} ${num(Math.abs(F) / k)}·${num(Math.abs(arm))}${extra}` };
  });
  const sumMp = terms.reduce((s, x) => s + x.Mp, 0);
  const sumF = terms.reduce((s, x) => s + x.F, 0);

  // 7. interior V = 0 points
  const zeros = kps.filter((p) => p.tags.includes('shear-zero'));

  return (
    <div className="solution">
      <h2 className="sec">{t('sol.title')}</h2>

      <div className="sol-ask">
        <h4>{t('sol.units')}</h4>
        {conv.length ? conv.map((c) => <p key={c} className="formula">{c}</p>) : <p>{t('sol.noUnits')}</p>}
      </div>

      <div className="sol-ask">
        <h4>{t('sol.fbd')}</h4>
        <BeamFigure ex={ex} dims="none" reactions={sol.reactions} units={units} />
      </div>

      <div className="sol-ask">
        <h4>{t('sol.equilibrium')}</h4>
        <div className="block">
          {sup.length === 2 ? (
            <>
              <p className="formula eq">
                ΣM<sub>{a.label}</sub> = 0 (↻ +): {terms.map((x) => x.text).join(' ')} − R<sub>{sup[1]!.label}</sub>·{num(R.toNumber(sup[1]!.x) - xa)} = 0
              </p>
              <p className="formula eq">
                R<sub>{sup[1]!.label}</sub> = {num(sumMp / k)} / {num(R.toNumber(sup[1]!.x) - xa)} = <b>{fmtF(R.toNumber(sup[1]!.R), units)}</b>
              </p>
              <p className="formula eq">
                ΣF<sub>y</sub> = 0: R<sub>{a.label}</sub> + R<sub>{sup[1]!.label}</sub> − {num(sumF / k)} = 0 → R<sub>{a.label}</sub> = <b>{fmtF(R.toNumber(a.R), units)}</b>
              </p>
            </>
          ) : (
            <>
              <p className="formula eq">
                ΣF<sub>y</sub> = 0: R<sub>{a.label}</sub> − {num(sumF / k)} = 0 → R<sub>{a.label}</sub> = <b>{fmtF(R.toNumber(a.R), units)}</b>
              </p>
              <p className="formula eq">
                ΣM<sub>{a.label}</sub> = 0 (↻ +): {terms.map((x) => x.text).join(' ')} + M<sub>{a.label}</sub> = 0 → M<sub>{a.label}</sub> = <b>{fmtM(R.toNumber(a.M ?? R.ZERO), units)}</b>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="sol-ask">
        <h4>{t('sol.segments')}</h4>
        <div className="block">
          {sol.segments.map((s) => (
            <p key={R.toString(s.x1)} className="formula eq">
              {t('sol.segment', { a: num(R.toNumber(s.x1)), b: num(R.toNumber(s.x2)) })}: &nbsp; V(x) = {polyText(vFlip ? s.V.map(R.neg) : s.V, k)} {units.force}; &nbsp; M(x) = {polyText(s.M, k)} {units.moment}
            </p>
          ))}
        </div>
      </div>

      <div className="sol-ask">
        <h4>{t('sol.table')}</h4>
        <div className="block">
          <table>
            <thead>
              <tr>
                <th>x (m)</th>
                <th>V⁻ ({units.force})</th>
                <th>V⁺ ({units.force})</th>
                <th>M⁻ ({units.moment})</th>
                <th>M⁺ ({units.moment})</th>
              </tr>
            </thead>
            <tbody>
              {kps.map((p) => {
                const atStart = Math.abs(p.x.value) < 1e-12;
                const atEnd = Math.abs(p.x.value - L) < 1e-12;
                const c = (v: number, hide: boolean) => (hide ? '—' : num((v / k) * 1, 3));
                return (
                  <tr key={p.x.value} className={Math.abs(p.x.value - ext.xAbsMmax.value) < 1e-9 ? 'best' : ''}>
                    <td>{num(p.x.value)}</td>
                    <td>{c(vs * p.Vl.value, atStart)}</td>
                    <td>{c(vs * p.Vr.value, atEnd)}</td>
                    <td>{c(p.Ml.value, atStart)}</td>
                    <td>{c(p.Mr.value, atEnd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sol-ask">
        <h4>{t('sol.diagrams')}</h4>
        <DiagramView sol={sol} kps={kps} units={units} vFlip={vFlip} mBelow={mBelow} overlay={overlay} />
        <p className="legend">
          <span>
            <i style={{ background: 'var(--V)' }} />V
          </span>
          <span>
            <i style={{ background: 'var(--M)' }} />M
          </span>
          {overlay?.length ? (
            <span>
              <i style={{ background: 'repeating-linear-gradient(90deg, var(--user) 0 6px, transparent 6px 10px)' }} />
              {t('sol.overlay')}
            </span>
          ) : null}
        </p>
      </div>

      <div className="sol-ask">
        <h4>{t('sol.mmax')}</h4>
        {zeros.length ? (
          zeros.map((z) => (
            <p key={z.x.value} className="formula eq">
              {t('sol.vzero', { x: num(z.x.value), m: fmtM(z.Ml.value, units) })}
            </p>
          ))
        ) : (
          <p>{t('sol.noVzero')}</p>
        )}
        <p className="answer">
          <b>{t('sol.absMax', { m: fmtM(ext.absMmax.value, units), x: num(ext.xAbsMmax.value) })}</b>
        </p>
      </div>
    </div>
  );
}
