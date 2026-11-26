/**
 * 公式LINEを、ブロックされにくくする決まり（純粋な関数。サーバー・画面・テストから読む）
 *
 * 2026-11-26 院長「次に公式lineをブロックしにくい設計に」。
 * ブロックの理由でいちばん多いのは「不要な情報が多かった」「配信が多かった」（Lステップの調査 2026年3月・1,000人）。
 * そこで、①友だち全員への一斉配信に歯止め、②止めたい方がブロックの手前で止められる入口、③ブロックの直前に何を送っていたかを数える、
 * の3つを決まりにする。予約の確定・前日のお知らせなど、ご本人あてのお知らせは今までどおり。
 * - 送った記録（だれに・いつ・何を）は lib/marketing/line-touch-server.ts（LINE の ID は残さない。印＝ハッシュだけ）
 */
import type { ConsentRecord } from '@/lib/marketing/consent'
import { CONSENT_KEYWORDS, consentAllows, normalizeCommand } from '@/lib/marketing/consent'

/** 患者さんの LINE へ送るものの種類（ブロックの直前に何が届いていたかを数えるため） */
export type TouchKind = 'reservation_confirm' | 'reservation_remind' | 'waitlist_notify' | 'followup' | 'birthday' | 'broadcast'

export const TOUCH_LABELS: Record<TouchKind | 'none', string> = {
  reservation_confirm: '予約の確定・変更のお知らせ',
  reservation_remind: '前日のお知らせ',
  waitlist_notify: '空き枠のお知らせ（キャンセル待ち）',
  followup: 'ご来院が空いた方へのご連絡',
  birthday: '誕生日のご挨拶',
  broadcast: '友だち全員への配信',
  none: 'この30日、こちらからは何も送っていない',
}

export interface Touch {
  at: string
  kind: TouchKind
}

/** 送った記録を持つ日数・1人あたりの件数 */
export const TOUCH_KEEP_DAYS = 60
export const TOUCH_KEEP_MAX = 30

/** ブロックの「どのくらい前に届いていたか」の分け方 */
export type WithinBucket = '1h' | '24h' | '3d' | '7d' | '30d' | 'none'
export const WITHIN_LABELS: Record<WithinBucket, string> = {
  '1h': '1時間以内',
  '24h': '1日以内',
  '3d': '3日以内',
  '7d': '1週間以内',
  '30d': '30日以内',
  none: '30日より前・なし',
}

export function withinBucket(hours: number): WithinBucket {
  if (!Number.isFinite(hours) || hours < 0) return 'none'
  if (hours <= 1) return '1h'
  if (hours <= 24) return '24h'
  if (hours <= 72) return '3d'
  if (hours <= 168) return '7d'
  if (hours <= 720) return '30d'
  return 'none'
}

/**
 * ブロックの直前に届いていたもの（その方あての最後のお知らせと、最後の一斉配信の、新しいほう）。
 * 30日より前のものは「何も送っていない」に数える（そのお知らせが理由とは言えないため）
 */
export function attributeBlock(touches: Touch[], lastBroadcastAt: string | null | undefined, now: Date): { last: TouchKind | 'none'; within: WithinBucket } {
  const all: Touch[] = [...touches]
  if (lastBroadcastAt) all.push({ at: lastBroadcastAt, kind: 'broadcast' })
  const past = all
    .map((t) => ({ kind: t.kind, ms: Date.parse(t.at) }))
    .filter((t) => Number.isFinite(t.ms) && t.ms <= now.getTime())
    .sort((a, b) => b.ms - a.ms)[0]
  if (!past) return { last: 'none', within: 'none' }
  const within = withinBucket((now.getTime() - past.ms) / 3_600_000)
  return within === 'none' ? { last: 'none', within } : { last: past.kind, within }
}

/** 一斉配信（友だち全員へ）の歯止め：30日に BROADCAST_MAX_PER_30_DAYS 回まで・BROADCAST_MIN_GAP_DAYS 日あける */
export const BROADCAST_MAX_PER_30_DAYS = 2
export const BROADCAST_MIN_GAP_DAYS = 7

