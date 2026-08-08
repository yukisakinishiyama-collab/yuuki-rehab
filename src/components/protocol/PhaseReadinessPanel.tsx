'use client'
// ──────────────────────────────────────────────
// フェーズ進行の準備状況パネル（NextGen v2.1）
//
// 現在フェーズの進行基準を、連携カルテの実測値（ROM・筋力LSI/MMT・NRS）と
// 自動照合して表示する。達成の「正」は施術者の手動チェックのままで、
// 実測が基準を満たしている場合は「チェックする」の提案だけを出す
// （実測照合が勝手に達成扱いにすることはない）。
// あわせて、未測定・測定が古い基準を「再評価のおすすめ」として提示する。
//
// 安全設計:
// - どの記録と照合したか（記録名・筋名・左右）を必ずバッジに表示する
// - 左右の記録混在・複数筋など照合先を特定できない基準は判定しない（曖昧表示）
// - PhaseCard が編集モードの間はチェック操作をロックする
//   （編集保存が draft 全体を書き戻すため、並行変更が無言で巻き戻るのを防ぐ）
// ──────────────────────────────────────────────
import { useMemo } from 'react'
import type { Protocol, ProtocolPatient } from '@/types/protocol'
import type { MMTGrade, StrengthRecord } from '@/types/patient'
import { updatePhase } from '@/lib/protocol-store'
import { resolveChartPatient, JOINT_TO_REGION } from '@/lib/clinical-sync'
import { getROMRecords, getStrengthRecords, getEvaluations } from '@/lib/patient-store'
import {
  evaluateCriteria, buildReassessmentSuggestions, formatThreshold, AMBIGUITY_LABELS,
  type MeasuredEvidence,
} from '@/lib/criteria-engine'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { Gauge, BellRing, Check, Link2Off, Lock } from 'lucide-react'

function mmtToNumber(g: MMTGrade): number {
  switch (g) {
    case '4-': return 3.7
    case '4+': return 4.3
    case '5-': return 4.7
    default: return g
  }
}

const EMPTY_EVIDENCE: MeasuredEvidence = {
  roms: [], lsiCandidates: [], mmtCandidates: [], painNrs: null,
}

/**
 * 筋力記録から健側比（LSI, %）を算出する。算出できない記録は null（照合しない）。
 *
 * 注意: StrengthRecord.contralateralRatio はフィールド名に反して「健側の実測値」が入る
 * （入力フォームの項目名は「健側値」。rehab-algorithms.ts も 患側÷健側×100 で比を出している）。
 * そのため、この値をそのまま%として扱ってはいけない。
 */
function computeLsiPercent(s: StrengthRecord): number | null {
  if (s.hhdValue == null) return null
  // 単位が「健側比 (%)」の場合は、測定値そのものが比率
  if (s.unit === 'contra_ratio') {
    return s.hhdValue >= 0 && s.hhdValue <= 200 ? s.hhdValue : null
  }
  // それ以外は 患側 ÷ 健側 × 100（同一単位での比較のみ意味を持つ）
  const contralateral = s.contralateralRatio
  if (contralateral == null || contralateral <= 0) return null
  const lsi = (s.hhdValue / contralateral) * 100
  return lsi >= 0 && lsi <= 200 ? lsi : null
}

/** カルテから照合用の実測値を集める（選別はエンジン側が保守的に行う） */
function buildEvidence(chartPatientId: string, region?: string): MeasuredEvidence {
  // 部位が特定できないプロトコルでは、部位別の記録（ROM・筋力）と照合しない
  // （別部位の実測値で誤判定するのを防ぐ。痛みNRSは全身の指標なので照合する）
  const roms = region
    ? getROMRecords(chartPatientId)
        .filter(r =>
          r.bodyRegion === region &&
          (r.activeRom ?? r.passiveRom) != null &&
          r.unit === 'deg', // 基準の照合は角度のみ（FABER距離などcm系は対象外）
        )
        .map(r => ({
          movement: r.movement,
          value: (r.activeRom ?? r.passiveRom)!,
          date: r.measuredDate,
          side: r.side,
        }))
    : []

  const strengths = region
    ? getStrengthRecords(chartPatientId).filter(s => s.bodyRegion === region)
    : []
  const lsiCandidates = strengths
    .map(s => ({ lsi: computeLsiPercent(s), record: s }))
    .filter((x): x is { lsi: number; record: StrengthRecord } => x.lsi != null)
    .map(({ lsi, record }) => ({
      value: Math.round(lsi),
      date: record.measuredDate,
      muscle: record.muscleGroup || record.movement || '',
      side: record.side,
    }))
  const mmtCandidates = strengths
    .filter(s => s.mmt != null)
    .map(s => ({
      value: mmtToNumber(s.mmt!),
      date: s.measuredDate,
      muscle: s.muscleGroup || s.movement || '',
      side: s.side,
    }))

  const evals = getEvaluations(chartPatientId)
    .filter(e => e.painNrs != null)
    .sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate))

  return {
    roms,
    lsiCandidates,
    mmtCandidates,
    painNrs: evals[0]
      ? { value: evals[0].painNrs, date: evals[0].evaluationDate, label: '評価記録のNRS' }
      : null,
  }
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  protocol: Protocol
  patient: ProtocolPatient
  /** 現在フェーズの PhaseCard が編集モード中（チェック操作をロックする） */
  editLocked?: boolean
  /** 基準チェックの変更後に呼ばれる（親がプロトコルを再読込する） */
  onUpdated: () => void
}

