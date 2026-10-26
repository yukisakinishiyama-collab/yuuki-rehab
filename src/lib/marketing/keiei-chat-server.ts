/**
 * 経営相談チャット（院長のみ）
 *
 * 院の集計の数字（NOAH の月ごとの売上・来院、予約、PDCA、NOAH以外の収入、目標）を文脈にして、
 * AI（Anthropic）と相談する。患者さんのお名前・電話などの個人情報は一切渡さない。
 * 会話は KV（keiei:chat）に残す（PCとスマホで同じ会話を続けられる）。
 * AI を使うと Anthropic の API の料金がかかる（1往復あたり数円〜十数円ほどの目安）。
 */
import Anthropic from '@anthropic-ai/sdk'
import { kvGet, kvSet } from './kv-store-server'
import { getNoahStore } from './noah-server'
import { fetchHubStatsFast } from './booking-stats-fast'
import { listWithChecks } from './pdca-server'
import { monthPoints, prevMonthOf, summarize, weekdayAverages } from './noah-analysis'
import { jstParts } from './autopilot-planner'
import { GENERATION_MODEL } from './generate-server'
import { DECISION_LABELS, METRICS } from './pdca'
import { sourceLabel } from './booking-stats-labels'
import type { NoahMonth } from './noah-types'
import type { ExtraMonth } from '@/app/api/marketing/keiei-extra/route'

export const CHAT_KEY = 'keiei:chat'
const MAX_MESSAGES = 80
/** AI に渡す直近の往復数 */
const CONTEXT_TURNS = 24

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  at: string
}

interface ChatStore {
  messages: ChatMessage[]
}

export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MARKETING_MODE !== 'mock'

export async function listMessages(): Promise<ChatMessage[]> {
  const store = await kvGet<ChatStore>(CHAT_KEY)
  return Array.isArray(store?.messages) ? store.messages : []
}

export async function saveMessages(messages: ChatMessage[]): Promise<void> {
  await kvSet(CHAT_KEY, { messages: messages.slice(-MAX_MESSAGES) } satisfies ChatStore)
}

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')

function sumMonth(m: NoahMonth) {
  const t = { visits: 0, sales: 0, insS: 0, selfS: 0, selfV: 0, accS: 0, openDays: 0 }
  for (const p of monthPoints(m)) {
    t.visits += p.visits
    t.sales += p.sales
    t.insS += p.ins[1] + p.work[1] + p.nonIns[1]
    t.selfS += p.self[1]
    t.selfV += p.self[0]
    t.accS += p.acc[1]
    if (p.visits > 0) t.openDays += 1
  }
  return t
}

/**
 * AI に渡す「院のいまの数字」。集計だけ（個人情報なし）。
 * 画面にも同じ文をそのまま出して、何を渡しているかを院長が確かめられるようにする。
 */
