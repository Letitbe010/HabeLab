/**
 * Theory widgets (spec §12.2). All of them use the same core solver as the rest of the
 * app (no duplicated calculations) and verify every beam before drawing it.
 *  - moving-load: a point load dragged along a simple beam → reactions, V, M live
 *  - section-cut: a section moved along a beam → forces left of it, V(x), M(x)
 *  - free-editor: build your own beam (supports, up to four loads) and see the diagrams
 */
import { useMemo, useState } from 'react';
import { extremes, keyPoints } from '../../core/keyPoints';
import type { Exercise, ExerciseLoad, ExerciseSupport } from '../../core/model';
import * as R from '../../core/rational';
import { loadResultant, valuesAt } from '../../core/solverAnalytic';
import { exerciseToBeam } from '../../core/units';
import { verifyBeam } from '../../core/verify';
import { useT } from '../../i18n';
import { BeamFigure } from '../BeamFigure';
import { DiagramView } from '../DiagramView';
import { type DisplayUnits, fmtF, fmtM, num } from '../format';
import type { WidgetId } from '../../content/theory/types';

const KN: DisplayUnits = { force: 'kN', moment: 'kN·m', fk: 1000 };
const qs = (x: number) => String(Math.round(x * 100) / 100);

function useSolved(ex: Exercise | null) {
  return useMemo(() => {
    if (!ex) return null;
    try {
      const v = verifyBeam(exerciseToBeam(ex, '9.81'), 2000);
      return v.ok && v.a ? v.a : null;
    } catch {
      return null;
    }
  }, [ex]);
}

function base(L: number, supports: ExerciseSupport[], loads: ExerciseLoad[]): Exercise {
  return { id: 'widget', origin: 'generated', difficulty: 1, beam: { length: qs(L), supports }, loads, ask: { reactions: true, diagrams: true } };
}

function MovingLoad() {
  const { t } = useT();
  const L = 6;
  const P = 10;
  const [a, setA] = useState(2);
  const ex = useMemo(
    () => base(L, [{ type: 'pin', x: '0', label: 'A' }, { type: 'roller', x: qs(L), label: 'B' }], [{ kind: 'point', x: qs(a), F: String(P), unit: 'kN' }]),
    [a],
  );
  const sol = useSolved(ex);
  if (!sol) return null;
  const kps = keyPoints(sol);
  const e = extremes(sol, kps);
  return (
    <div className="widget">
      <b>{t('th.w.moving')}</b>
      <label className="slider">
        {t('th.w.position')}: x = {num(a)} m
        <input type="range" min={0.25} max={L - 0.25} step={0.25} value={a} onChange={(ev) => setA(Number(ev.target.value))} />
      </label>
      <BeamFigure ex={ex} dims="cumulative" />
      <DiagramView sol={sol} kps={kps} units={KN} vFlip={false} mBelow={false} />
      <p className="formula">
        R<sub>A</sub> = {fmtF(R.toNumber(sol.reactions[0]!.R), KN)}; R<sub>B</sub> = {fmtF(R.toNumber(sol.reactions[1]!.R), KN)}; M<sub>max</sub> = {fmtM(e.absMmax.value, KN)} (x = {num(e.xAbsMmax.value)} m)
      </p>
      <p className="hint">{t('th.w.movingHint')}</p>
    </div>
  );
}

function SectionCut() {
  const { t } = useT();
  const ex = useMemo(
    () =>
      base(8, [{ type: 'pin', x: '0', label: 'A' }, { type: 'roller', x: '8', label: 'B' }], [
        { kind: 'point', x: '2', F: '20', unit: 'kN' },
        { kind: 'udl', x1: '4', x2: '8', q: '5', unit: 'kN/m' },
      ]),
    [],
  );
  const sol = useSolved(ex);
  const [x, setX] = useState(3);
  if (!sol) return null;
  const kps = keyPoints(sol);
  const v = valuesAt(sol, R.parse(qs(x)));
  // forces left of the section, from the core (loads clipped at the section)
  const cut = R.parse(qs(x));
  const left: string[] = sol.reactions.filter((r) => R.lt(r.x, cut)).map((r) => `R_${r.label} = ${fmtF(R.toNumber(r.R), KN)} ↑`);
  for (const ld of sol.beam.loads) {
    if (ld.kind === 'point' && R.lt(ld.x, cut)) left.push(`F = ${fmtF(R.toNumber(ld.F), KN)} ↓ (x = ${num(R.toNumber(ld.x))} m)`);
    if (ld.kind === 'udl' && R.lt(ld.x1, cut)) {
      const part = loadResultant({ ...ld, x2: R.min(ld.x2, cut) }, R.ZERO);
      left.push(`q·a = ${fmtF(R.toNumber(part.F), KN)} ↓ (x̄ = ${num(R.toNumber(part.Mp) / R.toNumber(part.F))} m)`);
    }
  }
  return (
    <div className="widget">
      <b>{t('th.w.cut')}</b>
      <label className="slider">
        {t('th.w.section')}: x = {num(x)} m
        <input type="range" min={0.1} max={7.9} step={0.1} value={x} onChange={(ev) => setX(Number(ev.target.value))} />
      </label>
      <BeamFigure ex={{ ...ex, points: [{ label: 's', x: qs(x) }] }} dims="cumulative" />
      <p className="formula">
        {t('th.w.leftForces')}: {left.join('; ')}
      </p>
      <p className="formula">
        V({num(x)}) = {fmtF(R.toNumber(v.Vl), KN)}; &nbsp; M({num(x)}) = {fmtM(R.toNumber(v.Ml), KN)}
      </p>
      <DiagramView sol={sol} kps={kps} units={KN} vFlip={false} mBelow={false} overlay={[{ x, Vl: R.toNumber(v.Vl), Ml: R.toNumber(v.Ml) }]} />
      <p className="hint">{t('th.w.cutHint')}</p>
    </div>
  );
}

