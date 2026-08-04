'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  RotateCcw,
  Save,
  Share2,
  ChevronDown,
  Globe,
  History,
  Info,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Crosshair,
  UserRound,
  ListChecks,
  Lock,
  LockOpen,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { getPatients, saveROMRecord } from '@/lib/patient-store'
import type { Patient, BodyRegion, Side } from '@/types/patient'

// ─── 型定義 ───────────────────────────────────────────────────
type Lang = 'ja' | 'en'

interface RomReference {
  normal: number   // 正常値
  min: number      // 最小機能的可動域
  unit: string
}

interface JointMotion {
  id: string
  joint_ja: string
  joint_en: string
  motion_ja: string
  motion_en: string
  rom: RomReference
  /** beta(前後傾き) or gamma(左右傾き) を使うか */
  axis: 'beta' | 'gamma'
  /** センサー値をそのまま使うか反転するか */
  invert: boolean
}

/** 患者カルテ(ROM記録)反映時の関節名→部位カテゴリ対応 */
const REGION_MAP: Record<string, BodyRegion> = {
  '膝関節': 'knee',
  '股関節': 'hip',
  '足関節': 'ankle',
  '肩関節': 'shoulder',
  '肘関節': 'elbow',
  '頸椎': 'cervical',
  '腰椎': 'lumbar',
}

interface Measurement {
  id: string
  motionId: string
  angle: number
  date: string   // ISO string
  note: string
  /** 開始肢位を0°にセットして計測したか（未記録の旧データは undefined） */
  zeroed?: boolean
}

// ─── 関節・動作データ ─────────────────────────────────────────
const JOINTS: JointMotion[] = [
  // 膝関節
  {
    id: 'knee-flex',
    joint_ja: '膝関節', joint_en: 'Knee',
    motion_ja: '屈曲', motion_en: 'Flexion',
    rom: { normal: 130, min: 90, unit: '°' },
    axis: 'beta', invert: false,
  },
  {
    id: 'knee-ext',
    joint_ja: '膝関節', joint_en: 'Knee',
    motion_ja: '伸展', motion_en: 'Extension',
    rom: { normal: 0, min: -10, unit: '°' },
    axis: 'beta', invert: true,
  },
  // 股関節
  {
    id: 'hip-flex',
    joint_ja: '股関節', joint_en: 'Hip',
    motion_ja: '屈曲', motion_en: 'Flexion',
    rom: { normal: 125, min: 90, unit: '°' },
    axis: 'beta', invert: false,
  },
  {
    id: 'hip-ext',
    joint_ja: '股関節', joint_en: 'Hip',
    motion_ja: '伸展', motion_en: 'Extension',
    rom: { normal: 15, min: 10, unit: '°' },
    axis: 'beta', invert: true,
  },
  {
    id: 'hip-abd',
    joint_ja: '股関節', joint_en: 'Hip',
    motion_ja: '外転', motion_en: 'Abduction',
    rom: { normal: 45, min: 20, unit: '°' },
    axis: 'gamma', invert: false,
  },
  {
    id: 'hip-add',
    joint_ja: '股関節', joint_en: 'Hip',
    motion_ja: '内転', motion_en: 'Adduction',
    rom: { normal: 20, min: 10, unit: '°' },
    axis: 'gamma', invert: true,
  },
  // 足関節
  {
    id: 'ankle-df',
    joint_ja: '足関節', joint_en: 'Ankle',
    motion_ja: '背屈', motion_en: 'Dorsiflexion',
    rom: { normal: 20, min: 10, unit: '°' },
    axis: 'beta', invert: false,
  },
  {
    id: 'ankle-pf',
    joint_ja: '足関節', joint_en: 'Ankle',
    motion_ja: '底屈', motion_en: 'Plantarflexion',
    rom: { normal: 45, min: 20, unit: '°' },
    axis: 'beta', invert: true,
  },
  // 肩関節
  {
    id: 'shoulder-flex',
    joint_ja: '肩関節', joint_en: 'Shoulder',
    motion_ja: '屈曲', motion_en: 'Flexion',
    rom: { normal: 180, min: 120, unit: '°' },
    axis: 'beta', invert: false,
  },
  {
    id: 'shoulder-ext',
    joint_ja: '肩関節', joint_en: 'Shoulder',
    motion_ja: '伸展', motion_en: 'Extension',
    rom: { normal: 50, min: 30, unit: '°' },
    axis: 'beta', invert: true,
  },
  {
    id: 'shoulder-abd',
    joint_ja: '肩関節', joint_en: 'Shoulder',
    motion_ja: '外転', motion_en: 'Abduction',
    rom: { normal: 180, min: 90, unit: '°' },
    axis: 'gamma', invert: false,
  },
  // 肘関節
  {
    id: 'elbow-flex',
    joint_ja: '肘関節', joint_en: 'Elbow',
    motion_ja: '屈曲', motion_en: 'Flexion',
    rom: { normal: 145, min: 90, unit: '°' },
    axis: 'beta', invert: false,
  },
  {
    id: 'elbow-ext',
    joint_ja: '肘関節', joint_en: 'Elbow',
    motion_ja: '伸展', motion_en: 'Extension',
    rom: { normal: 0, min: -10, unit: '°' },
    axis: 'beta', invert: true,
  },
  // 頸椎
  {
    id: 'cervical-flex',
    joint_ja: '頸椎', joint_en: 'Cervical',
    motion_ja: '屈曲', motion_en: 'Flexion',
    rom: { normal: 60, min: 30, unit: '°' },
    axis: 'beta', invert: false,
  },
  {
    id: 'cervical-ext',
    joint_ja: '頸椎', joint_en: 'Cervical',
    motion_ja: '伸展', motion_en: 'Extension',
    rom: { normal: 50, min: 20, unit: '°' },
    axis: 'beta', invert: true,
  },
  {
    id: 'cervical-lat',
    joint_ja: '頸椎', joint_en: 'Cervical',
    motion_ja: '側屈', motion_en: 'Lateral Flexion',
    rom: { normal: 50, min: 20, unit: '°' },
    axis: 'gamma', invert: false,
  },
  // 腰椎
  {
    id: 'lumbar-flex',
    joint_ja: '腰椎', joint_en: 'Lumbar',
    motion_ja: '屈曲', motion_en: 'Flexion',
    rom: { normal: 90, min: 40, unit: '°' },
    axis: 'beta', invert: false,
  },
  {
    id: 'lumbar-ext',
    joint_ja: '腰椎', joint_en: 'Lumbar',
    motion_ja: '伸展', motion_en: 'Extension',
    rom: { normal: 30, min: 10, unit: '°' },
    axis: 'beta', invert: true,
  },
]

