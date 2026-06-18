'use client'

import { useState, useMemo } from 'react'
import type { Protocol, Assessment, ProtocolPatient } from '@/types/protocol'
import MilestonePanel from './MilestonePanel'
import ProgressChart from './ProgressChart'
import { Eye, EyeOff, Star, ShieldAlert, Flame, Sprout, Activity, Dumbbell, Trophy } from 'lucide-react'

interface Props {
  patient: ProtocolPatient
  protocol: Protocol
  assessments: Assessment[]
}

const SIMPLE_WORDS: Record<string, string> = {
  'ROM': '関節の動く範囲',
  'LSI': '左右の筋力バランス',
  'MMT': '筋力テスト',
  'NRS': '痛みのレベル',
  'SLR': '脚上げ運動',
  'CKC': '足をつけた状態での運動',
  'ADL': '日常生活動作',
  '神経筋コントロール': '脳と筋肉の連携',
  '固有受容感覚': '体の位置感覚',
  '急性期': 'けがや手術の直後の時期',
  '回復期': '少しずつ回復している時期',
  '機能改善期': '筋力や動きを鍛える時期',
  '競技復帰期': 'スポーツに戻るための準備期間',
}

function simplify(text: string): string {
  let result = text
  for (const [term, plain] of Object.entries(SIMPLE_WORDS)) {
    result = result.replace(new RegExp(term, 'g'), `${term}(${plain})`)
  }
  return result
}

type IconComponent = React.ComponentType<{ className?: string }>

const PHASE_ENCOURAGEMENT: Record<number, { msg: string; Icon: IconComponent }> = {
  0: { msg: '回復のスタートです！毎日少しずつ積み上げましょう。', Icon: Sprout },
  1: { msg: 'よく頑張っています！少しずつ体が回復しています。',  Icon: Activity },
  2: { msg: 'いい調子です！筋力もついてきています。',            Icon: Dumbbell },
  3: { msg: 'ゴールが見えてきました！もうひと頑張り！',          Icon: Trophy },
}

