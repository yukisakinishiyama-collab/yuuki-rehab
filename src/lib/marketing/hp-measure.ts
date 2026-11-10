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

/**
 * 日別の件数。v=ページごとの閲覧数、t=ページごとの電話タップ、tw=電話タップの置き場所ごと、
 * s=外から入ってきた回数（入口）を来たところごと、lp=入口になったページごと。
 * s・lp は 2026-11 に足したので、それより前の日の記録には無い
 */
export interface HpDayStats {
  v: Record<string, number>
  t: Record<string, number>
  tw: Record<string, number>
  s?: Record<string, number>
  lp?: Record<string, number>
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

// ── 入口（どこから来たか） ─────────────────────────────────────
//
// ホームページは、外から入ってきた最初のページを開いたときだけ n=1 と、前のサイトの「ホスト名」
// （例 www.google.com。ページの場所や検索した言葉は送らない）と、URL に付いた utm_source を送る。
// ここで決まった分け方（HP_SOURCES）に直して、分け方ごとの件数だけを残す（ホスト名そのものは残さない）。

export const HP_SOURCES = [
  'google',
  'maps',
  'yahoo',
  'search',
  'ai',
  'instagram',
  'line',
  'facebook',
  'x',
  'portal',
  'direct',
  'other',
] as const
export type HpSource = (typeof HP_SOURCES)[number]

export const HP_SOURCE_LABELS: Record<HpSource, string> = {
  google: 'Google 検索',
  maps: 'Google マップ・ビジネスプロフィール',
  yahoo: 'Yahoo! 検索',
  search: 'ほかの検索（Bing など）',
  ai: 'AI（ChatGPT など）',
  instagram: 'Instagram',
  line: 'LINE',
  facebook: 'Facebook',
  x: 'X（旧 Twitter）',
  portal: '口コミ・予約サイト（エキテンなど）',
  direct: '直接（ブックマーク・アプリ・QR など）',
  other: 'ほかのサイト',
}

/** 院のホームページ自身（ここから来たのはサイトの中の移動なので、入口に数えない） */
const OWN_HOSTS = ['shimonoseki-yuuki.com']

/** ホスト名をそろえる。空なら ''（前のサイトなし）、おかしな値は 'invalid' */
function normalizeHost(raw: string | null | undefined): string {
  const h = (raw ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (!h) return ''
  if (h.length > 100 || !/^[a-z0-9.-]+$/.test(h)) return 'invalid'
  return h.replace(/^www\./, '')
}

const is = (h: string, domain: string) => h === domain || h.endsWith(`.${domain}`)

/** utm_source の決まった名前（ビジネスプロフィールのウェブサイト欄などに付けたとき） */
function sourceFromUtm(raw: string | null | undefined): HpSource | null {
  const u = (raw ?? '').trim().toLowerCase()
  if (!u) return null
  if (/^(gbp|gmb|google_?business(_profile)?|google_?maps?|maps)$/.test(u)) return 'maps'
  if (/^(ig|instagram)$/.test(u)) return 'instagram'
  if (/^line$/.test(u)) return 'line'
  if (/^(fb|facebook)$/.test(u)) return 'facebook'
  if (/^(x|twitter)$/.test(u)) return 'x'
  return null
}

/**
 * 来たところを分ける。サイトの中の移動なら null（入口に数えない）。
 * utm_source が決まった名前なら、そちらを優先する（Google マップのアプリは前のサイトを教えないことが多いため）
 */
export function classifySource(refHost: string | null | undefined, utmSource?: string | null): HpSource | null {
  const h = normalizeHost(refHost)
  if (h && OWN_HOSTS.some((own) => is(h, own))) return null
  const fromUtm = sourceFromUtm(utmSource)
  if (fromUtm) return fromUtm
  if (!h) return 'direct'
  if (h === 'invalid') return 'other'
  // Android のアプリから開いたときは「android-app://アプリの名前」がホスト名になる
  if (h === 'com.google.android.apps.maps' || /^maps\.google\./.test(h) || h === 'maps.app.goo.gl') return 'maps'
  if (
    is(h, 'chatgpt.com') ||
    is(h, 'chat.openai.com') ||
    is(h, 'perplexity.ai') ||
    h === 'gemini.google.com' ||
    h === 'copilot.microsoft.com' ||
    is(h, 'claude.ai') ||
    is(h, 'grok.com') ||
    is(h, 'felo.ai')
  )
    return 'ai'
  if (/(^|\.)google\.[a-z.]{2,8}$/.test(h) || h === 'com.google.android.googlequicksearchbox') return 'google'
  if (/(^|\.)yahoo\.(co\.jp|com)$/.test(h) || h === 'jp.co.yahoo.android.ybrowser' || h === 'jp.co.yahoo.android.yjtop') return 'yahoo'
  if (is(h, 'bing.com') || is(h, 'duckduckgo.com') || is(h, 'ecosia.org') || h === 'search.brave.com' || is(h, 'baidu.com') || is(h, 'naver.com'))
    return 'search'
  if (is(h, 'instagram.com') || h === 'com.instagram.android') return 'instagram'
  if (is(h, 'line.me') || h === 'jp.naver.line.android') return 'line'
  if (is(h, 'facebook.com') || h === 'fb.me' || h === 'com.facebook.katana') return 'facebook'
  if (h === 't.co' || is(h, 'x.com') || is(h, 'twitter.com')) return 'x'
  if (is(h, 'ekiten.jp') || is(h, 'bonbone.jp') || is(h, 'epark.jp') || is(h, 'hotpepper.jp') || is(h, 'caloo.jp') || is(h, 'shinq-compass.jp'))
    return 'portal'
  return 'other'
}

/** 入口になったページの呼び名（集客概要の表に出す）。載っていないページは場所のまま */
export const HP_PAGE_LABELS: Record<string, string> = {
  '/': 'トップ',
  '/first-visit': 'はじめての方へ',
  '/price': '料金',
  '/access': 'アクセス',
  '/about': '当院について',
  '/faq': 'よくある質問',
  '/contact': '予約・お問い合わせ',
  '/symptoms': '症状の一覧',
  '/column': 'ブログ一覧',
  '/jiko': '交通事故',
  '/col-acl-return': '記事: ACL再建術後のスポーツ復帰',
  '/col-hip-arthroscopy': '記事: 股関節鏡視下手術のあとの運動療法',
  '/col-ankle-habit': '記事: 捻挫グセ',
  '/col-firstaid': '記事: 応急処置',
  '/col-growth': '記事: 成長期のスポーツ障害',
  '/col-rehab': '記事: 術後リハビリの進め方',
  '/col-return': '記事: スポーツ復帰はいつから',
  '/sport-baseball': '野球をする方へ',
  '/sport-running': '陸上・ランナーの方へ',
  '/sport-soccer': 'サッカーをする方へ',
  '/sym-acl': 'ACL（前十字靭帯）',
  '/sym-meniscus': '半月板損傷',
  '/sym-hip': '股関節痛',
  '/sym-knee': '膝痛',
  '/sym-ankle': '足首の捻挫',
  '/sym-achilles': 'アキレス腱',
  '/sym-back': '腰痛',
  '/sym-gikkuri': 'ぎっくり腰',
  '/sym-hernia': '椎間板ヘルニア',
  '/sym-shoulder': '肩の痛み',
  '/sym-elbow': 'テニス肘・ゴルフ肘',
  '/sym-baseball': '野球肩・野球肘',
  '/sym-groin': 'グロインペイン',
  '/sym-osgood': 'オスグッド',
  '/sym-severs': 'シーバー病',
  '/sym-shin': 'シンスプリント',
  '/sym-plantar': '足底腱膜炎',
  '/sym-strain': '肉離れ',
  '/sym-stress-fracture': '疲労骨折',
  '/sym-wrist': '手首の痛み・突き指',
}

export function pageLabel(page: string): string {
  return HP_PAGE_LABELS[page] ?? page
}

export function emptyDay(): HpDayStats {
  return { v: {}, t: {}, tw: {}, s: {}, lp: {} }
}

/**
 * 1件足す（元の値は変えずに新しい値を返す）。1日あたり・1ページあたりの上限で暴走を止める。
 * source があるのは「外から入ってきた最初のページ」の閲覧のときだけ
 */
export const HP_DAY_LIMIT = 20000
export function addHpEvent(
  day: HpDayStats | null,
  kind: HpEventKind,
  page: string,
  place?: string,
  source?: HpSource | null,
): HpDayStats {
  const next: HpDayStats = {
    v: { ...(day?.v ?? {}) },
    t: { ...(day?.t ?? {}) },
    tw: { ...(day?.tw ?? {}) },
    s: { ...(day?.s ?? {}) },
    lp: { ...(day?.lp ?? {}) },
  }
  const bump = (bag: Record<string, number>, key: string) => {
    if ((bag[key] ?? 0) < HP_DAY_LIMIT) bag[key] = (bag[key] ?? 0) + 1
  }
  if (kind === 'view') {
    bump(next.v, page)
    if (source && (HP_SOURCES as readonly string[]).includes(source)) {
      bump(next.s!, source)
      bump(next.lp!, page)
    }
  } else {
    bump(next.t, page)
    bump(next.tw, normalizePlace(place))
  }
  return next
}

/** 何日分かを足し合わせる */
export function sumHpDays(days: HpDayStats[]): Required<HpDayStats> {
  const total = emptyDay() as Required<HpDayStats>
  for (const d of days) {
    for (const bag of ['v', 't', 'tw', 's', 'lp'] as const) {
      for (const [k, n] of Object.entries(d?.[bag] ?? {})) total[bag][k] = (total[bag][k] ?? 0) + (Number(n) || 0)
    }
  }
  return total
}

/** 件数の多い順に並べる */
export function topEntries(bag: Record<string, number>, limit = 20): [string, number][] {
  return Object.entries(bag)
    .filter(([, n]) => (Number(n) || 0) > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
}

export function totalOf(bag: Record<string, number>): number {
  return Object.values(bag).reduce((a, b) => a + (Number(b) || 0), 0)
}
