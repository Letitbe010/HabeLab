/**
 * Theory content model (spec §12), same structure as KateLab. Texts are templates:
 * numbers in examples come from the solver through {{…}} variables (core/workedVars.ts).
 * Formulas are LaTeX (KaTeX); a formula with `check` is tested against the solver on
 * 1000 random cases (tests/theory.test.ts).
 *
 * Deviation from the spec (§2 lists MDX): structured TypeScript data, so that template
 * variables and formula checks are testable without an MDX build.
 */

export type Bi = { eu: string; es: string };

export type FormulaId = 'pl4' | 'pab' | 'ql2' | 'tri' | 'cant-p' | 'cant-q';

export type WidgetId = 'moving-load' | 'section-cut' | 'free-editor';

export type Block =
  | ({ t: 'p' } & Bi)
  | { t: 'f'; tex: string; check?: FormulaId }
  | { t: 'list'; eu: string[]; es: string[] }
  | ({ t: 'example'; pool: string } & Bi)
  | ({ t: 'note'; kind: 'careful' | 'ope' } & Bi)
  | { t: 'table'; head: Bi[]; rows: Bi[][] }
  | { t: 'widget'; w: WidgetId }
  /** the three supports, each drawn with its unknown reactions (Rx, Ry, M) */
  | { t: 'supports' }
  /** 3D drawing: bending rotation θ of the sections (simple beam, cantilever) vs torsion φ */
  | { t: 'rotation' }
  /** free-body diagram of a pool exercise with the unknown reactions, the equilibrium
   *  equations written symbolically (LaTeX) and a text with the solver's values */
  | ({ t: 'fbd'; pool: string; tex: string[] } & Bi)
  /** a shaft on bearings drawn mechanically, and its beam model */
  | ({ t: 'shaft'; pool: string } & Bi)
  | { t: 'practice'; worked?: string; level?: 1 | 2 | 3 };

export interface Topic {
  id: string;
  title: Bi;
  status: 'draft' | 'reviewed';
  blocks: Block[];
}