export async function buildContext(goal?: number | null): Promise<string> {
  const today = jstParts(new Date()).date
  const [noah, stats, pdca, extra] = await Promise.all([
    getNoahStore().catch(() => null),
    fetchHubStatsFast(30).catch(() => null),
    listWithChecks().catch(() => null),
    kvGet<{ months: Record<string, ExtraMonth> }>('keiei:extra').catch(() => null),
  ])
  const lines: string[] = [`今日: ${today}`]

  const months = [...(noah?.months ?? [])].sort((a, b) => b.month.localeCompare(a.month))
  const s = months.length ? summarize(months) : null
  if (s) {
    lines.push(
      '',
      `【今月（${s.mtd.month}、${s.date}まで）】来院 ${s.mtd.visits}回／売上 ${yen(s.mtd.sales)}（NOAHの金額は保険の請求分も含めた総額）`,
      s.prev ? `【先月の同じ時期】来院 ${s.prev.visits}回／売上 ${yen(s.prev.sales)}` : '',
      s.newcomers !== null ? `初めての方（新患＋再初検）今月 ${s.newcomers}人${s.prevNewcomers !== null ? `／先月 ${s.prevNewcomers}人` : ''}` : '',
      s.repeat?.last != null && s.repeat.gone != null
        ? `先月来られた ${s.repeat.last}人のうち、今月まだ来られていない方 ${s.repeat.gone}人${s.repeat.selfGone != null ? `（自費の方 ${s.repeat.selfGone}人）` : ''}`
        : '',
    )
    const wa = weekdayAverages(months, s.date)
    if (wa.length) {
      lines.push(`曜日ごとの平均来院（直近8週）: ${wa.filter((w) => w.avg !== null).map((w) => `${w.label} ${w.avg!.toFixed(1)}`).join('、')}`)
    }
    lines.push('', '【月ごとの推移（新しい月が上。途中の月はその日まで）】')
    for (const m of months.slice(0, 13)) {
      const t = sumMonth(m)
      const ex = extra?.months?.[m.month]
      const outside = ex ? Math.max(0, ex.subscription + ex.cashless - ex.overlap) : 0
      lines.push(
        `- ${m.month}${m.asOf.slice(8, 10) !== String(new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)), 0).getDate()).padStart(2, '0') ? `（${Number(m.asOf.slice(8, 10))}日まで）` : ''}: 来院 ${t.visits}回／診療日 ${t.openDays}日／売上 ${yen(t.sales)}（自費・商品 ${yen(t.selfS)}＝${pct(t.selfS, t.sales)}、交通事故 ${yen(t.accS)}）${outside ? `／NOAH以外の収入 ${yen(outside)}（サブスクなど）` : ''}${m.repeat?.newPt != null ? `／新患 ${m.repeat.newPt}` : ''}${m.repeat?.reinit != null ? `・再初検 ${m.repeat.reinit}` : ''}`,
      )
    }
    const cur = months[0]
    if (cur?.self?.length || cur?.goods?.length) {
      const top = [...(cur.self ?? []), ...(cur.goods ?? [])].sort((a, b) => b[2] - a[2]).slice(0, 8)
      lines.push(`今月の自費・商品の内訳（上位）: ${top.map((r) => `${r[0]} ${yen(r[2])}（${r[3]}件）`).join('、')}`)
    }
    const prevM = months.find((m) => m.month === prevMonthOf(months[0].month))
    if (prevM?.rank?.length) {
      const r = prevM.rank[prevM.rank.length - 1]
      lines.push(`NOAHのエリアランキング（${r[0]}）: ${r[1]}院中 ${r[2]}位`)
    }
  } else {
    lines.push('', 'NOAH の集計はまだありません（毎晩の読み取りが届くと出ます）')
  }

  if (stats?.bookings) {
    const rows = stats.bookings.filter((r) => r.status !== 'キャンセル')
    const bySource = new Map<string, number>()
    for (const r of rows) bySource.set(sourceLabel(r.source), (bySource.get(sourceLabel(r.source)) ?? 0) + 1)
    const firsts = rows.filter((r) => r.visitType === '初めて').length
    lines.push(
      '',
      `【ネット予約（直近30日）】${rows.length}件（初めての方 ${firsts}件）／入口: ${[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('、') || '—'}`,
    )
  }
  if (stats?.openings?.length) {
    const next = stats.openings.filter((o) => !o.closed).slice(0, 7)
    lines.push(`この先の空き枠（午前/午後）: ${next.map((o) => `${o.date.slice(5)} ${o.am}/${o.pm}`).join('、')}`)
  }

  if (pdca?.items.length) {
    lines.push('', '【PDCA（施策）】')
    for (const it of pdca.items.slice(0, 8)) {
      const c = pdca.checks[it.id]
      const metric = METRICS.find((m) => m.key === it.metric)
      const status = it.status === 'doing' ? '実行中' : it.status === 'review' ? '振り返り待ち' : '終了'
      lines.push(
        `- ${it.title}（${status}、${it.start}〜${it.end}、指標 ${metric?.label ?? it.metric} 目標 ${it.target}${c ? `、いま ${c.actual}${c.baseline != null ? `、前の期間 ${c.baseline}` : ''}` : ''}）${it.review ? `→ ${DECISION_LABELS[it.review.decision]}：${it.review.learned.slice(0, 80)}` : ''}`,
      )
    }
  }

  if (goal && goal > 0) lines.push('', `【今月の売上目標】${yen(goal)}`)
  return lines.filter((l) => l !== undefined).join('\n')
}

const SYSTEM = [
  'あなたは、山口県下関市の整骨院「ゆうき整骨院」（柔道整復の保険の施術と、スポーツのケガ・術後リハビリなどの自費の運動療法。院長1人＋スタッフ）の経営の相談役です。',
  '院長とチャットで相談します。院長は忙しいので、短く（基本は200字以内、求められたら詳しく）、具体的に、数字の根拠を添えて、すぐ動ける形で答えます。日本語。箇条書きは3つまで。',
  '守ること：',
  '- 医療広告ガイドライン・柔道整復師法の広告の決まりを守る。効果の保証・体験談・ビフォーアフター・割引の強調・他院との比較はすすめない。',
  '- 療養費（保険）の決まりを守る。窓口負担の割引、金品や紹介のお礼で患者さんをさそうことはすすめない。請求は施術のとおりに。',
  '- 自費は、必要な理由と料金を説明して同意をいただいてから。無理にすすめない。',
  '- 患者さんの個人情報は扱わない（名前などを聞かれても使わない）。',
  '- 数字は渡された院の集計だけを根拠にする。分からないことは分からないと言う。税務・法務の判断は専門家の確認をすすめる。',
  '- 先に結論、次に理由、最後に次の一手（1つ）。',
].join('\n')

export interface ChatReply {
  reply: string
  ai: boolean
  /** AI を使えなかった理由 */
  fallback?: string
}

export async function ask(messages: ChatMessage[], context: string): Promise<ChatReply> {
  if (!aiAvailable()) {
    return { reply: 'AI の設定（ANTHROPIC_API_KEY）が無いため、相談にお答えできません。数字は「AIに渡している数字」で見られます。', ai: false, fallback: 'AI未設定' }
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const recent = messages.slice(-CONTEXT_TURNS * 2)
  const res = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1200,
    system: `${SYSTEM}\n\n院のいまの数字（集計のみ）：\n${context}`,
    messages: recent.map((m) => ({ role: m.role, content: m.text })),
  })
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  return { reply: text || '（返事が空でした。もう一度お試しください）', ai: true }
}
