'use client'

/**
 * 論文・根拠ライブラリ（指示書9章）
 * 承認済みの資料だけが投稿生成の根拠として選択できる。
 */
import { useEffect, useState } from 'react'
import { deleteReference, loadReferences, saveReference } from '@/lib/marketing/store'
import type { Reference } from '@/lib/marketing/types'

const EMPTY: Omit<Reference, 'id' | 'createdAt'> = {
  title: '',
  authors: '',
  year: '',
  journal: '',
  doi: '',
  pubmedId: '',
  url: '',
  design: '',
  subjects: '',
  findings: '',
  limitations: '',
  approved: false,
}

export default function ReferencesPage() {
  const [references, setReferences] = useState<Reference[]>([])
  const [draft, setDraft] = useState(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => setReferences(loadReferences()), [])
  const refresh = () => setReferences(loadReferences())

  function submit() {
    if (!draft.title.trim()) {
      setMessage('タイトルは必須です')
      return
    }
    saveReference({
      ...draft,
      id: editingId ?? crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })
    setDraft(EMPTY)
    setEditingId(null)
    setMessage('保存しました')
    refresh()
  }

  const fields: Array<{ key: keyof typeof EMPTY; label: string; wide?: boolean }> = [
    { key: 'title', label: 'タイトル（必須）', wide: true },
    { key: 'authors', label: '著者' },
    { key: 'year', label: '発行年' },
    { key: 'journal', label: '雑誌名' },
    { key: 'doi', label: 'DOI' },
    { key: 'pubmedId', label: 'PubMed ID' },
    { key: 'url', label: 'URL', wide: true },
    { key: 'design', label: '研究デザイン（RCT・レビュー・症例報告など）' },
    { key: 'subjects', label: '対象者' },
    { key: 'findings', label: '主な結果', wide: true },
    { key: 'limitations', label: '限界・注意点', wide: true },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">論文・根拠ライブラリ</h1>
      <p className="text-sm text-slate-600">
        投稿の根拠に使う資料を登録します。<strong>「承認済み」にした資料だけ</strong>が投稿作成画面で選択でき、
        AIには「この資料に書かれている範囲のみ使用」というルールで渡されます（論文の捏造防止）。
      </p>

      {/* 登録フォーム */}
      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        {fields.map(({ key, label, wide }) => (
          <label key={key} className={`block text-sm ${wide ? 'sm:col-span-2' : ''}`}>
            <span className="text-slate-600">{label}</span>
            <input
              value={draft[key] as string}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2"
            />
          </label>
        ))}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="button" onClick={submit} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white">
            {editingId ? '更新する' : '登録する'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setDraft(EMPTY)
              }}
              className="text-sm text-slate-500 underline"
            >
              新規登録に戻る
            </button>
          )}
          {message && <span className="text-sm font-bold text-emerald-700">{message}</span>}
        </div>
      </section>

      {/* 一覧 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">登録済み（{references.length}）</h2>
        {references.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">まだ資料がありません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {references.map((r) => (
              <li key={r.id} className="space-y-1 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                      r.approved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {r.approved ? '承認済み' : '未承認'}
                  </span>
                  <span className="font-bold">{r.title}</span>
                  <span className="text-xs text-slate-500">
                    {[r.authors, r.year, r.journal].filter(Boolean).join(' / ')}
                  </span>
                </div>
                {(r.doi || r.pubmedId) && (
                  <p className="text-xs text-slate-500">
                    {r.doi && `DOI: ${r.doi} `}
                    {r.pubmedId && `PMID: ${r.pubmedId}`}
                  </p>
                )}
                {r.findings && <p className="text-xs text-slate-600">結果: {r.findings}</p>}
                {r.limitations && <p className="text-xs text-amber-700">限界: {r.limitations}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      saveReference({ ...r, approved: !r.approved })
                      refresh()
                    }}
                    className={`rounded border px-2 py-1 text-xs font-bold ${
                      r.approved ? 'border-slate-300 text-slate-600' : 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {r.approved ? '承認を取り消す' : '承認する'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(r.id)
                      setDraft({ ...r })
                      window.scrollTo(0, 0)
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-bold"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('この資料を削除しますか？')) {
                        deleteReference(r.id)
                        refresh()
                      }
                    }}
                    className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-700"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
