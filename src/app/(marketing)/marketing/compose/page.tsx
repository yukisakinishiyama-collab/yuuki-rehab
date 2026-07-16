'use client'

/**
 * 投稿作成画面：目的→テーマ→媒体選択→AI生成→媒体別プレビュー→
 * 表現チェック→承認→予約 まで1画面で完結する（指示書24章のフロー）。
 */
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { checkContent } from '@/lib/marketing/compliance'
import { loadClinicProfile, saveProject, findProject, transitionVariant, updateVariantContent, appendAudit } from '@/lib/marketing/store'
import {
  CHANNEL_LABELS,
  OBJECTIVES,
  STATUS_LABELS,
  type Channel,
  type ContentProject,
  type ContentVariant,
} from '@/lib/marketing/types'

const ALL_CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[]

function ComposeInner() {
  const params = useSearchParams()
  const projectIdFromUrl = params.get('project')

  const [project, setProject] = useState<ContentProject | null>(null)
  const [objective, setObjective] = useState<string>(OBJECTIVES[0])
  const [theme, setTheme] = useState('')
  const [channels, setChannels] = useState<Channel[]>(['instagram_feed', 'google_business', 'line_broadcast'])
  const [detail, setDetail] = useState({ audience: '', keyMessage: '', evidence: '', cta: '', tone: '', notes: '' })
  const [showDetail, setShowDetail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<string>('')

  useEffect(() => {
    if (projectIdFromUrl) {
      const found = findProject(projectIdFromUrl)
      if (found) {
        setProject(found)
        setObjective(found.objective)
        setTheme(found.theme)
        setChannels(found.channels)
        setActiveTab(found.variants[0]?.id ?? '')
      }
    }
  }, [projectIdFromUrl])

  const activeVariant = useMemo(
    () => project?.variants.find((v) => v.id === activeTab) ?? project?.variants[0],
    [project, activeTab],
  )

  const refresh = () => {
    if (project) setProject(findProject(project.id) ?? null)
  }

  async function generate() {
    if (!theme.trim()) {
      setMessage('テーマを入力してください')
      return
    }
    setBusy(true)
    setMessage('AIが媒体別の下書きを作成しています…（媒体数により1〜2分かかることがあります）')
    try {
      const response = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective,
          theme,
          ...detail,
          channels,
          clinicProfile: loadClinicProfile() as unknown as Record<string, string>,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '生成に失敗しました')

      const next: ContentProject = project ?? {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        objective: objective as ContentProject['objective'],
        theme,
        channels,
        variants: [],
      }
      next.objective = objective as ContentProject['objective']
      next.theme = theme
      next.channels = channels
      Object.assign(next, detail)
      // 既存の同一媒体バリアントは置き換え（承認済み以降は保持）
      const keep = next.variants.filter(
        (v) => !data.variants.some((nv: ContentVariant) => nv.channel === v.channel) || v.status !== 'draft',
      )
      next.variants = [...keep, ...data.variants]
      saveProject(next)
      appendAudit('AI生成を実行', next.id, `${channels.length}媒体 / ${data.mode}`)
      setProject({ ...next })
      setActiveTab(data.variants[0]?.id ?? next.variants[0]?.id ?? '')
      const failed = (data.errors ?? []).map((e: { channel: Channel }) => CHANNEL_LABELS[e.channel]).join('・')
      setMessage(
        `生成完了（${data.mode === 'mock' ? 'モックモード' : 'AI生成'}）。内容を確認してください。` +
          (failed ? ` ※失敗: ${failed}` : ''),
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  function recheck(variant: ContentVariant) {
    if (!project) return
    updateVariantContent(project.id, variant.id, (v) => {
      v.compliance = checkContent(
        [v.content.title, v.content.hook, v.content.body, ...(v.content.slides?.flatMap((s) => [s.heading, s.body]) ?? []), ...v.content.hashtags],
        loadClinicProfile().bannedPhrases,
      )
    })
    refresh()
  }

  function doTransition(variant: ContentVariant, next: Parameters<typeof transitionVariant>[2]) {
    if (!project) return
    let options: Parameters<typeof transitionVariant>[3]
    if (next === 'scheduled') {
      const scheduledAt = window.prompt('公開予定日時を入力してください（例: 2026-07-20T10:00）', variant.scheduledAt ?? '')
      if (!scheduledAt) return
      options = { scheduledAt }
    }
    if (variant.compliance.status === 'blocked' && !variant.compliance.overrideReason && (next === 'approved' || next === 'scheduled')) {
      const reason = window.prompt('公開禁止の表現があります。解除する場合は理由を入力してください（監査ログに記録されます）')
      if (!reason) return
      options = { ...options, overrideReason: reason }
    }
    const result = transitionVariant(project.id, variant.id, next, options)
    setMessage(result.ok ? `${STATUS_LABELS[next]} に変更しました` : result.message ?? '')
    refresh()
  }

  const complianceBadge = (variant: ContentVariant) => {
    const s = variant.compliance.status
    if (s === 'pass') return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">公開可能</span>
    if (s === 'review') return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">要確認</span>
    return (
      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
        公開禁止{variant.compliance.overrideReason ? '（解除済み）' : ''}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">投稿を作る</h1>

      {/* 入力フォーム */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold">今回の目的</span>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
            >
              {OBJECTIVES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-bold">投稿テーマ</span>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="例：足首の捻挫、応急処置のポイント"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-bold">配信する媒体</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_CHANNELS.map((channel) => {
              const on = channels.includes(channel)
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setChannels((prev) => (on ? prev.filter((c) => c !== channel) : [...prev, channel]))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    on ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {CHANNEL_LABELS[channel]}
                </button>
              )
            })}
          </div>
        </div>

        <button type="button" onClick={() => setShowDetail(!showDetail)} className="text-sm font-medium text-teal-700">
          {showDetail ? '▲ 詳細設定を閉じる' : '▼ 詳細設定（対象者・根拠・CTA・トーンなど）'}
        </button>
        {showDetail && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['audience', '対象者（例：部活動をする学生と保護者）'],
                ['keyMessage', '最も伝えたいこと'],
                ['evidence', '根拠資料（論文タイトル・DOI等。この範囲のみ使用）'],
                ['cta', 'CTA（例：ネット予約へ）'],
                ['tone', 'トーン（例：やさしく・専門的に）'],
                ['notes', '補足指示・使用禁止ワード'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="text-slate-600">{label}</span>
                <input
                  value={detail[key]}
                  onChange={(e) => setDetail({ ...detail, [key]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </label>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500">
          ⚠ 患者氏名・診療内容など個人を特定できる情報は入力しないでください（AIへ送信されます）。
        </p>

        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-teal-700 px-5 py-2.5 font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {busy ? '生成中…' : project ? '選択媒体を再生成する' : 'AIで下書きを作る'}
        </button>
        {message && <p className="text-sm font-medium text-slate-700">{message}</p>}
      </section>

      {/* 媒体別プレビュー */}
      {project && project.variants.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
            {project.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveTab(v.id)}
                className={`rounded-t-lg px-3 py-1.5 text-sm font-medium ${
                  activeVariant?.id === v.id ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {CHANNEL_LABELS[v.channel]}
              </button>
            ))}
          </div>

          {activeVariant && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {complianceBadge(activeVariant)}
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                  {STATUS_LABELS[activeVariant.status]}
                </span>
                {activeVariant.scheduledAt && (
                  <span className="text-xs text-teal-800">公開予定: {activeVariant.scheduledAt.replace('T', ' ')}</span>
                )}
              </div>

              {/* 表現チェック所見 */}
              {activeVariant.compliance.findings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="font-bold text-amber-900">表現チェック所見</p>
                  <ul className="mt-1 space-y-1">
                    {activeVariant.compliance.findings.map((f, i) => (
                      <li key={i} className={f.level === 'NG' ? 'text-red-700' : 'text-amber-800'}>
                        [{f.level}]「{f.match}」— {f.reason} → {f.suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AIの注意喚起 */}
              {activeVariant.content.warnings.length > 0 && (
                <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
                  AIからの注意: {activeVariant.content.warnings.join(' / ')}
                </div>
              )}

              {/* 編集エリア */}
              <label className="block text-sm">
                <span className="font-bold">タイトル / フック</span>
                <input
                  value={activeVariant.content.hook}
                  onChange={(e) => {
                    updateVariantContent(project.id, activeVariant.id, (v) => (v.content.hook = e.target.value))
                    refresh()
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="font-bold">本文（公開される実際の文章）</span>
                <textarea
                  value={activeVariant.content.body}
                  onChange={(e) => {
                    updateVariantContent(project.id, activeVariant.id, (v) => (v.content.body = e.target.value))
                    refresh()
                  }}
                  rows={12}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-mono text-[13px] leading-relaxed"
                />
              </label>

              {activeVariant.content.slides && (
                <div className="space-y-2">
                  <p className="text-sm font-bold">カルーセル構成（{activeVariant.content.slides.length}枚）</p>
                  {activeVariant.content.slides.map((s) => (
                    <div key={s.order} className="rounded-lg border border-slate-200 p-2 text-sm">
                      <span className="font-bold text-teal-800">{s.order}. {s.heading}</span>
                      <p className="text-slate-600">{s.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeVariant.content.hashtags.length > 0 && (
                <p className="text-sm text-sky-700">{activeVariant.content.hashtags.join(' ')}</p>
              )}
              <p className="text-xs text-slate-500">
                CTA: {activeVariant.content.cta.label} → {activeVariant.content.cta.url}
              </p>

              {/* アクション */}
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => recheck(activeVariant)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">
                  表現を再チェック
                </button>
                {activeVariant.status === 'draft' && (
                  <button type="button" onClick={() => doTransition(activeVariant, 'review')} className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                    承認申請
                  </button>
                )}
                {(activeVariant.status === 'draft' || activeVariant.status === 'review') && (
                  <button type="button" onClick={() => doTransition(activeVariant, 'approved')} className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
                    承認する
                  </button>
                )}
                {activeVariant.status === 'approved' && (
                  <button type="button" onClick={() => doTransition(activeVariant, 'scheduled')} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white">
                    承認して予約する
                  </button>
                )}
                {(activeVariant.status === 'approved' || activeVariant.status === 'scheduled') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('この内容を手動で公開した記録を残しますか？（Phase 1では外部への自動投稿は行いません）')) {
                        doTransition(activeVariant, 'published')
                      }
                    }}
                    className="rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"
                  >
                    公開済みにする
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(`${activeVariant.content.body}\n\n${activeVariant.content.hashtags.join(' ')}`)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                >
                  本文をコピー
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default function ComposePage() {
  return (
    <Suspense>
      <ComposeInner />
    </Suspense>
  )
}
