/**
 * Mode A form (spec §7.1), built from what the exercise asks. The app never proposes the
 * critical points: identifying them is part of the exercise.
 */
import type { Exercise } from '../core/model';
import type { GradeResult, Item, ModeAAnswer, PointRow, Status } from '../core/grader';
import { positionTol } from '../core/grader';
import * as R from '../core/rational';
import { parseUserNumber } from '../core/units';
import { useT } from '../i18n';

interface Props {
  ex: Exercise;
  ans: ModeAAnswer;
  onChange: (a: ModeAAnswer) => void;
  result?: GradeResult | null;
}

const cls = (s?: Status) => (s ? s : '');

function Field({ label, value, onChange, status, w = 'w8' }: { label: string; value?: string; onChange: (v: string) => void; status?: Status; w?: string }) {
  return (
    <label className={`fld ${w} ${cls(status)}`}>
      {label}
      <input inputMode="decimal" autoComplete="off" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const tryNum = (s: string): number | null => {
  try {
    return R.toNumber(parseUserNumber(s));
  } catch {
    return null;
  }
};

export function KeyValuesForm({ ex, ans, onChange, result }: Props) {
  const { t } = useT();
  const L = R.toNumber(R.parse(ex.beam.length));
  const items = result?.items ?? [];
  const byId = (id: string) => items.find((i) => i.id === id)?.status;
  const set = (patch: Partial<ModeAAnswer>) => onChange({ ...ans, ...patch });

  /** Status of a field of a points-table row, from the items at that x. */
  const rowStatus = (row: PointRow, field: 'Vl' | 'Vr' | 'Ml' | 'Mr'): Status | undefined => {
    const x = tryNum(row.x);
    if (x === null) return row.x.trim() && result ? 'invalid' : undefined;
    const near = items.filter((i) => (i.part === 'V' || i.part === 'M') && i.x !== undefined && Math.abs(i.x - x) <= positionTol(L, true));
    const part = field[0] as 'V' | 'M';
    const side = field[1] === 'l' ? '-' : '+';
    const its = near.filter((i) => i.part === part);
    const exact = its.find((i) => i.id.startsWith(`${part}${side}:`));
    if (exact) return exact.status;
    const single = its.find((i) => i.id.startsWith(`${part}:`));
    if (!single) return undefined;
    const filled = (row[field] ?? '').trim() !== '';
    return filled ? single.status : undefined;
  };

  const sup = ex.beam.supports;
  const p = ex.points?.[0];

  return (
    <div className="asks">
      <div className="ask">
        <header>
          <b>{t('form.units')}</b>
        </header>
        <div className="row">
          <div className="choice">
            {(['N', 'kN'] as const).map((u) => (
              <button key={u} className={`small ${ans.forceUnit === u ? 'sel' : ''}`} aria-pressed={ans.forceUnit === u} onClick={() => set({ forceUnit: u, momentUnit: u === 'kN' ? 'kN·m' : 'N·m' })}>
                {u} · {u === 'kN' ? 'kN·m' : 'N·m'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {ex.ask.reactions && (
        <div className="ask">
          <header>
            <b>{t('form.reactions')}</b>
          </header>
          <p className="hint">{t('form.reactionsHint')}</p>
          <div className="row">
            {sup.map((s) => (
              <span key={s.label} className="row" style={{ marginTop: 0 }}>
                <Field
                  label={`R${s.label} (${ans.forceUnit})`}
                  value={ans.reactions?.[s.label]?.R}
                  status={byId(`R:${s.label}`)}
                  onChange={(v) => set({ reactions: { ...ans.reactions, [s.label]: { ...ans.reactions?.[s.label], R: v } } })}
                />
                {s.type === 'fixed' && (
                  <Field
                    label={`M${s.label} (${ans.momentUnit})`}
                    value={ans.reactions?.[s.label]?.M}
                    status={byId(`M:${s.label}`)}
                    onChange={(v) => set({ reactions: { ...ans.reactions, [s.label]: { ...ans.reactions?.[s.label], M: v } } })}
                  />
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {ex.ask.diagrams && (
        <div className="ask">
          <header>
            <b>{t('form.points')}</b>
          </header>
          <p className="hint">{t('form.pointsHint')}</p>
          <div className="scroll-x">
            <table className="points-table">
              <thead>
                <tr>
                  <th>x (m)</th>
                  <th>V⁻ ({ans.forceUnit})</th>
                  <th>V⁺ ({ans.forceUnit})</th>
                  <th>M⁻ ({ans.momentUnit})</th>
                  <th>M⁺ ({ans.momentUnit})</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(ans.points ?? []).map((row, i) => {
                  const upd = (patch: Partial<PointRow>) => set({ points: (ans.points ?? []).map((r, k) => (k === i ? { ...r, ...patch } : r)) });
                  return (
                    <tr key={i}>
                      {(['x', 'Vl', 'Vr', 'Ml', 'Mr'] as const).map((f) => (
                        <td key={f} className={cls(f === 'x' ? undefined : rowStatus(row, f))}>
                          <input inputMode="decimal" autoComplete="off" aria-label={`${f} ${i + 1}`} value={row[f] ?? ''} onChange={(e) => upd({ [f]: e.target.value })} />
                        </td>
                      ))}
                      <td>
                        <button className="small" onClick={() => set({ points: (ans.points ?? []).filter((_, k) => k !== i) })} aria-label={t('form.remove')}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <button onClick={() => set({ points: [...(ans.points ?? []), { x: '' }] })}>{t('form.addPoint')}</button>
          </div>
        </div>
      )}

      {ex.ask.pointValues?.length && p ? (
        <div className="ask">
          <header>
            <b>{t('form.atPoint', { label: p.label, x: p.x.replace('.', ',') })}</b>
          </header>
          <div className="row">
            <Field
              label={`V${p.label} (${ans.forceUnit})`}
              value={ans.pointValues?.[p.label]?.Vl}
              status={byId(`Vp:${p.label}`) ?? byId(`Vp-:${p.label}`)}
              onChange={(v) => set({ pointValues: { ...ans.pointValues, [p.label]: { ...ans.pointValues?.[p.label], Vl: v } } })}
            />
            <Field
              label={`M${p.label} (${ans.momentUnit})`}
              value={ans.pointValues?.[p.label]?.M}
              status={byId(`Mp:${p.label}`)}
              onChange={(v) => set({ pointValues: { ...ans.pointValues, [p.label]: { ...ans.pointValues?.[p.label], M: v } } })}
            />
          </div>
        </div>
      ) : null}

      {ex.ask.mmax && (
        <div className="ask">
          <header>
            <b>{t('form.mmax')}</b>
          </header>
          <div className="row">
            <Field label={`|M|max (${ans.momentUnit})`} value={ans.mmax?.value} status={byId('mmax')} onChange={(v) => set({ mmax: { ...ans.mmax, value: v } })} />
            <Field label={t('form.position')} value={ans.mmax?.x} status={byId('xmax')} w="w5" onChange={(v) => set({ mmax: { ...ans.mmax, x: v } })} />
          </div>
        </div>
      )}

      {ex.ask.equations && (
        <div className="ask">
          <header>
            <b>{t('form.equations')}</b>
          </header>
          <p className="hint">{t('form.equationsHint')}</p>
          {(ans.equations ?? []).map((row, i) => {
            const upd = (patch: Partial<typeof row>) => set({ equations: (ans.equations ?? []).map((r, k) => (k === i ? { ...r, ...patch } : r)) });
            const st = (part: 'Veq' | 'Meq'): Status | undefined => {
              const a = tryNum(row.x1);
              const it: Item | undefined = items.find((x) => x.part === part && a !== null && x.x !== undefined && Math.abs(x.x - a) <= positionTol(L));
              return it?.status;
            };
            return (
              <div key={i} className="ask" style={{ marginTop: 8 }}>
                <div className="row">
                  <Field label={t('form.from')} value={row.x1} w="w5" onChange={(v) => upd({ x1: v })} />
                  <Field label={t('form.to')} value={row.x2} w="w5" onChange={(v) => upd({ x2: v })} />
                  <button className="small" onClick={() => set({ equations: (ans.equations ?? []).filter((_, k) => k !== i) })}>
                    {t('form.remove')}
                  </button>
                </div>
                <div className="row">
                  <span className="unit">V(x):</span>
                  {['a', 'b', 'c'].map((c, k) => (
                    <Field key={c} label={c} w="w5" value={row.V[k]} status={st('Veq')} onChange={(v) => upd({ V: Object.assign([...row.V], { [k]: v }) })} />
                  ))}
                </div>
                <div className="row">
                  <span className="unit">M(x):</span>
                  {['a', 'b', 'c', 'd'].map((c, k) => (
                    <Field key={c} label={c} w="w5" value={row.M[k]} status={st('Meq')} onChange={(v) => upd({ M: Object.assign([...row.M], { [k]: v }) })} />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="actions">
            <button onClick={() => set({ equations: [...(ans.equations ?? []), { x1: '', x2: '', V: [], M: [] }] })}>{t('form.addSegment')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
