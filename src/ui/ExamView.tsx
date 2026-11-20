/**
 * Exam mode (spec §11.1, user choices 2026-11-20): three exercises (levels 1, 2, 3, ask at
 * random) from one seed, a countdown (30/45/60/90 min, default 45), grading only at the end
 * (also when time runs out). Start time and answers are kept in localStorage, so a reload
 * does not restart the clock. Every exercise is recorded in the progress history.
 */
import { useEffect, useMemo, useState } from 'react';
import { type Hypothesis, diagnose } from '../core/diagnosis';
import { EXAM_DEFAULT_MINUTES, EXAM_MINUTES, examExercises, examScore, formatClock, remainingSeconds } from '../core/exam';
import { type GradeResult, type ModeAAnswer, grade } from '../core/grader';
import { keyPoints } from '../core/keyPoints';
import { renderText } from '../core/text';
import { exerciseToBeam, formatSmart, gValue } from '../core/units';
import { verifyBeam } from '../core/verify';
import { useT } from '../i18n';
import { BeamFigure } from './BeamFigure';
import { displayUnits, num } from './format';
import { KeyValuesForm } from './KeyValuesForm';
import { recordAttempt } from './progress';
import { ResultItems } from './ResultItems';
import { hrefOf } from './router';
import { loadJSON, saveJSON, useSettings } from './settings';
import { SolutionSteps } from './SolutionSteps';

const askOf = (e: { ask: { pointValues?: string[]; mmax?: boolean; equations?: boolean } }) =>
  e.ask.pointValues?.length ? 'point' : e.ask.mmax ? 'mmax' : e.ask.equations ? 'equations' : 'diagrams';