export default function PhaseReadinessPanel({ protocol, patient, editLocked, onUpdated }: Props) {
  const currentPhase = protocol.phases[protocol.currentPhaseIndex]
  const criteria = currentPhase?.advanceCriteria ?? []

  const link = useMemo(() => resolveChartPatient(patient), [patient])
  const evaluations = useMemo(() => {
    const region = patient.joint ? JOINT_TO_REGION[patient.joint] : undefined
    const evidence = link.patient ? buildEvidence(link.patient.id, region) : EMPTY_EVIDENCE
    return evaluateCriteria(criteria, evidence, todayString())
    // protocol.updatedAt を依存に含めてチェック操作後に再評価する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, link.patient, patient.joint, protocol.updatedAt])

  if (!isFeatureEnabled('smartProtocol')) return null
  if (!currentPhase || criteria.length === 0) return null

  const suggestions = link.patient ? buildReassessmentSuggestions(evaluations) : []
  const metCount = evaluations.filter(e => e.met).length
  const autoOkPending = evaluations.filter(e => e.autoJudgment === 'pass' && !e.met).length

  function setMet(index: number, met: boolean) {
    if (editLocked) return
    updatePhase(protocol.id, currentPhase.id, {
      advanceCriteria: criteria.map((c, i) => (i === index ? { ...c, met } : c)),
    })
    onUpdated()
  }

  return (
    <div className="no-print bg-[--color-surface-card] rounded-2xl border border-slate-200 p-5 mb-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[--color-primary]" />
          <span className="text-xs font-bold text-[--color-text-secondary] font-display uppercase tracking-widest">
            フェーズ進行の準備状況 — {currentPhase.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="metric text-sm font-bold text-slate-700">
            {metCount} / {criteria.length} 達成
          </span>
          {autoOkPending > 0 && (
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200
              rounded-full px-2 py-0.5">
              実測OK・未チェック {autoOkPending}件
            </span>
          )}
        </div>
      </div>

      {/* 編集ロック中の案内 */}
      {editLocked && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border
          border-amber-200 rounded-lg px-3 py-2 mb-2">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          フェーズを編集中です。チェック操作は編集の保存またはキャンセル後に行えます
        </p>
      )}

      {/* カルテ未連携の案内 */}
      {!link.patient && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-2">
          <Link2Off className="w-3.5 h-3.5" />
          カルテ連携（進捗管理→来院記録タブ）を行うと、ROM・筋力などの実測値と自動照合できます
        </p>
      )}
      {link.patient && !link.explicit && (
        <p className="text-[10px] text-amber-600 mb-2">
          ⚠ 氏名一致による自動連携（{link.patient.name}）です。別人の可能性がある場合は、進捗管理から明示的にリンクしてください
        </p>
      )}

      {/* 基準リスト */}
      <ul className="space-y-1.5">
        {evaluations.map(ev => (
          <li key={ev.index} className="flex items-center gap-2.5 rounded-xl border border-slate-100
            bg-white px-3 py-2">
            {/* 手動チェック（これが正） */}
            <button
              type="button"
              onClick={() => setMet(ev.index, !ev.met)}
              disabled={editLocked}
              aria-pressed={ev.met}
              title={editLocked ? 'フェーズ編集中は変更できません' : ev.met ? '達成を取り消す' : '達成としてチェックする'}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                ev.met
                  ? 'bg-teal-500 border-teal-500 text-white'
                  : 'bg-white border-slate-300 text-transparent hover:border-teal-400'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${ev.met ? 'text-slate-400' : 'text-slate-700'}`}>
                {ev.label}
                {ev.target && <span className="text-slate-400 text-xs ml-1">（{ev.target}）</span>}
              </span>
              {/* 実測バッジ（照合した記録の正体を必ず明示する） */}
              {ev.measured && ev.parsed && (
                <span className={`ml-2 inline-flex items-center gap-1 text-[10px] font-bold
                  rounded-full px-2 py-0.5 border ${
                  ev.autoJudgment === 'pass'
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  実測 {ev.measured.value}{ev.parsed.unit}
                  <span className="opacity-70">
                    （{ev.measured.label}・基準{formatThreshold(ev.parsed)}
                    {ev.staleDays != null && ev.staleDays > 0 && `・${ev.staleDays}日前`}）
                  </span>
                </span>
              )}
              {ev.ambiguity && (
                <span className="ml-2 text-[10px] text-slate-400">
                  {AMBIGUITY_LABELS[ev.ambiguity]}
                </span>
              )}
              {!ev.measured && !ev.ambiguity && ev.parsed && link.patient && (
                <span className="ml-2 text-[10px] text-slate-400">実測データなし</span>
              )}
              {/* 何も判定していない行を「確認済み」と誤読されないよう明示する */}
              {!ev.parsed && (
                <span className="ml-2 text-[10px] text-slate-400">自動照合の対象外（目視で判断してください）</span>
              )}
            </div>

            {/* 実測OKの承認提案（自動では達成にしない） */}
            {ev.autoJudgment === 'pass' && !ev.met && !editLocked && (
              <button
                type="button"
                onClick={() => setMet(ev.index, true)}
                className="flex-shrink-0 text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700
                  rounded-full px-3 py-1.5 transition-colors"
              >
                実測OK → チェック
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* 再評価のおすすめ（条件ベース） */}
      {suggestions.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1.5">
            <BellRing className="w-3.5 h-3.5" />再評価のおすすめ
          </div>
          <ul className="space-y-1">
            {suggestions.map((s, i) => (
              <li key={i} className="text-[11px] text-amber-800">
                <span className="font-semibold">{s.criterionLabel}</span>
                <span className="text-amber-700/80"> — {s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-2.5">
        実測照合は参考情報です。達成の判断は施術者のチェックで確定します（自動では達成になりません）。
      </p>
    </div>
  )
}
