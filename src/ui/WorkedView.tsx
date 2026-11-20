/**
 * Worked exercises (spec §13): list with filters, and a step-by-step view. Each step has
 * three layers: what is done (computed by the solver), why (reasoning) and, where useful,
 * careful! (a typical mistake). All numbers come from the solver ({{variables}}).
 */
import { useEffect, useMemo, useState } from 'react';
import { markWorked } from './progress';
import type { Exercise } from '../core/model';
import { keyPoints } from '../core/keyPoints';
import { renderText } from '../core/text';
import { exerciseToBeam } from '../core/units';
import { verifyBeam } from '../core/verify';
import { fillTemplate, workedVars } from '../core/workedVars';
import pool from '../data/pool.json';
import worked from '../data/worked.json';
import reviewStatus from '../data/review-status.json';
import { useT } from '../i18n';
import { BeamFigure } from './BeamFigure';
import { displayUnits, num } from './format';
import * as R from '../core/rational';
import { hrefOf } from './router';
import { useSettings } from './settings';
import { type SectionKey, SolutionSteps } from './SolutionSteps';

interface Bi {
  eu: string;
  es: string;
}
export interface WorkedItemData {
  id: string;
  pool: string;
  status: 'draft' | 'reviewed';
  support: 'simple' | 'overhang' | 'cantilever';
  load: 'point' | 'udl' | 'linear' | 'moment' | 'mixed';
  title: Bi;
  intro: Bi;
  careful?: Partial<Record<StepKind, Bi>>;
  why?: Partial<Record<StepKind, Bi>>;
  ope?: Bi;
}
type StepKind = 'units' | 'fbd' | 'reactions' | 'segments' | 'table' | 'mmax' | 'ope';

/** Worked exercises with their review status from src/data/review-status.json (edited from #/berrikusi). */
export const WORKED = (worked as unknown as { items: WorkedItemData[] }).items.map(
  (w): WorkedItemData => ({ ...w, status: (reviewStatus.worked as Record<string, string>)[w.id] === 'reviewed' ? 'reviewed' : 'draft' }),
);
const EXERCISES = (pool as { exercises: Exercise[] }).exercises;

