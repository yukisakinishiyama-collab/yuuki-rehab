'use client'
// ──────────────────────────────────────────────
// キャンセル記録タブ
// 「予約日前 / 当日 / 無断」の3区分でワンタップ記録し、患者ごとの累計を表示する。
// 連絡日は区分から自動で決まる（無断は連絡なしのため空欄）。
// ──────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import type { CancellationExclusion, CancellationKind, CancellationRecord } from '@/types/patient'
import {
  CANCELLATION_KINDS, CANCELLATION_LABELS, CANCELLATION_SHORT_LABELS,
  CANCELLATION_DESCRIPTIONS, CANCELLATION_EXCLUSIONS,
  CANCELLATION_EXCLUSION_LABELS, CANCELLATION_EXCLUSION_DESCRIPTIONS,
} from '@/types/patient'
import { saveCancellation } from '@/lib/patient-store'
import { deleteCancellationRecord } from '@/lib/yoyaku-cancel-sync'
import VoiceInputButton from '@/components/rehab/VoiceInputButton'
import {
  summarizeCancellations, inferCancellationKind, todayString, splitCancellations,
} from '@/lib/cancellation-utils'
import { Card, CardContent, CardHeader, SectionTitle, FormLabel, Input, SaveButton } from './shared'

// 区分ごとの配色（当日・無断ほど重く見せる）
const KIND_STYLES: Record<CancellationKind, { chip: string; active: string; idle: string; text: string }> = {
  advance: {
    chip: 'bg-gray-100 text-gray-700',
    active: 'bg-gray-700 border-gray-700 text-white',
    idle: 'bg-white border-gray-200 text-gray-600 hover:border-gray-400',
    text: 'text-gray-700',
  },
  same_day: {
    chip: 'bg-orange-100 text-orange-700',
    active: 'bg-orange-500 border-orange-500 text-white',
    idle: 'bg-white border-gray-200 text-gray-600 hover:border-orange-300',
    text: 'text-orange-600',
  },
  no_show: {
    chip: 'bg-red-100 text-red-700',
    active: 'bg-red-600 border-red-600 text-white',
    idle: 'bg-white border-gray-200 text-gray-600 hover:border-red-300',
    text: 'text-red-600',
  },
}

const REASON_CHIPS = ['体調不良', '仕事の都合', '家族の用事', '交通・天候', '症状が改善', 'その他']

interface Props {
  patientId: string
  records: CancellationRecord[]
  /** 来院回数（キャンセル率の算出に使用） */
  visitCount: number
  onUpdate: () => void
}

