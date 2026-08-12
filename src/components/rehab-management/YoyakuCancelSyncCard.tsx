'use client'
// ──────────────────────────────────────────────
// 予約システム → カルテ キャンセル自動取り込みカード
//
// ・本人と確実に分かる予約のキャンセルは、開くだけで自動的にカルテへ記録される
// ・患者を特定できない／区分を断定できないものは「要確認」として1タップで処理する
// ・予約日を過ぎても「確定」のままの予約は「無断キャンセル候補」として提示する
//   （来院済みの付け忘れと区別できないため、必ず確認してもらう）
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarX, RefreshCw, Check, X, ChevronDown, ChevronUp, Undo2 } from 'lucide-react'
import type { CancellationKind, Patient } from '@/types/patient'
import { CANCELLATION_KINDS, CANCELLATION_SHORT_LABELS } from '@/types/patient'
import { nanoid } from 'nanoid'
import { getPatients, initPatientStore, savePatient } from '@/lib/patient-store'
import {
  syncFromFeed, confirmPending, excludeReservationNo, unexcludeReservationNo,
  getExcludedReservationNos, resolveNoShow, unresolveNoShow, getResolvedNoShows,
  type PendingCancellation, type SyncResult, type YoyakuFeed,
} from '@/lib/yoyaku-cancel-sync'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const FEED_KEY_STORAGE = 'yoyaku_feed_key'
/** さかのぼる日数（数日アプリを開かなくても取りこぼさない） */
const BACK_DAYS = 30
/** 先の予約まで見る日数（予約日前キャンセルを早く確実に判定するため） */
const FORWARD_DAYS = 14

/** 一度に表示する要確認の件数（初回に大量に出ても画面が埋まらないようにする） */
const PENDING_PAGE_SIZE = 8

const REASON_LABELS: Record<PendingCancellation['reason'], string> = {
  unmatched: 'カルテの患者を特定できません',
  ambiguous_kind: '区分（当日／無断）を判定できません',
  no_show_candidate: '来院の記録がありません',
}

function dayLabel(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  return `${date.getMonth() + 1}/${date.getDate()}（${youbi}）`
}

