/**
 * Instagramストーリー（予約の空き状況）の組み立て（サーバー専用・画像APIと公開の両方で使う）
 *
 * - 空きは予約システムから取り直す（v3.10 以降は時間と残り枠も来る。来なければ午前・午後だけ）
 * - 院長が画面で直したところ（見出し・ひとこと・出さない時間・残り枠の数を出すか）を当てはめる
 * - ひとこと・見出しは広告の表現チェック（NG）を通らなければ使わない
 * - ネット予約のQR（ストーリーの計測つきリンク）を画像に入れる
 */
import { storyHasOpening, storyRows, storyText, type OpeningDay, type StoryRow } from './autopilot-planner'
import { findViolations } from './compliance'
import type { StoryEdits } from './types'

export const SITE_URL = 'https://yuuki-rehab.vercel.app'

/** ストーリーのQRに入れる、ネット予約の計測つきリンク（院内アプリの「リンク・QR」と同じ形） */
export function storyReserveLink(dateYmd: string): string {
  const qs = new URLSearchParams({ d: 'reserve', source: 'instagram', campaign: `story-${dateYmd.replace(/-/g, '')}` })
  return `${SITE_URL}/api/marketing/go?${qs.toString()}`
}

/** 画面から来た編集を、決まった形・長さにそろえる（それ以外は捨てる） */
export function sanitizeStoryEdits(raw: unknown): StoryEdits {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '')
  const hidden = Array.isArray(r.hiddenSlots)
    ? (r.hiddenSlots as unknown[]).filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(x)).slice(0, 200)
    : []
  return {
    title: text(r.title, 24) || undefined,
    note: text(r.note, 40) || undefined,
    hiddenSlots: hidden.length ? hidden : undefined,
    showRemaining: r.showRemaining === false ? false : true,
  }
}

/** 見出し・ひとことに広告の表現でNGのものがあれば、その理由を返す（無ければ null） */
export function storyEditsProblem(edits: StoryEdits): string | null {
  const text = [edits.title, edits.note].filter(Boolean).join('\n')
  if (!text) return null
  const ng = findViolations(text).filter((f) => f.level === 'NG')
  if (ng.length === 0) return null
  return `「${ng[0].match}」は使えません（${ng[0].reason}）。${ng[0].suggestion}`
}

/** 出さない時間を外す。外した結果その半日に空きが無くなったら「いっぱい」にする */
export function applyHiddenSlots(rows: StoryRow[], edits: StoryEdits): StoryRow[] {
  const hidden = new Set(edits.hiddenSlots ?? [])
  if (hidden.size === 0) return rows
  return rows.map((r) => {
    if (!r.slots) return r
    const slots = r.slots.filter((s) => !hidden.has(`${r.date} ${s.time}`))
    const am = slots.some((s) => s.time < '13:00') ? r.am : r.closed ? r.am : 'full'
    const pm = slots.some((s) => s.time >= '13:00') ? r.pm : r.closed ? r.pm : 'full'
    return { ...r, slots, am, pm }
  })
}

export interface BuiltStory {
  rows: StoryRow[]
  title: string
  body: string
  note?: string
  showRemaining: boolean
  hasOpening: boolean
}

/** 空き（openings）と載せる日から、編集を当てはめたストーリーの中身を作る */
export function buildStory(
  openings: OpeningDay[],
  dates: string[],
  scope: 'day' | 'week',
  asOfLocal: string,
  defaultTitle: string | undefined,
  edits: StoryEdits,
): BuiltStory {
  const rows = applyHiddenSlots(storyRows(openings, dates), edits)
  const text = storyText(rows, scope, asOfLocal, edits.title || defaultTitle)
  return {
    rows,
    title: text.title,
    body: edits.note ? `${text.body}\n（ひとこと）${edits.note}` : text.body,
    note: edits.note,
    showRemaining: edits.showRemaining !== false,
    hasOpening: storyHasOpening(rows),
  }
}

/** ネット予約のQR（PNGのdata URL）。作れなければ undefined（QR無しで画像を作る） */
export async function storyQrDataUrl(link: string): Promise<string | undefined> {
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(link, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: '#16233d', light: '#ffffff' } })
  } catch (error) {
    console.warn('[story] QRを作れませんでした', error)
    return undefined
  }
}
