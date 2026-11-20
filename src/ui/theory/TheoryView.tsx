/** Theory section (spec §12): list of topics and one topic with its blocks (same model as KateLab). */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';
import { TOPICS } from '../../content/theory/topics';
import type { Block } from '../../content/theory/types';
import type { Exercise } from '../../core/model';
import { fillTemplate, workedVars } from '../../core/workedVars';
import pool from '../../data/pool.json';
import { useT } from '../../i18n';
import { displayUnits } from '../format';
import { hrefOf } from '../router';
import { useSettings } from '../settings';
import { WORKED } from '../WorkedView';
import { TheoryWidget } from './widgets';

const EXERCISES = (pool as { exercises: Exercise[] }).exercises;

function Tex({ tex }: { tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: true, throwOnError: false, output: 'htmlAndMathml' }), [tex]);
  return <div className="tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

function BlockView({ b }: { b: Block }) {
  const { t, lang } = useT();
  const { settings } = useSettings();
  switch (b.t) {
    case 'p':
      return <p>{b[lang]}</p>;
    case 'f':
      return <Tex tex={b.tex} />;
    case 'list':
      return (
        <ul>
          {b[lang].map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div className="block">
          <table className="th-table">
            <thead>
              <tr>
                {b.head.map((h, i) => (
                  <th key={i}>{h[lang]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, k) => (
                    <td key={k}>{c[lang]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'note':
      return (
        <div className={`layer ${b.kind === 'careful' ? 'careful' : 'ope'}`}>
          <span className="lab">{b.kind === 'careful' ? t('wk.careful') : t('th.ope')}</span>
          <p>{b[lang]}</p>
        </div>
      );
    case 'example': {
      const ex = EXERCISES.find((e) => e.id === b.pool);
      if (!ex) return null;
      const vars = workedVars(ex, settings.g, displayUnits(ex));
      return (
        <div className="example">
          <span className="lab">{t('th.example')}</span>
          <p>{fillTemplate(b[lang], vars)}</p>
          <a href={hrefOf({ name: 'pool', id: ex.id })}>{t('th.openExercise')}</a>
        </div>
      );
    }
    case 'widget':
      return <TheoryWidget w={b.w} />;
    case 'practice': {
      const w = b.worked ? WORKED.find((x) => x.id === b.worked) : undefined;
      return (
        <div className="actions">
          <span>{t('th.nowPractice')}</span>
          {w && (
            <a className="button" href={hrefOf({ name: 'workedItem', id: w.id })}>
              {w.title[lang]}
            </a>
          )}
          {b.level && (
            <a className="button primary" href={hrefOf({ name: 'generated', level: b.level, ask: 'any', seed: Math.floor(Math.random() * 1_000_000) })}>
              {t('th.practiceLevel', { n: b.level })}
            </a>
          )}
        </div>
      );
    }
  }
}

export function TheoryList() {
  const { t, lang } = useT();
  return (
    <section className="card">
      <h1>{t('nav.theory')}</h1>
      <p className="lead">{t('th.lead')}</p>
      <ol className="topic-list">
        {TOPICS.map((tp) => (
          <li key={tp.id}>
            <a href={hrefOf({ name: 'theoryTopic', id: tp.id })}>{tp.title[lang]}</a>
            {tp.status !== 'reviewed' && <span className="tag warn">{t('wk.draft')}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TheoryTopic({ id }: { id: string }) {
  const { t, lang } = useT();
  const i = TOPICS.findIndex((x) => x.id === id);
  const tp = TOPICS[i];
  if (!tp) return <section className="card">404</section>;
  const prev = TOPICS[i - 1];
  const next = TOPICS[i + 1];
  return (
    <section className="card theory">
      <div className="ex-top">
        <a href={hrefOf({ name: 'theory' })}>← {t('nav.theory')}</a>
        <span className="tags">
          <span className="tag">
            {i + 1} / {TOPICS.length}
          </span>
          {tp.status !== 'reviewed' && <span className="tag warn">{t('wk.draft')}</span>}
        </span>
      </div>
      <h1>{tp.title[lang]}</h1>
      {tp.blocks.map((b, k) => (
        <BlockView key={k} b={b} />
      ))}
      <nav className="actions topic-nav">
        {prev && (
          <a className="button" href={hrefOf({ name: 'theoryTopic', id: prev.id })}>
            ← {prev.title[lang]}
          </a>
        )}
        {next && (
          <a className="button primary" href={hrefOf({ name: 'theoryTopic', id: next.id })}>
            {next.title[lang]} →
          </a>
        )}
      </nav>
    </section>
  );
}
