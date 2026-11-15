/**
 * 院長のLINEへ送るお知らせのリンクを、「いつものブラウザ」（Safari・Chrome）で開かせる
 *
 * 院内アプリの画面と画像・動画は、パスワード（src/proxy.ts の Basic 認証）で守っている。
 * LINE の中のブラウザはパスワードの入力画面を出さないので、LINE から開くと
 * 「認証が必要です」とだけ出て、中身が見られない（2026-11-16 院長から：お知らせの「内容を確認する」が開けない）。
 * LINE は、リンクに openExternalBrowser=1 が付いていると、中のブラウザではなく端末のブラウザで開く
 * （https://developers.line.biz/ja/docs/line-login/using-line-url-scheme/#opening-url-in-external-browser）。
 * 端末のブラウザなら、パスワードの入力画面が出て、いちど入れれば覚えてくれる。
 *
 * - 付けるのは院内アプリ（yuuki-rehab.vercel.app）のリンクだけ。ほかのサイトのリンクは変えない
 * - 守り（パスワード）はそのまま。リンクを知っていても、パスワードが無ければ見られない
 * - サーバーの機能は使わない（node で単体テストできる。tools/marketing/test-line-links.mjs）
 */

/** 院内アプリの場所（パスワードで守っている） */
export const APP_ORIGIN = 'https://yuuki-rehab.vercel.app'

const PARAM = 'openExternalBrowser'
/** LINE のボタンのリンクは 1000 文字まで（こえると、お知らせごと送れなくなる） */
const LINE_URI_MAX = 1000

/** 院内アプリのリンクか（似た名前の別のサイトは数えない） */
export function isAppUrl(url: string): boolean {
  try {
    return new URL(url).origin === APP_ORIGIN
  } catch {
    return false
  }
}

/**
 * 院内アプリのリンクに「端末のブラウザで開く」印を付ける。
 * もとの文字はそのまま（? の後ろに足すだけ。# より前に入れる）。もう付いていれば何もしない。
 */
export function externalBrowserUrl(url: string): string {
  if (!isAppUrl(url)) return url
  const at = url.indexOf('#')
  const base = at === -1 ? url : url.slice(0, at)
  const hash = at === -1 ? '' : url.slice(at)
  if (new RegExp(`[?&]${PARAM}=`).test(base)) return url
  const next = `${base}${base.includes('?') ? '&' : '?'}${PARAM}=1${hash}`
  return next.length > LINE_URI_MAX ? url : next
}

// 文の中のリンク（半角の、URLに使える文字が続くところまで。後ろの日本語や句読点は巻きこまない）
const APP_URL_IN_TEXT = new RegExp(`${APP_ORIGIN.replace(/[.]/g, '\\.')}(?![\\w.-])[\\w\\-./?=&%#~+:@!$'()*,;]*`, 'g')

/** 文の中に書いた院内アプリのリンクにも、同じ印を付ける */
export function externalBrowserText(text: string): string {
  return text.replace(APP_URL_IN_TEXT, (found) => {
    // 文の終わりの「.」「,」「)」はリンクの外に出す
    const tail = /[.,)]+$/.exec(found)?.[0] ?? ''
    const url = tail ? found.slice(0, -tail.length) : found
    return `${externalBrowserUrl(url)}${tail}`
  })
}

/**
 * LINE へ送るメッセージ（文・カード）の中のリンクを直す。
 * - 文のメッセージ … 文の中のリンク
 * - カード（Flex）など … 押すと開くボタン（action.type が 'uri'）のリンク
 * 画像・動画そのもの（originalContentUrl など。LINE のサーバーが取りに来る）は変えない。
 */
export function withExternalBrowserLinks<T>(message: T): T {
  if (typeof message === 'string') return externalBrowserText(message) as T
  if (!message || typeof message !== 'object') return message
  const top = message as Record<string, unknown>
  if (top.type === 'text' && typeof top.text === 'string') return { ...top, text: externalBrowserText(top.text) } as T
  return fixActions(message) as T
}

function fixActions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fixActions)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) out[key] = fixActions(item)
  if (record.type === 'uri' && typeof record.uri === 'string') out.uri = externalBrowserUrl(record.uri)
  return out
}
