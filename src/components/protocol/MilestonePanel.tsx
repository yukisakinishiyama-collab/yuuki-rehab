'use client'

import { useState, useEffect } from 'react'
import type { Milestone } from '@/types/protocol'
import { achieveMilestone, getMilestones, initMilestones, getAssessments } from '@/lib/protocol-store'
import Confetti from './Confetti'
import { ClipboardCheck, Trophy, CheckCircle, Target, Sparkles } from 'lucide-react'

interface Props {
  patientId: string
  simpleMode?: boolean
}

const ENCOURAGE_MESSAGES = [
  'よく頑張っています！次の目標まであと少し！',
  '着実に回復しています。この調子で続けましょう！',
  '毎日の積み重ねが回復につながります。',
  '順調に進んでいます。焦らず一歩一歩！',
]

export default function MilestonePanel({ patientId, simpleMode }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [celebrating, setCelebrating] = useState<string | null>(null)
  const [recordCount, setRecordCount] = useState(0)

  useEffect(() => {
    const ms = getMilestones(patientId)
    if (ms.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMilestones(initMilestones(patientId))
    } else {
      setMilestones(ms)
    }
    // 実データ: この患者の評価記録の回数
    setRecordCount(getAssessments(patientId).length)
  }, [patientId])

  function handleAchieve(id: string) {
    achieveMilestone(id)
    setMilestones(getMilestones(patientId))
    setCelebrating(id)
    setTimeout(() => setCelebrating(null), 3500)
  }

  const achieved = milestones.filter(m => m.achieved).length
  const total = milestones.length
  const pct = total === 0 ? 0 : Math.round((achieved / total) * 100)
  const nextMilestone = milestones.find(m => !m.achieved)
  const msg = ENCOURAGE_MESSAGES[achieved % ENCOURAGE_MESSAGES.length]

  // シンプルモード（患者ビューのサマリー）
  if (simpleMode) {
    return (
      <div className="flex flex-wrap gap-2">
        {milestones.map(m => (
          <div
            key={m.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all font-body ${
              m.achieved
                ? 'bg-[--color-primary-light] border-[--color-primary]/30 text-[--color-primary-hover]'
                : 'bg-[--color-surface-raised] border-slate-200 text-[--color-text-muted]'
            }`}
          >
            <CheckCircle className={`w-3 h-3 flex-shrink-0 ${m.achieved ? 'text-[--color-primary]' : 'text-slate-300'}`} />
            <span>{m.label}</span>
            {m.achieved && <CheckCircle className="w-3 h-3 text-[--color-primary]" />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {celebrating && <Confetti />}

      {/* サマリーバナー */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[--color-navy] to-[--color-navy-800] p-5 text-white">
        {/* 背景装飾 */}
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-[--color-primary]/20" />

        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-xs text-white/60 font-display uppercase tracking-widest mb-1">
              回復の旅
            </div>
            <div className="metric text-3xl font-bold text-white mb-0.5">{pct}%</div>
            <div className="text-xs text-white/70 font-body">
              {achieved} / {total} マイルストーン達成
            </div>
          </div>
          <div className="text-center bg-white/10 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <ClipboardCheck className="w-4 h-4 text-[--color-accent]" />
              <span className="metric text-2xl font-bold text-white">{recordCount}</span>
            </div>
            <div className="text-xs text-white/60 font-body">評価記録</div>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="relative mt-4">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[--color-primary-mid] to-[--color-primary] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* マイルストーンマーカー */}
          <div className="flex justify-between mt-1.5">
            {milestones.map(m => (
              <div
                key={m.id}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  m.achieved ? 'bg-[--color-primary-mid] scale-125' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        <p className="text-xs text-white/60 mt-3 font-body italic">{msg}</p>
      </div>

      {/* 次の目標 */}
      {nextMilestone && (
        <div className="flex items-center gap-3 bg-[--color-accent-light] border border-[--color-accent-mid]/40 rounded-xl px-4 py-3.5 animate-slide-up">
          <div className="w-10 h-10 rounded-lg border border-[--color-accent-mid]/40 bg-[--color-accent-light]
            flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-[--color-accent]" />
          </div>
          <div>
            <div className="text-xs text-[--color-accent] font-display font-bold uppercase tracking-wide">
              次の目標
            </div>
            <div className="text-sm font-semibold text-orange-900 font-display">
              {nextMilestone.label}
            </div>
          </div>
        </div>
      )}

      {/* マイルストーンタイムライン */}
      <div>
        <h3 className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest mb-3">
          マイルストーン
        </h3>
        <div className="relative space-y-2">
          {/* タイムラインライン */}
          <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-slate-100" />

          {milestones.map((m, i) => {
            const isNext = !m.achieved && milestones.findIndex(x => !x.achieved) === i
            return (
            <div
              key={m.id}
              className={`relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300 animate-slide-up ${
                m.achieved
                  ? 'bg-[--color-primary] border border-[--color-primary] shadow-sm'
                  : isNext
                    ? 'bg-white border-2 border-dashed border-[--color-accent] shadow-sm'
                    : 'bg-[--color-surface-card] border border-slate-200 hover:border-[--color-primary]/30 hover:shadow-sm'
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* つぎの目標バッジ */}
              {isNext && (
                <span className="absolute -top-2.5 left-3 text-[9px] font-bold text-white
                  bg-[--color-accent] px-2 py-0.5 rounded-full font-display tracking-wide shadow-sm">
                  NEXT
                </span>
              )}

              {/* タイムラインドット（達成: 白丸+チェック / 未達成: 番号） */}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                m.achieved
                  ? 'bg-white animate-achievement'
                  : isNext
                    ? 'bg-[--color-accent-light] border-2 border-[--color-accent]'
                    : 'bg-slate-100 border-2 border-slate-200'
              }`}>
                {m.achieved
                  ? <CheckCircle className="w-4 h-4 text-[--color-primary]" />
                  : <span className={`text-xs font-bold ${isNext ? 'text-[--color-accent]' : 'text-slate-400'}`}>{i + 1}</span>
                }
              </div>

              {/* マイルストーンアイコン */}
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                m.achieved ? 'bg-white/20' : 'bg-[--color-surface-raised]'
              }`}>
                <span className={m.achieved || isNext ? '' : 'grayscale opacity-40'}>{m.icon ?? '⭐'}</span>
              </span>

              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold font-display ${
                  m.achieved ? 'text-white' : isNext ? 'text-orange-900' : 'text-[--color-text-muted]'
                }`}>
                  {m.label}
                </div>
                {m.achieved && m.date && (
                  <div className="metric text-xs text-white/75 mt-0.5">
                    {new Date(m.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} 達成
                  </div>
                )}
              </div>

              {m.achieved ? (
                <Trophy className="w-4 h-4 text-white/70 flex-shrink-0" />
              ) : (
                <button
                  onClick={() => handleAchieve(m.id)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors
                    font-display font-bold focus-visible:ring-2 focus-visible:ring-offset-1 ${
                    isNext
                      ? 'bg-[--color-accent] text-white hover:opacity-90 focus-visible:ring-[--color-accent]'
                      : 'bg-[--color-primary] text-white hover:bg-[--color-primary-hover] focus-visible:ring-[--color-primary]'
                  }`}
                >
                  達成！
                </button>
              )}

              {celebrating === m.id && (
                <Sparkles className="w-4 h-4 text-[--color-accent] animate-bounce ml-1 flex-shrink-0" />
              )}
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}
