'use client'
/**
 * 自動投稿の設定：YouTubeショート・TikTokの動画（前半はAIのイメージ・後半は院の写真＋文字・約16秒）
 *
 * - オン・オフ（媒体ごと）と本数
 * - Buffer の連携（キーを貼って「つなぐ」・確かめる・外す）。つなぐと「承認して投稿」で自動で出せる
 * - 次の予定：承認の状態と、承認して投稿・見送る・別の動画にする・承認を取り消す・元に戻す（院長のみ）
 * - YouTube と直接つなぐ方法（YouTube の審査が必要。ふだんは使わない）
 * - 動画の一覧（見本の絵・動画を開く・AIの絵を作り直す）
 * 絵は、前半がAIで作ったイメージ、後半が人物の写っていない院の写真（src/data/promo-videos.ts）
 */
import { useState } from 'react'
import { PROMO_VIDEOS, promoUsesAi } from '@/data/promo-videos'
import { promoVideoUrl } from '@/lib/marketing/promo-video'
import type { AutopilotSettings } from '@/lib/marketing/autopilot-types'

export interface YoutubeConnection {
  connected: boolean
  channelTitle: string | null
  clientReady: boolean
  last: { ok: boolean; message: string; at: string } | null
}

export interface BufferConnection {
  connected: boolean
  source: 'env' | 'app' | null
  keyHint: string | null
  organizationName: string | null
  youtube: { name: string; ready: boolean } | null
  tiktok: { name: string; ready: boolean } | null
  checkedAt: string | null
  last: { ok: boolean; message: string; at: string } | null
  error?: string
}

type PromoChannel = 'youtube_short' | 'tiktok'

export interface PromoPlanItem {
  week: string
  n: number
  scheduledAt: string
  videoId: string
  title: string
  status: 'waiting' | 'approved' | 'skipped' | 'expired' | 'manual'
  channels: Array<{ channel: PromoChannel; route: 'buffer' | 'youtube_api' | 'manual'; jobStatus: string | null; url: string | null }>
  requestedAt: string | null
  requestDelivered: boolean
  approvedAt: string | null
  approvedBy: string | null
  videoUrl: string | null
  /** 時刻がまだ来ていない */
  upcoming: boolean
  /** 2日以内 */
  soon: boolean
}

const CH_LABEL: Record<PromoChannel, string> = { youtube_short: 'YouTube', tiktok: 'TikTok' }
const ROUTE_LABEL = { buffer: '自動（Buffer）', youtube_api: '自動（YouTubeに直接）', manual: '手で投稿（LINEでお送りします）' } as const

function slotLabel(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(local)
  if (!m) return local
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return `${Number(m[2])}/${Number(m[3])}（${'日月火水木金土'[day]}）${m[4]}`
}

function posted(p: PromoPlanItem): boolean {
  return p.channels.length > 0 && p.channels.every((c) => c.jobStatus === 'published')
}

function statusChip(p: PromoPlanItem): { label: string; tone: string } {
  if (posted(p)) return { label: '投稿しました', tone: 'bg-emerald-100 text-emerald-800' }
  switch (p.status) {
    case 'approved':
      return { label: `承認済み${p.approvedBy ? `（${p.approvedBy}）` : ''}`, tone: 'bg-emerald-100 text-emerald-800' }
    case 'skipped':
      return { label: '見送り（出しません）', tone: 'bg-slate-200 text-slate-700' }
    case 'expired':
      return { label: '承認が無かったため出していません', tone: 'bg-slate-100 text-slate-600' }
    case 'manual':
      return { label: '時間になったらLINEで（手で投稿）', tone: 'bg-sky-100 text-sky-800' }
    default:
      return { label: p.requestDelivered ? '承認待ち（LINEでお送りしました）' : '承認待ち', tone: 'bg-amber-100 text-amber-900' }
  }
}

