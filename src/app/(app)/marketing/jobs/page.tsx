'use client'

/** 投稿ジョブ・履歴：予約済みジョブの実行状況、リトライ、手動投稿の完了記録、接続状況 */
import { useCallback, useEffect, useState } from 'react'
import type { PublishJob } from '@/lib/marketing/jobs-store-server'
import type { GooglePostRow, GooglePostsOverview } from '@/lib/marketing/gbp-posts-server'
import { CHANNEL_LABELS } from '@/lib/marketing/types'
import { useMarketingRole } from '@/lib/marketing/use-role'

interface Connections {
  mode: string
  connections: Record<string, boolean>
  /** 実疎通チェックの結果（envがある項目のみ）。okでも定期確認を推奨 */
  details?: Record<string, { ok: boolean; note: string }>
  /** 「Instagramとつなぐ」ボタン用 */
  instagramOAuth?: { ready: boolean; last: { ok: boolean; message: string; at: string } | null }
  /** 「Googleとつなぐ」ボタン用 */
  googleOAuth?: { ready: boolean; location: string | null; last: { ok: boolean; message: string; at: string } | null }
}

const JOB_STATUS_LABEL: Record<PublishJob['status'], { label: string; tone: string }> = {
  pending: { label: '実行待ち', tone: 'bg-teal-100 text-teal-800' },
  processing: { label: '公開処理中', tone: 'bg-blue-100 text-blue-800' },
  published: { label: '公開済み', tone: 'bg-emerald-100 text-emerald-800' },
  failed: { label: '公開失敗', tone: 'bg-red-100 text-red-800' },
  action_required: { label: '手動対応待ち', tone: 'bg-amber-100 text-amber-800' },
  cancelled: { label: '取消済み', tone: 'bg-slate-200 text-slate-500' },
}

/** Google の審査で拒否された投稿（status は failed。ふつうの「公開失敗」と分けて見せる） */
const GOOGLE_REJECTED_LABEL = { label: 'Googleが拒否', tone: 'bg-red-100 text-red-800' }

/** Google へ送ったが、公開されたかはまだ確かめていない投稿 */
const GOOGLE_SENT_LABEL = { label: 'Googleへ送信済み', tone: 'bg-blue-100 text-blue-800' }

const GOOGLE_BUTTON_LABEL: Record<string, string> = {
  BOOK: '予約',
  CALL: '今すぐ電話',
  LEARN_MORE: '詳細',
  ORDER: 'オンライン注文',
  SHOP: '購入',
  SIGN_UP: '登録',
}

function isGoogleRejected(job: PublishJob): boolean {
  return job.channel === 'google_business' && job.google?.state === 'rejected'
}

/** Google へ出したあとの、審査の確認の状態（公開済みの Google の投稿だけ） */
function googleCheckNote(job: PublishJob): { text: string; tone: string } | null {
  if (job.channel !== 'google_business' || job.status !== 'published') return null
  if (job.google?.state === 'live') return { text: 'Googleで公開を確認', tone: 'bg-emerald-50 text-emerald-700' }
  if (job.google?.done) return { text: 'Googleでの公開は未確認', tone: 'bg-slate-100 text-slate-500' }
  return { text: 'Googleの審査を確認中', tone: 'bg-amber-50 text-amber-700' }
}

/** この日数より前の拒否は、たたんで見せる（古い拒否でいつまでも赤くしない） */
const GOOGLE_RECENT_DAYS = 30

function isRecentRow(row: GooglePostRow, at: string | undefined): boolean {
  const base = Date.parse(at ?? '')
  const t = Date.parse(row.createTime)
  return Number.isFinite(base) && Number.isFinite(t) && base - t <= GOOGLE_RECENT_DAYS * 24 * 60 * 60 * 1000
}

function GoogleRejectedRow({ row }: { row: GooglePostRow }) {
  return (
    <li className="space-y-0.5 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">拒否</span>
        <span>{googleRowText(row)}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{row.fromApp ? '院内アプリから' : 'Googleの画面から'}</span>
      </div>
      <p className="text-xs text-slate-600">
        ボタン：{row.button ? (GOOGLE_BUTTON_LABEL[row.button] ?? row.button) : 'なし'}
        {row.linkHost ? ` → ${row.linkHost}` : ''}
        {!row.linkOk ? <span className="font-bold text-red-700">（このリンク先は拒否されやすい）</span> : null}
      </p>
    </li>
  )
}

