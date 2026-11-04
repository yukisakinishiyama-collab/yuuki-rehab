'use client'
// ──────────────────────────────────────────────
// 経営：「CSVを入れて最新にする」（2026-11-05 院長の依頼。毎晩の自動の読み取りの代わり）
//
// 1. NOAH（金額分析 → F5 金額集計 → F9 CSV出力）と、アルファノート（カード・QR の取引一覧）の CSV を選ぶ
// 2. ブラウザの中で読み、月ごとに「NOAH ＋ サブスク ＋ NOAHに入っていない分 ＝ 総合計」を見せる
//    カードの一括・QR はふだん NOAH と重なるので足さない。NOAH に入っていなさそうなものだけ日付と金額で出し、
//    院長が「NOAHに入っていない」に印を付けた分を足す
// 3.「この内容で最新にする」で保存 → グラフ・目標までの道すじ（施策）がこの数字で計算し直される
// アルファノートの CSV のお名前・カード番号などはブラウザの外へ出さない（日付と金額だけを送る）。
// ──────────────────────────────────────────────
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, FileUp, Target } from 'lucide-react'
import type { NoahMonth } from '@/lib/marketing/noah-types'
import {
  decodeCsvBytes,
  detectCsvKind,
  extraFromSummary,
  parseAlphaCashless,
  parseAlphaCredit,
  parseNoahKingaku,
  summarizeAlpha,
  type AlphaPayment,
} from '@/lib/marketing/keiei-csv'
import { DEFAULT_GOAL, baseline, insights, simDefaults } from '@/lib/marketing/goal-plan'
import { mergeMonths } from '@/lib/marketing/noah-analysis'
import { cn } from '@/lib/utils'

interface ParsedFile {
  name: string
  kind: 'noah' | 'alpha-credit' | 'alpha-cashless' | 'unknown'
  label: string
  error?: string
  noah?: NoahMonth
  payments?: AlphaPayment[]
}

interface ExtraMonth {
  month: string
  subscription: number
  cashless: number
  overlap: number
}

