/**
 * 解剖図（関節ごとのイラスト）と、その上で押せる部位の定義
 *
 * 1つの関節につき、向き（前面・後面・内側・外側 など）ごとに「画像1枚＋部位の多角形」を持つ。
 * 画像は public/anatomy/<joint>/<view>.webp、部位の座標は src/lib/anatomy/zones/<joint>.json。
 * 右側の図だけ用意し、左は画面で左右反転して使う（mirrorForLeft）。
 * 画像と座標は Codex が納品する（docs/anatomy-illustrations-brief.md）。無い関節は従来の JointDetailMap に戻る。
 */

export type AnatomyView = 'anterior' | 'posterior' | 'medial' | 'lateral' | 'superior' | 'palmar' | 'dorsal'

export const ANATOMY_VIEW_LABELS: Record<AnatomyView, string> = {
  anterior: '前面',
  posterior: '後面',
  medial: '内側',
  lateral: '外側',
  superior: '上面',
  palmar: '掌側',
  dorsal: '背側',
}

export type ZoneType = 'ligament' | 'tendon' | 'meniscus' | 'muscle' | 'nerve' | 'bursa' | 'cartilage' | 'bone'

export interface AnatomyZone {
  /** 既存の部位ID（knee_mcl など。カルテの保存値なので変えない） */
  id: string
  label: string
  type: ZoneType
  /** 画像の座標系（左上が 0,0。単位は px）での多角形。3点以上 */
  polygon: Array<[number, number]>
  /** ラベルを出す位置（省略時は多角形の中心） */
  labelAt?: [number, number]
}

/** 層（下から順に重ねる）。bone が土台、その上に靭帯・腱、筋、皮膚の順 */
export type AnatomyLayerKey = 'bone' | 'ligament' | 'muscle' | 'skin'

export const ANATOMY_LAYER_LABELS: Record<AnatomyLayerKey, string> = {
  bone: '骨',
  ligament: '靭帯・腱',
  muscle: '筋',
  skin: '皮膚',
}

export const ANATOMY_LAYER_ORDER: AnatomyLayerKey[] = ['bone', 'ligament', 'muscle', 'skin']

export interface AnatomyLayer {
  key: AnatomyLayerKey
  /** 透過画像（bone だけ不透過でよい）。向きの画像と同じ大きさ */
  image: string
  /** 最初から表示するか（省略時は表示） */
  defaultVisible?: boolean
}

/** 部位の種類 → どの層に属するか（層を外すと、その層の部位も押せなくなる） */
export const ZONE_LAYER: Record<ZoneType, AnatomyLayerKey> = {
  bone: 'bone',
  cartilage: 'bone',
  meniscus: 'bone',
  ligament: 'ligament',
  tendon: 'ligament',
  bursa: 'ligament',
  muscle: 'muscle',
  nerve: 'muscle',
}

export interface AnatomyViewSpec {
  view: AnatomyView
  /** 層が無いときの1枚絵（層があるときは、層をすべて外したときの下絵にはならない。bone 層が土台） */
  image: string
  width: number
  height: number
  zones: AnatomyZone[]
  /** 軟部組織を層にして、押して外せるようにする（任意。無ければ image の1枚絵） */
  layers?: AnatomyLayer[]
}

export interface AnatomyJointSpec {
  /** 画面で使う関節名（JointDetailMap と同じ日本語キー。例: 膝関節） */
  joint: string
  /** ファイル名に使う英字キー（knee / shoulder …） */
  key: string
  /** 図は右側の関節として描く。左を選んだとき左右反転するか（体幹の図は false） */
  mirrorForLeft: boolean
  views: AnatomyViewSpec[]
  /** 納品者・日付などのメモ */
  credit?: string
}

// ── 解剖図への直接のマーク（部位の多角形とは別に、ペンで描いた線・×印） ──
// 座標は右側の図の px（画像そのものの座標）。左は表示時に反転するので、保存値は反転しない。

/** 1つの向きのマーク */
export interface AnatomyViewMarks {
  /** ×印の位置 */
  pins: Array<[number, number]>
  /** ペンで描いた線（1本 = 点の列） */
  strokes: Array<Array<[number, number]>>
}

/** 向きごとのマーク（キーは AnatomyView） */
export type AnatomyMarks = Partial<Record<AnatomyView, AnatomyViewMarks>>

export function hasAnatomyMarks(marks: AnatomyMarks | undefined): boolean {
  if (!marks) return false
  return Object.values(marks).some(m => m && (m.pins.length > 0 || m.strokes.length > 0))
}