function googleRowText(row: GooglePostRow): string {
  const at = row.createTime ? new Date(row.createTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  return `${at}　${row.title || '（本文なし）'}`
}

const CONNECTION_ITEMS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'anthropic', label: 'AI文章生成（Anthropic）', hint: 'ANTHROPIC_API_KEY' },
  { key: 'openaiImage', label: '画像生成（OpenAI）', hint: 'OPENAI_API_KEY（Phase 5で使用）' },
  { key: 'lineChannel', label: 'LINE Messaging API', hint: 'LINE_CHANNEL_SECRET / ACCESS_TOKEN' },
  { key: 'instagram', label: 'Instagram Graph API', hint: '下の「Instagramとつなぐ」から接続' },
  { key: 'googleBusiness', label: 'Google Business Profile API', hint: '下の「Googleとつなぐ」から接続' },
  { key: 'cronSecret', label: 'ジョブ実行の保護（CRON_SECRET）', hint: '本番デプロイ時に設定推奨' },
]

export default function JobsPage() {
  const { isAdmin } = useMarketingRole()
  const [jobs, setJobs] = useState<PublishJob[]>([])
  const [conn, setConn] = useState<Connections | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [googlePosts, setGooglePosts] = useState<GooglePostsOverview | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)

  /** Google の投稿の審査の結果（読むだけ）。失敗しても、ほかの表示は生かす */
  const loadGooglePosts = useCallback(async (force = false) => {
    setGoogleBusy(true)
    try {
      const res = await fetch(`/api/marketing/google/posts${force ? '?refresh=1' : ''}`)
      const data = (await res.json()) as GooglePostsOverview
      setGooglePosts(data)
    } catch {
      setGooglePosts(null)
    } finally {
      setGoogleBusy(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    // 片方のAPIが失敗しても、もう片方の表示は生かす
    const [jobsRes, connRes] = await Promise.all([
      fetch('/api/marketing/jobs')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .catch((e: Error) => ({ error: e.message })),
      fetch('/api/marketing/connections')
        .then((r) => r.json())
        .catch(() => null),
    ])
    if ('error' in jobsRes) {
      setJobsError(`ジョブ一覧の取得に失敗しました（${jobsRes.error}）。保存先（Supabase）の設定を確認してください。`)
    } else {
      setJobsError('')
      setJobs(jobsRes.jobs ?? [])
    }
    if (connRes) setConn(connRes)
  }, [])

  useEffect(() => {
    // 読み込みは非同期で開始（effect本体で同期的にsetStateしない）
    let alive = true
    Promise.resolve().then(() => {
      if (alive) void refresh()
      if (alive) void loadGooglePosts()
    })
    return () => {
      alive = false
    }
  }, [refresh, loadGooglePosts])

  async function runNow() {
    setBusy(true)
    setMessage('実行中…')
    try {
      const res = await fetch('/api/marketing/jobs/run', { method: 'POST' })
      const data = await res.json()
      setMessage(`実行完了: ${data.processed}件処理（公開: ${data.results?.filter((r: { outcome: string }) => r.outcome === 'published').length ?? 0}件）`)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function patchJob(id: string, body: Record<string, unknown>) {
    await fetch(`/api/marketing/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">投稿の予定と結果・接続状況</h1>
        {conn && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${conn.mode === 'mock' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {conn.mode === 'mock' ? 'モックモード（外部送信なし）' : '本番モード'}
          </span>
        )}
        {isAdmin ? (
          <button type="button" onClick={runNow} disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 max-lg:min-h-10">
            期限のきたジョブを今すぐ実行
          </button>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">スタッフ（編集）権限：閲覧のみ・公開操作は院長</span>
        )}
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>

      {/* API接続確認 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">API接続確認</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {CONNECTION_ITEMS.map((item) => {
            const connected = conn?.connections?.[item.key]
            const detail = conn?.details?.[item.key]
            // 設定済みでも疎通NGなら黄色で警告（トークン失効などの早期発見用）
            const dotColor = !connected ? 'bg-slate-300' : detail && !detail.ok ? 'bg-amber-400' : 'bg-emerald-500'
            return (
              <li key={item.key} className="rounded-lg border border-slate-100 p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-auto text-xs text-slate-500">{connected ? '接続済み' : item.hint}</span>
                </div>
                {detail ? (
                  <p className={`mt-1 pl-4 text-xs ${detail.ok ? 'text-slate-500' : 'text-amber-700'}`}>{detail.note}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
        {/* Instagramとつなぐ（OAuth）: 院長が許可するだけで接続。トークンのコピーは不要 */}
        <div className="mt-3 rounded-lg border border-pink-100 bg-pink-50/50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold">Instagramの自動投稿</span>
            {isAdmin && conn?.instagramOAuth?.ready ? (
              <a href="/api/marketing/instagram/connect" className="rounded-lg bg-pink-700 px-4 py-2 text-sm font-bold text-white max-lg:min-h-10 max-lg:inline-flex max-lg:items-center">
                {conn?.connections?.instagram ? 'Instagramとつなぎ直す' : 'Instagramとつなぐ'}
              </a>
            ) : null}
            {isAdmin && conn && !conn.instagramOAuth?.ready ? (
              <span className="text-xs text-slate-500">VercelにINSTAGRAM_APP_IDとINSTAGRAM_APP_SECRETを設定すると「Instagramとつなぐ」ボタンが使えます。</span>
            ) : null}
            {!isAdmin ? <span className="text-xs text-slate-500">接続は院長が行います。</span> : null}
          </div>
          {conn?.instagramOAuth?.last ? (
            <p className={`mt-2 text-xs ${conn.instagramOAuth.last.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
              {conn.instagramOAuth.last.ok ? '✓ ' : '! '}
              {conn.instagramOAuth.last.message}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">ボタンを押すとInstagramの画面に移ります。yu.ki__seikotsuin で「許可」を押すと、この画面に戻って接続済みになります。</p>
          )}
        </div>
        {/* Googleとつなぐ（OAuth）: 院長が許可するだけで接続。トークンや店舗IDのコピーは不要 */}
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold">Googleの自動投稿・Search Console</span>
            {isAdmin && conn?.googleOAuth?.ready ? (
              <a href="/api/marketing/google/connect" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white max-lg:min-h-10 max-lg:inline-flex max-lg:items-center">
                {conn?.connections?.googleBusiness ? 'Googleとつなぎ直す' : 'Googleとつなぐ'}
              </a>
            ) : null}
            {isAdmin && conn && !conn.googleOAuth?.ready ? (
              <span className="text-xs text-slate-500">VercelにGBP_CLIENT_IDとGBP_CLIENT_SECRETを設定すると「Googleとつなぐ」ボタンが使えます。</span>
            ) : null}
            {!isAdmin ? <span className="text-xs text-slate-500">接続は院長が行います。</span> : null}
            {conn?.connections?.googleBusiness && conn.googleOAuth?.location ? (
              <span className="text-xs text-emerald-700">投稿先：{conn.googleOAuth.location}</span>
            ) : null}
          </div>
          {conn?.googleOAuth?.last ? (
            <p className={`mt-2 text-xs ${conn.googleOAuth.last.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
              {conn.googleOAuth.last.ok ? '✓ ' : '! '}
              {conn.googleOAuth.last.message}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              ボタンを押すとGoogleの画面に移ります。ビジネスプロフィールのオーナーのアカウント（yukisakinishiyama@gmail.com）を選び、「このアプリはGoogleで確認されていません」と出たら「詳細」→「ゆうき整骨院 投稿連携（安全ではないページ）に移動」→ 許可の項目（ビジネスプロフィールの管理・Search Console のデータの表示）の両方にチェックを入れて「続行」で許可してください。この画面に戻って接続済みになります。
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          未接続の媒体も投稿は止まりません。予定時刻になると「手動対応待ち」になり、本文コピー＋完了記録で運用できます。
        </p>
      </section>

      {/* Google の審査の結果（Google の投稿の一覧から。アプリの外で出した投稿も入る） */}
      {googlePosts?.connected
        ? (() => {
            const recent = googlePosts.rejected.filter((row) => isRecentRow(row, googlePosts.at))
            const older = googlePosts.rejected.filter((row) => !isRecentRow(row, googlePosts.at))
            return (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-bold">Googleの審査の結果</h2>
                  <span className="text-sm text-slate-600">
                    新しい{googlePosts.counts.total}本のうち：公開 {googlePosts.counts.live}・拒否 {googlePosts.counts.rejected}
                    {googlePosts.counts.rejected > 0 ? (
                      <span className={recent.length > 0 ? 'font-bold text-red-700' : ''}>（この{GOOGLE_RECENT_DAYS}日は {recent.length}）</span>
                    ) : null}
                    ・審査中 {googlePosts.counts.processing}
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadGooglePosts(true)}
                    disabled={googleBusy}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-bold disabled:opacity-50 max-lg:min-h-10"
                  >
                    {googleBusy ? '読み込み中…' : '読み直す'}
                  </button>
                </div>
                {googlePosts.error ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-700">{googlePosts.error}</p> : null}
                <p className="mt-2 text-xs text-slate-500">
                  Googleは、受け取った投稿をあとで審査し、決まりに合わないものを「拒否」にします（拒否された投稿は、一般の方には見えません）。Googleの画面や予約投稿で出したものも、ここに出ます。
                </p>
                {recent.length > 0 ? (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-red-100 bg-red-50/40 px-3">
                    {recent.map((row, i) => (
                      <GoogleRejectedRow key={`${row.createTime}-${i}`} row={row} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-emerald-700">この{GOOGLE_RECENT_DAYS}日に拒否された投稿はありません。</p>
                )}
                {older.length > 0 ? (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-xs text-slate-500">それより前に拒否された投稿（{older.length}）</summary>
                    <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-100 px-3">
                      {older.map((row, i) => (
                        <GoogleRejectedRow key={`${row.createTime}-${i}`} row={row} />
                      ))}
                    </ul>
                  </details>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  拒否されにくくする決まり：ボタンのリンクは院のホームページ（shimonoseki-yuuki.com）か公式LINEだけにする／本文に電話番号・URLを書かない／同じ文をくり返さない。院内アプリから出す投稿は、この決まりに自動で合わせます。拒否が見つかったら、院長のLINEにお知らせします。
                </p>
              </section>
            )
          })()
        : null}

      {/* ジョブ一覧 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">ジョブ一覧（{jobs.length}）</h2>
        {jobsError ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-700">{jobsError}</p> : null}
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">「投稿を作る」で承認→予約すると、ここにジョブが並びます。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {jobs.map((job) => {
              const check = googleCheckNote(job)
              // Google は受け取ったあとで審査する。公開を確かめるまでは「公開済み」と言い切らない
              const waiting = check !== null && job.google?.state !== 'live' && !job.google?.done
              const s = isGoogleRejected(job) ? GOOGLE_REJECTED_LABEL : waiting ? GOOGLE_SENT_LABEL : JOB_STATUS_LABEL[job.status]
              return (
                <li key={job.id} className="space-y-1.5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{job.scheduledAt.replace('T', ' ')}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${s.tone}`}>{s.label}</span>
                    {check ? <span className={`rounded px-2 py-0.5 text-xs ${check.tone}`}>{check.text}</span> : null}
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{CHANNEL_LABELS[job.channel]}</span>
                    <span className="font-medium">{job.theme}</span>
                    <span className="text-xs text-slate-500">試行 {job.attempts.length}/{job.maxAttempts}</span>
                  </div>
                  {job.actionReason && <p className="text-xs text-amber-800">▶ {job.actionReason}</p>}
                  {job.attempts.length > 0 && (
                    <p className="text-xs text-slate-500">
                      最終試行: {job.attempts[job.attempts.length - 1].message}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {job.status === 'action_required' && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`${job.content.body}\n\n${(job.content.hashtags ?? []).join(' ')}`)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-bold max-lg:min-h-10"
                        >
                          本文をコピー
                        </button>
                        {(job.channel === 'youtube_short' || job.channel === 'tiktok') && (
                          <>
                            {job.channel === 'youtube_short' && (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(job.content.title)}
                                className="rounded border border-slate-300 px-2 py-1 text-xs font-bold max-lg:min-h-10"
                              >
                                題名をコピー
                              </button>
                            )}
                            {job.manualUrl && (
                              <a
                                href={job.manualUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded border border-teal-600 bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800 max-lg:min-h-10"
                              >
                                動画を開く
                              </a>
                            )}
                          </>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              const url = window.prompt('投稿したURLがあれば入力してください（空欄でもOK）') ?? undefined
                              patchJob(job.id, { action: 'manual_complete', publishedUrl: url || undefined })
                            }}
                            className="rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 max-lg:min-h-10"
                          >
                            手動投稿を完了にする
                          </button>
                        )}
                      </>
                    )}
                    {/* Google が拒否した投稿は、同じ内容を出し直すとまた拒否されやすいので「再実行」は出さない */}
                    {isAdmin && job.status === 'failed' && !isGoogleRejected(job) && (
                      <button type="button" onClick={() => patchJob(job.id, { action: 'retry' })} className="rounded border border-blue-400 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800 max-lg:min-h-10">
                        再実行
                      </button>
                    )}
                    {isAdmin && (job.status === 'pending' || job.status === 'action_required') && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const at = window.prompt('新しい公開日時（例: 2026-07-20T10:00）', job.scheduledAt)
                            if (at) patchJob(job.id, { action: 'reschedule', scheduledAt: at })
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-bold max-lg:min-h-10"
                        >
                          日時変更
                        </button>
                        <button type="button" onClick={() => patchJob(job.id, { action: 'cancel' })} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 max-lg:min-h-10">
                          取消
                        </button>
                      </>
                    )}
                    {job.publishedUrl && (
                      <a href={job.publishedUrl} target="_blank" rel="noopener" className="text-xs text-sky-700 underline">
                        公開先を開く
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
