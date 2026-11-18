/**
 * 図の左右の決まり（純粋な関数）
 *
 * 2026-11-18「SOAP の記入画面で、絵と左右が逆」（院長）を直した：
 *  - 人体図の前面：向かって左に「左肩・左膝…」を置いていた（鏡の向き）→ 向かって左が患者さんの右（向かい合って見た向き）に
 *  - 腰部の解剖図の後面：向かって右に「左」を置いていた → 後ろから見た向き（向かって右が患者さんの右）に
 * 部位の ID と名前（fkl＝左膝、lum_para_r＝右傍脊柱筋 など）は変えていない。絵の中の位置だけを入れかえた。
 * カルテに残っているのは ID なので、前の記録の「左・右」の文字はそのまま。
 *
 * ペン・×印で図に直接描いた印は、図の座標で残っている。前の決まりで描いた印は、押した部位といっしょに
 * 左右を入れかえて出す（そのままだと、印だけが反対側に残る）。新しいカルテには版（diagramLayout）を付けて見分ける。
 */
import type { AnatomyMarks, AnatomyViewMarks } from './types'

/** 図の左右の決まりの版（カルテの diagramLayout。無い記録は 1＝直す前） */
export const DIAGRAM_LAYOUT = 2
/** 人体図の幅（viewBox 0 0 200 400） */
export const BODY_MAP_WIDTH = 200
/** 腰部の解剖図（後面）の幅 */
export const LUMBAR_JOINT = '腰部'
export const LUMBAR_POSTERIOR_WIDTH = 1000

type BodyMarks = Partial<Record<'front' | 'back', AnatomyViewMarks>>

/** 印を左右に入れかえる（x → 幅 − x） */
export function mirrorViewMarks(marks: AnatomyViewMarks, width: number): AnatomyViewMarks {
  const flip = ([x, y]: [number, number]): [number, number] => [width - x, y]
  return { pins: marks.pins.map(flip), strokes: marks.strokes.map((s) => s.map(flip)) }
}

function isOld(layout: number | undefined): boolean {
  return (layout ?? 1) < DIAGRAM_LAYOUT
}

/** 人体図の印を、いまの決まりの向きにする（前の決まりの記録は、前面だけ左右を入れかえる。背面は変わっていない） */
export function bodyMarksForLayout<T extends BodyMarks | undefined>(marks: T, layout: number | undefined): T {
  if (!marks || !isOld(layout) || !marks.front) return marks
  return { ...marks, front: mirrorViewMarks(marks.front, BODY_MAP_WIDTH) } as T
}

/** 解剖図の印を、いまの決まりの向きにする（前の決まりの記録は、腰部の後面だけ左右を入れかえる） */
export function anatomyMarksForLayout<T extends Record<string, AnatomyMarks> | undefined>(marks: T, layout: number | undefined): T {
  const lumbar = marks?.[LUMBAR_JOINT]
  if (!marks || !isOld(layout) || !lumbar?.posterior) return marks
  return { ...marks, [LUMBAR_JOINT]: { ...lumbar, posterior: mirrorViewMarks(lumbar.posterior, LUMBAR_POSTERIOR_WIDTH) } } as T
}