// ─── 多言語テキスト ───────────────────────────────────────────
const T = {
  ja: {
    title: '関節角度計',
    select: '関節・動作を選択',
    measure: '計測',
    save: '保存',
    share: '共有',
    reset: 'リセット',
    history: '計測履歴',
    reference: '参考可動域',
    normal: '正常値',
    functional: '機能的最小値',
    current: '現在角度',
    saved: '保存済み',
    noHistory: '計測履歴なし',
    noteMemo: 'メモ（任意）',
    noteHolder: '例：術後3週、疼痛なし',
    prevDiff: '前回との差',
    permissionBtn: 'センサー許可（iOS）',
    permissionNote: 'iPhoneの場合はタップしてセンサーを許可してください',
    sensorError: 'センサーが利用できません。PCではなくスマートフォンでご使用ください。',
    tiltInstruction: 'スマートフォンを測定したい角度まで傾けてください',
    deleteConfirm: 'この記録を削除しますか？',
    excellent: '正常範囲内',
    limited: '可動域制限あり',
    severely: '高度制限',
    lockOn: 'ロック中（表示値を固定）',
    lockOff: 'アンロック（追従中）',
    lockRelease: '解除',
    lockApply: '固定',
    gaugeIdeal: '0°（理想）',
    gaugeTolerance: '許容',
    gaugeRestricted: '制限大',
    extensionHint: 'この項目は 0° が理想です。数値が大きいほど伸展制限（屈曲拘縮）が強いことを示します',
    diffMethodMismatch: '前回と計測方式（絶対角／開始肢位0°基準）が異なるため、差分は表示していません',
    sensorNoData: 'センサーの値を受信できていません。スマートフォン（iPhone/Android）で開いているか、モーションセンサーの許可を確認してください。パソコンでは角度は 0° のまま動きません。',
    iosDenied: 'モーションセンサーへのアクセスが許可されませんでした。iPhone の「設定 → Safari → モーションと画面の向きのアクセス」をオンにしてから、ページを再読み込みしてください。',
    zeroBtn: '開始肢位を0°にセット',
    zeroHint: 'スマホを開始肢位（測り始めの位置）に当てて押すと、その瞬間の位置が0°になります。押した後そのまま静止していると基準値の精度が上がります',
    zeroActive: '開始肢位を0°として計測中',
    zeroClear: '解除',
    linkTitle: '患者カルテに反映',
    linkNone: '反映しない（単独計測）',
    sideRight: '右',
    sideLeft: '左',
    reflected: 'カルテのROM記録に反映しました',
    batchBtn: 'まとめて計測（複数項目を連続で）',
    batchSelectTitle: '計測する項目を選択',
    batchStart: '計測開始',
    batchCancel: 'やめる',
    batchConfirm: 'この値で決定 → 次へ',
    batchSkip: 'スキップ',
    batchReviewTitle: '計測結果の確認',
    batchRedo: '再計測',
    batchMeasureOne: '計測する',
    batchUnmeasured: '未計測',
    batchSaveAll: 'まとめて保存',
    batchNoteHolder: '共通メモ（任意）例: 術後4週評価',
    batchSavedCount: (n: number) => `${n}件を保存しました`,
    batchToReview: '確認へ',
    batchSelectAll: '全項目',
    batchClearAll: '選択解除',
    batchNoneSelected: '計測する項目を1つ以上選んでください',
    batchSelectedCount: (n: number) => `${n}項目を選択中`,
    batchPresetHint: 'よく使う部位から選べます',
    batchMeasuredCount: (done: number, total: number) => `${done}/${total} 項目を計測済み`,
    batchNoResult: '計測済みの項目がありません',
  },
  en: {
    title: 'Goniometer',
    select: 'Select Joint / Motion',
    measure: 'Measure',
    save: 'Save',
    share: 'Share',
    reset: 'Reset',
    history: 'Measurement History',
    reference: 'Reference ROM',
    normal: 'Normal',
    functional: 'Functional Min.',
    current: 'Current Angle',
    saved: 'Saved',
    noHistory: 'No measurements yet',
    noteMemo: 'Note (optional)',
    noteHolder: 'e.g., 3 weeks post-op, no pain',
    prevDiff: 'vs. Last',
    permissionBtn: 'Allow Sensor (iOS)',
    permissionNote: 'On iPhone, tap to allow sensor access',
    sensorError: 'Sensor unavailable. Please use a smartphone.',
    tiltInstruction: 'Tilt your smartphone to the desired angle',
    deleteConfirm: 'Delete this record?',
    excellent: 'Within normal range',
    limited: 'Limited ROM',
    severely: 'Severely limited',
    lockOn: 'Locked (reading held)',
    lockOff: 'Unlocked (live)',
    lockRelease: 'Unlock',
    lockApply: 'Hold',
    gaugeIdeal: '0° (ideal)',
    gaugeTolerance: 'tolerance',
    gaugeRestricted: 'restricted',
    extensionHint: 'For this motion 0° is ideal. A larger value means a greater extension lag (flexion contracture).',
    diffMethodMismatch: 'The previous record used a different method (absolute vs. zeroed), so no difference is shown.',
    sensorNoData: 'No sensor data received. Open this page on a phone and allow motion access. On a desktop the angle stays at 0°.',
    iosDenied: 'Motion access was not granted. Enable Settings → Safari → Motion & Orientation Access on your iPhone, then reload the page.',
    zeroBtn: 'Set start position to 0°',
    zeroHint: 'Hold the phone at the starting position and tap to zero the scale. Keep it still afterwards to refine the baseline',
    zeroActive: 'Measuring relative to zeroed start position',
    zeroClear: 'Clear',
    linkTitle: 'Link to patient chart',
    linkNone: 'No link (standalone)',
    sideRight: 'R',
    sideLeft: 'L',
    reflected: 'Saved to patient ROM records',
    batchBtn: 'Batch measure (multiple motions)',
    batchSelectTitle: 'Select motions to measure',
    batchStart: 'Start',
    batchCancel: 'Cancel',
    batchConfirm: 'Confirm → Next',
    batchSkip: 'Skip',
    batchReviewTitle: 'Review results',
    batchRedo: 'Redo',
    batchMeasureOne: 'Measure',
    batchUnmeasured: 'Not measured',
    batchSaveAll: 'Save all',
    batchNoteHolder: 'Shared note (optional)',
    batchSavedCount: (n: number) => `Saved ${n} records`,
    batchToReview: 'Review',
    batchSelectAll: 'All',
    batchClearAll: 'Clear',
    batchNoneSelected: 'Select at least one motion',
    batchSelectedCount: (n: number) => `${n} selected`,
    batchPresetHint: 'Pick a region to preselect',
    batchMeasuredCount: (done: number, total: number) => `${done}/${total} measured`,
    batchNoResult: 'No measurements recorded',
  },
}