/** 自動投稿の画面の上に出す「承認待ちの動画があります」（2日以内のもの） */
export function PromoApprovalBanner({ plan, onOpen }: { plan: PromoPlanItem[]; onOpen: () => void }) {
  const waiting = plan.filter((p) => p.status === 'waiting' && p.soon && !posted(p))
  if (waiting.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
      <span className="font-bold text-amber-900">🎬 承認待ちの動画</span>
      <span className="text-amber-900">{waiting.map((p) => `${slotLabel(p.scheduledAt)}「${p.title}」`).join('、')}</span>
      <button type="button" onClick={onOpen} className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-bold text-white max-lg:min-h-10">
        確認する
      </button>
    </div>
  )
}

export default function PromoVideoFields({
  s,
  setS,
  disabled,
  isAdmin,
  youtube,
  buffer,
  aiImage,
  plan,
  onChanged,
}: {
  s: AutopilotSettings
  setS: (next: AutopilotSettings) => void
  disabled: boolean
  isAdmin: boolean
  youtube?: YoutubeConnection
  buffer?: BufferConnection | null
  /** AI画像（OpenAI）が使える設定か */
  aiImage?: boolean
  plan?: PromoPlanItem[]
  /** 連携・承認のあとなど、読み直してほしいとき */
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  /** AIの絵を作り直している動画と、その結果 */
  const [remaking, setRemaking] = useState<string | null>(null)
  const [remakeMsg, setRemakeMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)
  /** Buffer のキー（貼るだけ。画面には二度と出さない） */
  const [bufferKey, setBufferKey] = useState('')
  const [bufferMsg, setBufferMsg] = useState<{ ok: boolean; text: string } | null>(null)
  /** 次の予定の操作中（`${week}:${n}`）と、その結果 */
  const [acting, setActing] = useState<string | null>(null)
  const [planMsg, setPlanMsg] = useState<{ key: string; ok: boolean; text: string } | null>(null)
  const anyOn = s.youtubeShorts || s.tiktokVideo

  async function remake(id: string) {
    setRemaking(id)
    setRemakeMsg(null)
    try {
      const res = await fetch('/api/marketing/promo-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'regenerate' }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; aiPending?: boolean }
      if (!res.ok) setRemakeMsg({ id, ok: false, text: data.error ?? `作り直せませんでした（${res.status}）` })
      else if (data.aiPending) setRemakeMsg({ id, ok: false, text: 'AIの絵を作れなかったため、院の写真で作りました。少し時間をおいて、もう一度お試しください。' })
      else setRemakeMsg({ id, ok: true, text: '新しい絵で作り直しました。「動画」を開いて確かめてください。' })
    } catch (e) {
      setRemakeMsg({ id, ok: false, text: `作り直せませんでした（${e instanceof Error ? e.message : '通信'}）` })
    } finally {
      setRemaking(null)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await fetch('/api/marketing/youtube/connect', { method: 'DELETE' })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function bufferCall(method: 'POST' | 'DELETE', body?: Record<string, unknown>) {
    setBusy(true)
    setBufferMsg(null)
    try {
      const res = await fetch('/api/marketing/buffer', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const data = (await res.json().catch(() => ({}))) as { error?: string; buffer?: BufferConnection }
      if (!res.ok) setBufferMsg({ ok: false, text: data.error ?? `できませんでした（${res.status}）` })
      else {
        setBufferKey('')
        if (data.buffer?.error) setBufferMsg({ ok: false, text: data.buffer.error })
        onChanged()
      }
    } catch (e) {
      setBufferMsg({ ok: false, text: `できませんでした（${e instanceof Error ? e.message : '通信'}）` })
    } finally {
      setBusy(false)
    }
  }

  async function planAction(p: PromoPlanItem, action: 'approve' | 'unapprove' | 'skip' | 'restore' | 'swap') {
    const key = `${p.week}:${p.n}`
    setActing(key)
    setPlanMsg(null)
    try {
      const res = await fetch('/api/marketing/promo-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week: p.week, n: p.n, action }) })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      setPlanMsg({ key, ok: res.ok && data.ok !== false, text: data.message ?? data.error ?? `できませんでした（${res.status}）` })
      onChanged()
    } catch (e) {
      setPlanMsg({ key, ok: false, text: `できませんでした（${e instanceof Error ? e.message : '通信'}）` })
    } finally {
      setActing(null)
    }
  }

  const bufferReady = Boolean(buffer?.connected && (buffer.youtube?.ready || buffer.tiktok?.ready))

  return (
    <fieldset id="promo-video" className="scroll-mt-24 space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
      <legend className="px-1 text-sm font-bold text-slate-900">YouTubeショート・TikTokの動画（約16秒）</legend>
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
        Google検索向けの投稿と同じ18のテーマ（「下関市彦島＋症状」に絞ったもの）を、短い動画にして、順にくり返します。絵は、前半（つかみ・こんなときに）がAIで作ったイメージ、後半（当院では・院の強み・ご予約）が院の写真です（足首とエコー・エコーの機械・運動の器具・外観だけ。人物が特定できる写真は使いません）。文面は院長が確認した文から抜いた決まった文です。年末年始（12/29〜1/3）は出しません。
      </p>
      <p className="text-xs text-slate-600">
        <b>Bufferにつないだ場合：</b>投稿の前日に、見本の動画と「承認して投稿」「今回は見送る」「別の動画にする」のボタンが院長のLINEに届きます。承認すると、時間になったら自動で投稿します（承認しなかった動画は出しません。時刻から24時間たっても承認が無ければ、その回は出しません）。
        <b>つないでいない媒体：</b>時間になると、動画と貼りつける文が院長のLINEに届くので、それぞれのアプリから投稿してください（1〜2分）。
      </p>

      {/* Buffer（審査済みの投稿サービス）で YouTube・TikTok へ自動で出す */}
      <div id="promo-buffer" className="space-y-2 rounded-lg bg-white p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-800">自動で投稿（Buffer）</span>
          {bufferReady ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">つながっています</span>
          ) : buffer?.connected ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">つながっていますが、使えるチャンネルがありません</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">まだつながっていません</span>
          )}
        </div>
        {buffer?.connected && (
          <ul className="space-y-0.5 text-xs text-slate-700">
            {(['youtube', 'tiktok'] as const).map((k) => {
              const ch = buffer[k]
              const label = k === 'youtube' ? 'YouTube' : 'TikTok'
              return (
                <li key={k}>
                  {label}：
                  {ch ? (
                    ch.ready ? (
                      <span className="font-bold text-emerald-800">{ch.name}（使えます）</span>
                    ) : (
                      <span className="font-bold text-red-700">{ch.name}（つながりが切れています。Bufferの画面でつなぎ直してください）</span>
                    )
                  ) : (
                    <span className="text-slate-600">Bufferに追加されていません（時間になったらLINEでお送りします）</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {buffer?.error && <p className="text-xs text-red-700">{buffer.error}</p>}
        {bufferMsg && <p className={`text-xs ${bufferMsg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{bufferMsg.text}</p>}
        {!bufferMsg && buffer?.last && <p className={`text-xs ${buffer.last.ok ? 'text-emerald-700' : 'text-red-700'}`}>{buffer.last.message}</p>}
        {isAdmin ? (
          buffer?.source === 'env' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600">Vercelの設定（BUFFER_API_KEY）のキーを使っています（{buffer.keyHint}）。</span>
              <button type="button" onClick={() => bufferCall('POST', { action: 'refresh' })} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50 max-lg:min-h-10">
                つながりを確かめる
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (bufferKey.trim()) bufferCall('POST', { action: 'connect', apiKey: bufferKey.trim() })
                }}
                className="flex flex-wrap items-end gap-2"
              >
                <label className="min-w-0 flex-1 text-xs">
                  <span className="font-bold text-slate-700">{buffer?.connected ? `Bufferのキー（いま：${buffer.keyHint}）を貼りかえる` : 'Bufferのキーを貼る'}</span>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={bufferKey}
                    onChange={(e) => setBufferKey(e.target.value)}
                    placeholder="Bufferの「設定 → API」で作ったキー"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                  />
                </label>
                <button type="submit" disabled={busy || !bufferKey.trim()} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 max-lg:min-h-10">
                  {busy ? '確かめています…' : 'つなぐ'}
                </button>
              </form>
              {buffer?.connected && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => bufferCall('POST', { action: 'refresh' })} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50 max-lg:min-h-10">
                    つながりを確かめる
                  </button>
                  <button type="button" onClick={() => bufferCall('DELETE')} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50 max-lg:min-h-10">
                    連携を外す
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <p className="text-xs text-slate-600">連携は院長が行います。</p>
        )}
        <details className="text-xs text-slate-700">
          <summary className="flex min-h-10 cursor-pointer items-center font-bold">つなぎ方（はじめの1回だけ・10分ほど）</summary>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <a href="https://buffer.com" target="_blank" rel="noreferrer" className="font-bold text-teal-700 underline">
                buffer.com
              </a>
              で無料のアカウントを作ります（無料のプランで、YouTube・TikTok の2つをつなげます）。
            </li>
            <li>Buffer の「チャンネルを追加（Connect channels）」で、YouTube と TikTok をつなぎます（院のアカウントでログイン）。TikTok がつながらないときは、TikTok アプリでビジネスアカウントに切りかえてから、もう一度。</li>
            <li>
              <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noreferrer" className="font-bold text-teal-700 underline">
                Buffer の「設定 → API」
              </a>
              を開き、キーを作ってコピーします（キーは他の人に見せないでください）。
            </li>
            <li>この上の欄に貼って「つなぐ」を押します。YouTube・TikTok のチャンネル名が出たら完了です。</li>
          </ol>
        </details>
      </div>

      {plan && plan.length > 0 && (
        <div className="rounded-lg bg-white p-3 text-sm">
          <p className="font-bold text-slate-800">次の予定</p>
          <ul className="mt-1 divide-y divide-slate-100">
            {plan.map((p) => {
              const key = `${p.week}:${p.n}`
              const chip = statusChip(p)
              const done = posted(p)
              const future = p.upcoming
              const btn = 'rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 max-lg:min-h-10'
              return (
                <li key={key} className="space-y-1.5 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="tabular-nums text-slate-600">{slotLabel(p.scheduledAt)}</span>
                    <span className="font-bold text-slate-800">{p.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${chip.tone}`}>{chip.label}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {p.channels.map((c) => (
                      <span key={c.channel} className="mr-3 inline-block">
                        {CH_LABEL[c.channel]}：{c.jobStatus === 'published' ? '投稿しました' : ROUTE_LABEL[c.route]}
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer" className="ml-1 font-bold text-teal-700 underline">
                            開く
                          </a>
                        )}
                      </span>
                    ))}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={p.videoUrl ?? promoVideoUrl(p.videoId, 'video', '')} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center text-xs font-bold text-teal-700 underline">
                      動画を見る
                    </a>
                    {isAdmin && !done && p.status === 'waiting' && (
                      <>
                        <button type="button" onClick={() => planAction(p, 'approve')} disabled={acting !== null} className={`${btn} border-teal-700 bg-teal-700 text-white`}>
                          {acting === key ? '動画を用意しています…' : '承認して投稿'}
                        </button>
                        <button type="button" onClick={() => planAction(p, 'skip')} disabled={acting !== null} className={`${btn} border-slate-300 bg-white text-slate-700`}>
                          今回は見送る
                        </button>
                        <button type="button" onClick={() => planAction(p, 'swap')} disabled={acting !== null} className={`${btn} border-slate-300 bg-white text-slate-700`}>
                          別の動画にする
                        </button>
                      </>
                    )}
                    {isAdmin && !done && p.status === 'manual' && future && (
                      <>
                        <button type="button" onClick={() => planAction(p, 'skip')} disabled={acting !== null} className={`${btn} border-slate-300 bg-white text-slate-700`}>
                          今回は見送る
                        </button>
                        <button type="button" onClick={() => planAction(p, 'swap')} disabled={acting !== null} className={`${btn} border-slate-300 bg-white text-slate-700`}>
                          別の動画にする
                        </button>
                      </>
                    )}
                    {isAdmin && !done && p.status === 'approved' && (
                      <button type="button" onClick={() => planAction(p, 'unapprove')} disabled={acting !== null} className={`${btn} border-slate-300 bg-white text-slate-700`}>
                        承認を取り消す
                      </button>
                    )}
                    {isAdmin && p.status === 'skipped' && future && (
                      <button type="button" onClick={() => planAction(p, 'restore')} disabled={acting !== null} className={`${btn} border-slate-300 bg-white text-slate-700`}>
                        元に戻す
                      </button>
                    )}
                  </div>
                  {planMsg?.key === key && <p className={`text-xs ${planMsg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{planMsg.text}</p>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {aiImage === false && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">AI画像の設定（OPENAI_API_KEY）が無いため、いまは院の写真だけで作ります。</p>
      )}

      <details className="rounded-lg bg-white p-2">
        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-bold text-slate-700">動画の一覧（{PROMO_VIDEOS.length}本）</summary>
        <p className="mt-1 text-xs text-slate-600">
          「動画」は、はじめて開くときだけ作るのに1〜2分かかります（AIの絵もこのとき作ります。2回めからはすぐ出ます）。AIの絵は一度作ると使い回します。手や足が不自然・内容に合わないときは「絵を作り直す」を押してください（1枚ごとにAIの利用料がかかります）。
        </p>
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
              {isAdmin && aiImage && promoUsesAi(v) && (
                <button
                  type="button"
                  onClick={() => remake(v.id)}
                  disabled={remaking !== null}
                  className="min-h-10 rounded border border-slate-300 px-2 text-xs text-slate-700 disabled:opacity-50"
                >
                  {remaking === v.id ? '作り直しています…（1〜2分）' : '絵を作り直す'}
                </button>
              )}
              {remakeMsg?.id === v.id && <span className={`w-full text-xs ${remakeMsg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{remakeMsg.text}</span>}
            </li>
          ))}
        </ol>
      </details>

      {/* YouTube に直接（Buffer を使わない方法）。YouTube の審査に通るまでは使えない */}
      <details className="rounded-lg bg-white p-2 text-sm">
        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-bold text-slate-700">
          YouTubeと直接つなぐ（Bufferを使わない方法・YouTubeの審査が必要）
          {youtube?.connected ? '：つながっています' : ''}
        </summary>
        <div className="mt-1 space-y-2">
          <p className="text-xs text-slate-600">ふだんは Buffer を使うので、ここは使わなくてかまいません。Buffer につないでいるときは、Buffer が先に使われます。</p>
          {youtube?.last && <p className={`text-xs ${youtube.last.ok ? 'text-emerald-700' : 'text-red-700'}`}>{youtube.last.message}</p>}
          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              {youtube?.clientReady ? (
                <a href="/api/marketing/youtube/connect" className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800 max-lg:inline-flex max-lg:min-h-10 max-lg:items-center">
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
                審査に通る前にアプリから送った動画は「非公開」に固定され、あとから公開に直せません（YouTubeの決まり）。審査に通るまではオフのままにしてください。オンにしても、承認した動画だけを出します。
              </span>
            </span>
          </label>
        </div>
      </details>
    </fieldset>
  )
}
