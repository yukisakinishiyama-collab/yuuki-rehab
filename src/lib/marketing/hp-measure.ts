/**
 * ホームページの計測（自動アクセスの見分け方・閲覧数と電話タップの数え方）
 *
 * 2026-11 時点で「HPの予約ボタン 119回」に対して「HP経由の予約 0件」だった。
 * 計測リンク（/api/marketing/go）がサイトの全ページに載っているため、検索エンジンや
 * AI のクローラーがリンクをたどるたびにクリックとして数えていた可能性が高い。
 * ここでは、人が押したものと自動アクセスを分ける。
 *
 * 閲覧数・電話タップは GA4 の代わりに、件数だけを日別に数える（個人を特定する情報は持たない）。
 * サーバーに依存しない純粋な関数だけを置く（node のテストから直接読む）。
 */

/** 検索エンジン・AI のクローラー・リンクの下見（プレビュー）・監視ツール・プログラムからのアクセス */
const BOT_UA =
  /bot\b|bot\/|bot;|crawl|spider|slurp|mediapartners|adsbot|apis-google|feedfetcher|google-inspectiontool|googleother|google-safety|google-read-aloud|storebot|bingpreview|yandex|baidu|sogou|petal|bytespider|gptbot|chatgpt-user|oai-searchbot|claude|anthropic|perplexity|ccbot|amazonbot|applebot|duckduck|ia_archiver|facebookexternalhit|facebookcatalog|meta-externalagent|twitterbot|slackbot|discordbot|telegrambot|whatsapp\/|skypeuripreview|linkedinbot|embedly|pinterest|vkshare|quora link preview|preview|headless|phantomjs|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|python|curl\/|wget|go-http-client|okhttp|java\/|axios|node-fetch|undici|httpclient|libwww|scrapy|postman|insomnia/i

/** User-Agent から自動アクセスかどうかを見る。空の User-Agent も自動アクセスとみなす */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const value = (ua ?? '').trim()
  if (!value) return true
  return BOT_UA.test(value)
}

/** ブラウザの先読み（リンクの上に指を置いた・表示しただけで裏で読みにいくもの）か */
export function isPrefetch(get: (name: string) => string | null): boolean {
  const purpose = `${get('sec-purpose') ?? ''} ${get('purpose') ?? ''} ${get('x-purpose') ?? ''} ${get('x-moz') ?? ''}`.toLowerCase()
  return /prefetch|prerender|preview/.test(purpose)
}

// ── 閲覧数・電話タップ ───────────────────────────────────────

export type HpEventKind = 'view' | 'tel'

/** 日別の件数。v=ページごとの閲覧数、t=ページごとの電話タップ、tw=電話タップの置き場所ごと */
export interface HpDayStats {
  v: Record<string, number>
  t: Record<string, number>
  tw: Record<string, number>
}

export const HP_ORIGINS = ['https://shimonoseki-yuuki.com', 'https://www.shimonoseki-yuuki.com']

/** ページの場所を「/first-visit」の形にそろえる。おかしな値は null（数えない） */
export function normalizePage(raw: string | null | undefined): string | null {
  if (!raw) return null
  let p = raw.trim().toLowerCase()
  if (!p.startsWith('/')) return null
  p = p.replace(/\?.*$/, '').replace(/#.*$/, '').replace(/\.html$/, '').replace(/\/index$/, '/')
  if (p.length > 1) p = p.replace(/\/+$/, '')
  if (!/^\/[a-z0-9-]{0,40}$/.test(p)) return null
  return p
}

/** 電話の置き場所（ヘッダー・スマホの下のバー・本文・フッター）。決まった名前以外は「other」 */
export function normalizePlace(raw: string | null | undefined): string {
  const v = (raw ?? '').trim().toLowerCase()
  return /^(header|bar|main|footer|cta|nav)$/.test(v) ? v : 'other'
}

export function emptyDay(): HpDayStats {
  return { v: {}, t: {}, tw: {} }
}

/** 1件足す（元の値は変えずに新しい値を返す）。1日あたり・1ページあたりの上限で暴走を止める */
export const HP_DAY_LIMIT = 20000
export function addHpEvent(day: HpDayStats | null, kind: HpEventKind, page: string, place?: string): HpDayStats {
  const next: HpDayStats = {
    v: { ...(day?.v ?? {}) },
    t: { ...(day?.t ?? {}) },
    tw: { ...(day?.tw ?? {}) },
  }
  const bump = (bag: Record<string, number>, key: string) => {
    if ((bag[key] ?? 0) < HP_DAY_LIMIT) bag[key] = (bag[key] ?? 0) + 1
  }
  if (kind === 'view') bump(next.v, page)
  else {
    bump(next.t, page)
    bump(next.tw, normalizePlace(place))
  }
  return next
}

/** 何日分かを足し合わせる */
export function sumHpDays(days: HpDayStats[]): HpDayStats {
  const total = emptyDay()
  for (const d of days) {
    for (const bag of ['v', 't', 'tw'] as const) {
      for (const [k, n] of Object.entries(d?.[bag] ?? {})) total[bag][k] = (total[bag][k] ?? 0) + (Number(n) || 0)
    }
  }
  return total
}

export function totalOf(bag: Record<string, number>): number {
  return Object.values(bag).reduce((a, b) => a + (Number(b) || 0), 0)
}
