/** Exercise screen: ① statement → ② solve → ③ grading → ④ solution (spec §11.1). */
import { useMemo, useState } from 'react';
import type { Exercise } from '../core/model';
import { type GradeResult, type Item, type ModeAAnswer, grade } from '../core/grader';
import { type BResult, type ModeBAnswer, gradeB } from '../core/diagramGrader';
import { DiagramEditor } from './DiagramEditor';
import { type Hypothesis, diagnose } from '../core/diagnosis';
import { formatSmart, gValue } from '../core/units';
import { generate } from '../core/generator';
import { keyPoints } from '../core/keyPoints';
import * as R from '../core/rational';
import { renderText } from '../core/text';
import { exerciseToBeam, parseUserNumber } from '../core/units';
import { verifyBeam } from '../core/verify';
import pool from '../data/pool.json';
import { useT } from '../i18n';
import { BeamFigure } from './BeamFigure';
import type { OverlayPoint } from './DiagramView';
import { displayUnits, fmtF, fmtM, num } from './format';
import { KeyValuesForm } from './KeyValuesForm';
import { type AskChoice, hrefOf } from './router';
import { loadJSON, saveJSON, useSettings } from './settings';
import { SolutionSteps } from './SolutionSteps';

export type Source = { kind: 'generated'; level: 1 | 2 | 3; ask: AskChoice; seed: number } | { kind: 'pool'; id: string };

function loadExercise(src: Source): Exercise | null {
  if (src.kind === 'pool') return (pool as { exercises: Exercise[] }).exercises.find((e) => e.id === src.id) ?? null;
  return generate({ level: src.level, seed: src.seed, ask: src.ask === 'any' ? undefined : src.ask }).exercise;
}

const STEP_KEYS = ['ex.step1', 'ex.step2', 'ex.step3', 'ex.step4'];

