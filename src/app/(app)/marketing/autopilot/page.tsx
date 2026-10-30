'use client'

/**
 * 自動投稿：毎週のAI下書きを確認して、1タップで承認する画面（スマホで使う前提）
 *
 * 日曜の夕方に翌週分の投稿案ができると院長のLINEに通知が届き、ここを開く。
 * 「承認」した案だけが予定の時刻に投稿される。承認しなければ何も出ない。
 */
import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadClinicProfile } from '@/lib/marketing/store'
import { useMarketingRole } from '@/lib/marketing/use-role'
import { CHANNEL_LABELS, type Channel, type ContentVariant } from '@/lib/marketing/types'
import { postImageUrl, usesAiImage } from '@/lib/marketing/post-image'
import {
  activeVariants,
  approvalBlocker,
  CATEGORY_LABELS,
  DEFAULT_AUTOPILOT_SETTINGS,
  ITEM_STATUS_LABELS,
  WEEKDAY_LABELS,
  type AutopilotSettings,
  type ProposalItem,
  type WeeklyProposal,
} from '@/lib/marketing/autopilot-types'

interface Connections {
  ai: boolean
  /** AI画像（ChatGPT＝OpenAIの画像生成） */
  aiImage?: boolean
  instagram: boolean
  googleApi: boolean
  ownerLine: boolean
  bookingStats: boolean
  mock: boolean
}

const STATUS_TONE: Record<ProposalItem['status'], string> = {
  proposed: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  skipped: 'bg-slate-200 text-slate-600',
  expired: 'bg-slate-100 text-slate-500',
}

function formatSlot(local: string): string {
  const [y, m, d] = local.slice(0, 10).split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${d}(${WEEKDAY_LABELS[weekday]}) ${local.slice(11, 16)}`
}

function weekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split('-').map(Number)
  return `${m}/${d}の週`
}

function channelShort(channel: Channel): string {
  if (channel === 'instagram_story') return 'ストーリー'
  return channel === 'google_business' ? 'Google' : channel.startsWith('instagram') ? 'Instagram' : CHANNEL_LABELS[channel]
}

function ComplianceBox({ variant }: { variant: ContentVariant }) {
  const { status, findings } = variant.compliance
  if (status === 'pass') return <p className="text-xs font-bold text-emerald-700">✓ 表現チェックOK</p>
  return (
    <div className={`rounded-lg p-2 text-xs ${status === 'blocked' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
      <p className="font-bold">{status === 'blocked' ? '⛔ 公開できない表現があります（直すまで承認できません）' : '⚠ 確認してほしい表現があります'}</p>
      <ul className="mt-1 space-y-0.5">
        {findings.map((f, i) => (
          <li key={i}>
            「{f.match}」… {f.reason} → {f.suggestion}
          </li>
        ))}
      </ul>
    </div>
  )
}

