/**
 * 経営の「CSVを入れて最新にする」：NOAH・アルファノートの CSV を読む（純粋関数。画面とテストで共通）
 * 2026-11-05 院長の依頼（毎晩の自動の読み取りをやめて、院長が出力した CSV を入れる形に）
 *
 * 読めるもの（どれも Shift_JIS。UTF-8 でもよい）
 * - NOAH「分析 → 金額分析 → F5 金額集計 → F9 CSV出力」… <金額集計>（日ごと）・<自費売上構成>・<商品売上構成>・<エリアランキング>
 * - アルファノート カードの取引一覧（transaction_credit_*.csv）… 決済日・入力金額・支払タイプ（継続／一括）・ステータス
 * - アルファノート QR の取引一覧（transaction_CASHLESS_*.csv）… 決済日・入力金額・ブランド・ステータス
 *
 * 個人情報：アルファノートの CSV にはお名前・カード番号などがあるが、ここでは日付と金額（とカードの継続／一括、QRのブランド）
 * だけを取り出し、ほかの列は読み捨てる。CSV はブラウザの中だけで読み、サーバーへは数字だけを送る。
 *
 * NOAH と重なる分（院長と決めた考え方 2026-10-24・2026-11-05）
 * - カードの「継続」（サブスク）… NOAH に入っていない → 全額を足す
 * - カードの「一括」・QR … ふだんは窓口のお支払いで NOAH にも入っている → 足さない（二重に数えない）
 *   ただし NOAH に入っていないものもある → 怪しいものを日付と金額で出し、院長が「NOAHに入っていない」に印を付けた分だけ足す
 */
import type { NoahMonth } from './noah-types'

// ── CSV の読み方 ─────────────────────────────────────────

/** バイト列 → 文字。UTF-8 として正しく読めなければ Shift_JIS として読む */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(view).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('shift_jis').decode(view)
  }
}

/** CSV（ダブルクォート・カンマ・改行入りのマスに対応）→ 行の配列 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += c
      }
      continue
    }
    if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += c
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** '77,627' / '1,500' / '' → 数（読めなければ null） */
export function toInt(value: string | undefined): number | null {
  const t = String(value ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，円\s]/g, '')
  if (t === '') return 0
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Math.round(Number(t))
}