export default function YoyakuCancelSyncCard() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [result, setResult] = useState<SyncResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noKey, setNoKey] = useState(false)
  const [excluded, setExcluded] = useState<string[]>([])
  const [resolved, setResolved] = useState<string[]>([])
  const [showExcluded, setShowExcluded] = useState(false)
  const [showAllPending, setShowAllPending] = useState(false)
  // 要確認の行ごとの選択状態（患者ID・区分）
  const [choice, setChoice] = useState<Record<string, { patientId: string; kind: CancellationKind }>>({})

  const sortedPatients = useMemo(
    () => [...patients].sort((a, b) => a.kana.localeCompare(b.kana, 'ja')),
    [patients],
  )

  const run = useCallback(async () => {
    const key = localStorage.getItem(FEED_KEY_STORAGE) || ''
    if (!key) {
      setNoKey(true)
      return
    }
    setNoKey(false)
    setLoading(true)
    setError('')
    try {
      initPatientStore()
      const list = getPatients()
      setPatients(list)
      const res = await fetch(
        `/api/yoyaku/feed?key=${encodeURIComponent(key)}&days=${FORWARD_DAYS}&back=${BACK_DAYS}`,
        { cache: 'no-store' },
      )
      const feed = (await res.json()) as YoyakuFeed
      if (!feed.ok) {
        setError(
          feed.error === 'unauthorized'
            ? '連携キーが一致しません。「今日の予約」から設定し直してください。'
            : feed.error || '予約の取得に失敗しました。',
        )
        return
      }
      setResult(syncFromFeed(feed, list))
      setExcluded(getExcludedReservationNos())
      setResolved(getResolvedNoShows())
    } catch {
      setError('予約の取得に失敗しました。通信環境をご確認ください。')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初回同期は描画を終えてから始める（ダッシュボードの表示を遅らせないため）
  useEffect(() => {
    const timer = setTimeout(() => { void run() }, 0)
    return () => clearTimeout(timer)
  }, [run])

  /** 要確認の1件を記録する。patientId を渡すと、その患者へ直接記録する */
  function handleConfirm(item: PendingCancellation, forcePatientId?: string) {
    const selected = choice[item.reservationNo]
    const patientId = forcePatientId || selected?.patientId || item.patientId || ''
    const kind = selected?.kind || item.suggestedKind
    if (!patientId || !kind) return
    confirmPending(item, patientId, kind)
    dropPending(item.reservationNo)
  }

  /**
   * カルテが無い方の予約を、予約情報からカルテを作って記録する。
   * 氏名・ふりがな・電話は予約のものをそのまま使い、あとから編集できる。
   */
  function handleCreateAndConfirm(item: PendingCancellation) {
    const kind = choice[item.reservationNo]?.kind || item.suggestedKind
    if (!kind) return
    if (!confirm(`${item.name} 様のカルテを新しく作成して記録しますか？`)) return
    const now = new Date().toISOString()
    const patient: Patient = {
      id: nanoid(),
      name: item.name,
      kana: item.kana ?? '',
      birthDate: '',
      gender: 'other',
      phone: item.phone ?? '',
      emergencyContact: '',
      mainComplaint: '',
      bodyRegion: 'other',
      diagnosisLabel: '',
      onsetDate: '',
      firstVisitDate: item.date,
      status: 'active',
      therapistNotes: '予約システムのキャンセルから作成',
      createdAt: now,
      updatedAt: now,
    }
    savePatient(patient)
    setPatients(getPatients())
    confirmPending(item, patient.id, kind)
    dropPending(item.reservationNo)
  }

  /** 「今後取り込まない」＝誤入力・対象外として除外する */
  function handleExclude(item: PendingCancellation) {
    excludeReservationNo(item.reservationNo)
    setExcluded(getExcludedReservationNos())
    dropPending(item.reservationNo)
  }

  /** 無断キャンセル候補に対して「来院された」と答える */
  function handleVisited(item: PendingCancellation) {
    resolveNoShow(item.reservationNo)
    setResolved(getResolvedNoShows())
    dropPending(item.reservationNo)
  }

  /** 除外を取り消す（次の同期で「要確認」として出し直す） */
  function handleUnexclude(reservationNo: string) {
    unexcludeReservationNo(reservationNo)
    setExcluded(getExcludedReservationNos())
  }

  /** 「来院された」の判断を取り消す（押し間違いの復旧） */
  function handleUnresolve(reservationNo: string) {
    unresolveNoShow(reservationNo)
    setResolved(getResolvedNoShows())
  }

  /** 処理済みの1件をリストから消す（再取得せずに手元だけ更新） */
  function dropPending(reservationNo: string) {
    setResult((prev) =>
      prev ? { ...prev, pending: prev.pending.filter((p) => p.reservationNo !== reservationNo) } : prev,
    )
  }

  const pending = result?.pending ?? []
  const visiblePending = showAllPending ? pending : pending.slice(0, PENDING_PAGE_SIZE)
  const hasNothingToDo = !loading && !error && !noKey && pending.length === 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarX className="w-4 h-4 text-orange-500" />
            <CardTitle className="text-sm font-semibold text-gray-900">
              キャンセルのカルテ反映
            </CardTitle>
            {result && (result.imported > 0 || result.withdrawn > 0 || result.linked > 0) && (
              <span className="text-[11px] text-gray-500">
                {[
                  result.imported > 0 ? `${result.imported}件を記録` : '',
                  result.linked > 0 ? `${result.linked}件は入力済みと照合` : '',
                  result.withdrawn > 0 ? `${result.withdrawn}件を取り下げ` : '',
                ].filter(Boolean).join(' / ')}
              </span>
            )}
          </div>
          <Button
            variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-500"
            onClick={() => void run()} disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {noKey && (
          <p className="text-xs text-gray-500">
            「今日の予約」で予約システムと連携すると、キャンセルが自動でカルテに記録されます。
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {loading && !result && <p className="text-xs text-gray-400">予約を確認しています…</p>}

        {/* GAS側が未更新のとき（キャンセル日時が取れず、判定できないものが増える） */}
        {result && !result.feedV2 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] text-amber-800 leading-relaxed">
              予約システム側が旧バージョンのため、キャンセル日時を取得できません。
              「当日」か「予約日前」かの自動判定ができず、多くが要確認になります。
              予約システムの更新をおすすめします。
            </p>
          </div>
        )}

        {hasNothingToDo && (
          <p className="text-xs text-gray-400">
            確認が必要なキャンセルはありません。
            {result && result.imported === 0 && result.withdrawn === 0 && ' すべて反映済みです。'}
          </p>
        )}

        {/* ── 要確認リスト ── */}
        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">
              確認をお願いします（{pending.length}件）
            </p>
            {visiblePending.map((item) => {
              const selected = choice[item.reservationNo]
              const rawPatientId = selected?.patientId ?? item.patientId ?? ''
              // '__pick__' は「一覧から選ぶ」を開いただけの状態。まだ患者は決まっていない
              const patientId = rawPatientId === '__pick__' ? '' : rawPatientId
              const kind = selected?.kind ?? item.suggestedKind
              const setChoiceFor = (next: Partial<{ patientId: string; kind: CancellationKind }>) =>
                setChoice((prev) => ({
                  ...prev,
                  [item.reservationNo]: {
                    patientId: next.patientId ?? patientId,
                    kind: next.kind ?? kind ?? 'same_day',
                  },
                }))

              return (
                <div
                  key={item.reservationNo}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800">
                        <span className="tabular-nums">{dayLabel(item.date)} {item.time}</span>
                        <span className="ml-2">{item.name} 様</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {REASON_LABELS[item.reason]}
                        {item.phone && <span className="ml-2">{item.phone}</span>}
                      </div>
                    </div>
                    {item.reason === 'no_show_candidate' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-50 text-red-600 border-red-200">
                        無断の可能性
                      </span>
                    )}
                  </div>

                  {/* 記録先のカルテ。
                      予約の氏名と一致するカルテがあれば、その名前のまま1タップで記録できるようにする。
                      自動では紐づけない（別人の可能性があるため）が、探させることもしない。 */}
                  {patientId ? (
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="text-gray-500">カルテ</span>
                      <span className="font-semibold text-gray-800">
                        {sortedPatients.find((p) => p.id === patientId)?.name ?? ''} 様
                      </span>
                      <button
                        type="button"
                        onClick={() => setChoiceFor({ patientId: '' })}
                        className="text-gray-400 hover:text-gray-600 underline"
                      >
                        別の方を選ぶ
                      </button>
                    </div>
                  ) : item.guessPatientId ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-gray-500">
                        同じ氏名のカルテがあります（電話番号は一致していません）
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm" className="h-7 text-xs"
                          onClick={() => handleConfirm(item, item.guessPatientId)}
                          disabled={!kind}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {item.guessPatientName} 様のカルテに記録
                        </Button>
                        <button
                          type="button"
                          onClick={() => setChoiceFor({ patientId: '__pick__' })}
                          className="text-[11px] text-gray-400 hover:text-gray-600 underline px-1"
                        >
                          別の方を選ぶ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-gray-500">
                        「{item.name}」様のカルテが見つかりません
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          variant="outline" size="sm" className="h-7 text-xs"
                          onClick={() => handleCreateAndConfirm(item)}
                          disabled={!kind}
                        >
                          カルテを作成して記録
                        </Button>
                        <button
                          type="button"
                          onClick={() => setChoiceFor({ patientId: '__pick__' })}
                          className="text-[11px] text-gray-400 hover:text-gray-600 underline px-1"
                        >
                          既存のカルテから選ぶ
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 「別の方を選ぶ」を押したときだけ一覧を出す */}
                  {choice[item.reservationNo]?.patientId === '__pick__' && (
                    <select
                      value=""
                      onChange={(e) => setChoiceFor({ patientId: e.target.value })}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white
                        focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                      aria-label="記録する患者"
                    >
                      <option value="">— 患者を選択 —</option>
                      {sortedPatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}（{p.kana}）
                        </option>
                      ))}
                    </select>
                  )}

                  {/* 区分の指定 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-gray-500 mr-0.5">区分</span>
                    {CANCELLATION_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setChoiceFor({ kind: k })}
                        className={`px-2.5 py-1 text-[11px] rounded-full border font-medium transition-colors ${
                          kind === k
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                        }`}
                      >
                        {CANCELLATION_SHORT_LABELS[k]}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {/* 記録先が決まっているときだけ出す。
                        決まっていないときは上の「◯◯様のカルテに記録」が主役になる */}
                    {patientId && (
                      <Button
                        size="sm" className="h-7 text-xs"
                        onClick={() => handleConfirm(item)}
                        disabled={!kind}
                      >
                        <Check className="w-3.5 h-3.5" />カルテに記録
                      </Button>
                    )}
                    {item.reason === 'no_show_candidate' ? (
                      <Button
                        variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => handleVisited(item)}
                      >
                        来院された（記録しない）
                      </Button>
                    ) : (
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs text-gray-500"
                        onClick={() => handleExclude(item)}
                      >
                        <X className="w-3.5 h-3.5" />今後取り込まない
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            {pending.length > visiblePending.length && (
              <button
                type="button"
                onClick={() => setShowAllPending(true)}
                className="w-full text-xs text-teal-700 hover:text-teal-900 py-2 transition-colors"
              >
                残り {pending.length - visiblePending.length} 件を表示
              </button>
            )}
          </div>
        )}

        {/* ── 処理済み（誤入力として削除した分・来院確認した分）── */}
        {(excluded.length > 0 || resolved.length > 0) && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowExcluded((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showExcluded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              処理済みにした予約（除外 {excluded.length}件 / 来院確認 {resolved.length}件）
            </button>
            {showExcluded && (
              <ul className="mt-1.5 space-y-1">
                {excluded.map((no) => (
                  <li key={`ex-${no}`} className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                    <span className="tabular-nums">予約番号 {no}（取り込まない）</span>
                    <button
                      type="button"
                      onClick={() => handleUnexclude(no)}
                      className="flex items-center gap-1 text-teal-600 hover:text-teal-800 transition-colors"
                    >
                      <Undo2 className="w-3 h-3" />要確認に戻す
                    </button>
                  </li>
                ))}
                {resolved.map((no) => (
                  <li key={`ok-${no}`} className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                    <span className="tabular-nums">予約番号 {no}（来院された）</span>
                    <button
                      type="button"
                      onClick={() => handleUnresolve(no)}
                      className="flex items-center gap-1 text-teal-600 hover:text-teal-800 transition-colors"
                    >
                      <Undo2 className="w-3 h-3" />取り消す
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              「要確認に戻す」を押すと、次の更新でもう一度確認リストに出ます（自動記録はされません）。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
