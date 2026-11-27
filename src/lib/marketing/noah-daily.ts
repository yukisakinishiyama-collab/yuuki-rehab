/**
 * NOAH の「来院者日報」（1日分。NOAH から PDF に保存したもの）を読んで、1日の合計（数字だけ）にする決まり
 *
 * 2026-11-27 院長「売り上げ日報もCSVで登録保存、反映できるように」→「NOAHの日報をのせます」「PDFでした」。
 * 画面は日報（components/clinic/NoahDailyPdfImport.tsx）。PDF はブラウザの中で読み（lib/pdf-text.ts）、
 * お名前・受診者No・保険種別は外へ出さない。保存するのは、この日の合計と人数の内訳だけ（サーバーは noah-daily-server.ts）。
 *
 * 来院者日報の1行：No・受診者No・受診者氏名・保険種別・負担割合・施術額・負担金・徴収額・保険外・自費売上額・商品売上額・窓口領収額。
 * いちばん下の「日計」「累計」「前年」は、PDF では文字ではなく絵になっていて読めないので、行の数字を足して日計を出す
 * （2026-11-25 分の見本で、足した数が日計と同じことを確かめた）。紙の日計と同じかは、保存の前に院長が見比べる。
 */

/** 1日の合計（保存するのはこれだけ。お名前などは入れない） */
export interface NoahDailySheet {
  /** YYYY-MM-DD */
  date: string
  /** 来院（行の数） */
  visits: number
  /** 施術額（健康保険などの施術料金の合計＝10割） */
  treatment: number
  /** 負担金（窓口でいただく分の計算） */
  burden: number
  /** 徴収額（窓口でいただいた保険の分） */
  collected: number
  /** 保険外 */
  nonIns: number
  /** 自費売上額 */
  self: number
  /** 商品売上額 */
  goods: number
  /** 窓口領収額（その日に窓口でいただいた合計） */
  window: number
  /** 人数の内訳 */
  counts: {
    /** 施術額のある方（保険などで施術） */
    insured: number
    /** 施術額が0で、自費・商品・保険外だけの方 */
    selfOnly: number
    /** 自費売上のある方 */
    selfAny: number
    /** 商品売上のある方 */
    goodsAny: number
    /** 保険種別が交通事故の方 */
    accident: number
    /** 保険種別が労災の方 */
    workers: number
  }
  /** PDF のページ数 */
  pages: number
  /** 保存した日時（サーバーが入れる） */
  savedAt?: string
}

export const NOAH_DAILY_AMOUNT_KEYS = ['treatment', 'burden', 'collected', 'nonIns', 'self', 'goods', 'window'] as const
export type NoahDailyAmountKey = (typeof NOAH_DAILY_AMOUNT_KEYS)[number]

export const NOAH_DAILY_LABELS: Record<NoahDailyAmountKey, string> = {
  treatment: '施術額',
  burden: '負担金',
  collected: '徴収額',
  nonIns: '保険外',
  self: '自費',
  goods: '商品',
  window: '窓口領収',
}

export type NoahDailyParse =
  | { ok: true; sheet: NoahDailySheet; rows: number }
  | { ok: false; error: string }

/** '1,227' '-500' '△500' → 数（読めなければ null） */
export function amountOf(token: string): number | null {
  const t = String(token ?? '').normalize('NFKC').trim()
  const m = t.match(/^([-△▲]?)(\d{1,3}(?:,\d{3})+|\d+)$/)
  if (!m) return null
  const n = Number(m[2].replace(/,/g, ''))
  return m[1] ? -n : n
}