/** '2026/10/01' / '2026-10-01' → '2026-10-01'（読めなければ ''） */
export function toDate(value: string | undefined): string {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(String(value ?? '').trim())
  if (!m) return ''
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()

export type CsvKind = 'noah' | 'alpha-credit' | 'alpha-cashless'

/** どの CSV か（読めないものは null） */
export function detectCsvKind(text: string): CsvKind | null {
  if (text.includes('<金額集計>')) return 'noah'
  const header = (parseCsv(text.slice(0, 4000))[0] ?? []).map((h) => h.trim())
  if (header.includes('決済日') && header.includes('入力金額')) {
    if (header.includes('支払タイプ') || header.includes('カード名義')) return 'alpha-credit'
    if (header.includes('ブランド')) return 'alpha-cashless'
  }
  return null
}

// ── NOAH の金額集計 ─────────────────────────────────────

export interface NoahCsvResult {
  ok: true
  month: NoahMonth
  /** 画面に出す短い説明（例：2026年10月（10/1〜10/31）） */
  label: string
}
export interface CsvError {
  ok: false
  error: string
}

/** '<金額集計>' のような見出しごとに、行を分ける */
function sections(rows: string[][]): Map<string, string[][]> {
  const out = new Map<string, string[][]>()
  let name = ''
  for (const r of rows) {
    const first = (r[0] ?? '').trim()
    const m = /^<(.+)>$/.exec(first)
    if (m && r.slice(1).every((c) => !c.trim())) {
      name = m[1]
      out.set(name, [])
      continue
    }
    if (!name) continue
    if (r.every((c) => !c.trim())) continue
    out.get(name)?.push(r)
  }
  return out
}

/** 見出しの行の名前 → 列の番号 */
function columnIndex(header: string[]): (name: string) => number {
  const names = header.map((h) => h.trim())
  return (name) => names.indexOf(name)
}

/**
 * NOAH の「金額集計」の CSV → 月の集計（数字だけ）
 * today … 日本時間の今日（'YYYY-MM-DD'）。今月の分は今日までを使う（先の日の 0 の行は入れない）
 * exportedAt … 入れた日時（日本時間 'YYYY-MM-DDTHH:MM'）
 */
export function parseNoahKingaku(text: string, today: string, exportedAt: string, file = ''): NoahCsvResult | CsvError {
  const rows = parseCsv(text)
  const sec = sections(rows)
  // 抽出年月（202610）
  const ymRow = sec.get('金額分析')?.find((r) => /^\d{6}$/.test((r[0] ?? '').trim()))
  const daily = sec.get('金額集計')
  if (!daily || daily.length < 2) return { ok: false, error: 'NOAHの「金額集計」の表が見つかりませんでした' }
  const col = columnIndex(daily[0])
  const need = ['年月日', '全体人数', '全体金額', '保険人数', '保険金額', '自費・商品人数', '自費・商品金額', '保険外人数', '保険外金額', '交通事故人数', '交通事故金額', '労災人数', '労災金額']
  const missing = need.filter((n) => col(n) < 0)
  if (missing.length > 0) return { ok: false, error: `NOAHの金額集計に「${missing.join('・')}」の列がありません` }

  const parsed: { date: string; values: number[] }[] = []
  for (const r of daily.slice(1)) {
    const date = toDate(r[col('年月日')])
    if (!date) continue
    const values = need.slice(1).map((n) => toInt(r[col(n)]))
    if (values.some((v) => v === null || v < 0)) return { ok: false, error: `${date} の行に読めない数字があります` }
    parsed.push({ date, values: values as number[] })
  }
  if (parsed.length === 0) return { ok: false, error: 'NOAHの金額集計に日ごとの行がありません' }

  const month = ymRow ? `${ymRow[0].trim().slice(0, 4)}-${ymRow[0].trim().slice(4, 6)}` : parsed[0].date.slice(0, 7)
  if (parsed.some((p) => p.date.slice(0, 7) !== month)) return { ok: false, error: '金額集計に、別の月の行がまざっています' }
  const thisMonth = today.slice(0, 7)
  if (month > thisMonth) return { ok: false, error: `${month} はまだ来ていない月です` }
  // 集計日：終わった月はその月の最終日、今月は今日
  const asOf = month < thisMonth ? `${month}-${pad(daysIn(month))}` : today
  const days = parsed
    .filter((p) => p.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => [Number(p.date.slice(8, 10)), ...p.values])
  const total = Array.from({ length: 12 }, (_, i) => days.reduce((s, d) => s + d[i + 1], 0))

  const items = (name: string, label: string): Array<[string, number, number, number]> => {
    const list = sec.get(name)
    if (!list || list.length < 2) return []
    const c = columnIndex(list[0])
    return list
      .slice(1)
      .map((r) => [String(r[c(label)] ?? '').trim().slice(0, 60), toInt(r[c('単価')]), toInt(r[c('金額')]), toInt(r[c('点数')])] as const)
      .filter((r): r is [string, number, number, number] => Boolean(r[0]) && [r[1], r[2], r[3]].every((v) => v !== null && v >= 0))
      .map((r) => [r[0], r[1], r[2], r[3]])
  }
  const rankRows = sec.get('エリアランキング')
  const rank: Array<[string, number, number]> = []
  if (rankRows && rankRows.length >= 2) {
    const c = columnIndex(rankRows[0])
    for (const r of rankRows.slice(1)) {
      const m = /^(\d{4})[/-](\d{1,2})$/.exec(String(r[c('年月')] ?? '').trim())
      const clinics = toInt(r[c('院数')])
      const place = toInt(r[c('順位')])
      if (m && clinics !== null && place !== null && clinics >= 0 && place >= 0) rank.push([`${m[1]}-${m[2].padStart(2, '0')}`, clinics, place])
    }
  }

  const noahMonth: NoahMonth = {
    month,
    asOf,
    exportedAt,
    file: file.slice(0, 80) || undefined,
    days,
    total,
    self: items('自費売上構成', '自費名'),
    goods: items('商品売上構成', '商品名'),
    rank,
  }
  const first = days[0]?.[0] ?? 1
  const last = Number(asOf.slice(8, 10))
  return {
    ok: true,
    month: noahMonth,
    label: `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月（${Number(month.slice(5, 7))}/${first}〜${Number(month.slice(5, 7))}/${last}）`,
  }
}

// ── アルファノート ─────────────────────────────────────

export type AlphaKind = 'subscription' | 'card' | 'qr'

/** 1件の支払い（日付と金額だけ。お名前・カード番号などは持たない） */
export interface AlphaPayment {
  date: string
  amount: number
  /** subscription … カードの継続（サブスク）／ card … カードの一括（窓口）／ qr … QR（PayPay・d払いなど） */
  kind: AlphaKind
}

export interface AlphaCsvResult {
  ok: true
  payments: AlphaPayment[]
  /** 取消・未確定などで数えなかった件数 */
  skipped: number
}

/** カードの取引一覧 → 支払い（ステータスが「売上確定」のものだけ） */
export function parseAlphaCredit(text: string): AlphaCsvResult | CsvError {
  const rows = parseCsv(text)
  if (rows.length < 1) return { ok: false, error: 'カードのCSVが空です' }
  const col = columnIndex(rows[0])
  if (col('決済日') < 0 || col('入力金額') < 0 || col('ステータス') < 0) {
    return { ok: false, error: 'カードのCSVに「決済日・入力金額・ステータス」の列がありません' }
  }
  const payments: AlphaPayment[] = []
  let skipped = 0
  for (const r of rows.slice(1)) {
    if (r.every((c) => !c.trim())) continue
    const date = toDate(r[col('決済日')])
    const amount = toInt(r[col('入力金額')])
    const status = String(r[col('ステータス')] ?? '').trim()
    const currency = col('入力通貨') >= 0 ? String(r[col('入力通貨')] ?? '').trim() : 'JPY'
    if (!date || amount === null || amount <= 0 || status !== '売上確定' || (currency && currency !== 'JPY')) {
      skipped += 1
      continue
    }
    const type = col('支払タイプ') >= 0 ? String(r[col('支払タイプ')] ?? '').trim() : ''
    payments.push({ date, amount, kind: type.startsWith('継続') ? 'subscription' : 'card' })
  }
  return { ok: true, payments, skipped }
}

/** QR の取引一覧 → 支払い（ステータスが「売上」で、取消日の無いものだけ） */
export function parseAlphaCashless(text: string): AlphaCsvResult | CsvError {
  const rows = parseCsv(text)
  if (rows.length < 1) return { ok: false, error: 'QRのCSVが空です' }
  const col = columnIndex(rows[0])
  if (col('決済日') < 0 || col('入力金額') < 0 || col('ステータス') < 0) {
    return { ok: false, error: 'QRのCSVに「決済日・入力金額・ステータス」の列がありません' }
  }
  const payments: AlphaPayment[] = []
  let skipped = 0
  for (const r of rows.slice(1)) {
    if (r.every((c) => !c.trim())) continue
    const date = toDate(r[col('決済日')])
    const amount = toInt(r[col('入力金額')])
    const status = String(r[col('ステータス')] ?? '').trim()
    const cancelled = col('取消日') >= 0 && String(r[col('取消日')] ?? '').trim() !== ''
    if (!date || amount === null || amount <= 0 || status !== '売上' || cancelled) {
      skipped += 1
      continue
    }
    payments.push({ date, amount, kind: 'qr' })
  }
  return { ok: true, payments, skipped }
}

// ── 月ごとのまとめと、NOAH に入っていないかもしれないもの ─────────

/** 1回でこの金額以上のカード一括・QR は、確かめてもらう（窓口の負担としては大きめ） */
export const LARGE_PAYMENT = 5_000

export interface AlphaCandidate {
  /** 画面の印に使う（同じ日・同じ金額が2件あっても別のものとして扱う） */
  id: string
  date: string
  amount: number
  kind: 'card' | 'qr'
  reasons: string[]
}

export interface AlphaMonthSummary {
  month: string
  subscription: { sum: number; count: number }
  card: { sum: number; count: number }
  qr: { sum: number; count: number }
  /** NOAH に入っていないかもしれない（院長に確かめてもらう）。足すかどうかは院長が決める */
  candidates: AlphaCandidate[]
  /** その月の NOAH の日ごとの集計が無く、日ごとの見比べができなかった */
  noahMissing: boolean
}

/**
 * 支払いを月ごとにまとめ、NOAH に入っていないかもしれないものを拾う
 * (a) NOAH に記録の無い日・来院 0 の日の支払い
 * (b) 1回 5,000円以上の支払い
 * (c) その日のカード一括＋QR の合計が、NOAH のその日の「自費・商品」＋「保険」の金額をこえる日（その日の分すべて）
 */
export function summarizeAlpha(payments: AlphaPayment[], noahMonths: NoahMonth[]): AlphaMonthSummary[] {
  const byMonth = new Map<string, AlphaPayment[]>()
  for (const p of payments) {
    const m = p.date.slice(0, 7)
    byMonth.set(m, [...(byMonth.get(m) ?? []), p])
  }
  const out: AlphaMonthSummary[] = []
  for (const [month, list] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const sum = (kind: AlphaKind) => {
      const items = list.filter((p) => p.kind === kind)
      return { sum: items.reduce((s, p) => s + p.amount, 0), count: items.length }
    }
    const noah = noahMonths.find((m) => m.month === month)
    const noahDay = new Map<string, { visits: number; window: number }>()
    for (const d of noah?.days ?? []) noahDay.set(`${month}-${pad(d[0])}`, { visits: d[1], window: d[4] + d[6] })
    const windowPaid = list.filter((p) => p.kind !== 'subscription')
    const dayTotal = new Map<string, number>()
    for (const p of windowPaid) dayTotal.set(p.date, (dayTotal.get(p.date) ?? 0) + p.amount)

    const candidates: AlphaCandidate[] = []
    windowPaid
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
      .forEach((p, i) => {
        const reasons: string[] = []
        if (noah) {
          const d = noahDay.get(p.date)
          if (!d || d.visits === 0) reasons.push('NOAHに来院の記録が無い日')
          else if ((dayTotal.get(p.date) ?? 0) > d.window) reasons.push('その日のNOAHの窓口の金額をこえる')
        }
        if (p.amount >= LARGE_PAYMENT) reasons.push(`1回${LARGE_PAYMENT.toLocaleString('ja-JP')}円以上`)
        if (reasons.length > 0) {
          candidates.push({ id: `${p.date}|${p.kind}|${p.amount}|${i}`, date: p.date, amount: p.amount, kind: p.kind as 'card' | 'qr', reasons })
        }
      })
    out.push({ month, subscription: sum('subscription'), card: sum('card'), qr: sum('qr'), candidates, noahMissing: !noah })
  }
  return out
}

/** 「その他の収入」に保存する形（subscription ＋（cashless − overlap）が売上に足される） */
export function extraFromSummary(s: AlphaMonthSummary, notInNoahIds: Set<string>, today: string) {
  const cashless = s.card.sum + s.qr.sum
  const added = s.candidates.filter((c) => notInNoahIds.has(c.id)).reduce((t, c) => t + c.amount, 0)
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
  const addedList = s.candidates
    .filter((c) => notInNoahIds.has(c.id))
    .map((c) => `${md(c.date)} ${c.amount.toLocaleString('ja-JP')}円`)
    .join('・')
  const note = [
    `CSV（${md(today)}）`,
    `サブスク${s.subscription.sum.toLocaleString('ja-JP')}円(${s.subscription.count}件)`,
    `カード一括${s.card.sum.toLocaleString('ja-JP')}円(${s.card.count}件)・QR${s.qr.sum.toLocaleString('ja-JP')}円(${s.qr.count}件)はNOAHと重なるので引く`,
    added > 0 ? `NOAH外として足した分：${addedList}` : '',
  ]
    .filter(Boolean)
    .join('。')
    .slice(0, 200)
  return { month: s.month, subscription: s.subscription.sum, cashless, overlap: cashless - added, note }
}
