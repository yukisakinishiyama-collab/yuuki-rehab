// ──────────────────────────────────────────────
// LIFF の行き先（純粋な関数。/liff/yoyaku の橋渡しページと tools/test-liff-route.mjs から使う）
//
// 2026-11-20 院長「カルテでLINE連携した時に患者様側の表示がおかしくなったりします」。
// カルテのQRコード（https://liff.line.me/{LIFF_ID}/link?c=番号）や、メニューの「カルテ連携」を開くと、LINE はまず
// エンドポイント（/liff/yoyaku?lid=…&liff.state=%2Flink%3Fc%3D…）を開き、liff.init() の中で /liff/yoyaku/link へ進む。
// ところが /liff/yoyaku は「予約ページへ進む橋渡し」で、4秒たつか、LINE の確認が先に終わると予約システムへ進んでいたため、
// 「予約ページを開いています…」が出たり、カルテ連携ではなく予約のページが開いたりしていた（LINE の進む先と取り合い）。
// → liff.state に行き先（/link）があるときは、予約へは進まず、そのページへ行く（LINE が進めなければ、自分で進む）
// ──────────────────────────────────────────────

/** 橋渡しページ（/liff/yoyaku）の下にあるページ。liff.state にこれがあれば、予約ではなくそこへ行く */
export const LIFF_SUBPAGES = ['link'] as const
export type LiffSubpage = (typeof LIFF_SUBPAGES)[number]

const CODE_RE = /^[A-Za-z0-9_-]{20,40}$/

/**
 * 1次リダイレクト先のアドレスの liff.state から、行き先のページと番号を読む。無ければ null（今までどおり予約へ）。
 * liff.state は「/link?c=…」の形（URLSearchParams が % をほどいたもの）。前の「/」は無いこともある
 */
export function liffSubpageOf(search: string): { page: LiffSubpage; code: string } | null {
  let state = ''
  try {
    state = new URLSearchParams(search).get('liff.state') ?? ''
  } catch {
    return null
  }
  if (!state) return null
  const s = state.replace(/^\/+/, '')
  const m = /^([a-z]+)\/?(?:[?&]([^#]*))?/.exec(s)
  if (!m || !(LIFF_SUBPAGES as readonly string[]).includes(m[1])) return null
  let code = ''
  try {
    code = new URLSearchParams(m[2] ?? '').get('c') ?? ''
  } catch {
    code = ''
  }
  return { page: m[1] as LiffSubpage, code: CODE_RE.test(code) ? code : '' }
}

/** LINE が進めなかったときに、自分で進むアドレス（lid と、正しい形の番号だけを付ける） */
export function liffSubpageUrl(sub: { page: LiffSubpage; code: string }, lid: string): string {
  const q = new URLSearchParams()
  if (/^\d{5,}-\w+$/.test(lid)) q.set('lid', lid)
  if (sub.code && CODE_RE.test(sub.code)) q.set('c', sub.code)
  const qs = q.toString()
  return `/liff/yoyaku/${sub.page}${qs ? `?${qs}` : ''}`
}

/** 行き先ごとの、待っているあいだの言葉 */
export function liffSubpageWaitText(page: LiffSubpage): string {
  return page === 'link' ? 'LINEとカルテを結びつけるページを開いています…' : 'ページを開いています…'
}