function VariantPreview({
  variant,
  theme,
  editing,
  onSave,
  onCancel,
  busy,
}: {
  variant: ContentVariant
  theme: string
  editing: boolean
  onSave: (patch: { hook: string; body: string; hashtags: string[] }) => void
  onCancel: () => void
  busy: boolean
}) {
  // 媒体の切り替え・保存のたびに親が key を変えて作り直すので、初期値は props から取るだけでよい
  const [hook, setHook] = useState(variant.content.hook)
  const [imageBroken, setImageBroken] = useState(false)
  const [body, setBody] = useState(variant.content.body)
  const [tags, setTags] = useState(variant.content.hashtags.join(' '))

  if (editing) {
    return (
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-600">
          1行目（フック）
          <input value={hook} onChange={(e) => setHook(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          本文
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal leading-relaxed" />
        </label>
        {variant.channel !== 'google_business' && (
          <label className="block text-xs font-bold text-slate-600">
            ハッシュタグ（スペース区切り）
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal" />
          </label>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave({ hook, body, hashtags: tags.split(/\s+/).filter(Boolean) })}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 max-lg:min-h-10"
          >
            保存して表現チェック
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold max-lg:min-h-10">
            やめる
          </button>
        </div>
      </div>
    )
  }

  const c = variant.content
  return (
    <div className="space-y-2 text-sm">
      {usesAiImage(variant.channel) && (
        <figure className="flex items-start gap-3">
          <a href={postImageUrl(c, variant.channel, theme)} target="_blank" rel="noopener" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- 院内だけで使うその場の見本（最適化は不要） */}
            <img
              src={postImageUrl(c, variant.channel, theme)}
              alt={c.altText || '投稿画像の見本'}
              loading="lazy"
              onError={() => setImageBroken(true)}
              onLoad={() => setImageBroken(false)}
              className="w-32 rounded-xl border border-slate-200 sm:w-40"
            />
          </a>
          <figcaption className="text-xs leading-relaxed text-slate-500">
            {imageBroken && (
              <span className="mb-1 block font-bold text-red-700">
                画像を読み込めませんでした。見本を確かめられないまま承認しないでください（画面を開き直すか、作り直す／テンプレ画像にする）。
              </span>
            )}
            {c.image
              ? `AI画像（ChatGPTで作成）に見出しを重ねた、投稿と同じ画像です。${variant.channel === 'instagram_carousel' ? '1枚目（表紙）に使い、2枚目からは文字のスライドです。' : ''}押すと大きく開きます。`
              : 'テンプレ画像（紺の背景＋見出し）で投稿します。下の「画像を作る」でAI画像にできます。'}
          </figcaption>
        </figure>
      )}
      {c.hook && <p className="font-bold text-slate-900">{c.hook}</p>}
      {c.slides && c.slides.length > 0 && (
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {c.slides.map((s) => (
            <li key={s.order} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="font-bold text-teal-800">
                {s.order}. {s.heading}
              </p>
              <p className="mt-0.5 text-slate-600">{s.body}</p>
            </li>
          ))}
        </ol>
      )}
      {variant.channel === 'instagram_story' && c.story && (
        <figure className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- 院内だけで使うその場の見本（最適化は不要） */}
          <img
            src={`/api/marketing/image?${new URLSearchParams({ kind: 'story', scope: c.story.scope, dates: c.story.dates.join(',') }).toString()}`}
            alt="ストーリー画像の見本"
            loading="lazy"
            className="w-32 shrink-0 rounded-xl border border-slate-200 sm:w-40"
          />
          <figcaption className="text-xs leading-relaxed text-slate-500">
            いまの空きで作った見本です。投稿の時刻に、その時の空きで作り直します（空きが無くなっていたら出しません）。
          </figcaption>
        </figure>
      )}
      <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{c.body}</p>
      {c.hashtags.length > 0 && <p className="text-xs text-sky-700">{c.hashtags.join(' ')}</p>}
      {variant.channel === 'google_business' && c.cta?.url && (
        <p className="break-all text-xs text-slate-500">
          ボタン「{c.cta.label}」→ {c.cta.url}
        </p>
      )}
      {c.warnings.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">AIからの注意メモ（{c.warnings.length}）</summary>
          <ul className="mt-1 list-disc pl-4">
            {c.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <ComplianceBox variant={variant} />
    </div>
  )
}

function ItemCard({
  item,
  isAdmin,
  aiImage,
  busy,
  act,
}: {
  item: ProposalItem
  isAdmin: boolean
  /** AI画像（ChatGPT）が使えるか */
  aiImage: boolean
  busy: boolean
  act: (body: Record<string, unknown>) => Promise<void>
}) {
  const [tab, setTab] = useState(item.variants[0]?.id ?? '')
  const [editing, setEditing] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [newTheme, setNewTheme] = useState('')
  const variant = item.variants.find((v) => v.id === tab) ?? item.variants[0]
  const excluded = new Set(item.excludedChannels ?? [])
  const editable = item.status === 'proposed' || item.status === 'expired'
  const blocker = approvalBlocker(item)
  const active = activeVariants(item)

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-teal-800">{formatSlot(item.scheduledAt)}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[item.status]}`}>{ITEM_STATUS_LABELS[item.status]}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{CATEGORY_LABELS[item.category]}</span>
      </div>
      <h3 className="mt-1.5 text-base font-bold leading-snug text-slate-900">{item.theme}</h3>
      {item.sitePath && <p className="text-xs text-slate-500">関連ページ: {item.sitePath}</p>}
      {(item.errors ?? []).length > 0 && (
        <p className="mt-1 rounded bg-red-50 p-2 text-xs text-red-700">{item.errors!.join(' / ')}</p>
      )}

      {item.variants.length > 0 && variant && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
            {item.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === variant.id}
                onClick={() => {
                  setTab(v.id)
                  setEditing(false)
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold max-lg:min-h-10 ${
                  v.id === variant.id ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
                } ${excluded.has(v.channel) ? 'line-through opacity-60' : ''}`}
              >
                {channelShort(v.channel)}
                {v.compliance.status === 'blocked' ? ' ⛔' : v.compliance.status === 'review' ? ' ⚠' : ''}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <VariantPreview
              key={`${variant.id}:${variant.editedAt ?? ''}:${editing}`}
              variant={variant}
              theme={item.theme}
              editing={editing}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={async (patch) => {
                await act({ action: 'edit_variant', itemId: item.id, variantId: variant.id, ...patch })
                setEditing(false)
              }}
            />
          </div>
          {editable && !editing && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={() => setEditing(true)} className="rounded border border-slate-300 px-2 py-1 font-bold max-lg:min-h-10">
                この文章を直す
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => act({ action: 'toggle_channel', itemId: item.id, channel: variant.channel, exclude: !excluded.has(variant.channel) })}
                className="rounded border border-slate-300 px-2 py-1 font-bold max-lg:min-h-10"
              >
                {excluded.has(variant.channel) ? `${channelShort(variant.channel)}にも出す` : `${channelShort(variant.channel)}には出さない`}
              </button>
              {usesAiImage(variant.channel) && aiImage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: 'regenerate_image', itemId: item.id })}
                  className="rounded border border-sky-300 bg-sky-50 px-2 py-1 font-bold text-sky-800 disabled:opacity-50 max-lg:min-h-10"
                >
                  {variant.content.image ? '画像を作り直す' : '画像を作る（AI）'}
                </button>
              )}
              {usesAiImage(variant.channel) && variant.content.image && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: 'remove_image', itemId: item.id })}
                  className="rounded border border-slate-300 px-2 py-1 font-bold text-slate-600 max-lg:min-h-10"
                >
                  テンプレ画像にする
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {editable && isAdmin && (
          <button
            type="button"
            disabled={busy || Boolean(blocker)}
            onClick={() => act({ action: 'approve_item', itemId: item.id })}
            className="min-h-11 rounded-lg bg-teal-700 px-5 py-2 text-sm font-bold text-white disabled:bg-slate-300"
            title={blocker ?? ''}
          >
            承認する（{active.map((v) => channelShort(v.channel)).join('＋') || '媒体なし'}）
          </button>
        )}
        {item.status === 'approved' && isAdmin && (
          <button type="button" disabled={busy} onClick={() => act({ action: 'unapprove_item', itemId: item.id })} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 max-lg:min-h-10">
            承認を取り消す
          </button>
        )}
        {editable && isAdmin && (
          <button type="button" disabled={busy} onClick={() => act({ action: 'skip_item', itemId: item.id })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 max-lg:min-h-10">
            見送る
          </button>
        )}
        {item.status === 'skipped' && isAdmin && (
          <button type="button" disabled={busy} onClick={() => act({ action: 'restore_item', itemId: item.id })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold max-lg:min-h-10">
            承認待ちに戻す
          </button>
        )}
        {editable && (
          <button type="button" disabled={busy} onClick={() => setRegenOpen((v) => !v)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 max-lg:min-h-10">
            作り直す
          </button>
        )}
        {editable && blocker && isAdmin && <span className="text-xs text-red-700">{blocker}</span>}
        {item.status === 'expired' && <span className="text-xs text-slate-500">時刻を過ぎたため投稿していません。承認すると15分以内に投稿します。</span>}
      </div>

      {regenOpen && editable && (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
          <label className="block text-xs font-bold text-slate-600">
            テーマを指定（空欄なら別のテーマをAIが選びます）
            <input value={newTheme} onChange={(e) => setNewTheme(e.target.value)} placeholder="例: 冬の朝のジョギングでひざを痛めないために" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal" />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await act({ action: 'regenerate_item', itemId: item.id, theme: newTheme.trim() || undefined })
              setRegenOpen(false)
              setNewTheme('')
            }}
            className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 max-lg:min-h-10"
          >
            {busy ? '作り直し中…（1〜3分）' : 'この枠を作り直す'}
          </button>
        </div>
      )}
    </li>
  )
}

function SettingsPanel({
  initial,
  isAdmin,
  onSaved,
}: {
  initial: AutopilotSettings
  isAdmin: boolean
  onSaved: (message: string) => void
}) {
  // 保存のたびに親が key を変えて作り直す（初期値は props から）
  const [s, setS] = useState<AutopilotSettings>(initial)
  const [syncProfile, setSyncProfile] = useState(true)
  const [saving, setSaving] = useState(false)

  const slots = Array.from({ length: s.postsPerWeek }, (_, i) => s.slots[i] ?? DEFAULT_AUTOPILOT_SETTINGS.slots[i])

  async function save() {
    setSaving(true)
    try {
      const body: AutopilotSettings = { ...s, slots: [...slots, ...s.slots.slice(s.postsPerWeek)].slice(0, 5) }
      if (syncProfile) {
        const profile = loadClinicProfile()
        body.clinicProfile = Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, String(v ?? '')]))
      }
      const res = await fetch('/api/marketing/autopilot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      onSaved(res.ok ? '設定を保存しました' : (data.error ?? '保存に失敗しました'))
    } finally {
      setSaving(false)
    }
  }

  const disabled = !isAdmin
  return (
    <div className="space-y-4 text-sm">
      <label className="flex items-center gap-2 font-bold max-lg:min-h-10">
        <input type="checkbox" checked={s.enabled} disabled={disabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} className="h-5 w-5" />
        毎週、自動で投稿案を作る（日曜 {s.generateHour}時ごろ → 院長のLINEへお知らせ）
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold text-slate-600">1週間の投稿本数</span>
          <select value={s.postsPerWeek} disabled={disabled} onChange={(e) => setS({ ...s, postsPerWeek: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}本{n === 3 ? '（おすすめ）' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-600">Instagramの形式</span>
          <select value={s.instagram} disabled={disabled} onChange={(e) => setS({ ...s, instagram: e.target.value as AutopilotSettings['instagram'] })} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
            <option value="instagram_carousel">カルーセル（複数枚の解説・おすすめ）</option>
            <option value="instagram_feed">1枚画像</option>
            <option value="off">Instagramには出さない</option>
          </select>
        </label>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-600">投稿する曜日と時刻</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-xs text-slate-500">{i + 1}.</span>
              <select
                value={slot.weekday}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...slots]
                  next[i] = { ...slot, weekday: Number(e.target.value) }
                  setS({ ...s, slots: [...next, ...s.slots.slice(next.length)] })
                }}
                className="rounded-lg border border-slate-300 p-2"
              >
                {WEEKDAY_LABELS.map((w, d) => (
                  <option key={d} value={d}>
                    {w}曜
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={slot.time}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...slots]
                  next[i] = { ...slot, time: e.target.value }
                  setS({ ...s, slots: [...next, ...s.slots.slice(next.length)] })
                }}
                className="rounded-lg border border-slate-300 p-2"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 max-lg:min-h-10">
          <input type="checkbox" checked={s.google} disabled={disabled} onChange={(e) => setS({ ...s, google: e.target.checked })} className="h-5 w-5" />
          同じテーマでGoogleビジネスプロフィールにも投稿する
        </label>
        <label className="flex items-center gap-2 max-lg:min-h-10">
          <input type="checkbox" checked={s.availabilityPost} disabled={disabled || !s.google} onChange={(e) => setS({ ...s, availabilityPost: e.target.checked })} className="h-5 w-5" />
          週のはじめに「今週の予約の空き状況」をGoogleに投稿する（予約システムの空き枠から自動作成）
        </label>
        <label className="flex items-center gap-2 max-lg:min-h-10">
          <input
            type="checkbox"
            checked={s.availabilityStory}
            disabled={disabled}
            onChange={(e) => setS({ ...s, availabilityStory: e.target.checked })}
            className="h-5 w-5"
          />
          空き状況をInstagramのストーリーにも出す（週のはじめ・空きが多い日の朝。投稿の時刻の空きで画像を作り、空きが無ければ出しません）
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-bold text-slate-600">来週の投稿で触れてほしいこと（院長メモ・任意）</span>
        <textarea
          value={s.ownerNote}
          disabled={disabled}
          maxLength={400}
          rows={3}
          onChange={(e) => setS({ ...s, ownerNote: e.target.value })}
          placeholder="例: 11/3は祝日で休診です／高校サッカーの大会前なので肉離れの予防を"
          className="mt-1 w-full rounded-lg border border-slate-300 p-2"
        />
        <span className="text-xs text-slate-500">次の下書きの1本目のテーマになります（患者さんのお名前・症状などの個人情報は書かないでください）。使ったら空に戻ります。</span>
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-600 max-lg:min-h-10">
        <input type="checkbox" checked={syncProfile} disabled={disabled} onChange={(e) => setSyncProfile(e.target.checked)} />
        「基本設定」の院情報（この端末に保存したもの）を自動下書きにも使う
      </label>

      {isAdmin ? (
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-teal-700 px-5 py-2 font-bold text-white disabled:opacity-50 max-lg:min-h-10">
          {saving ? '保存中…' : '設定を保存'}
        </button>
      ) : (
        <p className="text-xs text-slate-500">設定の変更は院長（管理者）のみです。</p>
      )}
    </div>
  )
}

function AutopilotInner() {
  const { isAdmin } = useMarketingRole()
  const params = useSearchParams()
  const weekFromUrl = params.get('week')

  const [settings, setSettings] = useState<AutopilotSettings | null>(null)
  const [proposals, setProposals] = useState<WeeklyProposal[]>([])
  const [conn, setConn] = useState<Connections | null>(null)
  const [selected, setSelected] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const refresh = useCallback(
    () =>
      fetch('/api/marketing/autopilot', { cache: 'no-store' })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
          setSettings(data.settings)
          setProposals(data.proposals ?? [])
          setConn(data.connections)
          setError('')
        })
        .catch((e: unknown) => setError(`読み込みに失敗しました（${e instanceof Error ? e.message : '不明'}）`)),
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  // 開く週：画面で選んだ週 → URL指定 → 承認待ちがある週 → いちばん新しい週
  const currentWeek = useMemo(() => {
    if (selected && proposals.some((p) => p.weekStart === selected)) return selected
    const fromUrl = proposals.find((p) => p.weekStart === weekFromUrl)
    const pending = [...proposals].reverse().find((p) => p.items.some((i) => i.status === 'proposed'))
    return (fromUrl ?? pending ?? proposals[0])?.weekStart ?? ''
  }, [proposals, weekFromUrl, selected])

  const proposal = useMemo(() => proposals.find((p) => p.weekStart === currentWeek), [proposals, currentWeek])
  const approvable = (proposal?.items ?? []).filter((i) => i.status === 'proposed' && !approvalBlocker(i))

  async function act(body: Record<string, unknown>) {
    if (!proposal) return
    setBusy(true)
    setMessage(
      body.action === 'regenerate_item'
        ? 'AIが文章と画像を作り直しています…（1〜3分かかります）'
        : body.action === 'regenerate_image'
          ? 'ChatGPTで画像を作っています…（1分ほどかかります）'
          : '処理中…',
    )
    try {
      const res = await fetch(`/api/marketing/autopilot/proposals/${proposal.weekStart}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setMessage(data.message ?? data.error ?? (res.ok ? '完了しました' : '失敗しました'))
      if (data.proposal) setProposals((list) => list.map((p) => (p.weekStart === data.proposal.weekStart ? data.proposal : p)))
    } catch {
      setMessage('通信に失敗しました。電波の良いところでもう一度お試しください')
    } finally {
      setBusy(false)
    }
  }

  async function generateNow() {
    setBusy(true)
    setMessage('AIが投稿案と画像を作っています…（2〜4分かかります。画面はそのままでお待ちください）')
    try {
      const res = await fetch('/api/marketing/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_now' }),
      })
      const data = await res.json()
      setMessage(data.message ?? (res.ok ? '作成しました' : '作成できませんでした'))
      if (data.week) setSelected(data.week)
      await refresh()
    } catch {
      setMessage('通信が途切れました。作成は続いている場合があります。1〜2分後に画面を更新してください')
    } finally {
      setBusy(false)
    }
  }

  const chips: Array<{ label: string; ok: boolean; note: string }> = conn
    ? [
        { label: 'AI下書き', ok: conn.ai, note: conn.ai ? '稼働中' : conn.mock ? 'モック' : 'APIキー未設定' },
        { label: 'AI画像（ChatGPT）', ok: Boolean(conn.aiImage), note: conn.aiImage ? '稼働中' : conn.mock ? 'モック' : 'OPENAI_API_KEY 未設定（テンプレ画像）' },
        { label: '院長LINE通知', ok: conn.ownerLine, note: conn.ownerLine ? '通知あり' : '未設定' },
        { label: 'Instagram', ok: conn.instagram, note: conn.instagram ? '自動投稿' : '未連携（時刻にLINEで本文が届きます）' },
        { label: 'Google', ok: conn.googleApi, note: conn.googleApi ? '自動投稿' : '接続の設定待ち（時刻にLINEで本文が届きます）' },
        { label: '予約の流入元', ok: conn.bookingStats, note: conn.bookingStats ? '集計できます' : '未設定' },
      ]
    : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">自動投稿</h1>
        <span className="text-sm text-slate-500">AIが下書き → 院長が承認 → 予定の時刻に投稿</span>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span key={c.label} className={`rounded-full px-3 py-1 text-xs font-bold ${c.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
            {c.ok ? '●' : '○'} {c.label}：{c.note}
          </span>
        ))}
      </div>

      {/* 週の切り替え */}
      {proposals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {proposals.map((p) => {
            const pending = p.items.filter((i) => i.status === 'proposed').length
            return (
              <button
                key={p.weekStart}
                type="button"
                aria-pressed={p.weekStart === currentWeek}
                onClick={() => setSelected(p.weekStart)}
                className={`rounded-lg px-3 py-2 text-sm font-bold max-lg:min-h-10 ${p.weekStart === currentWeek ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
              >
                {weekLabel(p.weekStart)}
                {pending > 0 && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-xs text-slate-900">{pending}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* まとめて承認 */}
      {proposal && proposal.status === 'ready' && approvable.length > 0 && isAdmin && (
        <div
          className="sticky z-10 rounded-xl border border-teal-200 bg-teal-50 p-3 shadow-sm"
          style={{ top: 'calc(var(--shell-top, 0px) + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => act({ action: 'approve_all' })}
              className="min-h-12 flex-1 rounded-xl bg-teal-700 px-5 py-3 text-base font-black text-white disabled:opacity-50 sm:flex-none"
            >
              まとめて承認（{approvable.length}本）
            </button>
            <p className="text-xs text-teal-900">内容を確認してから押してください。承認した投稿だけが予定の時刻に出ます。</p>
          </div>
        </div>
      )}
      {!isAdmin && <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600">スタッフ（編集）権限：文章の修正・作り直しはできます。承認は院長が行います。</p>}

      {message && <p className="rounded-lg bg-white p-3 text-sm whitespace-pre-wrap text-slate-700 ring-1 ring-slate-200">{message}</p>}

      {proposal ? (
        proposal.status === 'generating' ? (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-600 ring-1 ring-slate-200">AIが投稿案を作成中です…（1〜2分後に画面を更新してください）</p>
        ) : (
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2 text-xs text-slate-500">
              <span>作成: {new Date(proposal.createdAt).toLocaleString('ja-JP')}</span>
              {proposal.mode === 'mock' && <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-800">モック（サンプル文）</span>}
              {proposal.notifyResult && <span>{proposal.notifyResult}</span>}
            </div>
            {proposal.items.length === 0 ? (
              <p className="rounded-xl bg-white p-6 text-sm text-slate-600 ring-1 ring-slate-200">この週は作れる投稿枠がありませんでした。</p>
            ) : (
              <ul className="space-y-4">
                {proposal.items.map((item) => (
                  <ItemCard key={item.id} item={item} isAdmin={isAdmin} aiImage={Boolean(conn?.aiImage)} busy={busy} act={act} />
                ))}
              </ul>
            )}
          </section>
        )
      ) : (
        !error && (
          <div className="rounded-xl bg-white p-6 text-sm text-slate-600 ring-1 ring-slate-200">
            <p className="font-bold text-slate-800">まだ投稿案はありません</p>
            <p className="mt-1">毎週日曜の夕方に、翌週分の投稿案が自動でできて院長のLINEにお知らせが届きます。今すぐ作ることもできます。</p>
          </div>
        )
      )}

      <div className="flex flex-wrap gap-2">
        {isAdmin && (
          <button type="button" onClick={generateNow} disabled={busy} className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-bold text-teal-800 disabled:opacity-50 max-lg:min-h-10">
            今すぐ投稿案を作る
          </button>
        )}
        <button type="button" onClick={() => setShowSettings((v) => !v)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold max-lg:min-h-10">
          {showSettings ? '設定を閉じる' : '設定（本数・曜日・媒体・院長メモ）'}
        </button>
        <Link href="/marketing/jobs" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold max-lg:min-h-10 max-lg:inline-flex max-lg:items-center">
          投稿の予定と結果
        </Link>
      </div>

      {showSettings && settings && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-bold">自動投稿の設定</h2>
          <SettingsPanel
            key={settings.updatedAt ?? 'default'}
            initial={settings}
            isAdmin={isAdmin}
            onSaved={(m) => {
              setMessage(m)
              refresh()
            }}
          />
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
        <h2 className="mb-1 text-sm font-bold text-slate-800">しくみ</h2>
        <ol className="list-decimal space-y-1 pl-4">
          <li>毎週日曜の夕方、テーマ集（症状の解説・予防・院のご案内）と院長メモから翌週分の投稿案をAIが作り、表現チェックをかけます。</li>
          <li>院長のLINEにお知らせが届きます。この画面で内容を確認して「承認」。LINEの「このまま全部承認」でも承認できます。</li>
          <li>予定の時刻に自動で投稿します。Instagram未連携・Google（接続の設定待ち）の間は、時刻になると本文がLINEに届くので、コピーして貼り付けて「投稿した」を押すだけです。</li>
          <li>承認しなかった案は投稿されません。投稿のリンクは計測付きで、どの投稿から予約が入ったかが「効果測定」でわかります。</li>
        </ol>
      </section>
    </div>
  )
}

export default function AutopilotPage() {
  return (
    <Suspense>
      <AutopilotInner />
    </Suspense>
  )
}
