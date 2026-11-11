// ──────────────────────────────────────────────
// 契約書・同意書の記入欄を、カルテ・今日の日付・会員の手続きの欄から自動で埋める（純粋な関数）
//
// 院長の決めたこと（2026-11-11「名前を書くところ以外は自動入力。チェックシートは別」）:
// - 署名（指で書くお名前）は自動にしない。□ のチェックも自動で入れない（患者さんが自分で付ける）
// - それ以外の記入欄は、分かるものを先に入れておく。カルテや今日の日付から入れたものは書きかえられる
// - 会員の手続きの欄（利用開始日・休会の月・契約終了日・兄弟・親子プランのもう1名）から入るものは、
//   文面と院の記録が食いちがわないように、その欄でだけ直せる（文面の側は読むだけ）
// 欄は「欄の前の文字」と「表の行の見出し」で見分ける（番号で決め打ちしない。文面を直しても外れにくいように）。
// ──────────────────────────────────────────────
import type { MemberStatus } from '@/types/contracts'
import type { Block, Part, ParsedTemplate } from './template'
import { jaDate } from './template'
import { addMonthsYm, cancelEndOf, PAIR_PLAN, type MemberInput } from './member'

export interface BlankInfo {
  i: number
  kind: 'text' | 'date' | 'time'
  /** 欄の前の文字（「学校名」「利用開始日」「その他」など） */
  label: string
  /** 表の中なら、その行のいちばん左のマスの文字 */
  row: string
  /** いちばん近い見出し（## / ###） */
  section: string
}

export interface CheckInfo {
  i: number
  /** □ のうしろの文字（次の □ か記入欄まで） */
  after: string
  row: string
  section: string
}

export type AutoSource = 'karte' | 'today' | 'member'

export interface AutoValue {
  value: string
  source: AutoSource
  /** 会員の手続きの欄から入るもの（文面の側では直さない） */
  locked?: boolean
}

const textOf = (parts: Part[]) =>
  parts
    .map((p) => (p.t === 'text' ? p.v : ''))
    .join('')
    .trim()

/** 欄の前の文字を、見出しの言葉だけにする（「学生会員（学校名：」→「学校名」、「□ その他（」→「その他」） */
function cleanLabel(raw: string): string {
  let s = raw.replace(/[：:（(\s　]+$/u, '').trim()
  const open = Math.max(s.lastIndexOf('（'), s.lastIndexOf('('))
  const close = Math.max(s.lastIndexOf('）'), s.lastIndexOf(')'))
  if (open > close) s = s.slice(open + 1)
  return s.replace(/^[□・\s　]+/u, '').trim()
}

/** 記入欄・チェックの一つずつに、見分けるための文字を付ける */
export function describeTemplate(parsed: ParsedTemplate): { blanks: BlankInfo[]; checks: CheckInfo[] } {
  const blanks: BlankInfo[] = []
  const checks: CheckInfo[] = []
  let section = ''

  const walk = (parts: Part[], row: string) => {
    let before = ''
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k]
      if (p.t === 'text') {
        before += p.v
        continue
      }
      if (p.t === 'blank') {
        const label = cleanLabel(before) || row
        blanks.push({ i: p.i, kind: p.kind, label, row, section })
      } else {
        let after = ''
        for (let j = k + 1; j < parts.length && parts[j].t === 'text'; j++) after += (parts[j] as { v: string }).v
        checks.push({ i: p.i, after: after.trim(), row, section })
      }
      before = ''
    }
  }

  const visit = (block: Block) => {
    switch (block.type) {
      case 'h2':
      case 'h3':
        section = textOf(block.parts)
        walk(block.parts, '')
        break
      case 'title':
        break
      case 'ul':
        for (const it of block.items) walk(it, '')
        break
      case 'table':
        if (block.head) for (const h of block.head) walk(h, '')
        for (const r of block.rows) {
          const row = textOf(r[0] ?? [])
          r.forEach((cell, ci) => walk(cell, ci === 0 ? '' : row))
        }
        break
      default:
        walk(block.parts, '')
    }
  }
  for (const b of parsed.blocks) visit(b)
  blanks.sort((a, b) => a.i - b.i)
  checks.sort((a, b) => a.i - b.i)
  return { blanks, checks }
}

