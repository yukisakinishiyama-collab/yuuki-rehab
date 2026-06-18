export type JointType =
  | 'cervical' | 'shoulder' | 'elbow' | 'forearm' | 'wrist' | 'finger'
  | 'thoracolumbar' | 'hip' | 'knee' | 'ankle' | 'toe'

export type SideType = 'right' | 'left' | 'both' | 'none'

export type EndFeelType = 'soft' | 'hard' | 'elastic' | 'empty' | 'springy' | 'none'

export type MeasurementPositionType = 'supine' | 'prone' | 'sidelying' | 'sitting' | 'standing'

export interface ROMPatient {
  id: string
  name: string
  nameKana: string
  birthDate: string
  gender: 'male' | 'female' | 'other'
  diagnosis: string
  affectedSide: SideType
  injuryDate: string | null
  surgeryDate: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ROMRecord {
  id: string
  direction: string
  side: 'right' | 'left' | 'none'
  position: MeasurementPositionType
  arom: number | null
  prom: number | null
  normalValue: number
  hasPain: boolean
  painAngle: number | null
  painNote: string
  endFeel: EndFeelType
  compensatoryMotion: string
  memo: string
}

export interface ROMSession {
  id: string
  patientId: string
  measuredAt: string
  measuredBy: string
  sessionNumber: number
  joint: JointType
  records: ROMRecord[]
  overallNote: string
}

export const JOINT_LABELS: Record<JointType, string> = {
  cervical: '頸椎',
  shoulder: '肩関節',
  elbow: '肘関節',
  forearm: '前腕',
  wrist: '手関節',
  finger: '手指',
  thoracolumbar: '胸腰椎',
  hip: '股関節',
  knee: '膝関節',
  ankle: '足関節',
  toe: '足趾',
}

export const SIDE_LABELS: Record<string, string> = {
  right: '右',
  left: '左',
  both: '両側',
  none: '－',
}

export const END_FEEL_LABELS: Record<EndFeelType, string> = {
  soft: '軟性（筋・軟部組織）',
  hard: '硬性（骨・軟骨）',
  elastic: '弾性（関節包・靭帯）',
  empty: '空性（疼痛防御）',
  springy: 'スプリンギー',
  none: '記録なし',
}

export const POSITION_LABELS: Record<MeasurementPositionType, string> = {
  supine: '背臥位',
  prone: '腹臥位',
  sidelying: '側臥位',
  sitting: '座位',
  standing: '立位',
}

export const GENDER_LABELS: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
}

export interface JointDirectionDef {
  label: string
  normalValue: number
  sideFixed?: 'right' | 'left'
}

export interface JointConfig {
  label: string
  bilateral: boolean
  defaultPosition: MeasurementPositionType
  directions: JointDirectionDef[]
  compensatoryOptions: string[]
}

