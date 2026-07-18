'use client'

/** 投稿ジョブ・履歴：予約済みジョブの実行状況、リトライ、手動投稿の完了記録、接続状況 */
import { useCallback, useEffect, useState } from 'react'
import type { PublishJob } from '@/lib/marketing/jobs-store-server'
import { CHANNEL_LABELS } from '@/lib/marketing/types'

interface Connections {
  mode: string
  connections: Record<string, boolean>
  /** 実疎通チェックの結果（envがある項目のみ）。okでも定期確認を推奨 */
  details?: Record<string, { ok: boolean; note: string }>
}

const JOB_STATUS_LABEL: Record<PublishJob['status'], { label: string; tone: string }> = {
  pending: { label: '実行待ち', tone: 'bg-teal-100 text-teal-800' },
  processing: { label: '公開処理中', tone: 'bg-blue-100 text-blue-800' },
  published: { label: '公開済み', tone: 'bg-emerald-100 text-emerald-800' },
  failed: { label: '公開失敗', tone: 'bg-red-100 text-red-800' },
  action_required: { label: '手動対応待ち', tone: 'bg-amber-100 text-amber-800' },
  cancelled: { label: '取消済み', tone: 'bg-slate-200 text-slate-500' },
}

const CONNECTION_ITEMS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'anthropic', label: 'AI文章生成（Anthropic）', hint: 'ANTHROPIC_API_KEY' },
  { key: 'openaiImage', label: '画像生成（OpenAI）', hint: 'OPENAI_API_KEY（Phase 5で使用）' },
  { key: 'lineChannel', label: 'LINE Messaging API', hint: 'LINE_CHANNEL_SECRET / ACCESS_TOKEN' },
  { key: 'instagram', label: 'Instagram Graph API', hint: 'INSTAGRAM_ACCESS_TOKEN / USER_ID' },
  { key: 'googleBusiness', label: 'Google Business Profile API', hint: '利用申請の承認待ち（手動投稿モードで運用）' },
  { key: 'cronSecret', label: 'ジョブ実行の保護（CRON_SECRET）', hint: '本番デプロイ時に設定推奨' },
]

export default function JobsPage() {
  const [jobs, setJobs] = useState<PublishJob[]>([])
  const [conn, setConn] = useState<Connections | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [jobsError, setJobsError] = useState('')

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
    refresh()
  }, [refresh])

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
        <h1 className="text-2xl font-bold">投稿ジョブ・接続状況</h1>
        {conn && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${conn.mode === 'mock' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {conn.mode === 'mock' ? 'モックモード（外部送信なし）' : '本番モード'}
          </span>
        )}
        <button type="button" onClick={runNow} disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          期限のきたジョブを今すぐ実行
        </button>
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
                  <span className="ml-auto text-xs text-slate-400">{connected ? '接続済み' : item.hint}</span>
                </div>
                {detail ? (
                  <p className={`mt-1 pl-4 text-xs ${detail.ok ? 'text-slate-500' : 'text-amber-600'}`}>{detail.note}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          未接続の媒体も投稿は止まりません。予定時刻になると「手動対応待ち」になり、本文コピー＋完了記録で運用できます。
        </p>
      </section>

      {/* ジョブ一覧 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">ジョブ一覧（{jobs.length}）</h2>
        {jobsError ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-700">{jobsError}</p> : null}
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">「投稿を作る」で承認→予約すると、ここにジョブが並びます。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {jobs.map((job) => {
              const s = JOB_STATUS_LABEL[job.status]
              return (
                <li key={job.id} className="space-y-1.5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{job.scheduledAt.replace('T', ' ')}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${s.tone}`}>{s.label}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{CHANNEL_LABELS[job.channel]}</span>
                    <span className="font-medium">{job.theme}</span>
                    <span className="text-xs text-slate-400">試行 {job.attempts.length}/{job.maxAttempts}</span>
                  </div>
                  {job.actionReason && <p className="text-xs text-amber-800">▶ {job.actionReason}</p>}
                  {job.attempts.length > 0 && (
                    <p className="text-xs text-slate-400">
                      最終試行: {job.attempts[job.attempts.length - 1].message}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {job.status === 'action_required' && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`${job.content.body}\n\n${(job.content.hashtags ?? []).join(' ')}`)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-bold"
                        >
                          本文をコピー
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const url = window.prompt('投稿したURLがあれば入力してください（空欄でもOK）') ?? undefined
                            patchJob(job.id, { action: 'manual_complete', publishedUrl: url || undefined })
                          }}
                          className="rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800"
                        >
                          手動投稿を完了にする
                        </button>
                      </>
                    )}
                    {job.status === 'failed' && (
                      <button type="button" onClick={() => patchJob(job.id, { action: 'retry' })} className="rounded border border-blue-400 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
                        再実行
                      </button>
                    )}
                    {(job.status === 'pending' || job.status === 'action_required') && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const at = window.prompt('新しい公開日時（例: 2026-07-20T10:00）', job.scheduledAt)
                            if (at) patchJob(job.id, { action: 'reschedule', scheduledAt: at })
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-bold"
                        >
                          日時変更
                        </button>
                        <button type="button" onClick={() => patchJob(job.id, { action: 'cancel' })} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
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