/** 「令和8年11月25日分」→ '2026-11-25'（見つからなければ ''） */
export function dateOfTitle(text: string): string {
  const t = text.normalize('NFKC').replace(/\s+/g, '')
  const m = t.match(/令和(\d{1,2}|元)年(\d{1,2})月(\d{1,2})日分/)
  if (!m) return ''
  const year = 2018 + (m[1] === '元' ? 1 : Number(m[1]))
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** PDF の行（左からのかたまり）→ 1日の合計 */
export function parseNoahDaily(lines: Array<{ page: number; tokens: string[] }>): NoahDailyParse {
  const joined = lines.map((l) => l.tokens.join(''))
  if (!joined.some((t) => t.includes('来院者日報'))) return { ok: false, error: 'NOAH の「来院者日報」ではないようです' }
  const date = joined.map(dateOfTitle).find(Boolean) ?? ''
  if (!date) return { ok: false, error: '日報の日付（令和◯年◯月◯日分）が読めませんでした' }

  const sheet: NoahDailySheet = {
    date,
    visits: 0,
    treatment: 0,
    burden: 0,
    collected: 0,
    nonIns: 0,
    self: 0,
    goods: 0,
    window: 0,
    counts: { insured: 0, selfOnly: 0, selfAny: 0, goodsAny: 0, accident: 0, workers: 0 },
    pages: Math.max(1, ...lines.map((l) => l.page)),
  }
  const seen = new Set<number>()
  const unreadable: number[] = []
  let printedTotal: { visits: number | null; amounts: number[] } | null = null

  for (const line of lines) {
    const t = line.tokens
    if (!t.length) continue
    // 「日計」の行（文字で入っている PDF のときだけ）：あとで足した数と比べる
    if (t[0] === '日計') {
      const amounts = t.map(amountOf).filter((v): v is number => v !== null)
      const visitTok = t.join('').match(/来院(\d+)人/)
      printedTotal = { visits: visitTok ? Number(visitTok[1]) : null, amounts: amounts.slice(-7) }
      continue
    }
    if (!/^\d{1,3}$/.test(t[0])) continue
    const no = Number(t[0])
    const nums = t.slice(-7).map(amountOf)
    const ok = t.length >= 9 && nums.every((v) => v !== null)
    if (!ok) {
      // 番号で始まる行なのに数字が7つ並んでいない＝読めなかった行（その日の合計がずれるので、保存しない）
      if (t.length >= 4) unreadable.push(no)
      continue
    }
    if (seen.has(no)) continue
    seen.add(no)
    const [treatment, burden, collected, nonIns, self, goods, windowAmt] = nums as number[]
    const ratioAt = t.length - 8
    const kindAt = /割$/.test(t[ratioAt]) ? ratioAt - 1 : ratioAt
    const kind = t[kindAt] ?? ''
    sheet.visits += 1
    sheet.treatment += treatment
    sheet.burden += burden
    sheet.collected += collected
    sheet.nonIns += nonIns
    sheet.self += self
    sheet.goods += goods
    sheet.window += windowAmt
    if (treatment !== 0) sheet.counts.insured += 1
    else if (self !== 0 || goods !== 0 || nonIns !== 0) sheet.counts.selfOnly += 1
    if (self !== 0) sheet.counts.selfAny += 1
    if (goods !== 0) sheet.counts.goodsAny += 1
    if (/交通事故|自賠責/.test(kind)) sheet.counts.accident += 1
    if (/労災/.test(kind)) sheet.counts.workers += 1
  }

  if (unreadable.length) return { ok: false, error: `読めなかった行があります（No.${unreadable.join('・')}）。合計がずれるので保存しません` }
  if (sheet.visits === 0) return { ok: false, error: 'この日報には、来院の行がありませんでした' }
  // 番号が飛んでいないか（1 から続いているか）
  const missing: number[] = []
  for (let n = 1; n <= Math.max(...seen); n += 1) if (!seen.has(n)) missing.push(n)
  if (missing.length) return { ok: false, error: `行の番号が飛んでいます（No.${missing.slice(0, 5).join('・')}${missing.length > 5 ? ' ほか' : ''}）。全部のページが入った PDF か確かめてください` }

  if (printedTotal) {
    const sums = NOAH_DAILY_AMOUNT_KEYS.map((k) => sheet[k])
    const amountsMatch = printedTotal.amounts.length === 7 && printedTotal.amounts.every((v, i) => v === sums[i])
    const visitsMatch = printedTotal.visits === null || printedTotal.visits === sheet.visits
    if (!amountsMatch || !visitsMatch) return { ok: false, error: '行を足した数が、日報の「日計」と合いません。保存しません' }
  }
  return { ok: true, sheet, rows: sheet.visits }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isInt = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** サーバーで受け取るときの確かめ（数字だけの形か）。だめなら理由 */
export function sheetProblem(x: unknown): string | null {
  if (!x || typeof x !== 'object') return '形が正しくありません'
  const s = x as Record<string, unknown>
  if (typeof s.date !== 'string' || !DATE_RE.test(s.date)) return '日付が正しくありません'
  if (!isInt(s.visits, 1, 500)) return '来院の数が正しくありません'
  for (const k of NOAH_DAILY_AMOUNT_KEYS) if (!isInt(s[k], -10_000_000, 10_000_000)) return `${NOAH_DAILY_LABELS[k]}が正しくありません`
  if (!isInt(s.pages, 1, 50)) return 'ページ数が正しくありません'
  const c = s.counts as Record<string, unknown> | undefined
  if (!c || typeof c !== 'object') return '人数の内訳がありません'
  for (const k of ['insured', 'selfOnly', 'selfAny', 'goodsAny', 'accident', 'workers']) if (!isInt(c[k], 0, 500)) return '人数の内訳が正しくありません'
  return null
}

/** 受け取った形から、決めた項目だけを取り出す（ほかの項目＝お名前などが混じっても保存しない） */
export function cleanSheet(s: NoahDailySheet, savedAt: string): NoahDailySheet {
  return {
    date: s.date,
    visits: s.visits,
    treatment: s.treatment,
    burden: s.burden,
    collected: s.collected,
    nonIns: s.nonIns,
    self: s.self,
    goods: s.goods,
    window: s.window,
    counts: {
      insured: s.counts.insured,
      selfOnly: s.counts.selfOnly,
      selfAny: s.counts.selfAny,
      goodsAny: s.counts.goodsAny,
      accident: s.counts.accident,
      workers: s.counts.workers,
    },
    pages: s.pages,
    savedAt,
  }
}
