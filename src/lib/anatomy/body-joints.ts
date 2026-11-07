/**
 * 人体図（BodyMap）で押した部位 → 解剖図（AnatomyMap）で開く関節と左右
 *
 * 人体図の部位IDは f/b（前・後）＋部位＋l/r（左・右）。例: fkr = 前・膝・右。
 * 体幹（腰部・頚部）は左右が無いので side は undefined。
 */
import type { Side } from '@/types/patient'

export const BODY_REGION_TO_JOINT: Record<string, string> = {
  fkl: '膝関節', fkr: '膝関節', bkl: '膝関節', bkr: '膝関節',
  fsl: '肩関節', fsr: '肩関節', bsl: '肩関節', bsr: '肩関節',
  fhil: '股関節', fhir: '股関節', bgl: '股関節', bgr: '股関節',
  fal: '足関節', far: '足関節', bhal: '足関節', bher: '足関節',
  fab: '腰部', blb: '腰部',
  fn: '頚部', bn: '頚部',
  fel: '肘関節', fer: '肘関節', bel: '肘関節', ber: '肘関節',
  fhdl: '手関節・手指', fhdr: '手関節・手指',
}

const TRUNK = new Set(['腰部', '頚部'])

export interface JointPick {
  joint: string
  /** 右か左か。両方押していれば右、体幹なら undefined */
  side?: Side
}

/** 人体図の選択から、解剖図を出す関節の一覧（押した順） */
export function jointsFromPainLocations(locations: string[], supported: readonly string[]): JointPick[] {
  const picks = new Map<string, { left: boolean; right: boolean }>()
  for (const loc of locations) {
    const joint = BODY_REGION_TO_JOINT[loc]
    if (!joint || !supported.includes(joint)) continue
    const cur = picks.get(joint) ?? { left: false, right: false }
    if (loc.endsWith('l')) cur.left = true
    else cur.right = true
    picks.set(joint, cur)
  }
  return Array.from(picks, ([joint, lr]) => ({
    joint,
    side: TRUNK.has(joint) ? undefined : lr.right || !lr.left ? 'right' : 'left',
  }))
}