export function PracticeExercise({ source }: { source: Source }) {
  const { t, lang } = useT();
  const { settings } = useSettings();
  const ex = useMemo(() => loadExercise(source), [source]);
  const storeKey = ex ? `habelab.ans.${ex.id}${source.kind === 'generated' ? `.${source.ask}` : ''}` : '';
  const [ans, setAns] = useState<ModeAAnswer>(() => {
    const saved = loadJSON<ModeAAnswer>(storeKey);
    if (saved) return saved;
    const u = ex ? displayUnits(ex) : null; // answer in the statement's units by default
    return { forceUnit: u?.force ?? 'N', momentUnit: u?.moment ?? 'N·m', points: [{ x: '' }] };
  });
  const [result, setResult] = useState<GradeResult | BResult | null>(null);
  const [hyps, setHyps] = useState<Hypothesis[]>([]);
  const [mode, setMode] = useState<'A' | 'B'>(() => (loadJSON<string>('habelab.mode') === 'B' ? 'B' : 'A'));
  const [ansB, setAnsB] = useState<ModeBAnswer>(() => {
    const saved = loadJSON<ModeBAnswer>(`${storeKey}.B`);
    if (saved) return saved;
    const u = ex ? displayUnits(ex) : null;
    return { forceUnit: u?.force ?? 'N', momentUnit: u?.moment ?? 'N·m', nodes: [{ x: '' }, { x: '' }] };
  });
  const [showSol, setShowSol] = useState(false);

  const check = useMemo(() => (ex ? verifyBeam(exerciseToBeam(ex, settings.g)) : null), [ex, settings.g]);
  if (!ex || !check) return <section className="card">404</section>;
  if (!check.ok || !check.a) {
    console.error('HabeLab: internal verification failed', ex.id, check.failures); // spec §5.3: logged, not shown
    return <section className="card note warn">{t('ex.invalidExercise')}</section>;
  }
  const sol = check.a;
  const kps = keyPoints(sol);
  const units = displayUnits(ex);

  const update = (a: ModeAAnswer) => {
    setAns(a);
    saveJSON(storeKey, a);
  };
  const useB = mode === 'B' && !!ex.ask.diagrams;
  const updateB = (a: ModeBAnswer) => {
    // the reactions part of the form is shared between both modes
    setAnsB(a);
    saveJSON(`${storeKey}.B`, a);
  };
  const onGrade = () => {
    const opts = { g: settings.g, vFlip: settings.vFlip };
    const r = useB ? gradeB(ex, { ...ansB, reactions: ans.reactions, forceUnit: ans.forceUnit, momentUnit: ans.momentUnit }, opts) : grade(ex, ans, opts);
    setResult(r);
    // §8.4: hypotheses of typical mistakes (mode B answers are read as key values at the nodes)
    const asA: ModeAAnswer = useB
      ? { forceUnit: ans.forceUnit, momentUnit: ans.momentUnit, reactions: ans.reactions, points: ansB.nodes.map((n) => ({ x: n.x, Vl: n.Vl, Vr: n.Vr, Ml: n.Ml, Mr: n.Mr })) }
      : ans;
    setHyps(r.invalid || r.incomplete || r.score >= 10 ? [] : diagnose(ex, asA, opts));
  };
  const switchMode = (m: 'A' | 'B') => {
    setMode(m);
    setResult(null);
    saveJSON('habelab.mode', m);
  };
  const blocked = !!result && (result.invalid || result.incomplete);
  const step = showSol ? 4 : result && !blocked ? 3 : 2;

  const nextHref =
    source.kind === 'generated'
      ? hrefOf({ name: 'generated', level: source.level, ask: source.ask, seed: (source.seed * 7919 + 1) % 1_000_000 })
      : hrefOf({ name: 'home' });

  // user's values for the diagram overlay (SI)
  const toSI = (s: string | undefined, f: number): number | undefined => {
    if (!s || !s.trim()) return undefined;
    try {
      return R.toNumber(parseUserNumber(s)) * f;
    } catch {
      return undefined;
    }
  };
  const fF = (ans.forceUnit === 'kN' ? 1000 : 1) * (settings.vFlip ? -1 : 1); // overlay in the solver's convention
  const fM = ans.momentUnit === 'kN·m' ? 1000 : 1;
  const overlay: OverlayPoint[] = [];
  for (const r of useB ? ansB.nodes : (ans.points ?? [])) {
    const x = toSI(r.x, 1);
    if (x === undefined) continue;
    overlay.push({ x, Vl: toSI(r.Vl, fF), Vr: toSI(r.Vr, fF), Ml: toSI(r.Ml, fM), Mr: toSI(r.Mr, fM) });
  }

  const itemLabel = (it: Item | BResult['items'][number]): string => {
    // segment ids look like "sV:0.0000-6.0000" (x1-x2, both ≥ 0)
    const range = (id: string) => id.slice(3).split('-').map((v) => num(Number(v))).join(' – ');
    if (it.id.startsWith('sV:') || it.id.startsWith('sM:')) return `${t(it.id[1] === 'V' ? 'ed.shapeV' : 'ed.shapeM')} (${range(it.id)} m)`;
    if (it.id.startsWith('qV:') || it.id.startsWith('qM:')) return `${it.id[1]} · ${t('res.sample')} (${range(it.id)} m)`;
    if (it.id.startsWith('ext')) return `${t('ed.extM')} (x = ${num(it.x ?? 0)} m)`;
    const [head, rest] = it.id.split(':') as [string, string?];
    const at = it.x !== undefined ? ` (x = ${num(it.x)} m)` : '';
    const names: Record<string, string> = { V: 'V', 'V-': 'V⁻', 'V+': 'V⁺', M: 'M', 'M-': 'M⁻', 'M+': 'M⁺', Vp: 'V', 'Vp-': 'V⁻', 'Vp+': 'V⁺', Mp: 'M' };
    if (head === 'R') return `R${rest}`;
    if (head === 'M' && it.part === 'reactions') return `M${rest}`;
    if (head === 'mmax') return '|M|max';
    if (head === 'xmax') return 'x (|M|max)';
    if (head === 'Veq' || head === 'Meq') return `${head === 'Veq' ? 'V(x)' : 'M(x)'}${at}`;
    if (head === 'x') return `x = ${('raw' in it ? it.raw : undefined) ?? ''}`;
    return `${names[head] ?? head}${head.startsWith('Vp') || head === 'Mp' ? ` ${rest}` : ''}${at}`;
  };
  const valText = (it: Item | BResult['items'][number], v: number | null) => {
    if (v === null) return '—';
    if (it.part === 'xmax') return `${num(v)} m`;
    const isM = it.part === 'M' || it.part === 'Mp' || it.part === 'mmax' || it.id.startsWith('M:');
    const shown = (it.part === 'V' || it.part === 'Vp') && settings.vFlip ? -v : v;
    return isM ? fmtM(shown, units) : fmtF(shown, units);
  };
  const ICON: Record<string, string> = { correct: '✓', wrong: '✗', missing: '!', invalid: '?' };

  return (
    <section className="card">
      <div className="ex-top">
        <a href={hrefOf({ name: 'home' })}>{t('nav.back')}</a>
        <span className="pos">
          {source.kind === 'generated' ? t('ex.seed', { seed: source.seed }) : ex.sourceNote ? t('ex.source', { source: ex.sourceNote.split(' / ')[lang === 'es' ? 1 : 0] ?? ex.sourceNote }) : ''}
        </span>
      </div>
      <ol className="stepper" aria-label="steps">
        {STEP_KEYS.map((k, i) => (
          <li key={k} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}>
            <span className="num">{i + 1}</span>
            <span className="lbl">{t(k)}</span>
          </li>
        ))}
      </ol>

      <p className="statement">{renderText(ex.text?.[lang] ?? '', settings.g)}</p>
      <BeamFigure ex={ex} dims={settings.dims} />
      <p className="note">{settings.vFlip ? t('ex.conventionAlt') : t('ex.convention')}</p>

      {ex.ask.diagrams && (
        <div className="choice" role="group" aria-label="mode" style={{ margin: '10px 0' }}>
          {(['A', 'B'] as const).map((m) => (
            <button key={m} className={`small ${mode === m ? 'sel' : ''}`} aria-pressed={mode === m} onClick={() => switchMode(m)}>
              {t(`mode.${m}`)}
            </button>
          ))}
        </div>
      )}
      <KeyValuesForm ex={useB ? { ...ex, ask: { ...ex.ask, diagrams: false } } : ex} ans={ans} onChange={update} result={useB ? null : (result as GradeResult | null)} />
      {useB && (
        <DiagramEditor
          ex={ex}
          ans={{ ...ansB, forceUnit: ans.forceUnit, momentUnit: ans.momentUnit }}
          onChange={(a) => updateB({ ...a })}
          result={result as BResult | null}
        />
      )}

      <div className="actions">
        <button className="primary" onClick={onGrade}>
          {t('ex.grade')}
        </button>
        <button onClick={() => setShowSol(true)}>{t('ex.showSolution')}</button>
        <a className="button" href={nextHref}>
          {t('ex.another')}
        </a>
      </div>

      {result && (
        <div className="feedback" aria-live="polite">
          {blocked ? (
            <p className="note warn">{result.invalid ? t('ex.fixInput') : t('ex.incomplete')}</p>
          ) : (
            <>
              <p className="score">{t('ex.score', { score: num(result.score, 1) })}</p>
              <div className="parts">
                {result.parts.map((p) => (
                  <div key={p.key}>
                    <span>
                      {t(`part.${p.key}`)}: {p.correct}/{p.total} · {num(p.weight * 100, 0)} %
                    </span>
                    <div className="bar">
                      <span style={{ width: `${p.ratio * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {result.missingPoints.length > 0 && <p className="note warn">{t('ex.missingPoints', { xs: result.missingPoints.map((x) => num(x)).join('; ') })}</p>}
              {result.score < 10 && (
                <div className="diag">
                  <b>{t('diag.title')}</b>
                  {hyps.length ? (
                    <ul>
                      {hyps.map((h) => (
                        <li key={h.id}>
                          {t(`diag.${h.id}`, { g: formatSmart(gValue(settings.g)), gs: formatSmart(gValue(settings.g)), ...h.info })}{' '}
                          <span className="vals">{t('diag.fit', { n: h.explained, m: h.typed })}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t('diag.none')}</p>
                  )}
                </div>
              )}
            </>
          )}
          <ul className="res-list">
            {result.items.map((it, i) => (
              <li key={`${it.id}-${i}`}>
                <span className={`chip ${it.status}`}>
                  {ICON[it.status]} {t(`st.${it.status}`)}
                </span>
                <span className="what">{itemLabel(it)}</span>
                {'expectedShape' in it && it.expectedShape && <span className="vals">{t('res.expected', { v: t(`shape.${it.expectedShape}`) })}</span>}
                {'givenShape' in it && it.givenShape && it.status !== 'correct' && (
                  <span className="vals">{t('res.given', { v: it.givenShape.split(',').map((s) => t(`shape.${s}`)).join(', ') })}</span>
                )}
                {it.expected !== null && <span className="vals">{t('res.expected', { v: valText(it, it.expected) })}</span>}
                {it.given !== null && <span className="vals">{t('res.given', { v: valText(it, it.given) })}</span>}
              </li>
            ))}
          </ul>
          {!showSol && (
            <div className="actions">
              <button onClick={() => setShowSol(true)}>{t('ex.showSolution')}</button>
            </div>
          )}
        </div>
      )}

      {showSol && <SolutionSteps ex={ex} sol={sol} kps={kps} units={units} g={settings.g} vFlip={settings.vFlip} mBelow={settings.mBelow} overlay={overlay} />}
    </section>
  );
}
