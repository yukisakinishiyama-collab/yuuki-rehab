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
} from 'lucide-react'

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

interface Measurement {
  id: string
  motionId: string
  angle: number
  date: string   // ISO string
  note: string
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

  // スムージング用バッファ
  const bufferRef = useRef<number[]>([])
  const BUFFER_SIZE = 12

  const motion = JOINTS.find((j) => j.id === selectedId)!

  // ─ センサーイベント ─
  const handleOrientation = useCallback(
    (e: DeviceOrientationEvent) => {
      if (!measuring) return
      const raw = motion.axis === 'beta' ? (e.beta ?? 0) : (e.gamma ?? 0)
      const val = motion.invert ? -raw : raw

      bufferRef.current.push(val)
      if (bufferRef.current.length > BUFFER_SIZE) {
        bufferRef.current.shift()
      }
      const avg =
        bufferRef.current.reduce((a, b) => a + b, 0) /
        bufferRef.current.length
      setAngle(Math.round(Math.abs(avg)))
    },
    [measuring, motion]
  )

  useEffect(() => {
    window.addEventListener('deviceorientation', handleOrientation, true)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }, [handleOrientation])

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
      }
    } catch {}
  }

  // ─ リセット ─
  function handleReset() {
    bufferRef.current = []
    setAngle(0)
    setMeasuring(false)
  }

  // ─ 保存 ─
  function handleSave() {
    const m: Measurement = {
      id: Date.now().toString(),
      motionId: motion.id,
      angle,
      date: new Date().toISOString(),
      note,
    }
    const updated = [m, ...measurements]
    setMeasurements(updated)
    saveMeasurements(updated)
    setNote('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1800)
    setMeasuring(false)
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
  const diff =
    prevMeasurement !== undefined ? angle - prevMeasurement.angle : null

  // ─ 評価 ─
  const evaluation =
    angle >= motion.rom.normal * 0.9
      ? { label: t.excellent, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' }
      : angle >= motion.rom.min
      ? { label: t.limited, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
      : { label: t.severely, color: 'text-red-600', bg: 'bg-red-50 border-red-200' }

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

      {/* センサー非対応 */}
      {sensorAvailable === false && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {t.sensorError}
        </div>
      )}

      {/* 関節選択 */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          {t.select}
        </label>
        <div className="relative">
          <button
            onClick={() => setSelectOpen(!selectOpen)}
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
                        setSelectedId(j.id)
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

      {/* メイン計測カード */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-4">
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

          {/* 評価バッジ */}
          {measuring && angle > 0 && (
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
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 mb-4">
          <span>0°</span>
          <span className="text-amber-500">min {motion.rom.min}°</span>
          <span className="text-teal-500">norm {motion.rom.normal}°</span>
        </div>

        {/* 前回差分 */}
        {diff !== null && measuring && (
          <div className="flex items-center justify-center gap-1.5 mb-4 text-sm font-semibold">
            {diff > 0 ? (
              <TrendingUp className="w-4 h-4 text-teal-500" />
            ) : diff < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Minus className="w-4 h-4 text-slate-400" />
            )}
            <span
              className={
                diff > 0
                  ? 'text-teal-600'
                  : diff < 0
                  ? 'text-red-600'
                  : 'text-slate-500'
              }
            >
              {t.prevDiff}: {diff > 0 ? '+' : ''}{diff}°
            </span>
          </div>
        )}

        {/* 操作指示 */}
        {measuring && (
          <p className="text-center text-xs text-slate-500 mb-3 animate-pulse">
            {t.tiltInstruction}
          </p>
        )}

        {/* ボタン群 */}
        <div className="flex gap-2">
          {!measuring ? (
            <button
              onClick={() => {
                bufferRef.current = []
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