/** いま一斉配信してよいか。だめなら理由（画面・投稿の結果に出す文）。よければ null */
export function broadcastProblem(sentAts: string[], now: Date): string | null {
  const times = sentAts.map((s) => Date.parse(s)).filter((ms) => Number.isFinite(ms) && ms <= now.getTime())
  const last30 = times.filter((ms) => now.getTime() - ms < 30 * 86_400_000)
  const latest = times.length ? Math.max(...times) : null
  if (latest !== null && now.getTime() - latest < BROADCAST_MIN_GAP_DAYS * 86_400_000) {
    const days = Math.floor((now.getTime() - latest) / 86_400_000)
    return `友だち全員への配信は、前の配信から${BROADCAST_MIN_GAP_DAYS}日あけます（前の配信は${days === 0 ? '今日' : `${days}日前`}）。ブロックの理由で多いのは「配信が多い」「不要な情報が多い」です。`
  }
  if (last30.length >= BROADCAST_MAX_PER_30_DAYS) {
    return `友だち全員への配信は、30日に${BROADCAST_MAX_PER_30_DAYS}回までにしています（この30日で${last30.length}回）。ブロックの理由で多いのは「配信が多い」「不要な情報が多い」です。`
  }
  return null
}

/** 患者さんが送る言葉（お知らせの受け取りを、自分で確かめて変える） */
export const NOTICE_SETTINGS_KEYWORD = 'お知らせ設定'

const SETTINGS_PATTERNS = [
  /^(?:お知らせ|通知|配信|受け取り|受信)(?:の)?(?:設定|受け取り設定)(?:を)?(?:確認|変更|変えたい|したい|見たい)?$/,
  /^(?:お知らせ|通知|配信)(?:を)?(?:減らしたい|へらしたい|少なくしたい|止めたい|とめたい|やめたい)$/,
]

/** 「お知らせ設定」の言葉か（ふつうの相談の文には反応しない。「配信停止」などの、すぐ止める言葉は consent.ts が先に見る） */
export function parseNoticeSettings(text: string): boolean {
  const s = normalizeCommand(text)
  if (!s || s.length > 16) return false
  return SETTINGS_PATTERNS.some((re) => re.test(s))
}

export interface NoticeSettingsReply {
  text: string
  /** すぐ押せるボタン（押すと、その言葉が送られる） */
  buttons: string[]
}

/** 「お知らせ設定」への返事（いまの受け取りと、止める・再開するボタン。記録が無い方は「受け取る」） */
export function noticeSettingsReply(record: ConsentRecord | null | undefined, clinicName: string): NoticeSettingsReply {
  const reservation = consentAllows(record, 'reservation')
  const marketing = consentAllows(record, 'marketing')
  return {
    text: [
      `${clinicName}です。このLINEへのお知らせの設定です。`,
      '',
      `・ご予約のお知らせ（前日のお知らせ・キャンセル待ちのご案内）：${reservation ? 'お送りしています' : '止めています'}`,
      `・院からのご連絡（ご様子うかがい・誕生日のご挨拶）：${marketing ? 'お送りしています' : '止めています'}`,
      '',
      '下のボタンで、いつでも変えられます。',
      'ご予約の確定・変更の控えは、お手続きのたびにお送りします。',
    ].join('\n'),
    buttons: [
      reservation ? CONSENT_KEYWORDS.stopReservation : CONSENT_KEYWORDS.resumeReservation,
      marketing ? CONSENT_KEYWORDS.stopMarketing : CONSENT_KEYWORDS.resumeMarketing,
    ],
  }
}

/** ブロックの記録（個人を特定しない）から、30日の数え方を作る */
export function summarizeBlocks(events: Array<{ meta?: Record<string, string> }>): {
  total: number
  byLast: Array<{ kind: TouchKind | 'none' | 'unknown'; label: string; count: number }>
  byWithin: Array<{ within: WithinBucket; label: string; count: number }>
} {
  const last = new Map<string, number>()
  const within = new Map<string, number>()
  for (const e of events) {
    const k = e.meta?.last && e.meta.last in TOUCH_LABELS ? e.meta.last : 'unknown'
    last.set(k, (last.get(k) ?? 0) + 1)
    if (k !== 'unknown' && k !== 'none') {
      const w = e.meta?.within && e.meta.within in WITHIN_LABELS ? e.meta.within : 'none'
      within.set(w, (within.get(w) ?? 0) + 1)
    }
  }
  return {
    total: events.length,
    byLast: [...last.entries()]
      .map(([kind, count]) => ({ kind: kind as TouchKind | 'none' | 'unknown', label: kind === 'unknown' ? '記録を始める前（わからない）' : TOUCH_LABELS[kind as TouchKind | 'none'], count }))
      .sort((a, b) => b.count - a.count),
    byWithin: (Object.keys(WITHIN_LABELS) as WithinBucket[]).filter((w) => within.has(w)).map((w) => ({ within: w, label: WITHIN_LABELS[w], count: within.get(w) ?? 0 })),
  }
}