export function ExamStart() {
  const { t } = useT();
  const [minutes, setMinutes] = useState<number>(EXAM_DEFAULT_MINUTES);
  const start = () => {
    const seed = 1 + Math.floor(Math.random() * 999_999);
    window.location.hash = hrefOf({ name: 'examRun', seed, minutes });
  };
  return (
    <section className="card">
      <h1>{t('exam.title')}</h1>
      <p className="lead">{t('exam.lead')}</p>
      <ul>
        <li>{t('exam.rule1')}</li>
        <li>{t('exam.rule2')}</li>
        <li>{t('exam.rule3')}</li>
      </ul>
      <div className="ask">
        <b>{t('exam.time')}</b>
        <div className="choice" role="radiogroup" aria-label={t('exam.time')} style={{ marginTop: 6 }}>
          {EXAM_MINUTES.map((m) => (
            <button key={m} role="radio" aria-checked={minutes === m} className={minutes === m ? 'sel' : ''} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="primary" onClick={start}>
            {t('exam.start')}
          </button>
        </div>
      </div>
    </section>
  );
}

interface ExamState {
  startedAt: number;
  answers: ModeAAnswer[];
  submittedAt?: number;
}

export function ExamRun({ seed, minutes }: { seed: number; minutes: number }) {
  const { t, lang } = useT();
  const { settings } = useSettings();
  const exercises = useMemo(() => examExercises(seed), [seed]);
  const key = `habelab.exam.${seed}.${minutes}`;
  const [state, setState] = useState<ExamState>(() => {
    const saved = loadJSON<ExamState>(key);
    if (saved && Array.isArray(saved.answers) && saved.answers.length === 3) return saved;
    return {
      startedAt: Date.now(),
      answers: exercises.map((e) => {
        const u = displayUnits(e);
        return { forceUnit: u.force, momentUnit: u.moment, points: [{ x: '' }] };
      }),
    };
  });
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const save = (s: ExamState) => {
    setState(s);
    saveJSON(key, s);
  };
  useEffect(() => saveJSON(key, state), []); // eslint-disable-line react-hooks/exhaustive-deps
  const left = remainingSeconds(state.startedAt, minutes, now);
  const done = state.submittedAt !== undefined;

  const submit = () => {
    if (done) return;
    const opts = { g: settings.g, vFlip: settings.vFlip };
    exercises.forEach((ex, i) => {
      const r = grade(ex, state.answers[i]!, opts);
      const h = r.invalid || r.score >= 10 ? [] : diagnose(ex, state.answers[i]!, opts);
      recordAttempt({
        ts: Date.now(),
        exercise: ex.id,
        level: ex.difficulty,
        ask: askOf(ex),
        mode: 'A',
        score: r.score,
        parts: Object.fromEntries(r.parts.map((p) => [p.key, p.ratio])),
        diagnoses: h.map((x) => x.id),
        seconds: Math.round((Date.now() - state.startedAt) / 1000 / 3),
      });
    });
    save({ ...state, submittedAt: Date.now() });
  };

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [done]);
  useEffect(() => {
    if (!done && left === 0) submit(); // time is up: grade automatically
  }, [left, done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (done) return <ExamResults exercises={exercises} answers={state.answers} seconds={Math.round((state.submittedAt! - state.startedAt) / 1000)} timedOut={left === 0 && state.submittedAt! >= state.startedAt + minutes * 60_000} />;

  const ex = exercises[current]!;
  return (
    <section className="card">
      <div className={`exam-bar ${left < 300 ? 'late' : ''}`} role="timer" aria-live="off">
        <div className="choice" role="tablist" aria-label={t('exam.title')}>
          {exercises.map((e, i) => (
            <button key={e.id} role="tab" aria-selected={i === current} className={`small ${i === current ? 'sel' : ''}`} onClick={() => setCurrent(i)}>
              {t('exam.exercise', { n: i + 1 })}
            </button>
          ))}
        </div>
        <span className="clock" aria-label={t('exam.left')}>
          {formatClock(left)}
        </span>
      </div>
      <h1 className="ex-title">
        {t('exam.heading', { n: current + 1, level: ex.difficulty, ask: t(`home.ask.${askOf(ex)}`) })}
      </h1>
      <p className="statement">{renderText(ex.text?.[lang] ?? '', settings.g)}</p>
      <BeamFigure ex={ex} dims={settings.dims} />
      <KeyValuesForm key={ex.id} ex={ex} ans={state.answers[current]!} onChange={(a) => save({ ...state, answers: state.answers.map((x, k) => (k === current ? a : x)) })} />
      <div className="actions">
        {current > 0 && <button onClick={() => setCurrent(current - 1)}>← {t('exam.exercise', { n: current })}</button>}
        {current < 2 && (
          <button onClick={() => setCurrent(current + 1)}>
            {t('exam.exercise', { n: current + 2 })} →
          </button>
        )}
        <button
          className="primary"
          onClick={() => {
            if (window.confirm(t('exam.confirm'))) submit();
          }}
        >
          {t('exam.submit')}
        </button>
      </div>
      <p className="pos">{t('ex.seed', { seed })}</p>
    </section>
  );
}

function ExamResults({ exercises, answers, seconds, timedOut }: { exercises: ReturnType<typeof examExercises>; answers: ModeAAnswer[]; seconds: number; timedOut: boolean }) {
  const { t, lang } = useT();
  const { settings } = useSettings();
  const [open, setOpen] = useState<number | null>(null);
  const opts = { g: settings.g, vFlip: settings.vFlip };
  const results: { r: GradeResult; h: Hypothesis[] }[] = exercises.map((ex, i) => {
    const r = grade(ex, answers[i]!, opts);
    return { r, h: r.invalid || r.score >= 10 ? [] : diagnose(ex, answers[i]!, opts) };
  });
  const total = examScore(results.map((x) => x.r.score));
  return (
    <section className="card">
      <h1>{t('exam.result')}</h1>
      <p className="lead">
        <b>{t('exam.total', { score: num(total, 1) })}</b> · {t('exam.used', { t: formatClock(Math.max(0, seconds)) })}
        {timedOut && <> · {t('exam.timedOut')}</>}
      </p>
      {exercises.map((ex, i) => {
        const { r, h } = results[i]!;
        const units = displayUnits(ex);
        const check = verifyBeam(exerciseToBeam(ex, settings.g));
        return (
          <div key={ex.id} className="ask" style={{ marginTop: 12 }}>
            <header>
              <b>
                {t('exam.heading', { n: i + 1, level: ex.difficulty, ask: t(`home.ask.${askOf(ex)}`) })}
              </b>
              <span className="chip correct" style={{ marginLeft: 'auto' }}>
                {num(r.score, 1)} / 10
              </span>
            </header>
            <p className="statement">{renderText(ex.text?.[lang] ?? '', settings.g)}</p>
            <div className="parts">
              {r.parts.map((p) => (
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
            {r.score < 10 && (
              <div className="diag">
                <b>{t('diag.title')}</b>
                {h.length ? (
                  <ul>
                    {h.map((x) => (
                      <li key={x.id}>{t(`diag.${x.id}`, { g: formatSmart(gValue(settings.g)), gs: formatSmart(gValue(settings.g)), ...x.info })}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{t('diag.none')}</p>
                )}
              </div>
            )}
            <div className="actions">
              <button onClick={() => setOpen(open === i ? null : i)}>{open === i ? t('exam.hide') : t('ex.showSolution')}</button>
            </div>
            {open === i && (
              <>
                <ResultItems items={r.items} units={units} vFlip={settings.vFlip} />
                <BeamFigure ex={ex} dims={settings.dims} />
                {check.a && <SolutionSteps ex={ex} sol={check.a} kps={keyPoints(check.a)} units={units} g={settings.g} vFlip={settings.vFlip} mBelow={settings.mBelow} />}
              </>
            )}
          </div>
        );
      })}
      <div className="actions">
        <a className="button primary" href={hrefOf({ name: 'exam' })}>
          {t('exam.again')}
        </a>
        <a className="button" href={hrefOf({ name: 'progress' })}>
          {t('nav.progress')}
        </a>
      </div>
    </section>
  );
}
