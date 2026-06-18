'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Target, CheckCircle, RotateCcw, Smartphone, AlertCircle, Info } from 'lucide-react'
import type { JointType } from '@/types/rom'
import { JOINT_LABELS } from '@/types/rom'

type SensorAxis = 'beta' | 'gamma' | 'alpha'

// 運動方向からセンサー軸を決定
function getSensorAxis(direction: string): SensorAxis {
  if (/外旋|内旋|回旋/.test(direction)) return 'alpha'
  if (/外転|内転|側屈|橈屈|尺屈|回内|回外|内反|外反/.test(direction)) return 'gamma'
  return 'beta'
}

const AXIS_LABELS: Record<SensorAxis, string> = {
  beta: '前後方向（屈伸）',
  gamma: '左右方向（外転・側屈）',
  alpha: '回旋方向（コンパス）',
}

const PLACEMENT_GUIDES: Record<JointType, string> = {
  cervical: '側頭部〜頭頂部にスマホを当ててください',
  shoulder: '上腕外側（三角筋部）に縦に当ててください',
  elbow: '前腕の背面に縦に当ててください',
  forearm: '前腕に横に当ててください',
  wrist: '手の甲に縦に当ててください',
  finger: '指の背側に縦に当ててください',
  thoracolumbar: '脊柱に沿って背中に縦に当ててください',
  hip: '大腿前面に縦に当ててください',
  knee: 'すねの前（脛骨前面）に縦に当ててください',
  ankle: '足の甲に縦に当ててください',
  toe: '足趾の背側に縦に当ててください',
}

function getAxisVal(e: DeviceOrientationEvent, axis: SensorAxis): number {
  if (axis === 'beta') return e.beta ?? 0
  if (axis === 'gamma') return e.gamma ?? 0
  return e.alpha ?? 0
}

// 移動平均でノイズ除去
function smooth(buf: number[], val: number, size = 10): number {
  buf.push(val)
  if (buf.length > size) buf.shift()
  return buf.reduce((a, b) => a + b, 0) / buf.length
}

type Phase = 'permission' | 'place' | 'measure' | 'confirmed'

interface Props {
  joint: JointType
  direction: string
  onConfirm: (angle: number) => void
  onClose: () => void
}

