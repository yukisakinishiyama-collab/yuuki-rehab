/**
 * Search Console（ホームページ shimonoseki-yuuki.com の Google 検索での成果）の読み方（純粋な関数）
 *
 * - 直近28日（3日前まで。Search Console の数字は2〜3日遅れ）と、その前の28日
 * - 合計（クリック・表示・平均掲載順位）、検索キーワードごと、ページごと
 * - Google検索向けの投稿で狙っている言葉に印（gbp-performance.ts の matchTarget）
 * node で単体テストできる（tools/test-gbp-seo.mjs）。
 */
import { matchTarget } from './gbp-performance'

export const GSC_HOST = 'shimonoseki-yuuki.com'

export type GscSite = { siteUrl?: string; permissionLevel?: string }

/** 使えるプロパティを選ぶ（ドメイン → https → http の順。確認されていないものは使わない） */
export function pickGscSite(sites: GscSite[], host = GSC_HOST): string | null {
  const ok = sites.filter((s) => s.siteUrl && s.permissionLevel && s.permissionLevel !== 'siteUnverifiedUser')
  const order = [`sc-domain:${host}`, `https://${host}/`, `https://www.${host}/`, `http://${host}/`]
  for (const want of order) {
    const hit = ok.find((s) => s.siteUrl === want)
    if (hit) return want
  }
  return null
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function gscRanges(today: string) {
  const end = addDaysYmd(today, -3)
  const start = addDaysYmd(end, -27)
  const prevEnd = addDaysYmd(start, -1)
  const prevStart = addDaysYmd(prevEnd, -27)
  return { current: { start, end }, previous: { start: prevStart, end: prevEnd } }
}

export interface GscRow {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

type GscResponse = { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> }

export function parseGscRows(json: GscResponse): GscRow[] {
  return (json.rows ?? []).map((r) => ({
    key: r.keys?.[0] ?? '',
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
    position: Math.round(Number(r.position ?? 0) * 10) / 10,
  }))
}

export interface GscTotals {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export function gscTotals(json: GscResponse): GscTotals {
  const r = json.rows?.[0]
  return {
    clicks: Number(r?.clicks ?? 0),
    impressions: Number(r?.impressions ?? 0),
    ctr: Number(r?.ctr ?? 0),
    position: Math.round(Number(r?.position ?? 0) * 10) / 10,
  }
}

export interface GscQuery extends GscRow {
  /** 前の28日の掲載順位（無ければ null） */
  prevPosition: number | null
  prevClicks: number | null
  /** Google検索向けの投稿で狙っている言葉なら、その投稿の見出し */
  target: string | null
}

/** 今期のキーワードに、前期の順位・クリックと、狙っている言葉の印を付ける（表示の多い順） */
export function withPrevious(current: GscRow[], previous: GscRow[]): GscQuery[] {
  const prev = new Map(previous.map((r) => [r.key, r]))
  return current
    .filter((r) => r.key)
    .map((r) => ({ ...r, prevPosition: prev.get(r.key)?.position ?? null, prevClicks: prev.get(r.key)?.clicks ?? null, target: matchTarget(r.key) }))
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
}

export interface GscReport {
  /** 「Googleとつなぐ」で Search Console も許可されているか */
  connected: boolean
  error?: string
  siteUrl?: string
  current?: { start: string; end: string; totals: GscTotals }
  previous?: { start: string; end: string; totals: GscTotals }
  queries?: GscQuery[]
  pages?: GscRow[]
  fetchedAt?: string
}
