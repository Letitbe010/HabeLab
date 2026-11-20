import { useEffect, useState } from 'react';
import { type Lang, LangContext, translate } from '../i18n';
import { PracticeExercise } from './PracticeExercise';
import { PracticeHome } from './PracticeHome';
import { type Route, hrefOf, useRoute } from './router';
import { type Settings, SettingsContext, loadSettings, saveSettings } from './settings';
import { SettingsView } from './SettingsView';
import { WorkedItem, WorkedList } from './WorkedView';
import { TheoryList, TheoryTopic } from './theory/TheoryView';

const LANG_KEY = 'habelab.lang';

function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'es' ? 'es' : 'eu';
  } catch {
    return 'eu';
  }
}

const NAV: { key: string; route: Route; icon: string; section: string }[] = [
  { key: 'nav.theory', route: { name: 'theory' }, icon: 'T', section: 'teoria' },
  { key: 'nav.worked', route: { name: 'worked' }, icon: 'E', section: 'ebatziak' },
  { key: 'nav.practice', route: { name: 'home' }, icon: 'P', section: 'praktika' },
  { key: 'nav.progress', route: { name: 'soon', section: 'aurrerapena' }, icon: 'A', section: 'aurrerapena' },
];

const sectionOf = (r: Route): string =>
  r.name === 'soon' ? r.section : r.name === 'settings' ? 'ezarpenak' : r.name === 'worked' || r.name === 'workedItem' ? 'ebatziak' : r.name === 'theory' || r.name === 'theoryTopic' ? 'teoria' : 'praktika';

export function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const route = useRoute();
  const t = (k: string) => translate(lang, k);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);
  const setS = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };
  const current = sectionOf(route);

  return (
    <LangContext.Provider value={lang}>
      <SettingsContext.Provider value={{ settings, set: setS }}>
        <div className="app">
          <nav className="side" aria-label="Nabigazioa">
            <a className="brand" href="#/praktika">
              <small>{t('app.kicker')}</small>
              <b>HabeLab</b>
            </a>
            <ul>
              {NAV.map((n) => {
                const on = n.section === current;
                return (
                  <li key={n.key}>
                    <a href={hrefOf(n.route)} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                      <span className="ico" aria-hidden="true">
                        {n.icon}
                      </span>
                      <span>{t(n.key)}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="main">
            <header className="top">
              <a className="brand mobile-only" href="#/praktika">
                <b>HabeLab</b>
              </a>
              <div className="lang" role="group" aria-label="Hizkuntza / Idioma">
                {(['eu', 'es'] as const).map((l) => (
                  <button key={l} className={l === lang ? 'sel' : ''} aria-pressed={l === lang} onClick={() => setLang(l)}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <a className="gear" href={hrefOf({ name: 'settings' })} aria-label={t('nav.settings')} title={t('nav.settings')}>
                ⚙
              </a>
            </header>
            <main>
              {route.name === 'home' && <PracticeHome />}
              {route.name === 'generated' && (
                <PracticeExercise key={`${route.level}-${route.ask}-${route.seed}`} source={{ kind: 'generated', level: route.level, ask: route.ask, seed: route.seed }} />
              )}
              {route.name === 'pool' && <PracticeExercise key={route.id} source={{ kind: 'pool', id: route.id }} />}
              {route.name === 'settings' && <SettingsView />}
              {route.name === 'worked' && <WorkedList />}
              {route.name === 'workedItem' && <WorkedItem key={route.id} id={route.id} />}
              {route.name === 'theory' && <TheoryList />}
              {route.name === 'theoryTopic' && <TheoryTopic key={route.id} id={route.id} />}
              {route.name === 'soon' && (
                <section className="card">
                  <h1>{t(NAV.find((n) => n.section === route.section)?.key ?? 'nav.practice')}</h1>
                  <p className="note">{t('nav.soon')}</p>
                </section>
              )}
            </main>
          </div>
          <nav className="bottom" aria-label="Nabigazioa">
            {NAV.map((n) => {
              const on = n.section === current;
              return (
                <a key={n.key} href={hrefOf(n.route)} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                  <span className="ico" aria-hidden="true">
                    {n.icon}
                  </span>
                  <span>{t(n.key)}</span>
                </a>
              );
            })}
          </nav>
        </div>
      </SettingsContext.Provider>
    </LangContext.Provider>
  );
}
