/** Phase 10 screens (spec §11.1): learning path, first-visit intro, progress, about. Same design as KateLab. */
import { useRef, useState } from 'react';
import { TOPICS } from '../content/theory/topics';
import type { Exercise } from '../core/model';
import pool from '../data/pool.json';
import { useT } from '../i18n';
import { num } from './format';
import { exportJSON, importJSON, partRates, resetProgress, setIntroSeen, setTheme, topMistakes, useProgress } from './progress';
import { hrefOf } from './router';
import { WORKED } from './WorkedView';

const EXERCISES = (pool as { exercises: Exercise[] }).exercises;

/** Theory topic for each kind of mistake found by the diagnosis (link from the progress page). */
export const DIAG_TOPIC: Record<string, string> = {
  'units-kg': 'unitateak',
  'units-1000': 'unitateak',
  'units-0.001': 'unitateak',
  'g-other': 'unitateak',
  'v-sign': 'zeinuak',
  'm-sign': 'zeinuak',
  'reactions-swapped': 'oreka',
  'dims-cumulative-as-chained': 'akatsak',
  'dims-chained-as-cumulative': 'akatsak',
  'resultant-centre': 'kargak',
  'moment-jump-forgotten': 'erlazioak',
  'moment-reversed': 'erlazioak',
  'jumps-swapped': 'metodoa',
  'p-neighbour': 'ebaketa',
};

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${max ? Math.min(100, (100 * value) / max) : 0}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
export function StartPage() {
  const { t, lang } = useT();
  const p = useProgress();
  const ope = EXERCISES.filter((e) => /OPE (Euskadi|Madril) \d{4}/.test(e.sourceNote ?? '') || e.id === 'pool-W12');
  return (
    <section className="card">
      <h1>{t('start.title')}</h1>
      <p className="lead">{t('start.lead')}</p>
      {p.lastRoute && p.lastRoute !== '#/' && (
        <p>
          <a className="button primary" href={p.lastRoute}>
            {t('start.continue')} →
          </a>
        </p>
      )}
      <ol className="path">
        <li className="step-card">
          <span className="num">1</span>
          <div>
            <b>{t('start.step1')}</b>
            <small>{t('start.step1.sub', { n: p.theorySeen.filter((x) => TOPICS.some((tp) => tp.id === x)).length, total: TOPICS.length })}</small>
            <Bar value={p.theorySeen.length} max={TOPICS.length} label={t('start.step1')} />
          </div>
          <a className="button" href={hrefOf({ name: 'theory' })}>
            {t('start.go')}
          </a>
        </li>
        <li className="step-card">
          <span className="num">2</span>
          <div>
            <b>{t('start.step2')}</b>
            <small>{t('start.step2.sub', { n: p.workedDone.length, total: WORKED.length })}</small>
            <Bar value={p.workedDone.length} max={WORKED.length} label={t('start.step2')} />
          </div>
          <a className="button" href={hrefOf({ name: 'worked' })}>
            {t('start.go')}
          </a>
        </li>
        <li className="step-card">
          <span className="num">3</span>
          <div>
            <b>{t('start.step3')}</b>
            {([1, 2, 3] as const).map((lv) => {
              const a = p.attempts.filter((x) => x.level === lv);
              const mean = a.length ? a.reduce((s, x) => s + x.score, 0) / a.length : 0;
              return (
                <div key={lv}>
                  <small>{t('start.step3.sub', { n: lv, k: a.length, mean: num(mean, 1) })}</small>
                  <Bar value={mean} max={10} label={`${t('start.step3')} ${lv}`} />
                </div>
              );
            })}
          </div>
          <a className="button" href={hrefOf({ name: 'home' })}>
            {t('start.go')}
          </a>
        </li>
        <li className="step-card">
          <span className="num">4</span>
          <div>
            <b>{t('start.step4')}</b>
            <small>{t('start.step4.sub')}</small>
            <ul className="plain">
              {ope.map((e) => (
                <li key={e.id}>
                  <a href={hrefOf({ name: 'pool', id: e.id })}>{(e.sourceNote ?? e.id).split(' / ')[lang === 'es' ? 1 : 0]}</a>
                </li>
              ))}
            </ul>
          </div>
        </li>
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
export function Intro() {
  const { t } = useT();
  const [k, setK] = useState(1);
  return (
    <div className="intro-backdrop" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="intro card">
        <p className="tags">
          <span className="tag">{k} / 3</span>
        </p>
        <h2 id="intro-title">{t(`intro.${k}.title`)}</h2>
        <p>{t(`intro.${k}.text`)}</p>
        <div className="actions">
          <button onClick={setIntroSeen}>{t('intro.skip')}</button>
          {k < 3 ? (
            <button className="primary" onClick={() => setK(k + 1)}>
              {t('intro.next')}
            </button>
          ) : (
            <button className="primary" onClick={setIntroSeen}>
              {t('intro.done')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ProgressPage() {
  const { t, lang } = useT();
  const p = useProgress();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const n = p.attempts.length;
  const mean = n ? p.attempts.reduce((s, a) => s + a.score, 0) / n : 0;
  const parts = partRates(p.attempts);
  const mistakes = topMistakes(p.attempts);
  const secs = p.attempts.filter((a) => a.seconds > 0);
  const meanMin = secs.length ? secs.reduce((s, a) => s + a.seconds, 0) / secs.length / 60 : 0;
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'habelab-aurrerapena.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="card">
      <h1>{t('prog.title')}</h1>
      {n === 0 ? (
        <p className="note">{t('prog.empty')}</p>
      ) : (
        <>
          <p className="lead">{t('prog.total', { n, mean: num(mean, 1), min: num(meanMin, 1) })}</p>
          <h2 className="sec">{t('prog.byPart')}</h2>
          <table className="stats">
            <tbody>
              {parts.map((r) => (
                <tr key={r.key}>
                  <td>{t(`part.${r.key}`)}</td>
                  <td>{num(r.mean * 100, 0)} %</td>
                  <td className="w-bar">
                    <Bar value={r.mean} max={1} label={t(`part.${r.key}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {mistakes.length > 0 && (
            <>
              <h2 className="sec">{t('prog.mistakes')}</h2>
              <ul className="mistakes">
                {mistakes.map((m) => (
                  <li key={m.code}>
                    <span>{t(`diag.short.${m.code}`)}</span> <span className="tag">{t('prog.times', { n: m.count })}</span>{' '}
                    {DIAG_TOPIC[m.code] && (
                      <a href={hrefOf({ name: 'theoryTopic', id: DIAG_TOPIC[m.code] as string })}>
                        {t('prog.review', { title: TOPICS.find((x) => x.id === DIAG_TOPIC[m.code])?.title[lang] ?? '' })}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2 className="sec">{t('prog.history')}</h2>
          <ul className="history">
            {[...p.attempts]
              .reverse()
              .slice(0, 15)
              .map((a, i) => (
                <li key={i}>
                  <span className={`chip ${a.score >= 10 ? 'correct' : a.score >= 5 ? 'missing' : 'wrong'}`}>{num(a.score, 1)}</span> {a.exercise.replace('pool-', '').replace('gen-', '')} · {t(`home.ask.${a.ask}`)} · {a.mode} ·{' '}
                  {new Date(a.ts).toLocaleString(lang === 'eu' ? 'eu-ES' : 'es-ES')}
                </li>
              ))}
          </ul>
        </>
      )}
      <div className="actions">
        <button onClick={download}>{t('prog.export')}</button>
        <button onClick={() => file.current?.click()}>{t('prog.import')}</button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setMsg(importJSON(await f.text()) ? t('prog.importOk') : t('prog.importBad'));
            e.target.value = '';
          }}
        />
        <button
          onClick={() => {
            if (window.confirm(t('prog.resetConfirm'))) resetProgress();
          }}
        >
          {t('prog.reset')}
        </button>
      </div>
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
export function ThemeChoice() {
  const { t } = useT();
  const theme = useProgress().theme;
  return (
    <div className="choice" role="radiogroup" aria-label={t('set.theme')}>
      {(['auto', 'light', 'dark'] as const).map((v) => (
        <button key={v} role="radio" aria-checked={theme === v} className={theme === v ? 'sel' : ''} onClick={() => setTheme(v)}>
          {t(`set.theme.${v}`)}
        </button>
      ))}
    </div>
  );
}

export function AboutPage() {
  const { t } = useT();
  return (
    <section className="card">
      <h1>{t('about.title')}</h1>
      <p className="lead">{t('about.lead')}</p>
      <table className="stats">
        <tbody>
          <tr>
            <td>{t('about.version')}</td>
            <td>{__APP_VERSION__}</td>
          </tr>
          <tr>
            <td>{t('about.commit')}</td>
            <td>
              <code>{__COMMIT__}</code>
            </td>
          </tr>
          <tr>
            <td>{t('about.built')}</td>
            <td>{__BUILD_DATE__}</td>
          </tr>
          <tr>
            <td>{t('about.url')}</td>
            <td>
              <a href="https://letitbe010.github.io/HabeLab/">https://letitbe010.github.io/HabeLab/</a>
            </td>
          </tr>
        </tbody>
      </table>
      <p>{t('about.license')}</p>
      <p className="note">{t('about.sources')}</p>
      <p>
        <a href="https://github.com/Letitbe010/HabeLab">github.com/Letitbe010/HabeLab</a>
      </p>
    </section>
  );
}
