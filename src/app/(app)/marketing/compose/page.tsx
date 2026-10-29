'use client'

/**
 * 投稿作成画面：目的→テーマ→媒体選択→AI生成→媒体別プレビュー→
 * 表現チェック→承認→予約 まで1画面で完結する（指示書24章のフロー）。
 *
 * 画像: 文章の下書き（Claude）ができたら、続けて ChatGPT（OpenAIの画像生成）で内容に合った写真を1枚作り、
 * Instagram・Google・note の下書きに付ける。写真に見出しの文字を重ねた画像を、ここで見て承認する。
 */
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { checkContent } from '@/lib/marketing/compliance'
import {
  loadClinicProfile,
  loadReferences,
  saveProject,
  findProject,
  transitionVariant,
  updateVariantContent,
  appendAudit,
} from '@/lib/marketing/store'
import {
  CHANNEL_LABELS,
  OBJECTIVES,
  STATUS_LABELS,
  type Channel,
  type ContentProject,
  type ContentVariant,
} from '@/lib/marketing/types'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { postImageUrl, sceneFromVariants, usesAiImage } from '@/lib/marketing/post-image'

const ALL_CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[]

/** 入力のたびに画像を描き直さないよう、少し待ってから値を変える */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

function ComposeInner() {
  const { isAdmin } = useMarketingRole()
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
  const [imageBusy, setImageBusy] = useState(false)
  const [imageNote, setImageNote] = useState('')
  /** 見本の画像が読めなかったURL（読めない画像を見たまま承認しないように） */
  const [brokenPreview, setBrokenPreview] = useState('')

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

  // 投稿画像の見本（文字を直している間は描き直さない）
  const previewUrl =
    project && activeVariant && usesAiImage(activeVariant.channel) ? postImageUrl(activeVariant.content, activeVariant.channel, project.theme) : ''
  const debouncedPreview = useDebounced(previewUrl, 800)

  /** 画像を変えてよい下書き（承認済み・予約済みの媒体は変えない） */
  function imageTargets(target: ContentProject): ContentVariant[] {
    return target.variants.filter((v) => usesAiImage(v.channel) && (v.status === 'draft' || v.status === 'review'))
  }

  /**
   * ChatGPT（OpenAIの画像生成）で投稿の写真を1枚作り、画像を使う媒体の下書きに付ける。
   * 場面の説明は下書きを書いたAI（Claude）が本文に合わせて書いたもの。見出しの文字は写真に入れず、重ねて描く
   */
  async function makeImage(target: ContentProject) {
    const targets = imageTargets(target)
    if (targets.length === 0) {
      setImageNote('画像を使う媒体（Instagramフィード・カルーセル・Google投稿・note）の下書きがありません')
      return
    }
    setImageBusy(true)
    setImageNote('ChatGPTで投稿の画像を作っています…（1分ほどかかります）')
    try {
      const { scene, content } = sceneFromVariants(targets)
      const response = await fetch('/api/marketing/post-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: target.theme.slice(0, 300),
          scene: scene?.slice(0, 1000),
          title: content?.title.slice(0, 300),
          hook: content?.hook.slice(0, 300),
        }),
      })
      const data = await response.json()
      if (!data.ok || !data.image) {
        setImageNote(data.error ?? 'AI画像を作れませんでした（テンプレ画像で投稿します）')
        return
      }
      // 作っている間（1分ほど）に承認・予約された媒体は変えない（読み直して、まだ下書き・確認待ちのものだけに付ける）
      const latest = findProject(target.id)
      const ids = new Set(targets.map((v) => v.id))
      const applied = latest ? imageTargets(latest).filter((v) => ids.has(v.id)) : []
      for (const v of applied) {
        updateVariantContent(target.id, v.id, (x) => {
          x.content.image = data.image
        })
      }
      if (applied.length > 0) appendAudit('AI画像を作成', target.id, `${applied.length}媒体 / ${data.image.model}`)
      setProject(findProject(target.id) ?? null)
      const kept = (latest?.variants ?? []).filter((v) => usesAiImage(v.channel) && !applied.some((a) => a.id === v.id)).length
      setImageNote(
        (applied.length > 0
          ? `AI画像を作りました（${applied.map((v) => CHANNEL_LABELS[v.channel]).join('・')}で同じ写真を使います）。内容に合っているか確認してください。`
          : 'AI画像はできましたが、作っている間に承認・予約されたため付けていません。') +
          (applied.length > 0 && kept ? ' 承認済み・予約済みの媒体の画像は変えていません。' : ''),
      )
    } catch {
      setImageNote('通信に失敗しました。もう一度「AI画像を作る」を押してください（テンプレ画像のままでも投稿できます）')
    } finally {
      setImageBusy(false)
    }
  }

  /** AI画像を外してテンプレ画像に戻す */
  function removeImage(target: ContentProject) {
    const targets = imageTargets(target).filter((v) => v.content.image)
    for (const v of targets) {
      updateVariantContent(target.id, v.id, (x) => {
        delete x.content.image
      })
    }
    appendAudit('AI画像を外す', target.id, `${targets.length}媒体`)
    setProject(findProject(target.id) ?? null)
    setImageNote('AI画像を外しました（テンプレ画像で投稿します）')
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
      // 文章ができたら、続けて内容に合った画像を作る（文章の確認はその間にできる）
      if (data.mode !== 'mock' && (data.variants as ContentVariant[]).some((v) => usesAiImage(v.channel))) {
        void makeImage(next)
      }
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

    // 予約が成立したら、指定時刻に公開処理を行うサーバージョブを登録する（重複はサーバー側で防止）
    if (result.ok && next === 'scheduled' && options?.scheduledAt) {
      fetch('/api/marketing/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          variantId: variant.id,
          channel: variant.channel,
          theme: project.theme,
          content: variant.content,
          scheduledAt: options.scheduledAt,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setMessage(`予約しました。公開予定 ${options!.scheduledAt}（「投稿の予定と結果」に登録済み）`)
        })
        .catch(() => setMessage('予約は保存しましたが、ジョブ登録に失敗しました。「投稿の予定と結果」の画面から再登録してください。'))
    }
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
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">承認済みの根拠から選ぶ（論文・根拠ライブラリ）</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  const ref = loadReferences().find((r) => r.id === e.target.value)
                  if (ref) {
                    setDetail({
                      ...detail,
                      evidence: `${ref.title}（${[ref.authors, ref.year, ref.journal].filter(Boolean).join(', ')}）${ref.doi ? ` DOI:${ref.doi}` : ''}${ref.pubmedId ? ` PMID:${ref.pubmedId}` : ''}。主な結果: ${ref.findings || '記載なし'}。限界: ${ref.limitations || '記載なし'}`,
                    })
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              >
                <option value="">（選択すると根拠資料欄に自動入力されます）</option>
                {loadReferences()
                  .filter((r) => r.approved)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}（{r.year || '年不明'}）
                    </option>
                  ))}
              </select>
            </label>
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
          ⚠ 患者氏名・診療内容など個人を特定できる情報は入力しないでください（文章はAI（Claude）、画像の場面の説明はChatGPT（OpenAI）へ送信されます）。
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

              {/* 投稿画像（AI画像＝ChatGPT、無ければテンプレ画像） */}
              {usesAiImage(activeVariant.channel) && (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row">
                  <a href={previewUrl} target="_blank" rel="noopener" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 院内だけで使うその場の見本（最適化は不要） */}
                    <img
                      src={debouncedPreview || previewUrl}
                      alt={activeVariant.content.altText || '投稿画像の見本'}
                      onError={() => setBrokenPreview(debouncedPreview || previewUrl)}
                      onLoad={() => setBrokenPreview('')}
                      className="w-full max-w-[260px] rounded-lg border border-slate-200 bg-slate-100"
                    />
                  </a>
                  <div className="space-y-2 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      投稿画像
                      {activeVariant.content.image ? (
                        <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">AI画像（ChatGPT）</span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">テンプレ画像</span>
                      )}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-500">
                      {activeVariant.content.image
                        ? '本文に合わせてChatGPTで作った写真に、見出し（表現チェック済み）と院名を重ねています。投稿される画像と同じです。'
                        : '紺の背景に見出しを載せたテンプレ画像で投稿します。「AI画像を作る」で、本文に合った写真の画像にできます。'}
                      {activeVariant.channel === 'instagram_carousel' && ' カルーセルは1枚目（表紙）にこの画像を使い、2枚目からは文字のスライドです。'}
                      見出しは「タイトル / フック」や画像用の文言を直すと変わります。
                    </p>
                    {['draft', 'review'].includes(activeVariant.status) && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => makeImage(project)}
                          disabled={imageBusy || busy}
                          className="rounded-lg border border-sky-400 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800 disabled:opacity-50"
                        >
                          {imageBusy ? '画像を作成中…' : activeVariant.content.image ? 'AI画像を作り直す' : 'AI画像を作る'}
                        </button>
                        {activeVariant.content.image && (
                          <button
                            type="button"
                            onClick={() => removeImage(project)}
                            disabled={imageBusy}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
                          >
                            テンプレ画像にする
                          </button>
                        )}
                      </div>
                    )}
                    {brokenPreview && brokenPreview === (debouncedPreview || previewUrl) && (
                      <p className="rounded bg-red-50 p-2 text-xs font-bold text-red-700">
                        画像を読み込めませんでした。見本を確かめられないまま承認しないでください（開き直すか、作り直す／テンプレ画像にする）。
                      </p>
                    )}
                    {imageNote && <p className="text-xs font-medium text-slate-700">{imageNote}</p>}
                  </div>
                </div>
              )}

              {/* 編集エリア */}
              <label className="block text-sm">
                <span className="font-bold">タイトル / フック</span>
                <input
                  value={activeVariant.content.hook}
                  onChange={(e) => {
                    updateVariantContent(project.id, activeVariant.id, (v) => {
                      v.content.hook = e.target.value
                      // 文章を直したら、AIが書いた画像の場面の説明は古くなるので消す（作り直すときは直した文章から場面を作る）
                      delete v.content.imagePrompt
                    })
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
                    updateVariantContent(project.id, activeVariant.id, (v) => {
                      v.content.body = e.target.value
                      delete v.content.imagePrompt
                    })
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
                {isAdmin && (activeVariant.status === 'draft' || activeVariant.status === 'review') && (
                  <button
                    type="button"
                    onClick={() => doTransition(activeVariant, 'approved')}
                    disabled={imageBusy}
                    title={imageBusy ? '画像を作っている間は承認できません' : ''}
                    className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 disabled:opacity-50"
                  >
                    承認する
                  </button>
                )}
                {isAdmin && activeVariant.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => doTransition(activeVariant, 'scheduled')}
                    disabled={imageBusy}
                    title={imageBusy ? '画像を作っている間は予約できません' : ''}
                    className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    承認して予約する
                  </button>
                )}
                {isAdmin && (activeVariant.status === 'approved' || activeVariant.status === 'scheduled') && (
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
                {!isAdmin && (activeVariant.status === 'review' || activeVariant.status === 'approved') && (
                  <span className="self-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">承認・予約・公開は院長のみ</span>
                )}
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(`${activeVariant.content.body}\n\n${activeVariant.content.hashtags.join(' ')}`)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                >
                  本文をコピー
                </button>
                <a
                  href={postImageUrl(activeVariant.content, activeVariant.channel, project.theme)}
                  target="_blank"
                  rel="noopener"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                >
                  {usesAiImage(activeVariant.channel) ? '画像を開く（保存用）' : 'テンプレ画像を作る'}
                </a>
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