/** 日本時間の今日と、いまの時刻（'YYYY-MM-DDTHH:MM'） */
function jstNow(): { date: string; stamp: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return { date, stamp: `${date}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}` }
}

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
const ym = (month: string) => `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
const sumSales = (m: NoahMonth) => m.days.reduce((s, d) => s + d[2], 0)

/** この端末に覚えてある目標（目標の画面と同じ置き場所） */
function savedGoal(): number {
  try {
    const n = Number(window.localStorage.getItem('keiei:goal'))
    return n > 0 ? n : DEFAULT_GOAL
  } catch {
    return DEFAULT_GOAL
  }
}

export default function KeieiCsvImport({ storeMonths, onSaved }: { storeMonths: NoahMonth[]; onSaved: () => void }) {
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [notInNoah, setNotInNoah] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ message: string; notes: string[] } | null>(null)

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setDone(null)
    setError('')
    const { date, stamp } = jstNow()
    const parsed: ParsedFile[] = []
    for (const file of Array.from(list)) {
      try {
        const text = decodeCsvBytes(await file.arrayBuffer())
        const kind = detectCsvKind(text)
        if (kind === 'noah') {
          const r = parseNoahKingaku(text, date, stamp, file.name)
          parsed.push(
            r.ok
              ? { name: file.name, kind, label: `NOAH 金額集計 ${r.label}`, noah: r.month }
              : { name: file.name, kind, label: 'NOAH 金額集計', error: r.error },
          )
        } else if (kind === 'alpha-credit' || kind === 'alpha-cashless') {
          const r = kind === 'alpha-credit' ? parseAlphaCredit(text) : parseAlphaCashless(text)
          const what = kind === 'alpha-credit' ? 'アルファノート カード' : 'アルファノート QR'
          parsed.push(
            r.ok
              ? { name: file.name, kind, label: `${what} ${r.payments.length}件${r.skipped ? `（取消などで数えない ${r.skipped}件）` : ''}`, payments: r.payments }
              : { name: file.name, kind, label: what, error: r.error },
          )
        } else {
          parsed.push({ name: file.name, kind: 'unknown', label: file.name, error: 'NOAHの金額集計・アルファノートの取引一覧のCSVではないようです' })
        }
      } catch {
        parsed.push({ name: file.name, kind: 'unknown', label: file.name, error: 'ファイルを読めませんでした' })
      }
    }
    // 同じ名前のファイルを選び直したときは、新しい方にする
    setFiles((prev) => [...prev.filter((p) => !parsed.some((n) => n.name === p.name)), ...parsed])
  }

  const noahIn = useMemo(() => files.flatMap((f) => (f.noah ? [f.noah] : [])), [files])
  const payments = useMemo(() => files.flatMap((f) => f.payments ?? []), [files])
  // 日ごとの見比べに使う NOAH：今回入れる月 ＋ 保存済みの月
  const noahAll = useMemo(() => mergeMonths(storeMonths, noahIn), [storeMonths, noahIn])
  const alpha = useMemo(() => summarizeAlpha(payments, noahAll), [payments, noahAll])

  const months = useMemo(
    () => [...new Set([...noahIn.map((m) => m.month), ...alpha.map((a) => a.month)])].sort().reverse(),
    [noahIn, alpha],
  )

  function toggle(id: string) {
    setNotInNoah((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const { date } = jstNow()
      if (noahIn.length > 0) {
        const res = await fetch('/api/marketing/noah/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: files.filter((f) => f.noah).map((f) => f.name).join(', '), months: noahIn }),
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error ?? `NOAHの集計を保存できませんでした（HTTP ${res.status}）`)
      }
      const extras: ExtraMonth[] = []
      for (const s of alpha) {
        const body = extraFromSummary(s, notInNoah, date)
        const res = await fetch('/api/marketing/keiei-extra', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !data.ok) throw new Error(data.error ?? `${ym(s.month)}のアルファノートの分を保存できませんでした`)
        extras.push(body)
      }
      // 目標までの道すじ（目標の画面と同じ計算）
      const notes: string[] = []
      const base = baseline(noahAll)
      if (base) {
        const savedExtras = (await fetch('/api/marketing/keiei-extra', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { months: [] }))
          .catch(() => ({ months: [] }))) as { months: ExtraMonth[] }
        const e = savedExtras.months.find((m) => m.month === base.month) ?? extras.find((m) => m.month === base.month)
        const extra = e ? e.subscription + Math.max(0, e.cashless - e.overlap) : 0
        notes.push(...insights(savedGoal(), base, simDefaults(base, extra)).map((n) => n.text))
      }
      setDone({ message: '最新にしました。グラフと目標までの道すじを、入れた数字で計算し直しました。', notes })
      setFiles([])
      setNotInNoah(new Set())
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const usable = files.some((f) => !f.error)

  return (
    <section className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm sm:p-5" aria-label="CSVを入れて最新にする">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-base font-black text-slate-900">
            <FileUp className="h-5 w-5 text-teal-700" aria-hidden />
            CSVを入れて最新にする
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            NOAH：分析 → 金額分析 →「F5 金額集計」→「F9 CSV出力」。アルファノート：カード・QR の取引一覧の CSV。まとめて選べます。
          </p>
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800">
          <FileUp className="h-4 w-4" aria-hidden />
          CSVを選ぶ
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            className="sr-only"
            onChange={(e) => {
              void addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f) => (
            <li
              key={f.name}
              className={cn('flex items-start gap-2 rounded-lg px-3 py-2 text-sm', f.error ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-800')}
            >
              {f.error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />}
              <span className="min-w-0">
                <span className="font-bold">{f.label}</span>
                <span className="block break-all text-xs text-slate-500">{f.name}</span>
                {f.error && <span className="block text-xs">{f.error}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {months.length > 0 && (
        <div className="mt-4 space-y-4">
          {months.map((month) => {
            const noah = noahAll.find((m) => m.month === month)
            const fromFile = noahIn.some((m) => m.month === month)
            const a = alpha.find((x) => x.month === month)
            const noahSales = noah ? sumSales(noah) : 0
            const added = a ? a.candidates.filter((c) => notInNoah.has(c.id)).reduce((s, c) => s + c.amount, 0) : 0
            const total = noahSales + (a?.subscription.sum ?? 0) + added
            return (
              <div key={month} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                <h3 className="text-sm font-black text-slate-900">{ym(month)}の総合計</h3>
                <dl className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5">
                    <dt className="min-w-0 text-slate-600">NOAH{noah ? `（${md(noah.asOf)}まで${fromFile ? '・今回のCSV' : '・保存済み'}）` : ''}</dt>
                    <dd className="whitespace-nowrap font-bold tabular-nums">{noah ? yen(noahSales) : 'CSVがありません'}</dd>
                  </div>
                  <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5">
                    <dt className="min-w-0 text-slate-600">＋ サブスク（カードの継続 {a?.subscription.count ?? 0}件）</dt>
                    <dd className="whitespace-nowrap font-bold tabular-nums">{yen(a?.subscription.sum ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5">
                    <dt className="min-w-0 text-slate-600">＋ NOAHに入っていない分（印を付けたもの）</dt>
                    <dd className="whitespace-nowrap font-bold tabular-nums">{yen(added)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 rounded-lg bg-teal-50 px-3 py-1.5">
                    <dt className="font-bold text-teal-900">＝ 総合計</dt>
                    <dd className="whitespace-nowrap font-black tabular-nums text-teal-900">{yen(total)}</dd>
                  </div>
                </dl>
                {a && (
                  <p className="mt-2 text-xs text-slate-600">
                    カードの一括 {yen(a.card.sum)}（{a.card.count}件）・QR {yen(a.qr.sum)}（{a.qr.count}件）は、窓口のお支払いで NOAH にも入っているので足していません。
                  </p>
                )}
                {a && a.candidates.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-900">
                      NOAHに入っていないかもしれないもの（入っていなければ印を付けてください。その分を足します）
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {a.candidates.map((c) => (
                        <li key={c.id}>
                          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800 max-lg:min-h-10">
                            <input
                              type="checkbox"
                              checked={notInNoah.has(c.id)}
                              onChange={() => toggle(c.id)}
                              className="mt-1 h-4 w-4 accent-teal-700"
                            />
                            <span>
                              <span className="font-bold tabular-nums">
                                {md(c.date)} {c.kind === 'card' ? 'カード一括' : 'QR'} {yen(c.amount)}
                              </span>
                              <span className="ml-1 text-xs text-slate-600">（{c.reasons.join('・')}）</span>
                              {notInNoah.has(c.id) && <span className="ml-1 text-xs font-bold text-teal-800">→ NOAHに入っていない（足す）</span>}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a?.noahMissing && (
                  <p className="mt-2 text-xs text-amber-800">この月の NOAH の CSV がまだ無いので、日ごとの見比べ（NOAHに記録の無い日など）はしていません。</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {usable && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setFiles([])
              setNotInNoah(new Set())
            }}
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {busy ? '保存しています…' : 'この内容で最新にする'}
          </button>
        </div>
      )}

      {done && (
        <div role="status" className="mt-4 space-y-2 rounded-xl border border-teal-300 bg-teal-50 p-3 sm:p-4">
          <p className="flex items-start gap-1.5 text-sm font-bold text-teal-900">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {done.message}
          </p>
          {done.notes.length > 0 && (
            <ul className="space-y-1 text-sm text-slate-800">
              {done.notes.slice(0, 4).map((n) => (
                <li key={n} className="flex items-start gap-1.5">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                  {n}
                </li>
              ))}
            </ul>
          )}
          <Link href="/marketing/sales/goal" className="inline-flex h-10 items-center rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800">
            目標までの道すじ（施策）を見る →
          </Link>
        </div>
      )}
    </section>
  )
}