export default function SensorROMModal({ joint, direction, onConfirm, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('permission')
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [liveAngle, setLiveAngle] = useState(0)
  const [confirmedAngle, setConfirmedAngle] = useState<number | null>(null)

  const axis = getSensorAxis(direction)
  const zeroRef = useRef<number | null>(null)
  const latestRaw = useRef<number>(0)
  const smoothBuf = useRef<number[]>([])
  const phaseRef = useRef<Phase>('permission')

  // phaseRef をリアルタイム同期
  useEffect(() => { phaseRef.current = phase }, [phase])

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const raw = getAxisVal(e, axis)
    latestRaw.current = raw

    if (phaseRef.current === 'measure' && zeroRef.current !== null) {
      let diff = raw - zeroRef.current
      // alpha (0〜360°) のラップアラウンド処理
      if (axis === 'alpha') {
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
      }
      const smoothed = smooth(smoothBuf.current, Math.abs(diff))
      setLiveAngle(Math.round(smoothed))
    }
  }, [axis])

  // センサー登録・解除
  useEffect(() => {
    if (phase === 'place' || phase === 'measure') {
      window.addEventListener('deviceorientation', handleOrientation, true)
    }
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
    }
  }, [phase, handleOrientation])

  // Android・非iOSは即座にplace画面へ
  useEffect(() => {
    const needsPermission = typeof (DeviceOrientationEvent as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    if (!needsPermission) setPhase('place')
  }, [])

  async function requestPermission() {
    const req = (DeviceOrientationEvent as { requestPermission?: () => Promise<string> }).requestPermission
    if (typeof req === 'function') {
      try {
        const result = await req()
        if (result === 'granted') {
          setPhase('place')
        } else {
          setPermissionDenied(true)
        }
      } catch {
        setPermissionDenied(true)
      }
    } else {
      setPhase('place')
    }
  }

  function handleCalibrate() {
    zeroRef.current = latestRaw.current
    smoothBuf.current = []
    setLiveAngle(0)
    setPhase('measure')
  }

  function handleConfirm() {
    setConfirmedAngle(liveAngle)
    setPhase('confirmed')
  }

  function handleRetry() {
    zeroRef.current = null
    smoothBuf.current = []
    setLiveAngle(0)
    setConfirmedAngle(null)
    setPhase('place')
  }

  const guide = PLACEMENT_GUIDES[joint]

  // 角度に応じた色
  const angleColor =
    liveAngle >= 100 ? 'text-green-600' :
    liveAngle >= 60  ? 'text-teal-600' :
    liveAngle >= 30  ? 'text-yellow-600' :
    'text-slate-700'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-teal-200 text-xs mb-0.5">📱 スマホセンサー計測</p>
            <h2 className="text-white font-bold text-xl">{direction}</h2>
            <p className="text-teal-100 text-xs">{JOINT_LABELS[joint]}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ① 許可拒否 */}
          {permissionDenied && (
            <div className="text-center space-y-3 py-4">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
              <p className="font-bold text-slate-800">センサーの許可が必要です</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                iPhone の場合は<br />
                「設定 → Safari → モーションと画面の向き」<br />
                をオンにしてください
              </p>
              <button onClick={onClose} className="w-full bg-slate-100 text-slate-700 py-3 rounded-2xl font-medium">
                閉じる
              </button>
            </div>
          )}

          {/* ② iOS許可リクエスト */}
          {phase === 'permission' && !permissionDenied && (
            <div className="text-center space-y-4 py-2">
              <div className="w-20 h-20 bg-teal-50 rounded-3xl flex items-center justify-center mx-auto">
                <Smartphone className="w-10 h-10 text-teal-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg mb-2">センサーを使って計測します</p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  スマホを体の測定部位に当てると、傾きから関節角度を自動計算します。
                </p>
              </div>
              <button
                onClick={requestPermission}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-2xl font-bold text-base transition-colors"
              >
                センサーを許可する（iOSのみ）
              </button>
            </div>
          )}

          {/* ③ 配置ガイド */}
          {phase === 'place' && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto">
                <Target className="w-10 h-10 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg mb-3">スマホを当ててください</p>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">📍</span>
                    <div>
                      <p className="text-xs font-semibold text-blue-700 mb-0.5">置く場所</p>
                      <p className="text-sm text-slate-700">{guide}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">📐</span>
                    <div>
                      <p className="text-xs font-semibold text-blue-700 mb-0.5">計測軸</p>
                      <p className="text-sm text-slate-700">{AXIS_LABELS[axis]}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2 text-left">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  最初に<strong>基準姿勢（伸展位・解剖学的肢位）</strong>でスマホを当て、「ゼロ設定」を押してください
                </p>
              </div>
              <button
                onClick={handleCalibrate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-base transition-colors"
              >
                ゼロ設定（基準位置を記録）
              </button>
            </div>
          )}

          {/* ④ 計測中 */}
          {phase === 'measure' && (
            <div className="text-center space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">リアルタイム計測</p>
                <p className={`text-8xl font-black tabular-nums transition-colors duration-200 ${angleColor}`}>
                  {liveAngle}°
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {direction} ／ {JOINT_LABELS[joint]}
                </p>
              </div>

              {/* プログレスバー */}
              <div className="space-y-1">
                <div className="w-full bg-slate-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-100"
                    style={{ width: `${Math.min(100, (liveAngle / 180) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0°</span>
                  <span>90°</span>
                  <span>180°</span>
                </div>
              </div>

              <div className="bg-teal-50 rounded-xl p-3 text-sm text-teal-700 font-medium">
                💡 最大角度まで動かして止めてから「確定」を押してください
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRetry}
                  className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-2xl font-semibold transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  再測定
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white py-3.5 rounded-2xl font-bold transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  角度確定
                </button>
              </div>
            </div>
          )}

          {/* ⑤ 確認 */}
          {phase === 'confirmed' && confirmedAngle !== null && (
            <div className="text-center space-y-4 py-2">
              <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">計測結果</p>
                <p className="text-7xl font-black text-green-700">{confirmedAngle}°</p>
                <p className="text-slate-600 text-sm mt-1">{direction} ／ {JOINT_LABELS[joint]}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRetry}
                  className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-2xl font-semibold transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  やり直す
                </button>
                <button
                  onClick={() => onConfirm(confirmedAngle)}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-2xl font-bold transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  AROMに入力
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