// ─── ローカルストレージ ────────────────────────────────────────
const STORAGE_KEY = 'yuuki_goniometer_v1'

function loadMeasurements(): Measurement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMeasurements(data: Measurement[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

// ─── 角度ゲージ描画 ───────────────────────────────────────────
function AngleGauge({
  angle,
  normal,
  min,
}: {
  angle: number
  normal: number
  min: number
}) {
  // 伸展系（正常値0以下）は「0°が理想、大きいほど制限が強い」という逆向きの尺度。
  // 屈曲系と同じ式だと normal=0 で分母が1に丸められ、5°以上が常に満タン＋teal になる。
  if (normal <= 0) {
    const tolerance = Math.abs(min) || 10       // 例: 膝伸展 min:-10 → 10°まで許容
    const scale = tolerance * 3                 // ゲージ全体の幅
    const a = Math.abs(angle)
    const pct = Math.min(a / scale, 1)
    const color = a <= tolerance / 2 ? '#0d9488' : a <= tolerance * 1.5 ? '#f59e0b' : '#ef4444'

    return (
      <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-visible mt-1">
        {/* 正常上限マーカー */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-500 z-10"
          style={{ left: `${(tolerance / 2 / scale) * 100}%` }}
          title="normal limit"
        />
        {/* 許容上限マーカー */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-400 z-10"
          style={{ left: `${(tolerance * 1.5 / scale) * 100}%` }}
          title="tolerance"
        />
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
    )
  }

  const pct = Math.min(Math.abs(angle) / Math.max(normal, 1), 1.3)
  const normalPct = 1
  const minPct = min / Math.max(normal, 1)

  // 色判定
  const color =
    Math.abs(angle) >= normal * 0.9
      ? '#0d9488'
      : Math.abs(angle) >= min
      ? '#f59e0b'
      : '#ef4444'

  return (
    <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-visible mt-1">
      {/* 機能的最小値マーカー */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-400 z-10"
        style={{ left: `${Math.min(minPct * 100, 100)}%` }}
        title="functional min"
      />
      {/* 正常値マーカー */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-500 z-10"
        style={{ left: `${Math.min(normalPct * 100, 100)}%` }}
        title="normal"
      />
      {/* バー */}
      <div
        className="h-full rounded-full transition-all duration-100"
        style={{
          width: `${Math.min(pct * 100, 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  )
}

// ─── メインコンポーネント ─────────────────────────────────────
export default function Goniometer() {
  const [lang, setLang] = useState<Lang>('ja')
  const t = T[lang]

  const [selectedId, setSelectedId] = useState<string>(JOINTS[0].id)
  const [angle, setAngle] = useState<number>(0)
  const [measuring, setMeasuring] = useState(false)
  const [note, setNote] = useState('')
  // AuthGuard が先に null を返すため、ここはクライアント専用レンダリング保証済み
  const [measurements, setMeasurements] = useState<Measurement[]>(loadMeasurements)
  const [showHistory, setShowHistory] = useState(false)
  const [showRef, setShowRef] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  // センサー検出: lazy initializer でクライアントのみ実行
  const [sensorAvailable] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    return 'DeviceOrientationEvent' in window
  })
  const [iosPermission, setIosPermission] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    if (!('DeviceOrientationEvent' in window)) return false
    return (
      typeof (
        DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<string>
        }
      ).requestPermission === 'function'
    )
  })
  const [selectOpen, setSelectOpen] = useState(false)
  // センサー値を実際に1件でも受信したか（PC・iOS権限未許可では届かない）
  const [sensorLive, setSensorLive] = useState(false)
  const sensorLiveRef = useRef(false)
  const [sensorTimeout, setSensorTimeout] = useState(false)
  const [iosDenied, setIosDenied] = useState(false)
  // 患者カルテ連携: 選択した患者のROM記録に計測値を直接反映する
  const [patients, setPatients] = useState<Patient[]>([])
  const [linkedPatientId, setLinkedPatientId] = useState('')
  const [side, setSide] = useState<Side>('right')
  const [reflectedFlash, setReflectedFlash] = useState(false)
  // まとめて計測: 複数項目を連続で計測し、最後に一括保存
  const [batchMode, setBatchMode] = useState(false)
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([])
  // 角度だけでなく計測方式（ゼロセット基準か絶対角か）も持つ。
  // 方式が混ざったまま記録すると、経過比較で方式差が「改善／悪化」に見えてしまう。
  const [batchResults, setBatchResults] = useState<Record<string, { angle: number; zeroed: boolean }>>({})
  const [batchIdx, setBatchIdx] = useState(0)
  const [batchCommonNote, setBatchCommonNote] = useState('')
  // 項目選択 → 連続計測 → 確認・保存 の3段階
  const [batchStage, setBatchStage] = useState<'select' | 'measure' | 'review'>('select')
  // 計測ロック: 計測中の誤操作防止＋表示値の固定
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)

  // ロックはイベントハンドラ内で ref も同期的に書く。
  // useEffect 同期だと、切り替えた直後の1フレームが素通りしてしまう。
  function toggleLock() {
    const next = !locked
    lockedRef.current = next
    setLocked(next)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatients(getPatients().filter(p => p.status === 'active'))
  }, [])

  // 高精度フィルタリング: EMA（指数移動平均）+ 外れ値除去
  const emaRef = useRef(0)
  const hasEmaRef = useRef(false)   // EMA 初期化済みか（実測0°を未初期化と誤判定しないため）
  const EMA_ALPHA = 0.15  // 新値のウェイト（低いほど平滑、高いほど反応的）
  const OUTLIER_THRESHOLD = 8  // 前の値から8度以上の変化は外れ値と判定
  const OUTLIER_MAX_REJECT = 3  // 連続棄却の上限（速い動きで値が固まるのを防ぐ）
  const RAW_BUFFER_SIZE = 5  // 外れ値除去用の小バッファ
  const rawBufferRef = useRef<number[]>([])
  const rejectCountRef = useRef(0)

  // ゼロセット（開始肢位を0°とする基準値）
  const [zeroSet, setZeroSet] = useState(false)
  const zeroRef = useRef(0)
  const zeroPendingRef = useRef(false)      // 基準値の精密化サンプルを収集中か
  const zeroSamplesRef = useRef<number[]>([])
  const ZERO_SAMPLES = 12        // 約0.4秒ぶんのサンプルで基準を精密化
  const ZERO_STABLE_RANGE = 2.5  // サンプルの振れ幅がこの範囲なら「静止」と判定

  const motion = JOINTS.find((j) => j.id === selectedId)!

  // センサーハンドラから参照する可変値は ref に写す。
  // useCallback の依存配列に入れ忘れると値が更新されず（stale closure）、
  // ゼロセットが効かなくなるため、依存を持たない形に統一する。
  const measuringRef = useRef(measuring)
  const motionRef = useRef(motion)
  useEffect(() => { measuringRef.current = measuring }, [measuring])
  useEffect(() => { motionRef.current = motion }, [motion])

  // ─ センサーイベント（高精度計測） ─
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const m = motionRef.current
    const raw = m.axis === 'beta' ? e.beta : e.gamma

    // 値の入っていないイベントは受信として扱わない。
    // ここで 0 とみなすと、センサーが動いていないのに「0°」が正常表示され、
    // ゼロセットが効いていないのと区別が付かなくなる。
    if (raw == null || Number.isNaN(raw)) return
    if (!sensorLiveRef.current) {
      sensorLiveRef.current = true
      setSensorLive(true)
    }

    let val = m.invert ? -raw : raw

    // 外れ値除去: 前の値から急激に変わった値を除外する。
    // ただし連続で棄却が続く場合は実際の素早い動きとみなして追従を再開する
    // （無条件に棄却すると速く動かした瞬間に値が固まったままになる）。
    if (rawBufferRef.current.length > 0) {
      const lastVal = rawBufferRef.current[rawBufferRef.current.length - 1]
      if (
        Math.abs(val - lastVal) > OUTLIER_THRESHOLD &&
        rejectCountRef.current < OUTLIER_MAX_REJECT
      ) {
        rejectCountRef.current++
        val = lastVal
      } else {
        rejectCountRef.current = 0
      }
    }

    rawBufferRef.current.push(val)
    if (rawBufferRef.current.length > RAW_BUFFER_SIZE) {
      rawBufferRef.current.shift()
    }

    // EMA（指数移動平均）で平滑化
    const bufferAvg = rawBufferRef.current.reduce((a, b) => a + b, 0) / rawBufferRef.current.length
    if (hasEmaRef.current) {
      emaRef.current = emaRef.current * (1 - EMA_ALPHA) + bufferAvg * EMA_ALPHA
    } else {
      emaRef.current = bufferAvg
      hasEmaRef.current = true
    }

    // ゼロセットの精密化: 押した瞬間の値を暫定基準にしてあるので、
    // 続く数フレームが静止していれば、その平均で基準値を置き換える。
    if (zeroPendingRef.current) {
      zeroSamplesRef.current.push(emaRef.current)
      if (zeroSamplesRef.current.length >= ZERO_SAMPLES) {
        const s = zeroSamplesRef.current
        const spread = Math.max(...s) - Math.min(...s)
        // 静止していた場合のみ精密化。動いていたら押下時の暫定基準を維持する
        if (spread <= ZERO_STABLE_RANGE) {
          zeroRef.current = s.reduce((a, b) => a + b, 0) / s.length
        }
        zeroPendingRef.current = false
        zeroSamplesRef.current = []
      }
    }

    if (!measuringRef.current) return

    // 計測ロック中は表示値を固定する。
    // これが無いと、ロックしたまま端末を患部から外した瞬間の値が保存されてしまう。
    if (lockedRef.current) return

    // 基準値からの相対角度。-180〜180 に正規化してから絶対値を取る
    // （90°を超えた領域で数値が減少する現象を防ぐ）
    let delta = emaRef.current - zeroRef.current
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360

    // 0.1度単位で表示（精度向上）
    setAngle(Math.round(Math.abs(delta) * 10) / 10)
  }, [])

  // ─ ゼロセット: 現在の肢位を0°の基準にする ─
  // 押した瞬間に暫定基準を確定させて即座に0°を表示し、
  // 続く約0.4秒が静止していればその平均値で基準を精密化する。
  function handleZeroSet() {
    zeroRef.current = hasEmaRef.current ? emaRef.current : 0
    zeroPendingRef.current = true
    zeroSamplesRef.current = []
    setZeroSet(true)
    setAngle(0)
  }

  function clearZero() {
    zeroRef.current = 0
    zeroPendingRef.current = false
    zeroSamplesRef.current = []
    setZeroSet(false)
  }

  useEffect(() => {
    window.addEventListener('deviceorientation', handleOrientation, true)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }, [handleOrientation])

  // 計測開始後1.5秒たってもセンサー値が1件も届かない場合は原因を明示する。
  // ('DeviceOrientationEvent' in window は PC の Chrome でも true になるため、
  //  従来の sensorAvailable 判定だけでは PC での無反応を検出できない)
  useEffect(() => {
    if (!measuring || sensorLive) return
    const id = setTimeout(() => setSensorTimeout(true), 1500)
    return () => clearTimeout(id)
  }, [measuring, sensorLive])

  // 計測軸（beta/gamma）が変わると基準値の意味が失われるため、
  // 関節・運動方向を切り替えたらゼロセットも解除する
  function selectJoint(id: string) {
    setSelectedId(id)
    clearZero()
  }

  // ─ センサー許可（iOS）─
  async function requestIOS() {
    try {
      const fn = (
        DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<string>
        }
      ).requestPermission
      const result = await fn()
      if (result === 'granted') {
        setIosPermission(false)
        setIosDenied(false)
      } else {
        // 拒否を握り潰すと「許可を押しても何も起きない」状態になる
        setIosDenied(true)
      }
    } catch {
      setIosDenied(true)
    }
  }

  // ─ リセット ─
  function handleReset() {
    rawBufferRef.current = []
    rejectCountRef.current = 0
    emaRef.current = 0
    hasEmaRef.current = false
    zeroRef.current = 0
    zeroPendingRef.current = false
    zeroSamplesRef.current = []
    setZeroSet(false)
    setSensorTimeout(false)
    setAngle(0)
    setMeasuring(false)
    lockedRef.current = false
    setLocked(false)
  }

  // ─ まとめて計測: 項目選択を開く ─
  function openBatchSelect() {
    setBatchMode(true)
    setBatchStage('select')
    setBatchSelectedIds([])
    setBatchResults({})
    setBatchIdx(0)
    setBatchCommonNote('')
  }

  // ─ まとめて計測: 選択中の項目を1つトグル ─
  function toggleBatchJoint(id: string) {
    setBatchSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // ─ まとめて計測: 連続計測を開始 ─
  function startBatchMeasure(selectedIds: string[]) {
    if (selectedIds.length === 0) return
    // JOINTS の並び順に揃えると、部位ごとに肢位を変える回数が最小になる
    const ordered = JOINTS.filter(j => selectedIds.includes(j.id)).map(j => j.id)
    setBatchSelectedIds(ordered)
    setBatchResults({})
    setBatchIdx(0)
    setBatchStage('measure')
    setBatchMode(true)
    selectJoint(ordered[0])
    setMeasuring(true)
  }

  // ─ まとめて計測: 中止 ─
  function cancelBatch() {
    setBatchMode(false)
    setBatchStage('select')
    setBatchSelectedIds([])
    setBatchResults({})
    setBatchIdx(0)
    setBatchCommonNote('')
    handleReset()
  }

  // ─ ROM記録の memo 文言 ─
  // 絶対角とゼロセット相対角は同じ関節でも十数度ずれる。方式を残さないと
  // 方式を変えただけの差が「改善／悪化」として経過記録に残ってしまう。
  function buildRomMemo(userNote: string, zeroed: boolean) {
    const method = zeroed ? '関節角度計で計測（開始肢位0°基準）' : '関節角度計で計測（絶対角）'
    return userNote ? `${userNote}（${method}）` : method
  }

  // ─ まとめて計測: 指定インデックスへ進む ─
  // setBatchIdx は必ず呼ぶ。最終項目の次（nextIdx === length）は確認画面になる。
  // ここを条件分岐の内側に置くと確認画面に到達できず、計測結果が全て失われる。
  function advanceBatch(nextIdx: number) {
    setBatchIdx(nextIdx)
    handleReset()
    if (nextIdx < batchSelectedIds.length) {
      setBatchStage('measure')
      selectJoint(batchSelectedIds[nextIdx])
      setTimeout(() => setMeasuring(true), 100)
    } else {
      setBatchStage('review')
    }
  }

  // ─ まとめて計測: この値で確定して次へ ─
  function nextBatchItem() {
    if (batchIdx >= batchSelectedIds.length) return
    setBatchResults(prev => ({
      ...prev,
      [batchSelectedIds[batchIdx]]: { angle, zeroed: zeroSet }
    }))
    advanceBatch(batchIdx + 1)
  }

  // ─ まとめて計測: 記録せずに次へ ─
  function skipBatchItem() {
    if (batchIdx >= batchSelectedIds.length) return
    advanceBatch(batchIdx + 1)
  }

  // ─ まとめて計測: 確認画面から特定項目を測り直す ─
  function redoBatchItem(idx: number) {
    setBatchResults(prev => {
      const next = { ...prev }
      delete next[batchSelectedIds[idx]]
      return next
    })
    advanceBatch(idx)
  }

  // ─ まとめて計測: 保存（全項目） ─
  function saveBatchResults() {
    if (!linkedPatientId) {
      cancelBatch()
      return
    }
    const now = new Date()
    batchSelectedIds.forEach(motionId => {
      const motion = JOINTS.find(j => j.id === motionId)
      const result = batchResults[motionId]
      // 0° は正当な計測値（膝伸展・肘伸展の正常所見）なので falsy 判定で弾かない
      if (motion && result != null) {
        saveROMRecord({
          id: nanoid(),
          patientId: linkedPatientId,
          measuredDate: now.toISOString().slice(0, 10),
          bodyRegion: REGION_MAP[motion.joint_ja] ?? 'other',
          joint: motion.joint_ja,
          movement: motion.motion_ja,
          side,
          activeRom: result.angle,
          passiveRom: null,
          normalValue: motion.rom.normal,
          unit: 'deg',
          pain: false,
          painLocation: '',
          endFeel: '',
          limitationFactor: '',
          memo: buildRomMemo(batchCommonNote, result.zeroed),
          createdAt: now.toISOString(),
        })
      }
    })
    setReflectedFlash(true)
    setTimeout(() => setReflectedFlash(false), 2500)
    setBatchMode(false)
    setBatchStage('select')
    setBatchSelectedIds([])
    setBatchResults({})
    setBatchIdx(0)
    setBatchCommonNote('')
  }

  // ─ 保存 ─
  function handleSave() {
    const m: Measurement = {
      id: nanoid(),
      motionId: motion.id,
      angle,
      date: new Date().toISOString(),
      note,
      zeroed: zeroSet,
    }
    const updated = [m, ...measurements]
    setMeasurements(updated)
    saveMeasurements(updated)

    // 患者連携中はカルテのROM記録にもそのまま反映
    if (linkedPatientId) {
      const now = new Date()
      saveROMRecord({
        id: nanoid(),
        patientId: linkedPatientId,
        measuredDate: now.toISOString().slice(0, 10),
        bodyRegion: REGION_MAP[motion.joint_ja] ?? 'other',
        joint: motion.joint_ja,
        movement: motion.motion_ja,
        side,
        activeRom: angle,
        passiveRom: null,
        normalValue: motion.rom.normal,
        unit: 'deg',
        pain: false,
        painLocation: '',
        endFeel: '',
        limitationFactor: '',
        memo: buildRomMemo(note, zeroSet),
        createdAt: now.toISOString(),
      })
      setReflectedFlash(true)
      setTimeout(() => setReflectedFlash(false), 2500)
    }

    setNote('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1800)
    setMeasuring(false)
    // 基準を持ち越すと、次の計測が「見えない古い基準」で始まる
    clearZero()
    lockedRef.current = false
    setLocked(false)
  }

  // ─ 共有 ─
  async function handleShare() {
    const motionName =
      lang === 'ja'
        ? `${motion.joint_ja} ${motion.motion_ja}`
        : `${motion.joint_en} ${motion.motion_en}`
    const text =
      lang === 'ja'
        ? `【YUUKI REHAB】${motionName}: ${angle}°（正常値 ${motion.rom.normal}°）${note ? `\n${note}` : ''}`
        : `[YUUKI REHAB] ${motionName}: ${angle}° (Normal: ${motion.rom.normal}°)${note ? `\n${note}` : ''}`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'YUUKI REHAB Goniometer', text })
      } catch {}
    } else {
      await navigator.clipboard.writeText(text)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1800)
    }
  }

  // ─ 削除 ─
  function deleteMeasurement(id: string) {
    if (!confirm(t.deleteConfirm)) return
    const updated = measurements.filter((m) => m.id !== id)
    setMeasurements(updated)
    saveMeasurements(updated)
  }

  // ─ 前回値 ─
  const prevMeasurement = measurements.find((m) => m.motionId === motion.id)
  // 絶対角とゼロセット相対角は別物なので、方式が一致するときだけ差分を出す。
  // (旧データは zeroed 未記録 = undefined。絶対角として扱う)
  const prevSameMethod =
    prevMeasurement !== undefined && (prevMeasurement.zeroed ?? false) === zeroSet
  const diff = prevSameMethod ? angle - prevMeasurement!.angle : null
  const diffMethodMismatch = prevMeasurement !== undefined && !prevSameMethod

  // ─ 評価 ─
  // 伸展系（正常値が0以下）は「0°が理想で、大きいほど伸展制限が強い」という
  // 逆向きの尺度。屈曲系と同じ式（angle >= normal * 0.9）だと閾値が0になり
  // 何度出ていても『正常範囲内』になってしまうため、別扱いにする。
  const isExtensionType = motion.rom.normal <= 0
  const extLimitTolerance = Math.abs(motion.rom.min)   // 例: 膝伸展 min:-10 → 10°まで許容
  const evaluation = isExtensionType
    ? angle <= extLimitTolerance / 2
      ? { label: t.excellent, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' }
      : angle <= extLimitTolerance * 1.5
      ? { label: t.limited, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
      : { label: t.severely, color: 'text-red-600', bg: 'bg-red-50 border-red-200' }
    : angle >= motion.rom.normal * 0.9
      ? { label: t.excellent, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' }
      : angle >= motion.rom.min
      ? { label: t.limited, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
      : { label: t.severely, color: 'text-red-600', bg: 'bg-red-50 border-red-200' }

  // 伸展系は数値が小さいほど良いので、改善の向きが屈曲系と逆になる
  const diffImproved = diff !== null && (isExtensionType ? diff < 0 : diff > 0)

  // ─ 関節グループ ─
  const jointGroups = JOINTS.reduce<Record<string, JointMotion[]>>((acc, j) => {
    const key = lang === 'ja' ? j.joint_ja : j.joint_en
    if (!acc[key]) acc[key] = []
    acc[key].push(j)
    return acc
  }, {})

  // ─── レンダリング ─────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto pb-16">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'ja' ? '整形外科専用デジタルゴニオメーター' : 'Orthopedic Digital Goniometer'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 言語切替 */}
          <button
            onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'ja' ? 'EN' : 'JA'}
          </button>
        </div>
      </div>

      {/* iOS センサー許可 */}
      {iosPermission && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700 mb-2">{t.permissionNote}</p>
          <button
            onClick={requestIOS}
            className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
          >
            {t.permissionBtn}
          </button>
        </div>
      )}

      {/* iOS でモーションアクセスが拒否された場合 */}
      {iosDenied && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
          {t.iosDenied}
        </div>
      )}

      {/* センサー非対応 */}
      {sensorAvailable === false && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {t.sensorError}
        </div>
      )}

      {/* センサー値が届いていない（PC・権限未許可など）*/}
      {measuring && sensorTimeout && !sensorLive && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
          {t.sensorNoData}
        </div>
      )}

      {/* 関節選択 */}
      <div className="mb-4" style={{ opacity: measuring && locked ? 0.5 : 1, pointerEvents: measuring && locked ? 'none' : 'auto' }}>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          {t.select}
        </label>
        <div className="relative">
          <button
            onClick={() => setSelectOpen(!selectOpen)}
            disabled={measuring && locked}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-800 font-medium text-sm"
          >
            <span>
              {lang === 'ja'
                ? `${motion.joint_ja} — ${motion.motion_ja}`
                : `${motion.joint_en} — ${motion.motion_en}`}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${selectOpen ? 'rotate-180' : ''}`} />
          </button>

          {selectOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-auto max-h-72">
              {Object.entries(jointGroups).map(([groupName, items]) => (
                <div key={groupName}>
                  <div className="px-4 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                    {groupName}
                  </div>
                  {items.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => {
                        selectJoint(j.id)
                        setSelectOpen(false)
                        handleReset()
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        j.id === selectedId
                          ? 'bg-teal-50 text-teal-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {lang === 'ja' ? j.motion_ja : j.motion_en}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* まとめて計測モード: 項目選択 → 連続計測 → 確認・一括保存 */}
      {!batchMode && !measuring && (
        <button
          onClick={openBatchSelect}
          disabled={!linkedPatientId}
          className="w-full mb-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-md active:scale-95 transition-transform disabled:opacity-40 disabled:from-slate-300 disabled:to-slate-300"
        >
          <ListChecks className="w-4 h-4" />
          {t.batchBtn}
        </button>
      )}

      {batchMode && (
        <div className="mb-4 bg-white rounded-2xl shadow-sm border-2 border-indigo-200 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-sm text-indigo-900">
              {batchStage === 'select'
                ? t.batchSelectTitle
                : batchStage === 'review'
                ? t.batchReviewTitle
                : `${lang === 'ja' ? '計測中' : 'Measuring'}: ${batchIdx + 1}/${batchSelectedIds.length}`}
            </h3>
            <button
              onClick={cancelBatch}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              {t.batchCancel}
            </button>
          </div>

          {/* ── 項目選択 ── */}
          {batchStage === 'select' && (
            <>
              <p className="text-[11px] text-slate-500 mb-2">{t.batchPresetHint}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.entries(jointGroups).map(([groupName, items]) => (
                  <button
                    key={groupName}
                    onClick={() => setBatchSelectedIds(items.map(j => j.id))}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-semibold hover:bg-indigo-100 transition-colors"
                  >
                    {groupName}
                  </button>
                ))}
                <button
                  onClick={() => setBatchSelectedIds(JOINTS.map(j => j.id))}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold hover:bg-slate-200 transition-colors"
                >
                  {t.batchSelectAll}
                </button>
                <button
                  onClick={() => setBatchSelectedIds([])}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold hover:bg-slate-200 transition-colors"
                >
                  {t.batchClearAll}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 mb-3">
                {Object.entries(jointGroups).map(([groupName, items]) => (
                  <div key={groupName}>
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50">
                      {groupName}
                    </div>
                    {items.map(j => {
                      const checked = batchSelectedIds.includes(j.id)
                      return (
                        <button
                          key={j.id}
                          onClick={() => toggleBatchJoint(j.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                            checked ? 'bg-indigo-50 text-indigo-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                            checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                          }`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          {lang === 'ja' ? j.motion_ja : j.motion_en}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 mb-2">
                {batchSelectedIds.length === 0
                  ? t.batchNoneSelected
                  : t.batchSelectedCount(batchSelectedIds.length)}
              </p>
              <button
                onClick={() => startBatchMeasure(batchSelectedIds)}
                disabled={batchSelectedIds.length === 0}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
              >
                {t.batchStart}
              </button>
            </>
          )}

          {/* ── 連続計測 ── */}
          {batchStage === 'measure' && batchIdx < batchSelectedIds.length && (
            <>
              <p className="text-xs text-slate-500 mb-3">
                {lang === 'ja' ? `${batchIdx + 1}番目: ` : `${batchIdx + 1}/${batchSelectedIds.length}: `}
                {lang === 'ja'
                  ? `${JOINTS.find(j => j.id === batchSelectedIds[batchIdx])?.joint_ja} ${JOINTS.find(j => j.id === batchSelectedIds[batchIdx])?.motion_ja}`
                  : `${JOINTS.find(j => j.id === batchSelectedIds[batchIdx])?.joint_en} ${JOINTS.find(j => j.id === batchSelectedIds[batchIdx])?.motion_en}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={skipBatchItem}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm active:scale-95 transition-transform"
                >
                  {t.batchSkip}
                </button>
                <button
                  onClick={nextBatchItem}
                  disabled={!measuring}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-40"
                >
                  {batchIdx + 1 === batchSelectedIds.length ? t.batchToReview : t.batchConfirm}
                </button>
              </div>
            </>
          )}

          {/* ── 確認・一括保存 ── */}
          {batchStage === 'review' && (
            <>
              <p className="text-[11px] text-slate-500 mb-2">
                {t.batchMeasuredCount(Object.keys(batchResults).length, batchSelectedIds.length)}
              </p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 mb-3">
                {batchSelectedIds.map((id, idx) => {
                  const j = JOINTS.find(x => x.id === id)
                  const r = batchResults[id]
                  return (
                    <div key={id} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          {lang === 'ja' ? `${j?.joint_ja} ${j?.motion_ja}` : `${j?.joint_en} ${j?.motion_en}`}
                        </p>
                        <p className={`text-sm font-bold ${r != null ? 'text-teal-600' : 'text-slate-300'}`}>
                          {r != null ? `${r.angle}°${r.zeroed ? ' (0°基準)' : ''}` : t.batchUnmeasured}
                        </p>
                      </div>
                      <button
                        onClick={() => redoBatchItem(idx)}
                        className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold hover:bg-slate-200 transition-colors"
                      >
                        {r != null ? t.batchRedo : t.batchMeasureOne}
                      </button>
                    </div>
                  )
                })}
              </div>
              <input
                value={batchCommonNote}
                onChange={(e) => setBatchCommonNote(e.target.value)}
                placeholder={t.batchNoteHolder}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 mb-2
                  focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button
                onClick={saveBatchResults}
                disabled={Object.keys(batchResults).length === 0}
                className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
              >
                {Object.keys(batchResults).length === 0
                  ? t.batchNoResult
                  : `${t.batchSaveAll}（${Object.keys(batchResults).length}）`}
              </button>
            </>
          )}
        </div>
      )}

      {/* 患者カルテ連携（任意）: 選択すると保存時にROM記録へそのまま反映 */}
      <div className="mb-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-4" style={{ opacity: measuring && locked ? 0.5 : 1, pointerEvents: measuring && locked ? 'none' : 'auto' }}>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          <UserRound className="w-3.5 h-3.5 text-teal-500" />
          {t.linkTitle}
        </label>
        <div className="flex items-center gap-2">
          <select
            value={linkedPatientId}
            onChange={(e) => setLinkedPatientId(e.target.value)}
            className="flex-1 min-w-0 text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700
              focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">{t.linkNone}</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.diagnosisLabel || p.mainComplaint || '—'}）
              </option>
            ))}
          </select>
          {linkedPatientId && (
            <div className="flex rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
              {([['right', t.sideRight], ['left', t.sideLeft]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSide(key)}
                  className={`text-sm px-3.5 py-2.5 font-bold transition-colors ${
                    side === key ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {reflectedFlash && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 mt-2">
            <Check className="w-3.5 h-3.5" />
            {t.reflected}
          </p>
        )}
      </div>

      {/* メイン計測カード */}
      <div className={`bg-white rounded-2xl shadow-sm border-2 p-5 mb-4 transition-colors ${
        locked ? 'border-red-300 bg-red-50' : 'border-slate-200'
      }`}>
        {/* ロック表示 */}
        {measuring && (
          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              {locked ? (
                <><Lock className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-red-700">{t.lockOn}</span></>
              ) : (
                <><LockOpen className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-700">{t.lockOff}</span></>
              )}
            </div>
            <button
              onClick={toggleLock}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                locked
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {locked ? <><Lock className="w-3.5 h-3.5" />{t.lockRelease}</> : <><LockOpen className="w-3.5 h-3.5" />{t.lockApply}</>}
            </button>
          </div>
        )}

        {/* 角度表示 */}
        <div className="text-center mb-4">
          <div
            className="text-7xl font-black tracking-tighter leading-none"
            style={{
              color: measuring && angle > 0 ? '#0d9488' : '#1e3a5f',
            }}
          >
            {angle}
            <span className="text-3xl font-bold text-slate-400">°</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t.current}</p>

          {/* 評価バッジ（伸展系は 0° が最良なので angle > 0 を条件にしない） */}
          {measuring && sensorLive && (
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold border ${evaluation.bg} ${evaluation.color}`}>
              {evaluation.label}
            </span>
          )}
        </div>

        {/* ゲージ */}
        <AngleGauge
          angle={angle}
          normal={motion.rom.normal}
          min={motion.rom.min}
        />
        {isExtensionType ? (
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 mb-4">
            <span className="text-teal-500">{t.gaugeIdeal}</span>
            <span className="text-amber-500">{t.gaugeTolerance} {extLimitTolerance}°</span>
            <span className="text-red-400">{t.gaugeRestricted}</span>
          </div>
        ) : (
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 mb-4">
            <span>0°</span>
            <span className="text-amber-500">min {motion.rom.min}°</span>
            <span className="text-teal-500">norm {motion.rom.normal}°</span>
          </div>
        )}

        {/* 伸展系は数値の意味が屈曲系と逆なので明示する */}
        {isExtensionType && measuring && (
          <p className="text-center text-[10px] text-slate-500 -mt-2 mb-3 leading-relaxed">
            {t.extensionHint}
          </p>
        )}

        {/* 前回差分（伸展系は数値が減るほど改善なので向きを反転する） */}
        {diff !== null && measuring && (
          <div className="flex items-center justify-center gap-1.5 mb-4 text-sm font-semibold">
            {diff === 0 ? (
              <Minus className="w-4 h-4 text-slate-400" />
            ) : diffImproved ? (
              <TrendingUp className="w-4 h-4 text-teal-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span
              className={
                diff === 0 ? 'text-slate-500' : diffImproved ? 'text-teal-600' : 'text-red-600'
              }
            >
              {t.prevDiff}: {diff > 0 ? '+' : ''}{Math.round(diff * 10) / 10}°
            </span>
          </div>
        )}

        {/* 計測方式が前回と異なる場合は差分を出さず、理由を示す */}
        {diffMethodMismatch && measuring && (
          <p className="text-center text-[11px] text-slate-400 mb-4 leading-relaxed">
            {t.diffMethodMismatch}
          </p>
        )}

        {/* 操作指示 */}
        {measuring && (
          <p className="text-center text-xs text-slate-500 mb-3 animate-pulse">
            {t.tiltInstruction}
          </p>
        )}

        {/* ゼロセット（開始肢位を0°基準にするアタッチメント機能） */}
        {measuring && (
          zeroSet ? (
            <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl
              bg-indigo-50 border border-indigo-200">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                <Crosshair className="w-3.5 h-3.5" />
                {t.zeroActive}
              </span>
              <button
                onClick={clearZero}
                className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 underline"
              >
                {t.zeroClear}
              </button>
            </div>
          ) : (
            <div className="mb-3">
              <button
                onClick={handleZeroSet}
                disabled={!sensorLive}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                  bg-white border-2 border-dashed border-indigo-300 text-indigo-600
                  font-bold text-sm active:scale-95 transition-transform hover:bg-indigo-50
                  disabled:opacity-40 disabled:active:scale-100 disabled:hover:bg-white"
              >
                <Crosshair className="w-4 h-4" />
                {t.zeroBtn}
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-1 leading-relaxed">
                {t.zeroHint}
              </p>
            </div>
          )
        )}

        {/* ボタン群 */}
        <div className="flex gap-2">
          {!measuring ? (
            <button
              onClick={() => {
                rawBufferRef.current = []
                rejectCountRef.current = 0
                emaRef.current = 0
                hasEmaRef.current = false
                setSensorTimeout(false)
                setMeasuring(true)
              }}
              disabled={sensorAvailable === false}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#1a5276] to-[#0d9488] text-white font-bold text-sm shadow-md active:scale-95 transition-transform disabled:opacity-40"
            >
              {t.measure}
            </button>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-medium text-sm active:scale-95 transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                {t.reset}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-teal-600 text-white font-bold text-sm shadow-md active:scale-95 transition-transform"
              >
                {savedFlash ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savedFlash ? t.saved : t.save}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm active:scale-95 transition-transform"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* メモ */}
        {measuring && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.noteHolder}
            rows={2}
            className="mt-3 w-full text-sm px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        )}
      </div>

      {/* 参考可動域 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
        <button
          onClick={() => setShowRef(!showRef)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-500" />
            {t.reference}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showRef ? 'rotate-180' : ''}`} />
        </button>
        {showRef && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            <div className="bg-teal-50 rounded-xl p-3 text-center border border-teal-100">
              <div className="text-2xl font-black text-teal-700">{motion.rom.normal}°</div>
              <div className="text-xs text-teal-600 font-medium mt-0.5">{t.normal}</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
              <div className="text-2xl font-black text-amber-700">{motion.rom.min}°</div>
              <div className="text-xs text-amber-600 font-medium mt-0.5">{t.functional}</div>
            </div>
          </div>
        )}
      </div>

      {/* 計測履歴 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700"
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-500" />
            {t.history}
            {measurements.filter((m) => m.motionId === motion.id).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold">
                {measurements.filter((m) => m.motionId === motion.id).length}
              </span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>

        {showHistory && (
          <div className="border-t border-slate-100">
            {measurements.filter((m) => m.motionId === motion.id).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">{t.noHistory}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {measurements
                  .filter((m) => m.motionId === motion.id)
                  .map((m, idx, arr) => {
                    const next = arr[idx + 1]
                    const d = next ? m.angle - next.angle : null
                    const date = new Date(m.date)
                    const dateStr =
                      lang === 'ja'
                        ? `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
                        : `${date.toLocaleString('en', { month: 'short', day: 'numeric' })} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`

                    return (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-shrink-0 text-center w-14">
                          <div className="text-xl font-black text-slate-800">{m.angle}°</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-500">{dateStr}</div>
                          {m.note && (
                            <div className="text-xs text-slate-600 truncate mt-0.5">{m.note}</div>
                          )}
                          {d !== null && (
                            <div
                              className={`text-xs font-semibold mt-0.5 ${
                                d > 0 ? 'text-teal-600' : d < 0 ? 'text-red-600' : 'text-slate-400'
                              }`}
                            >
                              {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {d > 0 ? '+' : ''}{d}°
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => deleteMeasurement(m.id)}
                          className="flex-shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    )
                  })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
