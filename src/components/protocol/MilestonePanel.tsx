'use client'

import { useState, useEffect } from 'react'
import type { Milestone } from '@/types/protocol'
import { achieveMilestone, getMilestones, initMilestones } from '@/lib/protocol-store'
import Confetti from './Confetti'
import { Flame, Trophy, CheckCircle, Target, Sparkles } from 'lucide-react'

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
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const ms = getMilestones(patientId)
    if (ms.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMilestones(initMilestones(patientId))
    } else {
      setMilestones(ms)
    }
    setStreak(Math.floor(Math.random() * 10) + 1)
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
              <Flame className="w-4 h-4 text-[--color-accent]" />
              <span className="metric text-2xl font-bold text-white">{streak}</span>
            </div>
            <div className="text-xs text-white/60 font-body">日連続</div>
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

          {milestones.map((m, i) => (
            <div
              key={m.id}
              className={`relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300 animate-slide-up ${
                m.achieved
                  ? 'bg-[--color-primary-light]/60 border-[--color-primary]/20'
                  : 'bg-[--color-surface-card] border-slate-200 hover:border-[--color-primary]/30 hover:shadow-sm'
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* タイムラインドット */}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                m.achieved
                  ? 'bg-[--color-primary] animate-achievement'
                  : 'bg-slate-100 border-2 border-slate-200'
              }`}>
                {m.achieved
                  ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                  : <span className="text-xs text-slate-400">{i + 1}</span>
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium font-display ${
                  m.achieved ? 'text-[--color-primary-hover]' : 'text-[--color-text-primary]'
                }`}>
                  {m.label}
                </div>
                {m.achieved && m.date && (
                  <div className="text-xs text-[--color-primary]/70 font-body mt-0.5">
                    {new Date(m.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} 達成
                  </div>
                )}
              </div>

              {m.achieved ? (
                <Trophy className="w-4 h-4 text-[--color-primary]/50 flex-shrink-0" />
              ) : (
                <button
                  onClick={() => handleAchieve(m.id)}
                  className="flex-shrink-0 text-xs bg-[--color-primary] text-white px-3 py-1.5 rounded-full
                    hover:bg-[--color-primary-hover] transition-colors font-display font-medium
                    focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-1"
                >
                  達成！
                </button>
              )}

              {celebrating === m.id && (
                <Sparkles className="w-4 h-4 text-[--color-accent] animate-bounce ml-1 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
