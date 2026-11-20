/**
 * Bending rotation θ vs torsion φ, drawn in oblique 3D so that the cross-sections can be
 * seen tilting (user request). Purely illustrative: the deflected shapes are the textbook
 * shapes (parabola-like for a simple beam, t²(3 − t)/2 for a cantilever with a tip load),
 * exaggerated; no exercise values are shown.
 */
import { useT } from '../../i18n';

type Pt = [number, number];
const O: Pt = [14, -10]; // oblique depth offset (width of the section)
const H = 16; // height of the section

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const pts = (ps: Pt[]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/** centre, half-height vector (perpendicular to the deflected axis) at parameter t */
function frame(x0: number, len: number, y0: number, v: (t: number) => number, dv: (t: number) => number, t: number) {
  const c: Pt = [x0 + len * t, y0 + v(t)];
  const th = Math.atan(dv(t) / len);
  const n: Pt = [(-Math.sin(th) * H) / 2, (Math.cos(th) * H) / 2];
  return { c, n, th };
}

function Beam3D({
  x0,
  len,
  y0,
  v,
  dv,
  sections,
  highlight,
}: {
  x0: number;
  len: number;
  y0: number;
  v: (t: number) => number;
  dv: (t: number) => number;
  sections: number[];
  highlight: number[];
}) {
  const N = 40;
  const F = Array.from({ length: N + 1 }, (_, i) => frame(x0, len, y0, v, dv, i / N));
  const frontTop = F.map((f) => sub(f.c, f.n));
  const frontBot = F.map((f) => add(f.c, f.n));
  const backTop = frontTop.map((p) => add(p, O));
  return (
    <g>
      {/* undeformed beam (dashed) */}
      <polyline points={pts([[x0, y0 - H / 2], [x0 + len, y0 - H / 2], [x0 + len + O[0], y0 - H / 2 + O[1]], [x0 + O[0], y0 - H / 2 + O[1]], [x0, y0 - H / 2]])} fill="none" stroke="var(--muted)" strokeDasharray="4 3" strokeWidth={0.8} />
      <line x1={x0} y1={y0 + H / 2} x2={x0 + len} y2={y0 + H / 2} stroke="var(--muted)" strokeDasharray="4 3" strokeWidth={0.8} />
      {/* deformed beam: top face, front face */}
      <polygon points={pts([...frontTop, ...[...backTop].reverse()])} fill="var(--soft)" stroke="var(--ink)" strokeWidth={1} />
      <polygon points={pts([...frontTop, ...[...frontBot].reverse()])} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.2} />
      {/* cross-sections: perpendicular to the deflected axis */}
      {sections.map((t) => {
        const f = frame(x0, len, y0, v, dv, t);
        const hot = highlight.includes(t);
        const a = sub(f.c, f.n);
        const b = add(f.c, f.n);
        return (
          <polygon
            key={t}
            points={pts([a, b, add(b, O), add(a, O)])}
            fill={hot ? 'var(--warnbg)' : 'none'}
            stroke={hot ? 'var(--M)' : 'var(--muted)'}
            strokeWidth={hot ? 2 : 1}
          />
        );
      })}
    </g>
  );
}

/** angle mark between the vertical through c and a section tilted by th */
function Theta({ c, th, label, side }: { c: Pt; th: number; label: string; side: 1 | -1 }) {
  const r = 26;
  const top: Pt = [c[0], c[1] - r];
  const tilt: Pt = [c[0] + r * Math.sin(th), c[1] - r * Math.cos(th)];
  return (
    <g>
      <line x1={c[0]} y1={c[1] - 34} x2={c[0]} y2={c[1] + 20} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth={0.8} />
      {/* the section's line, perpendicular to the deflected axis */}
      <line x1={c[0] - 20 * Math.sin(th)} y1={c[1] + 20 * Math.cos(th)} x2={c[0] + 34 * Math.sin(th)} y2={c[1] - 34 * Math.cos(th)} stroke="var(--M)" strokeWidth={1.4} />
      <path d={`M${top[0]} ${top[1]} A${r} ${r} 0 0 ${th > 0 ? 1 : 0} ${tilt[0]} ${tilt[1]}`} fill="none" stroke="var(--M)" strokeWidth={1.4} />
      <text x={c[0] + side * 10} y={c[1] - 38} textAnchor={side > 0 ? 'start' : 'end'} className="lab" fill="var(--M)">
        {label}
      </text>
    </g>
  );
}