// ── 日付の形 ─────────────────────────────────

const YMD = /^\d{4}-\d{2}-\d{2}$/
const YM = /^\d{4}-\d{2}$/

/** 2026-12 → 2026年12月 */
export function jaMonth(ym: string): string {
  return YM.test(ym) ? `${Number(ym.slice(0, 4))}年${Number(ym.slice(5, 7))}月` : ym
}

/** 2026-11-20 → 2026/11/20（通院頻度 変更確認書の「例 2026/11/20」に合わせる） */
export function slashDate(ymd: string): string {
  return YMD.test(ymd) ? ymd.replace(/-/g, '/') : ymd
}

/** n か月後の同じ日（無い日は月末に寄せる）。2026-01-31 + 1 → 2026-02-28 */
export function addMonthsYmd(ymd: string, n: number): string {
  if (!YMD.test(ymd)) return ''
  const ym = addMonthsYm(ymd.slice(0, 7), n)
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const d = Math.min(Number(ymd.slice(8, 10)), last)
  return `${ym}-${String(d).padStart(2, '0')}`
}

// ── カルテから入れるもの ─────────────────────────

export interface AutofillPatient {
  mainComplaint?: string
  diagnosisLabel?: string
  occupation?: string
}

const SCHOOL = /学校|小学|中学|高校|高等|大学|高専|学園|学院|附属|付属/

/** 学校名に見えるときだけ（職業の欄に「会社員」などが入っていることがあるため） */
export function schoolOf(p: AutofillPatient | null | undefined): string {
  const v = String(p?.occupation ?? '').trim()
  return SCHOOL.test(v) ? v.slice(0, 40) : ''
}

/** 主な目的・部位（カルテの「診断名・部位」と「主訴」から短く） */
export function purposeOf(p: AutofillPatient | null | undefined): string {
  const dx = String(p?.diagnosisLabel ?? '').replace(/\s+/g, ' ').trim()
  const cc = String(p?.mainComplaint ?? '').replace(/\s+/g, ' ').trim()
  const v = dx && cc && !cc.includes(dx) && !dx.includes(cc) ? `${dx}（${cc}）` : dx || cc
  return v.length > 60 ? `${v.slice(0, 59)}…` : v
}

export interface AutofillContext {
  docId: string
  today: string
  patient: AutofillPatient
  /** 会員の手続きの欄（入会・休会・解約の書類だけ） */
  member?: MemberInput
  /** この方の会員の状態（休会・解約の「利用開始日」に使う） */
  status?: MemberStatus
  /** 兄弟・親子プランのもう1名のカルテ（選んだとき） */
  partnerPatient?: AutofillPatient | null
  /** 画面で入れた値（開始日を直したら、1か月後・3か月後の評価日もそれに合わせる） */
  inputs?: Array<string | null | undefined>
}

/**
 * 記入欄ごとの自動の値。入れられないものは null（空欄のまま、手で書く）
 */