export const JOINT_CONFIGS: Record<JointType, JointConfig> = {
  cervical: {
    label: '頸椎',
    bilateral: true,
    defaultPosition: 'sitting',
    directions: [
      { label: '屈曲', normalValue: 60 },
      { label: '伸展', normalValue: 50 },
      { label: '右側屈', normalValue: 50, sideFixed: 'right' },
      { label: '左側屈', normalValue: 50, sideFixed: 'left' },
      { label: '右回旋', normalValue: 60, sideFixed: 'right' },
      { label: '左回旋', normalValue: 60, sideFixed: 'left' },
    ],
    compensatoryOptions: ['肩挙上', '体幹側屈', '体幹回旋'],
  },
  shoulder: {
    label: '肩関節',
    bilateral: false,
    defaultPosition: 'standing',
    directions: [
      { label: '屈曲', normalValue: 180 },
      { label: '伸展', normalValue: 50 },
      { label: '外転', normalValue: 180 },
      { label: '内転', normalValue: 0 },
      { label: '外旋', normalValue: 60 },
      { label: '内旋', normalValue: 80 },
    ],
    compensatoryOptions: ['肩甲骨挙上', '体幹側屈', '肘屈曲', '肩甲骨前傾'],
  },
  elbow: {
    label: '肘関節',
    bilateral: false,
    defaultPosition: 'standing',
    directions: [
      { label: '屈曲', normalValue: 145 },
      { label: '伸展', normalValue: 0 },
    ],
    compensatoryOptions: ['肩関節代償', '体幹側屈'],
  },
  forearm: {
    label: '前腕',
    bilateral: false,
    defaultPosition: 'sitting',
    directions: [
      { label: '回内', normalValue: 90 },
      { label: '回外', normalValue: 90 },
    ],
    compensatoryOptions: ['肩関節内旋', '肩関節外旋'],
  },
  wrist: {
    label: '手関節',
    bilateral: false,
    defaultPosition: 'sitting',
    directions: [
      { label: '掌屈', normalValue: 90 },
      { label: '背屈', normalValue: 70 },
      { label: '橈屈', normalValue: 25 },
      { label: '尺屈', normalValue: 55 },
    ],
    compensatoryOptions: ['前腕回内', '前腕回外', '手指屈曲'],
  },
  finger: {
    label: '手指',
    bilateral: false,
    defaultPosition: 'sitting',
    directions: [
      { label: 'MP屈曲', normalValue: 90 },
      { label: 'MP伸展', normalValue: 45 },
      { label: 'PIP屈曲', normalValue: 100 },
      { label: 'DIP屈曲', normalValue: 80 },
      { label: '母指CM外転', normalValue: 60 },
    ],
    compensatoryOptions: ['手関節代償', '隣指代償'],
  },
  thoracolumbar: {
    label: '胸腰椎',
    bilateral: true,
    defaultPosition: 'standing',
    directions: [
      { label: '屈曲', normalValue: 45 },
      { label: '伸展', normalValue: 30 },
      { label: '右側屈', normalValue: 50, sideFixed: 'right' },
      { label: '左側屈', normalValue: 50, sideFixed: 'left' },
      { label: '右回旋', normalValue: 40, sideFixed: 'right' },
      { label: '左回旋', normalValue: 40, sideFixed: 'left' },
    ],
    compensatoryOptions: ['骨盤側傾', '股関節代償', '頸椎代償'],
  },
  hip: {
    label: '股関節',
    bilateral: false,
    defaultPosition: 'supine',
    directions: [
      { label: '屈曲', normalValue: 125 },
      { label: '伸展', normalValue: 15 },
      { label: '外転', normalValue: 45 },
      { label: '内転', normalValue: 20 },
      { label: '外旋', normalValue: 45 },
      { label: '内旋', normalValue: 45 },
    ],
    compensatoryOptions: ['骨盤前傾', '骨盤側傾', '腰椎代償', '膝関節代償'],
  },
  knee: {
    label: '膝関節',
    bilateral: false,
    defaultPosition: 'supine',
    directions: [
      { label: '屈曲', normalValue: 130 },
      { label: '伸展', normalValue: 0 },
    ],
    compensatoryOptions: ['骨盤前傾', '股関節外転', '足関節底屈', '体幹傾斜'],
  },
  ankle: {
    label: '足関節',
    bilateral: false,
    defaultPosition: 'supine',
    directions: [
      { label: '背屈', normalValue: 20 },
      { label: '底屈', normalValue: 45 },
      { label: '内反', normalValue: 30 },
      { label: '外反', normalValue: 20 },
    ],
    compensatoryOptions: ['膝屈曲', '距骨前方変位', '足部回内外'],
  },
  toe: {
    label: '足趾',
    bilateral: false,
    defaultPosition: 'supine',
    directions: [
      { label: 'MTP背屈', normalValue: 35 },
      { label: 'MTP底屈', normalValue: 45 },
      { label: 'PIP屈曲', normalValue: 35 },
      { label: '母趾MTP背屈', normalValue: 60 },
    ],
    compensatoryOptions: ['足関節代償', '隣趾代償'],
  },
}