function SimpleBeam() {
  const x0 = 30;
  const len = 290;
  const y0 = 90;
  const sag = 34;
  const v = (t: number) => sag * 4 * t * (1 - t);
  const dv = (t: number) => sag * 4 * (1 - 2 * t);
  const end0 = frame(x0, len, y0, v, dv, 0);
  const end1 = frame(x0, len, y0, v, dv, 1);
  return (
    <svg viewBox="0 0 360 190" role="img" aria-label="θ">
      <Beam3D x0={x0} len={len} y0={y0} v={v} dv={dv} sections={[0, 0.25, 0.5, 0.75, 1]} highlight={[0, 1]} />
      {/* supports under the end sections */}
      <polygon points={pts([add(end0.c, [0, H / 2 + 2]), add(end0.c, [-10, H / 2 + 20]), add(end0.c, [10, H / 2 + 20])])} fill="none" stroke="var(--ink)" strokeWidth={1.2} />
      <polygon points={pts([add(end1.c, [0, H / 2 + 2]), add(end1.c, [-10, H / 2 + 16]), add(end1.c, [10, H / 2 + 16])])} fill="none" stroke="var(--ink)" strokeWidth={1.2} />
      <circle cx={end1.c[0] - 5} cy={end1.c[1] + H / 2 + 20} r={3.5} fill="none" stroke="var(--ink)" strokeWidth={1.2} />
      <circle cx={end1.c[0] + 5} cy={end1.c[1] + H / 2 + 20} r={3.5} fill="none" stroke="var(--ink)" strokeWidth={1.2} />
      <Theta c={end0.c} th={end0.th} label="θ" side={1} />
      <Theta c={end1.c} th={end1.th} label="θ" side={-1} />
      {/* distributed load (symbolic) */}
      {[0.2, 0.35, 0.5, 0.65, 0.8].map((t) => {
        const f = frame(x0, len, y0, v, dv, t);
        return <line key={t} x1={f.c[0]} y1={f.c[1] - 40} x2={f.c[0]} y2={f.c[1] - H / 2 - 4} stroke="var(--load)" strokeWidth={1.4} markerEnd="url(#rot-arr)" />;
      })}
    </svg>
  );
}

function Cantilever() {
  const x0 = 40;
  const len = 270;
  const y0 = 70;
  const tip = 46;
  const v = (t: number) => (tip * t * t * (3 - t)) / 2;
  const dv = (t: number) => (tip * 3 * t * (2 - t)) / 2;
  const wall = frame(x0, len, y0, v, dv, 0);
  const end = frame(x0, len, y0, v, dv, 1);
  return (
    <svg viewBox="0 0 360 190" role="img" aria-label="θ = 0">
      <line x1={x0} y1={y0 - 34} x2={x0} y2={y0 + 40} stroke="var(--ink)" strokeWidth={2.2} />
      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
        <line key={k} x1={x0} y1={y0 - 30 + k * 11} x2={x0 - 9} y2={y0 - 21 + k * 11} stroke="var(--ink)" strokeWidth={1} />
      ))}
      <Beam3D x0={x0} len={len} y0={y0} v={v} dv={dv} sections={[0, 0.33, 0.66, 1]} highlight={[0, 1]} />
      <text x={x0 + 22} y={y0 + 46} className="lab" fill="var(--M)">
        θ = 0
      </text>
      <Theta c={end.c} th={end.th} label="θ" side={-1} />
      <line x1={end.c[0] + 8} y1={end.c[1] - 52} x2={end.c[0] + 8} y2={end.c[1] - H / 2 - 4} stroke="var(--load)" strokeWidth={2} markerEnd="url(#rot-arr)" />
      {/* reaction moment at the wall */}
      <path d={`M${wall.c[0] + 16} ${wall.c[1] - 26} A26 26 0 0 1 ${wall.c[0] + 16} ${wall.c[1] + 26}`} fill="none" stroke="var(--react)" strokeWidth={2} markerEnd="url(#rot-arr-g)" />
      <text x={wall.c[0] + 26} y={wall.c[1] - 28} className="fr">
        M_A
      </text>
    </svg>
  );
}

