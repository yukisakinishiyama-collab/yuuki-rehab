'use client'
// ──────────────────────────────────────────────
// 疾患ライブラリ - 管理画面（監修ワークフロー）
// 医師による監修記録・文献の原文確認状態を登録する。
// 記録は localStorage（disease_reviews）に保存され、既存のクラウド同期で共有される。
// ──────────────────────────────────────────────
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ShieldCheck, AlertTriangle, BookMarked, CalendarClock, Save, X,
} from 'lucide-react'
import type { DiseasePage } from '@/types/disease'
import {
  getDiseasePages, getReview, saveReview, clearReview, type DiseaseReview,
} from '@/lib/disease-store'

export default function DiseaseAdminPage() {
  const [pages, setPages] = useState<DiseasePage[]>([])
  const [reviews, setReviews] = useState<Map<string, DiseaseReview>>(new Map())
  const [editingId, setEditingId] = useState<string | null>(null)

  function reload() {
    const ps = getDiseasePages()
    setPages(ps)
    setReviews(new Map(
      ps.map(p => [p.id, getReview(p.id)]).filter((e): e is [string, DiseaseReview] => !!e[1])
    ))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-3xl mx-auto font-body space-y-5">
      <Link href="/diseases" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[--color-text-primary] transition-colors">
        <ArrowLeft className="w-4 h-4" />疾患ライブラリ
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[--color-text-primary] font-display">ライブラリ管理・監修</h1>
        <p className="text-sm text-[--color-text-muted] mt-1">
          疾患ページの監修状態と文献確認を管理します
        </p>
      </div>

      {/* 運用上の注意 */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <span>
          監修の登録は、内容を実際に確認した<b>医師</b>が行ってください。
          文献の「原文確認済み」は、実在と引用内容の一致を原文で確認した場合のみチェックしてください。
          監修登録後も、記載内容の最終責任は確認した医療者にあります。
        </span>
      </div>

      {/* ページ一覧 */}
      <div className="space-y-3">
        {pages.map(page => {
          const review = reviews.get(page.id)
          const supervised = !!(review?.supervisor || page.meta.supervisor)
          const overdue = page.meta.nextReviewDue < today
          const verifiedRefCount = page.references.filter((r, i) =>
            r.verified || (review?.verifiedRefs.includes(i) ?? false)).length

          return (
            <div key={page.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <BookMarked className="w-4 h-4 text-[--color-primary] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/diseases/${page.id}`}
                      className="text-sm font-bold text-[--color-text-primary] font-display hover:text-[--color-primary] transition-colors">
                      {page.names.ja}
                    </Link>
                    {supervised ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
                        <ShieldCheck className="w-3 h-3" />監修済み: {review?.supervisor ?? page.meta.supervisor}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                        医師監修前の下書き
                      </span>
                    )}
                    {overdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        <CalendarClock className="w-3 h-3" />見直し期限超過
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    最終更新 {page.meta.updatedAt} ／ 次回見直し {page.meta.nextReviewDue} ／
                    文献確認 {verifiedRefCount}/{page.references.length}件
                  </p>
                </div>
                <button
                  onClick={() => setEditingId(editingId === page.id ? null : page.id)}
                  className={`text-xs font-bold px-3.5 py-2 rounded-lg transition-colors font-display flex-shrink-0 ${
                    editingId === page.id
                      ? 'bg-slate-200 text-slate-600'
                      : 'bg-[--color-primary] text-white hover:bg-[--color-primary-hover]'
                  }`}
                >
                  {editingId === page.id ? '閉じる' : '監修を記録'}
                </button>
              </div>

              {editingId === page.id && (
                <ReviewForm
                  page={page}
                  review={review}
                  onSaved={() => { setEditingId(null); reload() }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-slate-400">
        疾患ページ本体の追加・本文編集は現在コード管理（src/data/diseases/）で行います。
        追加したい疾患・修正したい記載があれば開発担当へ伝えてください。
      </p>
    </div>
  )
}

// ── 監修記録フォーム ──
function ReviewForm({ page, review, onSaved, onCancel }: {
  page: DiseasePage
  review?: DiseaseReview
  onSaved: () => void
  onCancel: () => void
}) {
  const [supervisor, setSupervisor] = useState(review?.supervisor ?? '')
  const [reviewedAt, setReviewedAt] = useState(review?.reviewedAt ?? new Date().toISOString().split('T')[0])
  const [note, setNote] = useState(review?.note ?? '')
  const [verifiedRefs, setVerifiedRefs] = useState<number[]>(review?.verifiedRefs ?? [])

  function toggleRef(i: number) {
    setVerifiedRefs(v => v.includes(i) ? v.filter(x => x !== i) : [...v, i])
  }

  function handleSave() {
    if (!supervisor.trim()) {
      alert('監修者名（医師）を入力してください')
      return
    }
    saveReview({
      pageId: page.id,
      supervisor: supervisor.trim(),
      reviewedAt,
      note: note.trim() || undefined,
      verifiedRefs,
    })
    onSaved()
  }

  function handleClear() {
    if (!confirm('この監修記録を削除しますか？（ページは「下書き」表示に戻ります）')) return
    clearReview(page.id)
    onSaved()
  }

  return (
    <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 font-display">
            監修者名（医師）<span className="text-orange-500 ml-0.5">＊</span>
          </label>
          <input
            value={supervisor}
            onChange={e => setSupervisor(e.target.value)}
            placeholder="例: ○○整形外科 ○○医師"
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 font-display">確認日</label>
          <input
            type="date"
            value={reviewedAt}
            onChange={e => setReviewedAt(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 font-display">
          監修メモ（修正指示・確認範囲など）
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="例: 疫学の数値は文献確認後に追記すること。他は臨床使用可。"
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none
            focus:outline-none focus:ring-2 focus:ring-teal-500/40"
        />
      </div>

      {/* 文献の原文確認チェック */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 font-display">
          文献の原文確認（実在・引用内容の一致を確認したものにチェック）
        </label>
        <div className="space-y-1.5">
          {page.references.map((r, i) => (
            <label key={i} className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer bg-white rounded-lg px-3 py-2 border border-slate-100">
              <input
                type="checkbox"
                checked={r.verified || verifiedRefs.includes(i)}
                disabled={r.verified}
                onChange={() => toggleRef(i)}
                className="mt-0.5 accent-teal-600"
              />
              <span>
                <span className="metric text-slate-400">[{i + 1}]</span> {r.authors}. {r.title}. <i>{r.source}</i>. {r.year}.
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 text-sm font-bold text-white bg-teal-600 px-4 py-2.5
            rounded-lg hover:bg-teal-700 transition-colors font-display"
        >
          <Save className="w-3.5 h-3.5" />監修を保存
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-slate-500 px-4 py-2.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          キャンセル
        </button>
        {review && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 ml-auto transition-colors"
          >
            <X className="w-3.5 h-3.5" />監修記録を削除
          </button>
        )}
      </div>
    </div>
  )
}
