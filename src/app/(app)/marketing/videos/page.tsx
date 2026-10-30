'use client'

/**
 * 動画ストック一覧（指示書5-2）
 * 一覧・検索・絞り込み（疾患/部位/掲載可否/公開状況）・プレビュー再生。
 */
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AI_STATUS_LABELS,
  PERMISSION_LABELS,
  PUBLISH_STATE_LABELS,
  canPublishVideo,
  type StockVideo,
} from '@/lib/marketing/video-types'

const PERMISSION_TONE: Record<string, string> = {
  granted: 'bg-emerald-100 text-emerald-700',
  limited: 'bg-amber-100 text-amber-700',
  none: 'bg-rose-100 text-rose-700',
}

export default function VideosPage() {
  const [videos, setVideos] = useState<StockVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [permFilter, setPermFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/marketing/videos')
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setVideos(data.videos ?? [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  // AI動画（OpenAI）: 設定済みか・作成中の出来上がりの取りに行き・いますぐ1本
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

  const checkAi = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/videos/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' }),
      })
      if (res.status === 403) return // 院長以外は見るだけ
      const data = await res.json()
      setAiConfigured(data.configured !== false)
      if (data.failed > 0) load()
    } catch {
      /* 取りに行けなくても一覧は出す */
    }
  }, [load])

  useEffect(() => {
    // 一覧を出してから、作成中のAI動画の出来上がりを見に行く
    const t = setTimeout(() => {
      load().then(checkAi)
    }, 0)
    return () => clearTimeout(t)
  }, [load, checkAi])

  // 作成中のものがある間は、1分ごとに出来上がりを見に行く
  const generating = videos.some((v) => v.ai?.status === 'generating')
  useEffect(() => {
    if (!generating) return
    const t = setInterval(checkAi, 60_000)
    return () => clearInterval(t)
  }, [generating, checkAi])

  async function startAi() {
    setAiBusy(true)
    setAiMessage('')
    try {
      const res = await fetch('/api/marketing/videos/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setAiMessage(data.message)
      await load()
    } catch (e) {
      setAiMessage(`作れませんでした: ${e instanceof Error ? e.message : '不明'}`)
    } finally {
      setAiBusy(false)
    }
  }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return videos.filter((v) => {
      if (permFilter && v.permission !== permFilter) return false
      if (stateFilter && v.publishState !== stateFilter) return false
      if (!kw) return true
      return [v.title, v.disease, v.bodyPart, v.theme, v.place, v.performer]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(kw))
    })
  }, [videos, q, permFilter, stateFilter])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">動画ストック</h1>
          <p className="mt-1 text-sm text-slate-500">
            院内で撮影した動画を登録・検索・再生できます。患者が写る動画は掲載許可がないと公開工程に進めません。
          </p>
        </div>
        <Link
          href="/marketing/videos/new"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
        >
          ＋ 動画を登録
        </Link>
      </div>

      {/* AI動画（OpenAI） */}
      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-violet-900">AI動画の自動作成（OpenAI）</h2>
            <p className="mt-1 text-xs text-violet-800">
              自動で作るのは止めています。必要なときに下のボタンで1本ずつ、OpenAIで作った写真3枚をゆっくり動かしてつないだ約10秒の縦動画（音なし）を作り、ここに貯めます。内容は「セルフケア・姿勢の雰囲気」と「院の雰囲気・季節の映像」を交互に。
              顔の映らない人物・文字なしの映像で、公開はしません（使うかどうかは院長が決めます）。1本およそ30円です。
            </p>
          </div>
          {aiConfigured ? (
            <button
              onClick={startAi}
              disabled={aiBusy || generating}
              className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {aiBusy ? '作成中…（1〜3分）' : generating ? '作成中です…' : 'いま1本作る'}
            </button>
          ) : null}
        </div>
        {aiConfigured === false ? (
          <p className="mt-2 rounded bg-white px-2 py-1 text-xs text-amber-700">
            OpenAI のAPIキーがまだ設定されていません。Vercel の環境変数に OPENAI_API_KEY を入れると動き始めます。
          </p>
        ) : null}
        {aiMessage ? <p className="mt-2 text-xs text-violet-900">{aiMessage}</p> : null}
      </div>

      {/* 検索・絞り込み */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="タイトル・疾患・部位・テーマで検索"
          className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={permFilter}
          onChange={(e) => setPermFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">掲載可否（すべて）</option>
          {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">公開状況（すべて）</option>
          {Object.entries(PUBLISH_STATE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          {error}（Supabaseに marketing_videos テーブルが未作成の場合はマイグレーションを実行してください）
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {videos.length === 0
            ? '動画がまだありません。「＋ 動画を登録」から追加してください。'
            : '条件に一致する動画がありません。'}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const publishable = canPublishVideo(v)
            return (
              <div key={v.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="aspect-video bg-slate-900">
                  {v.url ? (
                    <video src={v.url} controls preload="metadata" poster={v.thumbUrl} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-white/70">
                      {v.ai?.status === 'generating'
                        ? 'AIが作成中です（1〜3分ほど）'
                        : v.ai?.status === 'failed'
                          ? `作成に失敗しました${v.ai.error ? `：${v.ai.error}` : ''}`
                          : '動画URL未登録'}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-bold leading-snug">{v.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {v.ai ? (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">
                        {AI_STATUS_LABELS[v.ai.status]}
                      </span>
                    ) : null}
                    <span className={`rounded px-1.5 py-0.5 font-medium ${PERMISSION_TONE[v.permission]}`}>
                      {PERMISSION_LABELS[v.permission]}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      {PUBLISH_STATE_LABELS[v.publishState]}
                    </span>
                    {v.patientPresent ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">患者あり</span>
                    ) : null}
                  </div>
                  <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
                    {v.disease ? <div>疾患: {v.disease}</div> : null}
                    {v.bodyPart ? <div>部位: {v.bodyPart}</div> : null}
                    {v.shotDate ? <div>撮影: {v.shotDate}</div> : null}
                  </dl>
                  {!publishable ? (
                    <p className="mt-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-600">
                      掲載許可が未取得のため公開工程に進めません
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