export default function CancellationTab({ patientId, records, visitCount, onUpdate }: Props) {
  const [appointmentDate, setAppointmentDate] = useState(todayString())
  const [kind, setKind] = useState<CancellationKind>('same_day')
  const [kindTouched, setKindTouched] = useState(false)
  const [reason, setReason] = useState('')
  const [memo, setMemo] = useState('')

  const summary = useMemo(() => summarizeCancellations(records), [records])
  const { counted, excluded } = useMemo(() => splitCancellations(records), [records])
  // 区分を直している行（誤って記録した区分を後から直せるようにする）
  const [editingKindId, setEditingKindId] = useState<string | null>(null)
  // カウント対象外にする理由を選んでいる行
  const [excludingId, setExcludingId] = useState<string | null>(null)
  const [showExcluded, setShowExcluded] = useState(false)

  // 予約日を変えたときは区分を推定し直す（施術者が自分で選び直した後は上書きしない）
  function handleDateChange(value: string) {
    setAppointmentDate(value)
    if (!kindTouched) setKind(inferCancellationKind(value, todayString()))
  }

  function handleSave() {
    if (!appointmentDate) return
    saveCancellation({
      id: nanoid(),
      patientId,
      kind,
      appointmentDate,
      // 無断キャンセルは連絡が無いため空欄。それ以外は本日連絡を受けた扱い
      contactedDate: kind === 'no_show' ? '' : todayString(),
      reason,
      memo,
      createdAt: new Date().toISOString(),
      source: 'manual',
    })
    setReason('')
    setMemo('')
    setKindTouched(false)
    onUpdate()
  }

  /** 記録済みの区分を直す（当日と予約日前を取り違えた場合など） */
  function handleChangeKind(record: CancellationRecord, kind: CancellationKind) {
    setEditingKindId(null)
    if (record.kind === kind) return
    // 院長が手で直した記録は、以後の同期で自動的に取り下げない
    saveCancellation({ ...record, kind, origin: record.source === 'yoyaku' ? 'confirmed' : record.origin })
    onUpdate()
  }

  /**
   * カウント対象外にする／戻す。
   * 記録そのものは残したまま、患者さんのキャンセル回数から外す
   * （こちらの入力ミスで患者さんの回数が増えないようにするため）。
   */
  function handleSetExclusion(record: CancellationRecord, excludedAs: CancellationExclusion | null) {
    setExcludingId(null)
    // origin は書き換えない。書き換えると「戻す」で元に戻せず、
    // 予約側でキャンセルが取り消されても自動で取り下げられなくなる。
    // 対象外の記録は予約番号で重複判定されるため、再取り込みは起きない。
    saveCancellation({ ...record, excludedAs: excludedAs ?? undefined })
    onUpdate()
  }

  // 誤って記録した分の取り消し。予約システムから取り込んだ記録は、
  // 削除しただけだと次の同期で戻ってきてしまうため、取り込み対象からも外す。
  function handleDelete(record: CancellationRecord) {
    const fromYoyaku = Boolean(record.sourceReservationNo)
    const lines = [
      `${record.appointmentDate} のキャンセル記録を削除しますか？`,
      '',
      '記録ごと消えます。元には戻せません。',
    ]
    if (fromYoyaku) lines.push('この予約は今後カルテに取り込まれなくなります。')
    if (!record.excludedAs) {
      lines.push('', '※ 記録を残したまま患者さんの回数から外すだけなら、「対象外にする」をお使いください。')
    }
    if (!confirm(lines.join('\n'))) return
    deleteCancellationRecord(record)
    onUpdate()
  }

  // 注意喚起：無断が2回以上、または直近90日で3回以上
  const alertMessage =
    summary.no_show >= 2 ? '無断キャンセルが複数回あります。連絡方法や予約枠の見直しをご検討ください。'
    : summary.recent90 >= 3 ? '直近3ヶ月でキャンセルが続いています。通院の負担や不安がないか確認してみてください。'
    : ''

  return (
    <div className="space-y-4">
      {/* ── 累計サマリー ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SectionTitle>キャンセル累計</SectionTitle>
            {/* 分母はSOAPカルテの件数。来院実績そのものではないため、率ではなく実数で示す */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>SOAPカルテ <strong className="text-gray-700 tabular-nums">{visitCount}</strong>件</span>
              <span className="text-gray-300">|</span>
              <span>キャンセル <strong className="text-gray-700 tabular-nums">{summary.total}</strong>件</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border-2 border-teal-200 bg-teal-50 px-4 py-3">
              <div className="text-xs font-medium text-teal-700">累計</div>
              <div className="text-3xl font-bold text-teal-800 tabular-nums leading-tight">
                {summary.total}<span className="text-sm font-medium ml-0.5">回</span>
              </div>
            </div>
            {CANCELLATION_KINDS.map(k => (
              <div key={k} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="text-xs font-medium text-gray-500">{CANCELLATION_SHORT_LABELS[k]}</div>
                <div className={`text-3xl font-bold tabular-nums leading-tight ${summary[k] > 0 ? KIND_STYLES[k].text : 'text-gray-300'}`}>
                  {summary[k]}<span className="text-sm font-medium ml-0.5">回</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
            <span>直近3ヶ月：<strong className="text-gray-700 tabular-nums">{summary.recent90}</strong>回</span>
            {summary.lastDate && <span>最終キャンセル：{summary.lastDate}</span>}
            {summary.excluded > 0 && (
              <span className="text-gray-400">
                （ほかにカウント対象外 <strong className="tabular-nums">{summary.excluded}</strong>件）
              </span>
            )}
          </div>

          {alertMessage && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <span aria-hidden className="text-base leading-none">⚠️</span>
              <p className="text-xs text-amber-800 leading-relaxed">{alertMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 記録フォーム ── */}
      <Card>
        <CardHeader><SectionTitle>キャンセルを記録</SectionTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <FormLabel required>予約されていた日</FormLabel>
            <Input type="date" value={appointmentDate} onChange={handleDateChange} />
          </div>

          <div>
            <FormLabel required>区分</FormLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CANCELLATION_KINDS.map(k => {
                const selected = kind === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setKind(k); setKindTouched(true) }}
                    aria-pressed={selected}
                    className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                      selected ? KIND_STYLES[k].active : KIND_STYLES[k].idle
                    }`}
                  >
                    <span className="block text-sm font-semibold">{CANCELLATION_LABELS[k]}</span>
                    <span className={`block text-[11px] mt-0.5 ${selected ? 'opacity-90' : 'text-gray-400'}`}>
                      {CANCELLATION_DESCRIPTIONS[k]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <FormLabel>理由（任意）</FormLabel>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REASON_CHIPS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setReason(reason === chip ? '' : chip)}
                  className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                    reason === chip
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <Input value={reason} onChange={setReason} placeholder="自由入力もできます" />
          </div>

          <div>
            <FormLabel>メモ（任意）</FormLabel>
            <div className="flex items-center gap-1.5">
              <div className="flex-1">
                <Input value={memo} onChange={setMemo} placeholder="次回の予約を◯日に取り直し、など" />
              </div>
              <VoiceInputButton size="sm" onText={t => setMemo(prev => (prev ? `${prev} ${t}` : t))} />
            </div>
          </div>

          <SaveButton onClick={handleSave} label="キャンセルを記録" />
        </CardContent>
      </Card>

      {/* ── 履歴（患者さんのキャンセル） ── */}
      <Card>
        <CardHeader>
          <SectionTitle>キャンセル履歴（{counted.length}件）</SectionTitle>
          <ul className="text-xs text-gray-400 mt-1 space-y-0.5">
            <li>・区分（予約日前／当日／無断）を間違えたときは、左の区分ラベルを押すと直せます</li>
            <li>
              ・<strong className="text-gray-500">対象外にする</strong>
              …こちらの入力ミスや院側都合のとき。記録は残したまま、患者さんの回数から外します（あとで戻せます）
            </li>
            <li>
              ・<strong className="text-gray-500">削除</strong>
              …記録ごと消します。予約システムから取り込んだ分は、以後そのまま取り込まれなくなります
            </li>
          </ul>
        </CardHeader>
        <CardContent>
          {counted.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              {excluded.length > 0
                ? `数える対象のキャンセルはありません（カウント対象外が${excluded.length}件あります）`
                : 'キャンセル記録はありません'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {counted.map(r => renderRow(r))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── カウント対象外（入力ミス・院側都合） ── */}
      {excluded.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle>
              <span>カウント対象外（{excluded.length}件）</span>
              <button
                type="button"
                onClick={() => setShowExcluded(v => !v)}
                aria-expanded={showExcluded}
                className="ml-auto text-xs font-normal text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showExcluded ? '閉じる' : '開く'}
              </button>
            </SectionTitle>
            <p className="text-xs text-gray-400 mt-1">
              患者さんのキャンセル回数には数えていません。「戻す」で数える側へ戻せます。
            </p>
          </CardHeader>
          {showExcluded && (
            <CardContent>
              <ul className="divide-y divide-gray-100">
                {excluded.map(r => renderRow(r))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )

  /** 履歴1行分。カウント対象かどうかで見た目と操作を変える */
  function renderRow(r: CancellationRecord) {
    const isExcluded = Boolean(r.excludedAs)
    return (
      <li key={r.id} className={`flex items-start gap-3 py-3 ${isExcluded ? 'opacity-60' : ''}`}>
        {isExcluded ? (
          <span className="flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
            font-medium bg-slate-100 text-slate-500 line-through">
            {CANCELLATION_SHORT_LABELS[r.kind]}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditingKindId(editingKindId === r.id ? null : r.id)}
            title="区分を直す"
            className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              hover:ring-2 hover:ring-teal-300 transition-shadow ${KIND_STYLES[r.kind].chip}`}
          >
            {CANCELLATION_SHORT_LABELS[r.kind]}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 tabular-nums">
              {r.appointmentDate}
              {r.appointmentTime && <span className="ml-1.5 text-gray-500">{r.appointmentTime}</span>}
            </span>
            {r.sourceReservationNo && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200"
                title={`予約番号 ${r.sourceReservationNo}`}
              >
                予約システムから
              </span>
            )}
            {r.excludedAs && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                {CANCELLATION_EXCLUSION_LABELS[r.excludedAs]}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {r.reason || '理由の記録なし'}
            {r.contactedDate && r.contactedDate !== r.appointmentDate && (
              <span className="text-gray-400">（連絡日 {r.contactedDate}）</span>
            )}
          </div>
          {r.memo && <div className="text-xs text-gray-400 mt-0.5">{r.memo}</div>}

          {editingKindId === r.id && !isExcluded && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[11px] text-gray-500">区分を直す</span>
              {CANCELLATION_KINDS.map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleChangeKind(r, k)}
                  className={`px-2.5 py-1 text-[11px] rounded-full border font-medium transition-colors ${
                    r.kind === k
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                  }`}
                >
                  {CANCELLATION_SHORT_LABELS[k]}
                </button>
              ))}
            </div>
          )}

          {excludingId === r.id && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-[11px] text-amber-800 mb-1.5">
                患者さんの回数から外します。理由を選んでください
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CANCELLATION_EXCLUSIONS.map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSetExclusion(r, key)}
                    title={CANCELLATION_EXCLUSION_DESCRIPTIONS[key]}
                    className="px-3 py-1.5 text-[11px] rounded-full border font-medium bg-white
                      text-amber-800 border-amber-300 hover:bg-amber-100 transition-colors"
                  >
                    {CANCELLATION_EXCLUSION_LABELS[key]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setExcludingId(null)}
                  className="px-3 py-1.5 text-[11px] rounded-full border border-transparent
                    text-gray-500 hover:text-gray-700 transition-colors"
                >
                  やめる
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-1">
          {isExcluded ? (
            <button
              type="button"
              onClick={() => handleSetExclusion(r, null)}
              className="text-xs text-gray-500 hover:text-teal-700 border border-gray-200
                hover:border-teal-300 rounded-md transition-colors px-2 py-1"
            >
              戻す
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExcludingId(excludingId === r.id ? null : r.id)}
              className="text-xs text-gray-500 hover:text-amber-700 border border-gray-200
                hover:border-amber-300 rounded-md transition-colors px-2 py-1"
            >
              対象外にする
            </button>
          )}
          <button
            type="button"
            onClick={() => handleDelete(r)}
            className="text-xs text-gray-400 hover:text-red-600 hover:border-red-200
              border border-transparent rounded-md transition-colors px-2 py-1"
            aria-label={`${r.appointmentDate} のキャンセル記録を削除`}
          >
            削除
          </button>
        </div>
      </li>
    )
  }
}
