/**
 * 集客概要の数字をまとめる（サーバー専用）
 *
 * 使うもの（どれも個人を特定しない集計か、院内だけの LINE の相談の一覧）
 * - 予約システム（GAS）の集計の行 … 今月受付の予約・初めての方・キャンセル・流入元（booking-stats）
 * - 計測イベント … LINE の友だち追加・ブロック、計測リンクのクリック（analytics-store-server）
 * - LINE の相談の一覧 … 今日の問い合わせ・未対応（line-store-server ＋ inquiry.ts）
 * - 自動投稿の案 … 承認待ちの数
 * 取れないものは value を null にして「未取得／未連携」と理由を返す（0 にしない）。売上・利益は扱わない。
 */
import { listEvents, type AnalyticsEvent } from './analytics-store-server'
import { sumHpStats } from './hp-stats-server'
import { HP_SOURCE_LABELS, pageLabel, topEntries, totalOf, type HpSource } from './hp-measure'
import { listContacts } from './line-store-server'
import { fetchHubStatsFast } from './booking-stats-fast'
import { sourceLabel } from './booking-stats'
import { listProposals } from './autopilot-store-server'
import { isInstagramConnected } from './instagram-token'
import { isGbpConnected } from './gbp-token'
import { inquiredOn, inquiryStatusOf, isInquiry } from './inquiry'
import type { LineContact } from './line-types'
import type { ConnectionRow, HpEntries, Metric, OverviewData, SourceRow } from './overview-types'

/** ブロックの記録を始めた日（これより前のブロックは数えられていない） */
export const UNFOLLOW_TRACKED_SINCE = '2026-11-04'

const DAY_MS = 24 * 60 * 60 * 1000

function jst(at: Date) {
  const iso = new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString()
  return { day: iso.slice(0, 10), local: iso.slice(0, 16) }
}