function Shaft() {
  const x0 = 60;
  const x1 = 300;
  const cy = 95;
  const r = 34;
  const rx = 18;
  const phi = (72 * Math.PI) / 180;
  // point of the generator line on the right end after twisting (angle measured from the top, towards the viewer)
  const end: Pt = [x1 + rx * Math.sin(phi), cy - r * Math.cos(phi)];
  return (
    <svg viewBox="0 0 360 190" role="img" aria-label="φ">
      <line x1={x0 - 30} y1={cy} x2={x1 + 40} y2={cy} stroke="var(--muted)" strokeDasharray="10 4 2 4" strokeWidth={0.8} />
      <line x1={x0} y1={cy - r} x2={x1} y2={cy - r} stroke="var(--ink)" strokeWidth={1.2} />
      <line x1={x0} y1={cy + r} x2={x1} y2={cy + r} stroke="var(--ink)" strokeWidth={1.2} />
      <ellipse cx={x0} cy={cy} rx={rx} ry={r} fill="var(--soft)" stroke="var(--ink)" strokeWidth={1.2} />
      <ellipse cx={x1} cy={cy} rx={rx} ry={r} fill="var(--soft)" stroke="var(--ink)" strokeWidth={1.2} />
      {/* generator line: straight before (dashed), helix after twisting */}
      <line x1={x0} y1={cy - r} x2={x1} y2={cy - r + 1} stroke="var(--muted)" strokeDasharray="4 3" strokeWidth={1} />
      {/* helix: a surface point turns by φ·(x − x0)/(x1 − x0) around the axis, towards the viewer */}
      <polyline
        points={pts(Array.from({ length: 31 }, (_, i): Pt => {
          const a = (phi * i) / 30;
          return [x0 + ((x1 - x0) * i) / 30 + rx * Math.sin(a) * (i / 30), cy - r * Math.cos(a)];
        }))}
        fill="none"
        stroke="var(--M)"
        strokeWidth={2}
      />
      {/* angle of twist on the right section */}
      <line x1={x1} y1={cy} x2={x1} y2={cy - r} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth={0.8} />
      <line x1={x1} y1={cy} x2={end[0]} y2={end[1]} stroke="var(--M)" strokeWidth={1.4} />
      <text x={x1 + 12} y={cy - r - 6} className="lab" fill="var(--M)">
        φ
      </text>
      {/* torques at both ends */}
      <path d={`M${x1 + 24} ${cy - 26} A14 26 0 1 1 ${x1 + 24} ${cy + 26}`} fill="none" stroke="var(--load)" strokeWidth={2} markerEnd="url(#rot-arr)" />
      <text x={x1 + 44} y={cy + 4} className="lab" fill="var(--load)">
        T
      </text>
      <path d={`M${x0 - 24} ${cy + 26} A14 26 0 1 1 ${x0 - 24} ${cy - 26}`} fill="none" stroke="var(--load)" strokeWidth={2} markerEnd="url(#rot-arr)" />
      <text x={x0 - 48} y={cy + 4} className="lab" fill="var(--load)">
        T
      </text>
    </svg>
  );
}

export function RotationFigure() {
  const { t } = useT();
  return (
    <div className="rot-grid">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <marker id="rot-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M1 1L9 5L1 9Z" fill="var(--load)" />
          </marker>
          <marker id="rot-arr-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M1 1L9 5L1 9Z" fill="var(--react)" />
          </marker>
        </defs>
      </svg>
      <figure className="fig-box">
        <SimpleBeam />
        <figcaption>{t('th.rot.simple')}</figcaption>
      </figure>
      <figure className="fig-box">
        <Cantilever />
        <figcaption>{t('th.rot.cant')}</figcaption>
      </figure>
      <figure className="fig-box">
        <Shaft />
        <figcaption>{t('th.rot.torsion')}</figcaption>
      </figure>
    </div>
  );
}
