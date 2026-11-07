/**
 * 解剖図の読み込み（関節ごとの JSON）。無い関節は undefined を返し、画面は従来の図に戻る。
 * JSON を足すときは、ここに import を1行足す。
 */
import type { AnatomyJointSpec } from './types'
import knee from './zones/knee.json'
import ankle from './zones/ankle.json'
import shoulder from './zones/shoulder.json'
import lumbar from './zones/lumbar.json'
import hip from './zones/hip.json'

export * from './types'

const SPECS: Record<string, AnatomyJointSpec> = {}
for (const spec of [knee as AnatomyJointSpec, ankle as AnatomyJointSpec, shoulder as AnatomyJointSpec, lumbar as AnatomyJointSpec, hip as AnatomyJointSpec]) {
  if (spec.views.length > 0) SPECS[spec.joint] = spec
}

export function getAnatomySpec(joint: string): AnatomyJointSpec | undefined {
  return SPECS[joint]
}

export function anatomyJoints(): string[] {
  return Object.keys(SPECS)
}

/** 多角形の中心（ラベル位置の既定値） */
export function polygonCenter(polygon: Array<[number, number]>): [number, number] {
  const n = polygon.length || 1
  const [sx, sy] = polygon.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0])
  return [sx / n, sy / n]
}