export function autofillContract(parsed: ParsedTemplate, ctx: AutofillContext): Array<AutoValue | null> {
  const { blanks } = describeTemplate(parsed)
  const out: Array<AutoValue | null> = Array(parsed.blankCount).fill(null)
  const typed = (i: number) => {
    const v = ctx.inputs?.[i]
    return typeof v === 'string' ? v : null
  }
  const karte = (value: string): AutoValue | null => (value ? { value, source: 'karte' } : null)
  const fromMember = (value: string): AutoValue => ({ value, source: 'member', locked: true })
  const m = ctx.member ?? {}
  const pair = m.plan === PAIR_PLAN
  const isPartnerSection = (b: BlankInfo) => /もう1名/.test(b.section)

  for (const b of blanks) {
    let v: AutoValue | null = null
    switch (ctx.docId) {
      case 'member-contract':
        if (isPartnerSection(b)) {
          if (!pair) break
          if (b.row === '氏名') v = fromMember(String(m.partnerName ?? '').trim())
          else if (b.row === '生年月日') v = fromMember(m.partnerBirthDate && YMD.test(m.partnerBirthDate) ? jaDate(m.partnerBirthDate) : '')
          else if (b.row.startsWith('続柄')) v = fromMember(String(m.partnerRelation ?? '').trim())
          else if (b.row.startsWith('主な目的')) v = karte(purposeOf(ctx.partnerPatient))
        } else if (b.label === '学校名') {
          v = m.plan === '学生会員' ? karte(schoolOf(ctx.patient)) : null
        } else if (b.label === '利用開始日') {
          v = fromMember(m.start && YMD.test(m.start) ? jaDate(m.start) : '')
        } else if (b.label.startsWith('主な目的')) {
          v = karte(purposeOf(ctx.patient))
        }
        break
      case 'member-pause': {
        const months = Number(m.pauseMonths)
        const from = m.pauseFrom && YM.test(m.pauseFrom) ? m.pauseFrom : ''
        if (b.label === '利用開始日') v = ctx.status?.start ? karte(jaDate(ctx.status.start)) : null
        else if (b.label === '休会届の提出日') v = { value: jaDate(ctx.today), source: 'today' }
        else if (b.label === '休会の開始月') v = fromMember(from ? jaMonth(from) : '')
        else if (b.label === '再開予定月') v = fromMember(from && months >= 1 ? jaMonth(addMonthsYm(from, months)) : '')
        else if (b.row === '休会の月数' && b.label === 'その他') v = fromMember(months > 3 ? `${months}か月` : '')
        break
      }
      case 'member-cancel': {
        const end = cancelEndOf(ctx.today)
        if (b.label === '利用開始日') v = ctx.status?.start ? karte(jaDate(ctx.status.start)) : null
        else if (b.label === '解約届の提出日') v = { value: jaDate(ctx.today), source: 'today' }
        else if (b.label === '契約終了日') v = fromMember(jaDate(end))
        else if (b.label === '最後の決済月') v = fromMember(jaMonth(end.slice(0, 7)))
        break
      }
      case 'visit-frequency':
        if (b.label.startsWith('部位')) v = karte(purposeOf(ctx.patient))
        else if (b.label === '変更日') v = { value: slashDate(ctx.today), source: 'today' }
        break
      case 'medical-cooperation': {
        if (b.kind !== 'date') break
        const startBlank = blanks.find((x) => x.kind === 'date' && x.label === '開始日')
        const start = (startBlank && typed(startBlank.i)) || ctx.today
        if (b.label === '開始日') v = { value: ctx.today, source: 'today' }
        else if (b.label === '1か月評価予定日' && YMD.test(start)) v = { value: addMonthsYmd(start, 1), source: 'today' }
        else if (b.label === '3か月評価予定日' && YMD.test(start)) v = { value: addMonthsYmd(start, 3), source: 'today' }
        break
      }
    }
    out[b.i] = v
  }
  return out
}

/**
 * 画面・印刷・保存に使う値：会員の手続きの欄から入るものはその値、
 * ほかは手で入れた値（触っていなければ自動の値）
 */
export function effectiveInputs(inputs: Array<string | null | undefined>, auto: Array<AutoValue | null>): string[] {
  const n = Math.max(inputs.length, auto.length)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const a = auto[i]
    const typed = inputs[i]
    out.push(a?.locked ? a.value : typeof typed === 'string' ? typed : (a?.value ?? ''))
  }
  return out
}

/** 会員プランの入会書の「□ 申し込む」が、どの種別の行か（チェックしたら下の会員の種別もそれにする） */
export function planOfCheck(info: CheckInfo | undefined): string | null {
  if (!info || !/申し込む/.test(info.after)) return null
  if (info.row.startsWith('一般会員')) return '一般会員'
  if (info.row.startsWith('学生会員')) return '学生会員'
  if (info.row.startsWith('兄弟・親子プラン')) return PAIR_PLAN
  return null
}

/** 休会届の「□ 1か月」などが何か月か */
export function pauseMonthsOfCheck(info: CheckInfo | undefined): number | null {
  if (!info || info.row !== '休会の月数') return null
  const mm = /^([1-3])か月/.exec(info.after)
  return mm ? Number(mm[1]) : null
}
