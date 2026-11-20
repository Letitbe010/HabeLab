import { useState } from 'react';
import type { Level } from '../core/generator';
import type { Exercise } from '../core/model';
import pool from '../data/pool.json';
import { useT } from '../i18n';
import { type AskChoice, hrefOf } from './router';

const ASKS: AskChoice[] = ['any', 'diagrams', 'point', 'mmax', 'equations'];

export function PracticeHome() {
  const { t } = useT();
  const [level, setLevel] = useState<Level>(1);
  const [ask, setAsk] = useState<AskChoice>('any');
  const go = () => {
    const seed = Math.floor(Math.random() * 1_000_000);
    window.location.hash = hrefOf({ name: 'generated', level, ask, seed });
  };
  const exercises = (pool as { exercises: Exercise[] }).exercises;

  return (
    <section className="card">
      <h1>{t('home.title')}</h1>
      <p className="lead">{t('home.lead')}</p>

      <h2 className="sec">{t('home.new')}</h2>
      <div className="ask">
        <b>{t('home.level')}</b>
        <div className="choice" style={{ marginTop: 6 }}>
          {([1, 2, 3] as Level[]).map((l) => (
            <button key={l} className={level === l ? 'sel' : ''} aria-pressed={level === l} onClick={() => setLevel(l)}>
              {t(`home.level${l}`)}
            </button>
          ))}
        </div>
        <b style={{ display: 'block', marginTop: 12 }}>{t('home.ask')}</b>
        <div className="choice" style={{ marginTop: 6 }}>
          {ASKS.filter((a) => !(level === 1 && a === 'equations')).map((a) => (
            <button key={a} className={`small ${ask === a ? 'sel' : ''}`} aria-pressed={ask === a} onClick={() => setAsk(a)}>
              {t(`home.ask.${a}`)}
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="primary" onClick={go}>
            {t('home.generate')}
          </button>
        </div>
      </div>

      <h2 className="sec">{t('exam.title')}</h2>
      <div className="ask">
        <p style={{ margin: 0 }}>{t('exam.lead')}</p>
        <div className="actions">
          <a className="button primary" href={hrefOf({ name: 'exam' })}>
            {t('exam.open')}
          </a>
        </div>
      </div>

      <h2 className="sec">{t('home.pool')}</h2>
      <div className="tiles">
        {exercises.map((e) => (
          <a key={e.id} className="tile" href={hrefOf({ name: 'pool', id: e.id })}>
            <b>{e.id.replace('pool-', '')}</b>
            <span className="tags">
              <span className="tag">{t('home.level')} {e.difficulty}</span>
              <span className="tag">
                {t(`home.ask.${e.ask.pointValues?.length ? 'point' : e.ask.mmax ? 'mmax' : e.ask.equations ? 'equations' : 'diagrams'}`)}
              </span>
              {e.sourceNote?.includes('OPE ') && !e.sourceNote.includes('estilo') && <span className="tag origin-ope">OPE</span>}
            </span>
            <span className="go">{t('home.open')}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