export default function PatientView({ patient, protocol, assessments }: Props) {
  const [simpleMode, setSimpleMode] = useState(true)
  const currentPhase = protocol.phases[protocol.currentPhaseIndex]
  const encourage = PHASE_ENCOURAGEMENT[protocol.currentPhaseIndex] ?? { msg: 'よく頑張っています！', Icon: Activity }
  const progressPct = Math.round(((protocol.currentPhaseIndex + 0.5) / protocol.phases.length) * 100)
  // 受傷・手術からの経過日数（レンダー毎に呼ばれないよう useMemo で安定化）
  const daysSince = useMemo(() => {
    if (!patient.eventDate) return null
    // eslint-disable-next-line react-hooks/purity
    return Math.floor((Date.now() - new Date(patient.eventDate).getTime()) / 86400000)
  }, [patient.eventDate])

  function text(t: string) {
    return simpleMode ? simplify(t) : t
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 font-body">
      {/* やさしい言葉切替 */}
      <div className="flex items-center justify-between bg-[--color-surface-card] rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          {simpleMode
            ? <Eye className="w-4 h-4 text-[--color-primary]" />
            : <EyeOff className="w-4 h-4 text-slate-400" />
          }
          <span className="text-sm font-semibold text-[--color-text-primary] font-display">
            やさしい言葉モード
          </span>
        </div>
        <button
          role="switch"
          aria-checked={simpleMode}
          onClick={() => setSimpleMode(v => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:ring-2
            focus-visible:ring-[--color-primary] focus-visible:ring-offset-2
            ${simpleMode ? 'bg-[--color-primary]' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200
            ${simpleMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* ヒーローバナー */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[--color-navy] via-[--color-navy-800] to-teal-900 p-5 text-white">
        {/* 装飾 */}
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute right-4 bottom-0 w-20 h-20 rounded-full bg-[--color-primary]/20" />

        <div className="relative">
          <div className="text-xs text-white/60 font-display uppercase tracking-widest mb-1">
            リハビリプロトコル
          </div>
          <div className="text-2xl font-bold font-display mb-0.5">
            {patient.name ?? '患者さん'} のリハビリ
          </div>
          <div className="text-sm text-white/80 font-body">{text(protocol.title)}</div>

          {daysSince !== null && (
            <div className="flex items-center gap-2 mt-3 bg-white/10 rounded-xl px-3 py-2 w-fit">
              <Flame className="w-4 h-4 text-[--color-accent]" />
              <span className="text-sm font-body">
                受傷 / 手術から
                <strong className="metric ml-1.5 text-white">
                  {daysSince} 日目
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 励ましメッセージ */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50
        border border-[--color-accent-mid]/40 rounded-xl px-4 py-3.5">
        <div className="w-9 h-9 rounded-lg bg-[--color-accent]/10 flex items-center justify-center flex-shrink-0">
          <encourage.Icon className="w-5 h-5 text-[--color-accent]" />
        </div>
        <p className="text-sm text-orange-900 font-body leading-relaxed">{encourage.msg}</p>
      </div>

      {/* 現在のフェーズカード */}
      {currentPhase && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          {/* フェーズヘッダー */}
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-[--color-primary] text-white flex items-center
              justify-center text-sm font-bold flex-shrink-0 font-display">
              {currentPhase.order}
            </span>
            <div>
              <div className="text-[10px] text-[--color-text-muted] font-display uppercase tracking-widest">
                今いる段階
              </div>
              <div className="font-bold text-[--color-text-primary] font-display text-base leading-tight">
                {text(currentPhase.title)}
              </div>
            </div>
          </div>

          {/* 目標リスト */}
          {currentPhase.goals.length > 0 && (
            <div>
              <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-2">
                今の目標
              </div>
              <ul className="space-y-1.5">
                {currentPhase.goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[--color-text-primary] font-body">
                    <Star className="w-3.5 h-3.5 text-[--color-accent] flex-shrink-0 mt-0.5" />
                    {text(g)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 全体プログレス */}
          <div className="bg-[--color-surface-raised] rounded-xl px-4 py-3">
            <div className="flex justify-between text-xs text-[--color-text-secondary] mb-2 font-body">
              <span>全体の進み具合</span>
              <span className="metric font-semibold">
                フェーズ {protocol.currentPhaseIndex + 1} / {protocol.phases.length}
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[--color-primary] to-[--color-primary-mid] rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {/* フェーズドット */}
            <div className="flex justify-between mt-1.5 px-0.5">
              {protocol.phases.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i < protocol.currentPhaseIndex
                    ? 'bg-[--color-primary]'
                    : i === protocol.currentPhaseIndex
                      ? 'bg-[--color-primary] scale-125'
                      : 'bg-slate-200'
                }`} />
              ))}
            </div>
          </div>

          {protocol.phases[protocol.currentPhaseIndex + 1] && (
            <div className="text-xs text-[--color-text-muted] font-body">
              次の段階：{text(protocol.phases[protocol.currentPhaseIndex + 1].title)}
            </div>
          )}
        </div>
      )}

      {/* エクササイズ */}
      {currentPhase && currentPhase.exercises.length > 0 && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-3">
            今取り組む運動
          </div>
          <div className="space-y-2">
            {currentPhase.exercises.slice(0, 5).map((ex, i) => (
              <div key={i} className="flex items-center gap-3 bg-[--color-surface-raised] rounded-xl px-3 py-2.5">
                <span className="w-6 h-6 rounded-full bg-[--color-primary-light] text-[--color-primary-hover]
                  flex items-center justify-center text-xs font-bold flex-shrink-0 metric">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[--color-text-primary] font-display">{ex.name}</div>
                  {ex.dose && <div className="metric text-xs text-[--color-text-muted]">{ex.dose}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 進捗グラフ */}
      {assessments.length > 0 && (
        <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-3">
            回復の記録
          </div>
          <ProgressChart assessments={assessments} />
        </div>
      )}

      {/* マイルストーン */}
      <div className="bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-3">
          目標マイルストーン
        </div>
        <MilestonePanel patientId={patient.id} simpleMode />
      </div>

      {/* 赤旗 */}
      {currentPhase && currentPhase.redFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-red-700 font-display mb-2">
            <ShieldAlert className="w-4 h-4" />こんなときはすぐ相談を
          </div>
          <ul className="space-y-1">
            {currentPhase.redFlags.map((r, i) => (
              <li key={i} className="text-sm text-red-800 font-body flex items-start gap-1.5">
                <span className="text-red-400 font-bold flex-shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 免責 */}
      <div className="text-xs text-[--color-text-muted] text-center pb-4 font-body">
        このページはリハビリの支援情報です。最終判断は担当の先生・療法士に相談してください。
      </div>
    </div>
  )
}
