// ──────────────────────────────────────────────
// 会員プランの書類の頭に入れる「ご契約内容」の枠（純粋な関数）
//
// 院長の依頼（2026-11-13）:「会員プランの契約書のプリントを、契約内容がわかるように。患者様控えも同じようにでき、
// 署名（直筆）も載るように。アプリからも契約内容を確認できるように」。
//
// - 署名するとき：書類のいちばん上（題名のすぐ下）に、だれが・どのプランを・いくらで・いつから、を1つの枠にまとめ、
//   直筆の署名も並べる。この枠は署名した書類の一部として保存され、院保管用にも患者様控えにも同じものが出る
// - 枠の中身は、その書類の文面・チェック・記入と、下の署名欄から作る（文面とちがう数字を別に持たない。
//   1部位施術料は、文面の表の行から読む）
// - 2026-11-13 より前に署名した入会の書類には、この枠が無い。保存した本文は書きかえず、
//   画面で見るとき・印刷するときにだけ、同じ形の枠を本文の前に足して見せる（withContractSummary）
// ──────────────────────────────────────────────
import type { ContractRecord, MemberStatus } from '@/types/contracts'
import type { ParsedTemplate, Part } from './template'
import { escapeHtml, jaDate } from './template'
import type { BlankInfo, CheckInfo } from './autofill'
import { MEMBER_FEES, memberEventRows, minEndOf } from './member'

export type SummaryRow = [string, string]

export interface SummarySignature {
  /** だれの署名か（患者様・保護者（母）・説明担当者 など） */
  label: string
  name: string
  /** 指で書いた署名（PNG の data URL） */
  image?: string | null
}

const SIG_IMAGE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/

const textOf = (parts: Part[] | undefined) =>
  (parts ?? [])
    .map((p) => (p.t === 'text' ? p.v : ''))
    .join('')
    .trim()

/** 文面の表から「来院ごとの1部位施術料」の行を読む（見出しと金額）。文面と同じ数字だけを枠に出すため */
export function visitFeeOf(parsed: ParsedTemplate): { label: string; amount: string } | null {
  for (const block of parsed.blocks) {
    if (block.type !== 'table') continue
    for (const row of block.rows) {
      const label = textOf(row[0])
      if (label.startsWith('来院ごとの1部位施術料')) return { label, amount: textOf(row[1]) }
    }
  }
  return null
}

