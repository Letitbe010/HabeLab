import { Suspense, lazy, useEffect, useState } from 'react';
import { type Lang, LangContext, translate } from '../i18n';
import { AboutPage, Intro, ProgressPage, StartPage } from './pages';
import { PracticeExercise } from './PracticeExercise';
import { PracticeHome } from './PracticeHome';
import { setLastRoute, useProgress } from './progress';
import { type Route, hrefOf, useRoute } from './router';
import { type Settings, SettingsContext, loadSettings, saveSettings } from './settings';
import { SettingsView } from './SettingsView';
import { WorkedItem, WorkedList } from './WorkedView';
import { ExamRun, ExamStart } from './ExamView';

// Theory (KaTeX) is loaded on demand: it is the heaviest part of the bundle.
const TheoryList = lazy(() => import('./theory/TheoryView').then((m) => ({ default: m.TheoryList })));
const TheoryTopic = lazy(() => import('./theory/TheoryView').then((m) => ({ default: m.TheoryTopic })));

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
  { key: 'nav.progress', route: { name: 'progress' }, icon: 'A', section: 'aurrerapena' },
];

const sectionOf = (r: Route): string => {
  switch (r.name) {
    case 'start':
      return 'hasiera';
    case 'settings':
    case 'about':
      return 'ezarpenak';
    case 'progress':
      return 'aurrerapena';
    case 'worked':
    case 'workedItem':
      return 'ebatziak';
    case 'theory':
    case 'theoryTopic':
      return 'teoria';
    default:
      return 'praktika';
  }
};

export function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const progress = useProgress();
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
  useEffect(() => {
    if (progress.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', progress.theme);
  }, [progress.theme]);
  // "continue where you left off": exercises, worked examples and theory topics
  useEffect(() => {
    if (['generated', 'pool', 'workedItem', 'theoryTopic', 'examRun'].includes(route.name)) setLastRoute(hrefOf(route));
  }, [route]);
  const setS = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };
  const current = sectionOf(route);
  const loading = <section className="card" aria-busy="true" />;

  return (
    <LangContext.Provider value={lang}>
      <SettingsContext.Provider value={{ settings, set: setS }}>
        <div className="app">
          <nav className="side" aria-label={t('nav.label')}>
            <a className="brand" href="#/">
              <small>{t('app.kicker')}</small>
              <b>HabeLab</b>
            </a>
            <ul>
              <li>
                <a href="#/" className={current === 'hasiera' ? 'on' : ''} aria-current={current === 'hasiera' ? 'page' : undefined}>
                  <span className="ico" aria-hidden="true">
                    ⌂
                  </span>
                  <span>{t('nav.start')}</span>
                </a>
              </li>
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
              <a className="brand mobile-only" href="#/" aria-current={current === 'hasiera' ? 'page' : undefined}>
                <b>HabeLab</b>
              </a>
              <div className="lang" role="group" aria-label="Hizkuntza / Idioma">
                {(['eu', 'es'] as const).map((l) => (
                  <button key={l} className={l === lang ? 'sel' : ''} aria-pressed={l === lang} onClick={() => setLang(l)}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <a
                className="gear"
                href={hrefOf({ name: 'settings' })}
                aria-label={t('nav.settings')}
                title={t('nav.settings')}
                aria-current={current === 'ezarpenak' ? 'page' : undefined}
              >
                ⚙
              </a>
            </header>
            <main>
              {route.name === 'start' && <StartPage />}
              {route.name === 'home' && <PracticeHome />}
              {route.name === 'generated' && (
                <PracticeExercise key={`${route.level}-${route.ask}-${route.seed}`} source={{ kind: 'generated', level: route.level, ask: route.ask, seed: route.seed }} />
              )}
              {route.name === 'pool' && <PracticeExercise key={route.id} source={{ kind: 'pool', id: route.id }} />}
              {route.name === 'settings' && <SettingsView />}
              {route.name === 'about' && <AboutPage />}
              {route.name === 'progress' && <ProgressPage />}
              {route.name === 'exam' && <ExamStart />}
              {route.name === 'examRun' && <ExamRun key={`${route.seed}-${route.minutes}`} seed={route.seed} minutes={route.minutes} />}
              {route.name === 'worked' && <WorkedList />}
              {route.name === 'workedItem' && <WorkedItem key={route.id} id={route.id} />}
              <Suspense fallback={loading}>
                {route.name === 'theory' && <TheoryList />}
                {route.name === 'theoryTopic' && <TheoryTopic key={route.id} id={route.id} />}
              </Suspense>
            </main>
          </div>
          <nav className="bottom" aria-label={t('nav.label')}>
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
          {!progress.introSeen && <Intro />}
        </div>
      </SettingsContext.Provider>
    </LangContext.Provider>
  );
}