export function WorkedList() {
  const { t, lang } = useT();
  const [support, setSupport] = useState('');
  const [load, setLoad] = useState('');
  const [level, setLevel] = useState('');
  const list = WORKED.filter((w) => {
    const ex = EXERCISES.find((e) => e.id === w.pool);
    return (!support || w.support === support) && (!load || w.load === load) && (!level || String(ex?.difficulty) === level);
  });
  return (
    <section className="card">
      <h1>{t('wk.title')}</h1>
      <p className="lead">{t('wk.lead')}</p>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', display: 'flex', margin: '8px 0 14px' }}>
        <label className="fld">
          {t('wk.f.support')}
          <select value={support} onChange={(e) => setSupport(e.target.value)}>
            <option value="">{t('wk.f.all')}</option>
            {['simple', 'overhang', 'cantilever'].map((s) => (
              <option key={s} value={s}>
                {t(`wk.support.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          {t('wk.f.load')}
          <select value={load} onChange={(e) => setLoad(e.target.value)}>
            <option value="">{t('wk.f.all')}</option>
            {['point', 'udl', 'linear', 'moment', 'mixed'].map((s) => (
              <option key={s} value={s}>
                {t(`wk.load.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          {t('home.level')}
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">{t('wk.f.all')}</option>
            {['1', '2', '3'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tiles">
        {list.map((w) => {
          const ex = EXERCISES.find((e) => e.id === w.pool);
          return (
            <a key={w.id} className="tile" href={`#/ebatziak/${w.id}`}>
              <b>
                {WORKED.indexOf(w) + 1}. {w.title[lang]}
              </b>
              <span className="tags">
                <span className="tag">{t(`wk.support.${w.support}`)}</span>
                <span className="tag">{t(`wk.load.${w.load}`)}</span>
                <span className="tag">
                  {t('home.level')} {ex?.difficulty}
                </span>
                {w.status === 'draft' && <span className="tag warn">{t('wk.draft')}</span>}
              </span>
              <span className="go">{t('home.open')}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

interface Step {
  kind: StepKind;
  sections?: SectionKey[];
  segIndex?: number;
}

export function WorkedItem({ id }: { id: string }) {
  const { t, lang } = useT();
  const { settings } = useSettings();
  const w = WORKED.find((x) => x.id === id);
  const ex = w ? EXERCISES.find((e) => e.id === w.pool) : undefined;
  const [shown, setShown] = useState(1);
  const check = useMemo(() => (ex ? verifyBeam(exerciseToBeam(ex, settings.g)) : null), [ex, settings.g]);
  const total = check?.a ? (ex!.loads.some((l) => l.unit.startsWith('kg')) ? 1 : 0) + 4 + check.a.segments.length + (w?.ope ? 1 : 0) : 99;
  useEffect(() => {
    if (w && shown >= total) markWorked(w.id);
  }, [w, shown, total]);
  if (!w || !ex || !check) return <section className="card">404</section>;
  if (!check.ok || !check.a) return <section className="card note warn">{t('ex.invalidExercise')}</section>;
  const sol = check.a;
  const kps = keyPoints(sol);
  const units = displayUnits(ex);
  const vars = workedVars(ex, settings.g, units, sol);
  const fill = (b?: Bi) => (b ? fillTemplate(b[lang], vars) : '');

  const steps: Step[] = [];
  if (ex.loads.some((l) => l.unit.startsWith('kg'))) steps.push({ kind: 'units', sections: ['units'] });
  steps.push({ kind: 'fbd', sections: ['fbd'] });
  steps.push({ kind: 'reactions', sections: ['equilibrium'] });
  sol.segments.forEach((_, i) => steps.push({ kind: 'segments', sections: ['segments', 'diagrams'], segIndex: i }));
  steps.push({ kind: 'table', sections: ['table'] });
  steps.push({ kind: 'mmax', sections: ['mmax'] });
  if (w.ope) steps.push({ kind: 'ope' });

  const firstSeg = steps.findIndex((s) => s.kind === 'segments');
  const visible = steps.slice(0, shown);
  const done = shown >= steps.length;
  const tryHref = hrefOf({ name: 'generated', level: ex.difficulty, ask: 'diagrams', seed: (WORKED.indexOf(w) + 1) * 7919 + Math.floor(Date.now() / 86_400_000) % 1000 });

  return (
    <section className="card">
      <div className="ex-top">
        <a href="#/ebatziak">{t('nav.back')}</a>
        {w.status === 'draft' && <span className="tag warn">{t('wk.draft')}</span>}
      </div>
      <h1>{w.title[lang]}</h1>
      <p className="lead">{fill(w.intro)}</p>
      <p className="statement">{renderText(ex.text?.[lang] ?? '', settings.g)}</p>
      <BeamFigure ex={ex} dims={settings.dims} />

      <div className="steps">
        {visible.map((s, i) => {
          const careful = s.kind === 'segments' && i !== firstSeg ? undefined : w.careful?.[s.kind];
          const why = w.why?.[s.kind] ? fill(w.why[s.kind]) : s.kind === 'segments' && i !== firstSeg ? '' : t(`wk.why.${s.kind}`);
          return (
            <div key={i} className={`wstep ${i === shown - 1 && !done ? 'current' : ''}`}>
              <header>
                <span className="chip">{i + 1}</span>
                <b>
                  {s.kind === 'segments'
                    ? t('wk.step.segment', { a: num(R.toNumber(sol.segments[s.segIndex!]!.x1)), b: num(R.toNumber(sol.segments[s.segIndex!]!.x2)) })
                    : t(`wk.step.${s.kind}`)}
                </b>
              </header>
              <div className="layer">
                <span className="lab">{t('wk.what')}</span>
                {s.kind === 'ope' ? (
                  <p>{fill(w.ope)}</p>
                ) : (
                  <SolutionSteps ex={ex} sol={sol} kps={kps} units={units} g={settings.g} vFlip={settings.vFlip} mBelow={settings.mBelow} sections={s.sections} segIndex={s.segIndex} bare />
                )}
              </div>
              {why && (
                <div className="layer">
                  <span className="lab">{t('wk.why')}</span>
                  <p>{why}</p>
                </div>
              )}
              {careful && (
                <div className="layer careful">
                  <span className="lab">{t('wk.careful')}</span>
                  <p>{fill(careful)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="actions">
        {!done ? (
          <>
            <button className="primary" onClick={() => setShown(shown + 1)}>
              {t('wk.next')}
            </button>
            <button onClick={() => setShown(steps.length)}>{t('wk.all')}</button>
          </>
        ) : (
          <a className="button primary" href={tryHref}>
            {t('wk.tryOne')}
          </a>
        )}
      </div>
    </section>
  );
}
