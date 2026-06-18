'use client'

import type { ExpertOpinion } from '@/types/protocol'
import {
  Cpu, CheckCircle, AlertTriangle,
  Activity, Stethoscope, Dumbbell, User,
} from 'lucide-react'

interface Props {
  discussion: ExpertOpinion[]
  consensusNotes: string
  generatedBy: 'ai' | 'template'
}

/**
 * 役割ごとの視覚スタイル
 * 左ボーダーアクセント＋テキスト色の組み合わせで各専門家を識別。
 * グラデーション背景は使わない（§1.4 禁止事項準拠）。
 */
const ROLE_STYLE: Record<string, {
  border: string       /* 左ボーダー色 */
  label: string        /* ラベル文字色 */
  dot: string          /* 推奨箇条点色 */
  Icon: React.ComponentType<{ className?: string }>
}> = {
  '膝専門PT':               { border: 'border-l-teal-600',   label: 'text-teal-700',  dot: 'bg-teal-500',   Icon: Activity },
  '理学療法士':              { border: 'border-l-teal-600',   label: 'text-teal-700',  dot: 'bg-teal-500',   Icon: Activity },
  'スポーツ整形外科医':      { border: 'border-l-slate-700',  label: 'text-slate-700', dot: 'bg-slate-500',  Icon: Stethoscope },
  '整形外科医':              { border: 'border-l-slate-700',  label: 'text-slate-700', dot: 'bg-slate-500',  Icon: Stethoscope },
  'S&Cコーチ視点':           { border: 'border-l-amber-700',  label: 'text-amber-800', dot: 'bg-amber-600',  Icon: Dumbbell },
  'アスレティックトレーナー':{ border: 'border-l-amber-700',  label: 'text-amber-800', dot: 'bg-amber-600',  Icon: Dumbbell },
  '足関節専門PT':            { border: 'border-l-teal-600',   label: 'text-teal-700',  dot: 'bg-teal-500',   Icon: Activity },
  '肩専門PT':                { border: 'border-l-teal-600',   label: 'text-teal-700',  dot: 'bg-teal-500',   Icon: Activity },
  '脊椎専門PT':              { border: 'border-l-teal-600',   label: 'text-teal-700',  dot: 'bg-teal-500',   Icon: Activity },
}

const DEFAULT_STYLE = {
  border: 'border-l-slate-400',
  label: 'text-slate-600',
  dot: 'bg-slate-400',
  Icon: User,
}

function getStyle(role: string) {
  return ROLE_STYLE[role] ?? DEFAULT_STYLE
}

export default function ExpertPanel({ discussion, consensusNotes, generatedBy }: Props) {
  return (
    <div className="space-y-4">

      {/* AI生成バッジ — 中立スレート（紫青グラデーションは使わない） */}
      {generatedBy === 'ai' && (
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600
          bg-slate-100 border border-slate-200 rounded-full px-3.5 py-1.5 font-display">
          <Cpu className="w-3.5 h-3.5" />
          AI 生成 · 要臨床確認
        </div>
      )}

      {/* 専門家見解リスト — 縦積み＋最大2列（§1.3 均等3列グリッド禁止） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {discussion.map((expert, i) => {
          const style = getStyle(expert.role)
          const { Icon } = style
          return (
            <div
              key={i}
              className={`bg-[--color-surface-card] rounded-xl border border-slate-200
                border-l-4 ${style.border} overflow-hidden`}
            >
              {/* ヘッダー — 背景は白のまま。左ボーダーと役割アイコンで識別 */}
              <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0
                  ${style.border.replace('border-l-', 'border-')} bg-slate-50`}>
                  <Icon className={`w-4 h-4 ${style.label}`} />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-bold font-display leading-tight ${style.label}`}>
                    {expert.role}
                  </div>
                  <div className="text-xs text-[--color-text-muted] font-body mt-0.5 leading-snug">
                    {expert.focus}
                  </div>
                </div>
              </div>

              {/* 本文 */}
              <div className="p-4 space-y-3">
                {expert.recommendations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle className="w-3 h-3 text-[--color-primary]" />
                      <span className="text-[10px] font-bold text-[--color-text-secondary] font-display
                        tracking-widest uppercase">推奨</span>
                    </div>
                    <ul className="space-y-1.5">
                      {expert.recommendations.map((r, j) => (
                        <li key={j} className="flex gap-2 text-xs text-[--color-text-primary] font-body leading-relaxed">
                          <span className={`w-1 h-1 rounded-full ${style.dot} flex-shrink-0 mt-1.5`} />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {expert.cautions.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-700 font-display
                        tracking-widest uppercase">注意点</span>
                    </div>
                    <ul className="space-y-1.5">
                      {expert.cautions.map((c, j) => (
                        <li key={j} className="flex gap-2 text-xs text-amber-800 font-body leading-relaxed">
                          <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 統合コンセンサス — 左ボーダーアクセント。グラデーション背景不使用 */}
      {consensusNotes && (
        <div className="rounded-xl border border-slate-200 border-l-4 border-l-[--color-primary] p-5">
          <div className="text-[10px] font-bold text-[--color-primary] font-display
            tracking-widest uppercase mb-2">統合コンセンサス</div>
          <p className="text-sm text-[--color-text-primary] font-body leading-relaxed">
            {consensusNotes}
          </p>
        </div>
      )}

      {/* 専門家なし */}
      {discussion.length === 0 && (
        <div className="text-center py-12 text-[--color-text-muted] font-body">
          <Cpu className="w-7 h-7 mx-auto mb-2 opacity-25" />
          <div className="text-sm">専門家ディスカッションは AI 生成プロトコルで利用できます</div>
        </div>
      )}
    </div>
  )
}