type LoadRow = { kind: 'point' | 'udl' | 'moment'; a: string; b: string; v: string };

function FreeEditor() {
  const { t } = useT();
  const [L, setL] = useState('6');
  const [sup, setSup] = useState<'ss' | 'overhang' | 'cantilever'>('ss');
  const [rows, setRows] = useState<LoadRow[]>([
    { kind: 'point', a: '2', b: '', v: '10' },
    { kind: 'udl', a: '3', b: '6', v: '4' },
  ]);
  const ex = useMemo((): Exercise | null => {
    const Ln = Number(L.replace(',', '.'));
    if (!(Ln > 0 && Ln <= 30)) return null;
    const supports: ExerciseSupport[] =
      sup === 'ss'
        ? [{ type: 'pin', x: '0', label: 'A' }, { type: 'roller', x: qs(Ln), label: 'B' }]
        : sup === 'overhang'
          ? [{ type: 'pin', x: '0', label: 'A' }, { type: 'roller', x: qs(Ln * 0.75), label: 'B' }]
          : [{ type: 'fixed', x: '0', label: 'A' }];
    const loads: ExerciseLoad[] = [];
    for (const r of rows) {
      const n = (s: string) => s.trim().replace(',', '.');
      if (!n(r.a) || !n(r.v)) continue;
      if (r.kind === 'point') loads.push({ kind: 'point', x: n(r.a), F: n(r.v), unit: 'kN' });
      else if (r.kind === 'moment') loads.push({ kind: 'moment', x: n(r.a), M: n(r.v), unit: 'kN·m' });
      else if (n(r.b)) loads.push({ kind: 'udl', x1: n(r.a), x2: n(r.b), q: n(r.v), unit: 'kN/m' });
    }
    return loads.length ? base(Ln, supports, loads) : null;
  }, [L, sup, rows]);
  const sol = useSolved(ex);
  const upd = (i: number, p: Partial<LoadRow>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
  return (
    <div className="widget">
      <b>{t('th.w.free')}</b>
      <div className="w-controls">
        <label className="fld">
          L (m)
          <input inputMode="decimal" value={L} onChange={(e) => setL(e.target.value)} style={{ width: '5em' }} />
        </label>
        <label className="fld">
          {t('wk.f.support')}
          <select value={sup} onChange={(e) => setSup(e.target.value as typeof sup)}>
            <option value="ss">{t('wk.support.simple')}</option>
            <option value="overhang">{t('wk.support.overhang')}</option>
            <option value="cantilever">{t('wk.support.cantilever')}</option>
          </select>
        </label>
      </div>
      {rows.map((r, i) => (
        <div className="w-controls" key={i}>
          <select value={r.kind} onChange={(e) => upd(i, { kind: e.target.value as LoadRow['kind'] })}>
            <option value="point">{t('wk.load.point')} (kN)</option>
            <option value="udl">{t('wk.load.udl')} (kN/m)</option>
            <option value="moment">{t('wk.load.moment')} (kN·m)</option>
          </select>
          <label className="fld">
            {r.kind === 'udl' ? 'x₁ (m)' : 'x (m)'}
            <input inputMode="decimal" value={r.a} onChange={(e) => upd(i, { a: e.target.value })} style={{ width: '4.5em' }} />
          </label>
          {r.kind === 'udl' && (
            <label className="fld">
              x₂ (m)
              <input inputMode="decimal" value={r.b} onChange={(e) => upd(i, { b: e.target.value })} style={{ width: '4.5em' }} />
            </label>
          )}
          <label className="fld">
            {t('th.w.value')}
            <input inputMode="decimal" value={r.v} onChange={(e) => upd(i, { v: e.target.value })} style={{ width: '5em' }} />
          </label>
          <button className="small" onClick={() => setRows(rows.filter((_, k) => k !== i))}>
            ✕
          </button>
        </div>
      ))}
      {rows.length < 4 && (
        <button className="small" onClick={() => setRows([...rows, { kind: 'point', a: '', b: '', v: '' }])}>
          + {t('th.w.addLoad')}
        </button>
      )}
      {ex && sol ? (
        <>
          <BeamFigure ex={ex} dims="both" reactions={sol.reactions} units={KN} />
          <DiagramView sol={sol} kps={keyPoints(sol)} units={KN} vFlip={false} mBelow={false} />
        </>
      ) : (
        <p className="note warn">{t('th.w.invalid')}</p>
      )}
    </div>
  );
}

export function TheoryWidget({ w }: { w: WidgetId }) {
  if (w === 'moving-load') return <MovingLoad />;
  if (w === 'section-cut') return <SectionCut />;
  return <FreeEditor />;
}