/** 開始時の通院頻度の目安（文面の「通院頻度」の □ から。その他は書いた内容） */
export function visitFrequencyOf(described: { blanks: BlankInfo[]; checks: CheckInfo[] }, checks: boolean[], values: string[]): string {
  const picked: string[] = []
  for (const c of described.checks) {
    if (!checks[c.i] || !c.section.includes('通院頻度')) continue
    const word = c.after.replace(/[（(\s　]+$/u, '').trim()
    if (/^週\d回$/.test(word)) picked.push(word)
    else if (word === 'その他') {
      const other = described.blanks.find((b) => b.section === c.section && b.label === 'その他')
      const v = other ? String(values[other.i] ?? '').trim() : ''
      picked.push(v ? `その他（${v}）` : 'その他')
    }
  }
  return picked.join('・')
}

/** 記入欄の値（欄の前の文字で探す。表の中の欄は除く） */
function blankValue(described: { blanks: BlankInfo[] }, values: string[], label: string): string {
  const hit = described.blanks.find((b) => b.label === label && !b.row)
  return hit ? String(values[hit.i] ?? '').trim() : ''
}

function partyOf(record: Pick<ContractRecord, 'patientName' | 'guardianName' | 'relation'>): string {
  const guardian = record.guardianName ? `（保護者：${record.guardianName}${record.relation ? `・${record.relation}` : ''}）` : ''
  return `${record.patientName} 様${guardian}`
}

/** 入会の書類の「ご契約内容」。visitFee は文面から読んだもの（無ければ行を出さない） */
function joinRows(
  record: ContractRecord,
  extra: { visitFee?: { label: string; amount: string } | null; school?: string; frequency?: string; purpose?: string },
): SummaryRow[] {
  const ev = record.member
  if (!ev || ev.kind !== 'join' || !ev.plan || !ev.start) return []
  const rows: SummaryRow[] = []
  rows.push(['ご契約者', partyOf(record)])
  rows.push(['プラン', `${ev.plan}${ev.plan === '学生会員' && extra.school ? `（学校名：${extra.school}）` : ''}`])
  rows.push(['月額料金', `${MEMBER_FEES[ev.plan].replace(/^月額/, '')}（税込）`])
  if (ev.partner) {
    rows.push([
      'もう1名の利用者',
      `${ev.partner.name} 様（${ev.partner.relation ?? ''}${ev.partner.birthDate ? `・${jaDate(ev.partner.birthDate)}生` : ''}）`,
    ])
  }
  if (extra.visitFee?.amount) {
    rows.push([extra.visitFee.label, `${extra.visitFee.amount}${ev.partner ? '（来院した方ごと・施術した部位ごと）' : ''}`])
  }
  rows.push(['利用開始日（最初の決済日）', jaDate(ev.start)])
  rows.push(['最低利用期間', `利用開始日から3か月（${jaDate(minEndOf(ev.start))}まで）`])
  rows.push(['満了後', '解約のお申し出がない場合は、1か月ごとに自動更新'])
  rows.push(['お支払い', 'クレジットカード決済（毎月の決済日に月額料金）'])
  if (extra.frequency) rows.push(['通院頻度の目安（開始時）', extra.frequency])
  if (extra.purpose) rows.push(['主な目的・部位', extra.purpose])
  rows.push(['解約するとき', '解約届を15日までに提出すると当月末、16日以降は翌月末で終了'])
  rows.push(['ご署名日', jaDate(record.signedDate)])
  return rows
}

const TITLE: Record<'join' | 'pause' | 'cancel', string> = {
  join: 'ご契約内容',
  pause: '休会の内容',
  cancel: '解約の内容',
}

/** 枠の HTML（保存する書類・印刷・画面で同じもの） */
export function summaryBoxHtml(title: string, rows: SummaryRow[], signatures: SummarySignature[]): string {
  if (rows.length === 0) return ''
  const sigs = signatures
    .filter((s) => s.name || s.image)
    .map((s) => {
      const img = s.image && SIG_IMAGE.test(s.image) ? `<img src="${s.image}" alt="${escapeHtml(s.label)}の署名">` : ''
      return `<div class="sum-sig"><span>${escapeHtml(s.label)}：${escapeHtml(s.name)}</span>${img}</div>`
    })
    .join('')
  return (
    `<div class="contract-summary"><h3>${escapeHtml(title)}</h3><table>${rows
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
      .join('')}</table>` +
    (sigs ? `<div class="sum-sigs">${sigs}</div>` : '') +
    `<p class="sum-note">この枠は、下の書類の内容を見やすくまとめたものです。くわしい条件は、下の書類のとおりです。</p></div>`
  )
}

export interface SummaryInput {
  record: ContractRecord
  /** この書類に署名する前の会員の状態（休会届・解約届の日付の計算に使う） */
  before: MemberStatus
  parsed: ParsedTemplate
  described: { blanks: BlankInfo[]; checks: CheckInfo[] }
  checks: boolean[]
  values: string[]
  signatures: SummarySignature[]
}

/** 署名するときに作る枠（会員プランの入会・休会・解約の書類だけ。ほかの書類は ''） */
export function contractSummaryHtml(input: SummaryInput): string {
  const { record, before, parsed, described, checks, values, signatures } = input
  const ev = record.member
  if (!ev) return ''
  if (ev.kind === 'join') {
    const rows = joinRows(record, {
      visitFee: visitFeeOf(parsed),
      school: blankValue(described, values, '学校名'),
      frequency: visitFrequencyOf(described, checks, values),
      purpose: blankValue(described, values, '主な目的・部位'),
    })
    return summaryBoxHtml(TITLE.join, rows, signatures)
  }
  const rows: SummaryRow[] = [['ご契約者', partyOf(record)], ...memberEventRows(ev, before), ['ご署名日', jaDate(record.signedDate)]]
  return rows.length > 2 ? summaryBoxHtml(TITLE[ev.kind], rows, signatures) : ''
}

/** 枠を、書類の題名・院名・注意書きのすぐ下（最初の見出しの前）に入れる */
export function insertSummary(docHtml: string, box: string): string {
  if (!box) return docHtml
  const at = docHtml.indexOf('<h3>')
  return at === -1 ? `${box}${docHtml}` : `${docHtml.slice(0, at)}${box}\n${docHtml.slice(at)}`
}

/** 署名した本文に、もう枠が入っているか */
export function hasContractSummary(html: string): boolean {
  return html.includes('<div class="contract-summary">')
}

/** 保存した本文の署名欄から、署名（お名前と直筆の画像）を読む */
export function signaturesFromHtml(html: string): SummarySignature[] {
  const at = html.indexOf('<table class="sigtable">')
  if (at === -1) return []
  const end = html.indexOf('</table>', at)
  const table = html.slice(at, end === -1 ? undefined : end)
  const out: SummarySignature[] = []
  const row = /<tr><th>([^<]*)<\/th><td>([^<]*)(?:<div class="sig"><img src="(data:image\/png;base64,[A-Za-z0-9+/=]+)" alt="署名"><\/div>)?<\/td><\/tr>/g
  const unescape = (v: string) => v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  let m: RegExpExecArray | null
  while ((m = row.exec(table))) {
    const label = unescape(m[1])
    if (label.startsWith('説明日')) continue
    // 「患者様氏名」→「患者様」、「保護者氏名（母）」→「保護者（母）」。担当者はそのまま
    out.push({ label: label.replace('氏名', ''), name: unescape(m[2]).trim(), image: m[3] ?? null })
  }
  return out
}

/**
 * 画面で見る・印刷するときの本文。
 * 枠の無い古い入会の書類（2026-11-13 より前に署名）には、記録と本文から作った同じ形の枠を足す。
 * 保存してある本文そのものは書きかえない
 */
export function withContractSummary(html: string, record: ContractRecord): string {
  if (hasContractSummary(html)) return html
  const ev = record.member
  if (!ev || ev.kind !== 'join') return html
  const fee = /<td>(来院ごとの1部位施術料[^<]*)<\/td><td>([^<]*)<\/td>/.exec(html)
  const rows = joinRows(record, { visitFee: fee ? { label: fee[1], amount: fee[2] } : null })
  return insertSummary(html, summaryBoxHtml(TITLE.join, rows, signaturesFromHtml(html)))
}

/** 一覧に出す1行（アプリで、開かなくても契約の中身が分かるように）。会員の書類でなければ '' */
export function memberLineOf(record: ContractRecord): string {
  const ev = record.member
  if (!ev) return ''
  if (ev.kind === 'join' && ev.plan && ev.start) {
    return [
      `${ev.plan}（${MEMBER_FEES[ev.plan]}）`,
      ev.partner ? `もう1名：${ev.partner.name}さん` : '',
      `利用開始 ${jaDate(ev.start)}`,
      `最低利用期間 ${jaDate(minEndOf(ev.start))}まで`,
    ]
      .filter(Boolean)
      .join('・')
  }
  if (ev.kind === 'pause' && ev.pauseFrom && ev.pauseMonths) {
    const [y, m] = ev.pauseFrom.split('-').map(Number)
    return `休会：${y}年${m}月から${ev.pauseMonths}か月`
  }
  if (ev.kind === 'cancel' && ev.end) return `解約：契約終了日 ${jaDate(ev.end)}${ev.special ? '（最低利用期間の途中・特別な事情）' : ''}`
  return ''
}

/** 保存した本文を画面にそのまま出してよいか（アプリが作った本文には、スクリプトや外の読み込みは入らない） */
export function isSafeContractHtml(html: string): boolean {
  return !/<script|<iframe|<object|<embed|<link|javascript:|\son[a-z]+\s*=/i.test(html)
}
