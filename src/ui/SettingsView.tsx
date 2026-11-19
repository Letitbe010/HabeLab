import { useT } from '../i18n';
import { useSettings } from './settings';

const COMMIT = ((import.meta.env.VITE_COMMIT as string | undefined) ?? 'dev').slice(0, 7);

export function SettingsView() {
  const { t } = useT();
  const { settings, set } = useSettings();
  const radio = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K], label: string) => (
    <label className="radio">
      <input type="radio" name={String(key)} checked={settings[key] === value} onChange={() => set({ ...settings, [key]: value })} />
      {label}
    </label>
  );
  return (
    <section className="card">
      <h1>{t('set.title')}</h1>
      <div className="settings-grid">
        <fieldset>
          <legend>{t('set.g')}</legend>
          {radio('g', '9.81', '9,81 m/s²')}
          {radio('g', '9.8', '9,8 m/s²')}
          {radio('g', '10', '10 m/s²')}
        </fieldset>
        <fieldset>
          <legend>{t('set.vconv')}</legend>
          {radio('vFlip', false, t('set.vconv.std'))}
          {radio('vFlip', true, t('set.vconv.alt'))}
        </fieldset>
        <fieldset>
          <legend>{t('set.morient')}</legend>
          {radio('mBelow', false, t('set.morient.up'))}
          {radio('mBelow', true, t('set.morient.down'))}
        </fieldset>
        <fieldset>
          <legend>{t('set.dims')}</legend>
          {radio('dims', 'both', t('set.dims.both'))}
          {radio('dims', 'chained', t('set.dims.chained'))}
          {radio('dims', 'cumulative', t('set.dims.cumulative'))}
        </fieldset>
        <fieldset>
          <legend>{t('set.tol')}</legend>
          <p>{t('set.tolText')}</p>
        </fieldset>
        <fieldset>
          <legend>{t('set.about')}</legend>
          <p>{t('set.version', { v: '0.5.0', c: COMMIT })}</p>
          <p>
            <a href="https://letitbe010.github.io/HabeLab/">https://letitbe010.github.io/HabeLab/</a>
          </p>
        </fieldset>
      </div>
    </section>
  );
}
