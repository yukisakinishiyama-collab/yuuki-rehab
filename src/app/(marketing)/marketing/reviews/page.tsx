'use client'

/** 口コミ返信支援：Google口コミを貼り付け→返信案3つ→表現チェック→コピーして手動返信 */
import { useState } from 'react'
import { DEFAULT_CLINIC_PROFILE } from '@/lib/marketing/clinic'
import type { ComplianceFinding } from '@/lib/marketing/types'

interface Draft {
  label: string
  text: string
  findings: ComplianceFinding[]
}

export default function ReviewsPage() {
  const [reviewText, setReviewText] = useState('')
  const [stars, setStars] = useState(5)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState<number | null>(null)

  async function generate() {
    if (!reviewText.trim()) {
      setMessage('口コミ本文を貼り付けてください')
      return
    }
    setBusy(true)
    setMessage('返信案を作成しています…')
    setDrafts([])
    try {
      const res = await fetch('/api/marketing/review-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewText, stars }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDrafts(data.drafts)
      setMessage(`返信案を${data.drafts.length}件作成しました（${data.mode === 'mock' ? 'モック' : 'AI生成'}）。内容を確認・編集してからGoogleへ投稿してください。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">口コミ返信支援</h1>
      <p className="text-sm text-slate-600">
        Googleビジネスプロフィールの口コミを貼り付けると、返信案を作成します。
        <strong>自動返信はしません</strong>——内容を確認し、
        <a href={DEFAULT_CLINIC_PROFILE.googleMapUrl} target="_blank" rel="noopener" className="text-teal-700 underline">
          Googleの管理画面
        </a>
        からご自身で返信してください。
      </p>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm">
          <span className="font-bold">口コミ本文</span>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={4}
            placeholder="口コミの文章をそのまま貼り付け"
            className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-bold">
            評価：
            <select value={stars} onChange={(e) => setStars(Number(e.target.value))} className="ml-2 rounded-lg border border-slate-300 p-2">
              {[5, 4, 3, 2, 1].map((s) => (
                <option key={s} value={s}>
                  {'★'.repeat(s)}
                  {'☆'.repeat(5 - s)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={generate} disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {busy ? '作成中…' : '返信案を作る'}
          </button>
          {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
        <p className="text-xs text-slate-500">
          ⚠ 口コミに書かれていない来院日・症状などの個人情報は、返信案にも含めない設計です。
        </p>
      </section>

      {drafts.map((draft, i) => (
        <section key={i} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold">案{i + 1}：{draft.label}</h2>
            {draft.findings.length === 0 ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">表現OK</span>
            ) : (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">要確認 {draft.findings.length}件</span>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(draft.text)
                setCopied(i)
                setTimeout(() => setCopied(null), 2000)
              }}
              className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold"
            >
              {copied === i ? 'コピーしました ✓' : 'コピー'}
            </button>
          </div>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed">{draft.text}</p>
          {draft.findings.length > 0 && (
            <ul className="mt-2 text-xs text-amber-800">
              {draft.findings.map((f, j) => (
                <li key={j}>
                  [{f.level}]「{f.match}」— {f.reason} → {f.suggestion}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
