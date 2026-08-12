'use client'
// ──────────────────────────────────────────────
// 進捗マップ（患者さんと一緒に見る画面）
//
// フェーズを「ステージ」に見立てて、いまどこまで来たかを一目で分かるようにする。
// 各ステージには、運動のマーカー（できる／実施中）の内訳を帯で出す。
//
// 患者さんに見せるため、次を守る:
// - 治癒の保証や断定をしない
// - スタッフ向けの内部表現（要対応・リスクなど）を出さない
// - 実際より進んで見せない（計算側で切り捨てている）
// ──────────────────────────────────────────────
import type { Protocol } from '@/types/protocol'
import { calcProtocolProgress, progressMessage } from '@/lib/protocol-progress'
import { Trophy, Flag, Check } from 'lucide-react'

interface Props {
  protocol: Protocol
  /** 患者さんに見せる画面では、専門用語を減らして大きめに出す */
  patientFacing?: boolean
}

export default function ProtocolProgressMap({ protocol, patientFacing }: Props) {
  const p = calcProtocolProgress(protocol)
  if (p.phaseTotal === 0) return null

  const big = patientFacing

  return (
    <div className={`rounded-2xl border shadow-sm ${
      big ? 'bg-white border-slate-200 px-7 py-6' : 'bg-[--color-surface-card] border-slate-200 px-5 py-4'
    }`}>
      {/* 見出しと全体の達成率 */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Trophy className={`text-amber-500 ${big ? 'w-6 h-6' : 'w-4 h-4'}`} />
          <span className={`font-bold text-slate-700 ${
            big ? 'text-lg' : 'text-xs font-display uppercase tracking-widest text-[--color-text-secondary]'
          }`}>
            {big ? '回復のステージ' : '進捗マップ'}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`font-bold tabular-nums text-teal-600 ${big ? 'text-5xl' : 'text-3xl'}`}>
            {p.overallPercent}
          </span>
          <span className={`font-bold text-teal-600 ${big ? 'text-xl' : 'text-sm'}`}>%</span>
        </div>
      </div>

      {/* 全体バー */}
      <div className={`w-full rounded-full bg-slate-100 overflow-hidden ${big ? 'h-4' : 'h-2.5'}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-700"
          style={{ width: `${p.overallPercent}%` }}
        />
      </div>

      {/* ステージ（フェーズ） */}
      <div className={`mt-4 grid gap-2 ${big ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {p.phases.map(ph => {
          const tone =
            ph.state === 'done' ? 'border-teal-300 bg-teal-50'
            : ph.state === 'current' ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-200'
            : 'border-slate-200 bg-white'
          return (
            <div key={ph.index} className={`rounded-xl border px-3 py-2.5 ${tone}`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px]
                  font-bold flex-shrink-0 ${
                  ph.state === 'done' ? 'bg-teal-500 text-white'
                  : ph.state === 'current' ? 'bg-orange-500 text-white'
                  : 'bg-slate-200 text-slate-500'
                }`}>
                  {ph.state === 'done' ? <Check className="w-3.5 h-3.5" /> : ph.index + 1}
                </span>
                <span className={`font-semibold truncate ${big ? 'text-sm' : 'text-xs'} ${
                  ph.state === 'upcoming' ? 'text-slate-400' : 'text-slate-800'
                }`}>
                  {ph.title}
                </span>
                {ph.state === 'current' && (
                  <span className="ml-auto text-[10px] font-bold text-orange-600 flex items-center gap-0.5">
                    <Flag className="w-3 h-3" />いまここ
                  </span>
                )}
              </div>

              {/* 運動の内訳（できる／実施中／これから） */}
              {ph.exerciseTotal > 0 && (
                <>
                  <div className="mt-2 flex h-2 rounded-full overflow-hidden bg-slate-150 bg-slate-200">
                    <div className="bg-sky-400" style={{ width: `${(ph.able / ph.exerciseTotal) * 100}%` }} />
                    <div className="bg-teal-400" style={{ width: `${(ph.doing / ph.exerciseTotal) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                    {ph.able > 0 && <span className="text-sky-700 font-semibold">できる {ph.able}</span>}
                    {ph.doing > 0 && <span className="text-teal-700 font-semibold">実施中 {ph.doing}</span>}
                    <span className="text-slate-400">全{ph.exerciseTotal}種目</span>
                  </div>
                </>
              )}

              {/* 進行基準（スタッフ画面のみ。患者さんには数字を並べない） */}
              {!big && ph.criteriaTotal > 0 && (
                <div className="mt-1 text-[10px] text-slate-500">
                  移行基準 {ph.criteriaMet}/{ph.criteriaTotal}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* できるようになった数（がんばりの見える化） */}
      {p.ableTotal > 0 && (
        <p className={`mt-3 text-center ${big ? 'text-base text-slate-700' : 'text-xs text-slate-500'}`}>
          できるようになった運動{' '}
          <span className="font-bold text-sky-600 tabular-nums">{p.ableTotal}</span>
          <span className="text-slate-400"> / {p.exerciseTotal} 種目</span>
        </p>
      )}

      {big && (
        <p className="mt-2 text-center text-sm text-teal-700">{progressMessage(p)}</p>
      )}
    </div>
  )
}
