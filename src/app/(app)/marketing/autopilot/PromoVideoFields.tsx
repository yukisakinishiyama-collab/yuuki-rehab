'use client'
/**
 * 自動投稿の設定：YouTubeショート・TikTokの動画（院の写真＋文字・約16秒）
 *
 * - オン・オフ（媒体ごと）と本数
 * - YouTube の連携（つなぐ・外す）と「審査に通った」の切りかえ
 * - 次に出す予定、動画の一覧（見本の絵・動画を開く）
 */
import { useState } from 'react'
import { PROMO_VIDEOS } from '@/data/promo-videos'
import { promoVideoUrl } from '@/lib/marketing/promo-video'
import type { AutopilotSettings } from '@/lib/marketing/autopilot-types'

export interface YoutubeConnection {
  connected: boolean
  channelTitle: string | null
  clientReady: boolean
  last: { ok: boolean; message: string; at: string } | null
}

export interface PromoPlanItem {
  scheduledAt: string
  videoId: string
  title: string
}

function slotLabel(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(local)
  if (!m) return local
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return `${Number(m[2])}/${Number(m[3])}（${'日月火水木金土'[day]}）${m[4]}`
}

export default function PromoVideoFields({
  s,
  setS,
  disabled,
  isAdmin,
  youtube,
  plan,
  onChanged,
}: {
  s: AutopilotSettings
  setS: (next: AutopilotSettings) => void
  disabled: boolean
  isAdmin: boolean
  youtube?: YoutubeConnection
  plan?: PromoPlanItem[]
  /** 連携を外したあとなど、読み直してほしいとき */
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const anyOn = s.youtubeShorts || s.tiktokVideo

  async function disconnect() {
    setBusy(true)
    try {
      await fetch('/api/marketing/youtube/connect', { method: 'DELETE' })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset id="promo-video" className="scroll-mt-24 space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
      <legend className="px-1 text-sm font-bold text-slate-900">YouTubeショート・TikTokの動画（院の写真＋文字・約16秒）</legend>
      <label className="flex items-start gap-2 font-bold max-lg:min-h-10">
        <input type="checkbox" checked={s.youtubeShorts} disabled={disabled} onChange={(e) => setS({ ...s, youtubeShorts: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0" />
        毎週、YouTubeショートに出す
      </label>
      <label className="flex items-start gap-2 font-bold max-lg:min-h-10">
        <input type="checkbox" checked={s.tiktokVideo} disabled={disabled} onChange={(e) => setS({ ...s, tiktokVideo: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0" />
        同じ動画をTikTokにも出す
      </label>
      <label className="block text-sm">
        <span className="font-bold text-slate-700">本数</span>
        <select
          value={s.promoVideoPerWeek}
          disabled={disabled || !anyOn}
          onChange={(e) => setS({ ...s, promoVideoPerWeek: Number(e.target.value) })}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2"
        >
          <option value={1}>週1本（水曜 13:30）</option>
          <option value={2}>週2本（水曜 13:30・土曜 16:00）</option>
        </select>
      </label>
      <p className="text-xs text-slate-600">
        Google検索向けの投稿と同じ18のテーマ（「下関市彦島＋症状」に絞ったもの）を、院の写真と文字の短い動画にして、順にくり返します。文面は院長が確認した文から抜いた決まった文です。時間になると、動画と貼りつける文（題名・説明）が院長のLINEに届きます。動画を保存して、それぞれのアプリから投稿してください（1〜2分。音楽はアプリの中で足せます）。年末年始（12/29〜1/3）は出しません。
      </p>

      <div className="space-y-2 rounded-lg bg-white p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-800">YouTubeの自動公開</span>
          {youtube?.connected ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">つながっています{youtube.channelTitle ? `（${youtube.channelTitle}）` : ''}</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">まだつながっていません</span>
          )}
        </div>
        {youtube?.last && <p className={`text-xs ${youtube.last.ok ? 'text-emerald-700' : 'text-red-700'}`}>{youtube.last.message}</p>}
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            {youtube?.clientReady ? (
              <a href="/api/marketing/youtube/connect" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white max-lg:inline-flex max-lg:min-h-10 max-lg:items-center">
                {youtube.connected ? 'YouTubeとつなぎ直す' : 'YouTubeとつなぐ'}
              </a>
            ) : (
              <span className="text-xs text-slate-600">Googleの連携の設定（GBP_CLIENT_ID・GBP_CLIENT_SECRET）が入ると、ここに「YouTubeとつなぐ」ボタンが出ます。</span>
            )}
            {youtube?.connected && (
              <button type="button" onClick={disconnect} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50 max-lg:min-h-10">
                連携を外す
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-600">連携は院長が行います。</p>
        )}
        <label className="flex items-start gap-2 max-lg:min-h-10">
          <input
            type="checkbox"
            checked={s.youtubeAudited}
            disabled={disabled || !youtube?.connected}
            onChange={(e) => setS({ ...s, youtubeAudited: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>
            <b>YouTubeの審査（APIの利用確認）に通った</b>
            <span className="block text-xs text-slate-600">
              オンにすると、時間になったら自動で公開します。審査に通る前にアプリから送った動画は「非公開」に固定され、あとから公開に直せません（YouTubeの決まり）。そのため、審査に通るまではオフのまま、LINEに届いた動画を手で投稿してください。
            </span>
          </span>
        </label>
      </div>

      {plan && plan.length > 0 && (
        <div className="rounded-lg bg-white p-3 text-sm">
          <p className="font-bold text-slate-800">次の予定</p>
          <ul className="mt-1 space-y-1">
            {plan.map((p) => (
              <li key={`${p.scheduledAt}-${p.videoId}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums text-slate-600">{slotLabel(p.scheduledAt)}</span>
                <span className="font-bold text-slate-800">{p.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-lg bg-white p-2">
        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-bold text-slate-700">動画の一覧（{PROMO_VIDEOS.length}本）</summary>
        <p className="mt-1 text-xs text-slate-600">「動画」は、はじめて開くときだけ作るのに1分ほどかかります（2回めからはすぐ出ます）。</p>
        <ol className="mt-2 space-y-1 text-sm">
          {PROMO_VIDEOS.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="tabular-nums text-slate-500">{i + 1}.</span>
              <span className="font-bold text-slate-800">{v.post.title}</span>
              <a href={promoVideoUrl(v.id, 'poster', '')} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-xs font-bold text-teal-700 underline">
                見本の絵
              </a>
              <a href={promoVideoUrl(v.id, 'video', '')} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-xs font-bold text-teal-700 underline">
                動画
              </a>
            </li>
          ))}
        </ol>
      </details>
    </fieldset>
  )
}