function md(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${m}月${d}日`
}

/** 同じ方（匿名の行為者キー）を1人として数える。キーが無いイベントは1件ずつ */
function uniqueActors(events: AnalyticsEvent[]): number {
  const keys = new Set<string>()
  let anonymous = 0
  for (const e of events) {
    if (e.actor) keys.add(e.actor)
    else anonymous += 1
  }
  return keys.size + anonymous
}

export async function buildOverview(now: Date = new Date()): Promise<OverviewData> {
  const { day: today, local: nowLocal } = jst(now)
  const monthStart = `${today.slice(0, 8)}01`
  const monthLabel = `${Number(today.slice(5, 7))}月`
  const period = today === monthStart ? `${md(today)}（今日）` : `${md(monthStart)}〜今日`
  const monthStartIso = new Date(`${monthStart}T00:00:00+09:00`).toISOString()
  const daysInMonthSoFar = Number(today.slice(8, 10))

  // ── 取りに行く（どれかが失敗しても、ほかは出す） ─────────────────
  const [contactsResult, eventsResult, statsResult, proposalsResult, igResult, gbpResult, hpResult] = await Promise.allSettled([
    listContacts(),
    // 計測リンクが使われているかを見るため、90日分を読む（今月分はこの中から絞る）
    listEvents(new Date(now.getTime() - 90 * DAY_MS).toISOString()),
    // 31日分を取り、今月受付の分に絞る（日数を毎日変えると控えが使えず、予約システムの起動を毎回待つため）
    fetchHubStatsFast(Math.max(daysInMonthSoFar + 1, 31)),
    listProposals(),
    isInstagramConnected(),
    isGbpConnected(),
    // ホームページの閲覧数・電話タップ（今月分。日本時間の日付）
    sumHpStats(monthStart),
  ])
  const contacts: LineContact[] | null = contactsResult.status === 'fulfilled' ? contactsResult.value : null
  const events90: AnalyticsEvent[] | null = eventsResult.status === 'fulfilled' ? eventsResult.value : null
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : null
  const bookingConfigured = Boolean(process.env.RESERVATION_NOTIFY_SECRET) && process.env.MARKETING_MODE !== 'mock'
  const lineConfigured = Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN)

  const monthEvents = events90?.filter((e) => e.at >= monthStartIso) ?? null
  const hp = hpResult.status === 'fulfilled' ? hpResult.value : null
  const clicks = (pred: (e: AnalyticsEvent) => boolean, list: AnalyticsEvent[] | null) =>
    list ? list.filter((e) => e.kind === 'link_click' && pred(e)) : null
  const tracked = (pred: (e: AnalyticsEvent) => boolean) => (clicks(pred, events90)?.length ?? 0) > 0

  // ── 今日 ──────────────────────────────────────────────────
  const inquiries = contacts?.filter((c) => isInquiry(c)) ?? null
  const todayMetrics: Metric[] = [
    {
      key: 'inquiries_today',
      label: '今日の問い合わせ（LINE）',
      value: inquiries ? inquiries.filter((c) => inquiredOn(c, today)).length : null,
      unit: '人',
      state: inquiries ? 'ok' : 'unavailable',
      period: `${md(today)}（今日）`,
      basis: '今日、公式LINE で何か送った・選んだ方の人数。同じ方が何度送っても1人。友だち追加だけの方は数えない',
      note: inquiries ? '電話・窓口での問い合わせは入っていません' : 'LINE の相談の一覧を読めませんでした',
      href: '/marketing/inquiries',
    },
    {
      key: 'inquiries_new',
      label: '未対応の問い合わせ',
      value: inquiries ? inquiries.filter((c) => inquiryStatusOf(c) === 'new').length : null,
      unit: '人',
      state: inquiries ? 'ok' : 'unavailable',
      period: 'いま',
      basis: 'スタッフの返信が要る（または、まだ状態を決めていない）相談の人数',
      href: '/marketing/inquiries',
    },
  ]

  // ── 今月：予約（予約システム） ───────────────────────────────
  const rows = stats ? stats.bookings.filter((b) => b.received >= monthStart && b.received <= today) : null
  const bookingNote = bookingConfigured
    ? '予約システムから数字を取れませんでした（しばらくしてから開き直してください）'
    : '予約システムと未連携です（RESERVATION_NOTIFY_SECRET 未設定）'
  const bookingState = rows ? 'ok' : bookingConfigured ? 'unavailable' : 'not_connected'
  const total = rows?.length ?? null
  const cancelled = rows ? rows.filter((r) => r.status === 'キャンセル').length : null
  // 予約システムで「無断キャンセル」を選べるようになっていれば、0件でも数えられる
  const hasNoShowStatus = Boolean(stats?.statuses?.some((s) => s.includes('無断')) || stats?.bookings.some((b) => b.status.includes('無断')))
  const followup = stats?.followup ?? null

  const monthMetrics: Metric[] = [
    {
      key: 'bookings_new',
      label: '新規予約',
      value: total,
      unit: '件',
      state: bookingState,
      period,
      basis: '今月に受け付けた予約の数（予約1件を1つ。あとでキャンセルになったものも含む。院で登録した電話・窓口の予約も含む）',
      note: rows ? undefined : bookingNote,
    },
    {
      key: 'bookings_first',
      label: 'うち初めての方',
      value: rows ? rows.filter((r) => r.visitType.startsWith('初')).length : null,
      unit: '件',
      state: bookingState,
      period,
      basis: '新規予約のうち、予約のときに「初めて」を選んだもの',
      note: rows ? '院で登録した予約は初めてかどうかの区別がないことがあります' : bookingNote,
    },
    {
      key: 'cancel_count',
      label: 'キャンセル',
      value: cancelled,
      unit: '件',
      state: bookingState,
      period,
      basis: '今月に受け付けた予約のうち、いまキャンセルになっているもの',
      note: rows ? undefined : bookingNote,
    },
    {
      key: 'cancel_rate',
      label: 'キャンセル率',
      value: total && cancelled !== null ? Math.round((cancelled / total) * 1000) / 10 : null,
      unit: '%',
      state: total ? 'ok' : rows ? 'unavailable' : bookingState,
      period,
      basis: 'キャンセル ÷ 新規予約（今月受付の分）',
      note: rows && !total ? '今月の予約がまだないため、率は出しません' : rows ? undefined : bookingNote,
    },
    {
      key: 'no_show',
      label: '無断キャンセル',
      value: rows && hasNoShowStatus ? rows.filter((r) => r.status.includes('無断')).length : null,
      unit: '件',
      state: rows && hasNoShowStatus ? 'ok' : rows ? 'unavailable' : bookingState,
      period,
      basis: '予約システムで「無断」と記録されたもの',
      note: rows && !hasNoShowStatus ? '予約システムの集計に無断キャンセルの区別がありません（カルテのキャンセルの記録で確認してください）' : rows ? undefined : bookingNote,
    },
    {
      key: 'first_visit_next',
      label: '初めての方の次回予約',
      value: followup && followup.firstVisits > 0 ? Math.round((followup.withNext / followup.firstVisits) * 1000) / 10 : null,
      unit: '%',
      state: followup ? (followup.firstVisits > 0 ? 'ok' : 'unavailable') : stats ? 'unavailable' : bookingState,
      period: followup ? `${md(followup.since)}〜（初めての来院から${followup.windowDays}日以内）` : period,
      basis:
        '初めての方の予約（来院済み）のうち、そのあと同じ方の次の予約が入ったものの割合。予約システムの中で数え、件数だけを受け取る（お名前などは受け取らない）',
      note: !followup
        ? stats
          ? '予約システムの集計がまだ対応していません（第2段階で予約システムに足します）'
          : bookingNote
        : followup.firstVisits === 0
          ? 'この期間の初めての方の来院がまだありません'
          : `${followup.withNext} / ${followup.firstVisits} 件`,
    },
  ]

  // ── 今月：LINE・ホームページ・Instagram（計測イベント） ─────────────
  const eventsNote = '計測の記録を読めませんでした'
  const follows = monthEvents ? uniqueActors(monthEvents.filter((e) => e.kind === 'line_follow')) : null
  const unfollows = monthEvents ? uniqueActors(monthEvents.filter((e) => e.kind === 'line_unfollow')) : null
  const hpReserve = clicks((e) => e.meta.dest === 'reserve' && e.meta.source === 'website', monthEvents)
  const hpBots = monthEvents ? monthEvents.filter((e) => e.kind === 'link_bot' && e.meta.source === 'website').length : null
  const hpLine = clicks((e) => e.meta.dest === 'line' && e.meta.source === 'website', monthEvents)
  // ホームページの入口（どこから来たか）。記録を始める前の日は数えていないので、始めた日からの期間にする
  const firstSourceDay = hp?.firstSourceDay ?? null
  const hpEntries: HpEntries | null =
    hp && firstSourceDay
      ? {
          period: firstSourceDay > monthStart ? `${md(firstSourceDay)}〜今日` : period,
          total: totalOf(hp.total.s),
          sources: topEntries(hp.total.s).map(([key, count]) => ({
            key,
            label: HP_SOURCE_LABELS[key as HpSource] ?? key,
            count,
          })),
          pages: topEntries(hp.total.lp, 8).map(([key, count]) => ({ key, label: pageLabel(key), count })),
        }
      : null
  const hpEntriesNote = !hp
    ? '記録を読めませんでした'
    : !firstSourceDay
      ? 'ホームページの入口の記録（js/site.js の更新）がまだ公開されていません'
      : '前のサイトの名前から分けた件数だけを残しています（Cookie・IP アドレス・検索した言葉は使いません）'
  const igClicks = clicks((e) => e.meta.source === 'instagram', monthEvents)
  const lineClickTracked = tracked((e) => e.meta.dest === 'line' && e.meta.source === 'website')
  const igTracked = tracked((e) => e.meta.source === 'instagram')

  monthMetrics.push(
    {
      key: 'line_follow',
      label: 'LINE 友だち追加',
      value: lineConfigured ? follows : null,
      unit: '人',
      state: !lineConfigured ? 'not_connected' : follows === null ? 'unavailable' : 'ok',
      period,
      basis: '友だち追加の通知の数。同じ方が追加し直しても1人',
      note: !lineConfigured ? '公式LINE と未連携です' : follows === null ? eventsNote : undefined,
    },
    {
      key: 'line_unfollow',
      label: 'LINE ブロック',
      value: lineConfigured ? unfollows : null,
      unit: '人',
      state: !lineConfigured ? 'not_connected' : unfollows === null ? 'unavailable' : 'ok',
      period: monthStart < UNFOLLOW_TRACKED_SINCE ? `${md(UNFOLLOW_TRACKED_SINCE)}〜今日` : period,
      basis: 'ブロックの通知の数。同じ方は1人',
      note: !lineConfigured
        ? '公式LINE と未連携です'
        : unfollows === null
          ? eventsNote
          : monthStart < UNFOLLOW_TRACKED_SINCE
            ? `${md(UNFOLLOW_TRACKED_SINCE)}から記録を始めました（それより前は未取得）`
            : undefined,
    },
    {
      key: 'hp_reserve_click',
      label: 'HP の予約ボタン',
      value: hpReserve ? hpReserve.length : null,
      unit: '回',
      state: hpReserve ? 'ok' : 'unavailable',
      period,
      basis: 'ホームページの予約ボタン（計測リンク）が押された回数。同じ方が2回押すと2回。検索エンジンなどの自動アクセスは数えない',
      note: hpReserve ? (hpBots ? `自動アクセス ${hpBots}回（予約・LINE ボタンの合計）は数えていません` : undefined) : eventsNote,
    },
    {
      key: 'hp_line_click',
      label: 'HP の LINE 相談ボタン',
      value: hpLine && lineClickTracked ? hpLine.length : null,
      unit: '回',
      state: hpLine && lineClickTracked ? 'ok' : hpLine ? 'not_connected' : 'unavailable',
      period,
      basis: 'ホームページの LINE ボタン（計測リンク）が押された回数',
      note: hpLine && !lineClickTracked
        ? 'ホームページの LINE ボタンが計測リンクになっていません（院長の設定待ち。計画書の「院長にお願いすること」2）'
        : hpLine ? undefined : eventsNote,
    },
    {
      key: 'instagram_click',
      label: 'Instagram からのリンク',
      value: igClicks && igTracked ? igClicks.length : null,
      unit: '回',
      state: igClicks && igTracked ? 'ok' : igClicks ? 'not_connected' : 'unavailable',
      period,
      basis: 'Instagram に置いた計測リンク（プロフィール・投稿・ストーリー）が押された回数',
      note: igClicks && !igTracked
        ? 'この90日、Instagram の計測リンクが押された記録がありません（プロフィールのリンクが計測リンクか確認してください）'
        : igClicks ? undefined : eventsNote,
      href: '/marketing/tools',
    },
    {
      key: 'hp_views',
      label: 'HP の閲覧（ページ表示）',
      value: hp && hp.days > 0 ? totalOf(hp.total.v) : null,
      unit: '回',
      state: hp ? (hp.days > 0 ? 'ok' : 'not_connected') : 'unavailable',
      period: hp?.firstDay && hp.firstDay > monthStart ? `${md(hp.firstDay)}〜今日` : period,
      basis: 'ホームページのページが開かれた回数（全ページの合計）。同じ方が2ページ見ると2回。検索エンジンなどの自動アクセスは数えない',
      note: !hp
        ? '記録を読めませんでした'
        : hp.days === 0
          ? 'ホームページの計測（js/site.js）がまだ公開されていません'
          : `はじめての方へ ${hp.total.v['/first-visit'] ?? 0}回・料金 ${hp.total.v['/price'] ?? 0}回・トップ ${hp.total.v['/'] ?? 0}回`,
    },
    {
      key: 'hp_tel_tap',
      label: 'HP の電話タップ',
      value: hp && hp.days > 0 ? totalOf(hp.total.t) : null,
      unit: '回',
      state: hp ? (hp.days > 0 ? 'ok' : 'not_connected') : 'unavailable',
      period: hp?.firstDay && hp.firstDay > monthStart ? `${md(hp.firstDay)}〜今日` : period,
      basis: 'ホームページの電話番号が押された回数。実際に電話がつながったかは分からない',
      note: !hp
        ? '記録を読めませんでした'
        : hp.days === 0
          ? 'ホームページの計測（js/site.js）がまだ公開されていません'
          : `スマホの下のバー ${hp.total.tw.bar ?? 0}回・本文 ${(hp.total.tw.main ?? 0) + (hp.total.tw.cta ?? 0)}回・ヘッダー ${hp.total.tw.header ?? 0}回・フッター ${hp.total.tw.footer ?? 0}回`,
    },
    {
      key: 'hp_visits',
      label: 'ホームページ訪問（外から）',
      value: hpEntries ? hpEntries.total : null,
      unit: '回',
      state: hp ? (hpEntries ? 'ok' : 'not_connected') : 'unavailable',
      period: hpEntries?.period ?? period,
      basis:
        '検索・地図・SNS・ブックマークなど、外からホームページに入ってきた回数。サイトの中のページ移動・再読み込みは数えない。同じ方が2回来ると2回。検索エンジンなどの自動アクセスは数えない',
      note: hpEntries
        ? hpEntries.sources
            .slice(0, 3)
            .map((r) => `${r.label} ${r.count}回`)
            .join('・') || 'この期間に外から来た記録はまだありません'
        : hpEntriesNote,
    },
    {
      key: 'cpa',
      label: '新患獲得単価（CPA）',
      value: null,
      unit: '円',
      state: 'not_connected',
      period,
      basis: '広告費 ÷ 初めての方の予約',
      note: '広告費の入力がまだありません（第4段階で入力欄を作ります）',
    },
  )

  // ── 流入元別 ───────────────────────────────────────────────
  let sources: SourceRow[] | null = null
  if (rows) {
    const map = new Map<string, SourceRow>()
    for (const row of rows) {
      const key = row.source || 'direct'
      const entry = map.get(key) ?? { source: key, label: sourceLabel(key), bookings: 0, firstVisit: 0, cancelled: 0, clicks: 0 }
      entry.bookings += 1
      if (row.visitType.startsWith('初')) entry.firstVisit += 1
      if (row.status === 'キャンセル') entry.cancelled += 1
      map.set(key, entry)
    }
    for (const e of clicks((x) => x.meta.dest === 'reserve', monthEvents) ?? []) {
      const key = e.meta.source || 'direct'
      const entry = map.get(key) ?? { source: key, label: sourceLabel(key), bookings: 0, firstVisit: 0, cancelled: 0, clicks: 0 }
      entry.clicks += 1
      map.set(key, entry)
    }
    sources = [...map.values()].sort((a, b) => b.bookings - a.bookings || b.clicks - a.clicks)
  }

  // ── 承認待ち ───────────────────────────────────────────────
  const approvals =
    proposalsResult.status === 'fulfilled'
      ? proposalsResult.value.flatMap((p) => p.items).filter((i) => i.status === 'proposed' && i.scheduledAt >= nowLocal).length
      : 0

  // ── 連携の状態（秘密の値は返さない。有無と、取れたかだけ） ──────────────
  const igConnected = igResult.status === 'fulfilled' && igResult.value
  const gbpConnected = gbpResult.status === 'fulfilled' && gbpResult.value
  const connections: ConnectionRow[] = [
    {
      key: 'booking',
      label: '予約システム（ネット予約）',
      state: !bookingConfigured ? 'not_set' : stats ? 'connected' : 'error',
      note: !bookingConfigured ? '未設定' : stats ? '予約の集計を受け取れています（個人を特定しない数字だけ）' : '設定はありますが、いま数字を取れません',
    },
    {
      key: 'line',
      label: '公式LINE',
      state: lineConfigured ? 'connected' : 'not_set',
      note: lineConfigured ? 'Messaging API でつながっています（署名を確かめて受け付け）' : '未設定',
      href: '/marketing/automation',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      state: igConnected ? 'connected' : 'not_set',
      note: igConnected ? '公式API でつながっています' : '未連携（投稿の予定と結果の画面の「Instagramとつなぐ」）',
      href: '/marketing/jobs',
    },
    {
      key: 'gbp',
      label: 'Googleビジネスプロフィール',
      state: gbpConnected ? 'connected' : 'not_set',
      note: gbpConnected ? 'つながっています（投稿は院長の承認後）' : '未連携（申請は承認済み。「Googleとつなぐ」の設定待ち）',
      href: '/marketing/jobs',
    },
    {
      key: 'hp_reserve',
      label: 'ホームページの予約ボタンの計測',
      state: tracked((e) => e.meta.dest === 'reserve' && e.meta.source === 'website') ? 'connected' : 'not_set',
      note: '予約ボタンは計測リンク（source=website）を通っています',
    },
    {
      key: 'hp_line',
      label: 'ホームページの LINE ボタンの計測',
      state: lineClickTracked ? 'connected' : 'not_set',
      note: lineClickTracked ? '計測リンクを通っています' : '未設定（LINE ボタンが lin.ee へ直接つながっています）',
    },
    {
      key: 'ga4',
      label: 'GA4（ホームページのアクセス）',
      state: 'not_set',
      note: '未連携（ページの閲覧・外からの訪問・来たところは、ホームページの計測で数えています）',
    },
    {
      key: 'gsc',
      label: 'Search Console（検索キーワード）',
      state: 'not_set',
      note: '未連携（検索キーワード・掲載順位の実測はここから取ります）',
    },
  ]
  // 予約ボタンの計測が一度も記録されていないときは、注意書きを変える
  const hpReserveRow = connections.find((c) => c.key === 'hp_reserve')
  if (hpReserveRow && hpReserveRow.state !== 'connected') hpReserveRow.note = 'この90日、ホームページの予約ボタンの計測が記録されていません'

  return {
    generatedAt: now.toISOString(),
    monthLabel,
    today: todayMetrics,
    month: monthMetrics,
    sources,
    hpEntries,
    hpEntriesNote,
    sourcesNote: rows
      ? '件数は予約システムの流入元（予約ボタンのリンクに付けた印）から。押した回数は計測リンクを通ったものだけ'
      : bookingNote,
    pending: {
      approvals,
      inquiriesNew: todayMetrics[1].value ?? 0,
    },
    connections,
  }
}
