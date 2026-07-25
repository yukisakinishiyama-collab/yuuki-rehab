'use client'
// ──────────────────────────────────────────────
// 疾患ライブラリ - 一覧・検索ページ
// 専門職向けの疾患・症例リファレンス。同義語・略語・症状で検索可能。
// ──────────────────────────────────────────────
import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search, BookMarked, ChevronRight, ShieldAlert, Stethoscope, ShieldCheck,
} from 'lucide-react'
import type { DiseaseCategory } from '@/types/disease'
import { DISEASE_CATEGORY_LABELS } from '@/types/disease'
import { getPlannedCatalog, findPageByName, searchDiseases } from '@/lib/disease-store'

const CATEGORY_ORDER: DiseaseCategory[] = ['knee', 'ankle_foot', 'shoulder', 'hip', 'elbow_hand', 'spine']

export default function DiseaseListPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<DiseaseCategory | 'all'>('all')

  const catalog = useMemo(() => getPlannedCatalog(), [])
  const searchResults = useMemo(() => searchDiseases(query), [query])

  const totalPlanned = useMemo(
    () => Object.values(catalog).reduce((acc, l) => acc + l.length, 0),
    [catalog],
  )
  const totalCreated = useMemo(
    () => Object.values(catalog).flat().filter(d => findPageByName(d.name)).length,
    [catalog],
  )

  return (
    <div className="max-w-4xl mx-auto font-body space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary] font-display">疾患ライブラリ</h1>
          <p className="text-sm text-[--color-text-muted] mt-1">
            専門職向けの疾患・症例リファレンス · {totalCreated}/{totalPlanned} ページ作成済み
          </p>
        </div>
        <Link
          href="/diseases/admin"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border
            border-slate-200 px-3.5 py-2 rounded-xl hover:border-teal-300 transition-colors font-display"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />管理・監修
        </Link>
      </div>

      {/* 医療安全表示 */}
      <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed animate-slide-up delay-75">
        <ShieldAlert className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <span>
          本ライブラリは医療従事者の臨床判断を補助するための参考情報です。診断・治療方針・手術適応・リハビリの進行は、
          患者の個別状況、医師の診断および指示、画像所見、術式、合併損傷、全身状態を踏まえて判断してください。
          記載内容より担当医の個別指示を優先してください。
        </span>
      </div>

      {/* 検索 */}
      <div className="relative animate-slide-up delay-100">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="疾患名・略語・症状で検索（例: ACL、前十字、膝崩れ、テニス肘）"
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm
            focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40 focus:border-[--color-primary]
            placeholder:text-slate-400"
        />
      </div>

      {/* 検索結果 */}
      {query.trim() !== '' ? (
        <div className="space-y-2 animate-slide-up">
          {searchResults.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              「{query}」に一致する疾患が見つかりません
            </p>
          ) : (
            searchResults.map(r => (
              r.page ? (
                <Link
                  key={r.name}
                  href={`/diseases/${r.page.id}`}
                  className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3
                    hover:border-[--color-primary]/40 hover:shadow-sm transition-all group"
                >
                  <BookMarked className="w-4 h-4 text-[--color-primary] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[--color-text-primary] font-display">{r.name}</span>
                    {r.matched && (
                      <span className="text-xs text-slate-400 ml-2">「{r.matched}」に一致</span>
                    )}
                    <span className="text-[10px] text-slate-400 ml-2">{DISEASE_CATEGORY_LABELS[r.category]}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[--color-primary] transition-colors" />
                </Link>
              ) : (
                <div key={r.name} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                  <Stethoscope className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-500">{r.name}</span>
                    {r.matched && <span className="text-xs text-slate-400 ml-2">「{r.matched}」に一致</span>}
                    <span className="text-[10px] text-slate-400 ml-2">{DISEASE_CATEGORY_LABELS[r.category]}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">準備中</span>
                </div>
              )
            ))
          )}
        </div>
      ) : (
        <>
          {/* カテゴリタブ */}
          <div className="flex flex-wrap gap-2 animate-slide-up delay-150">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-[--color-primary] text-white border-[--color-primary]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
              }`}
            >
              すべて
            </button>
            {CATEGORY_ORDER.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-[--color-primary] text-white border-[--color-primary]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                {DISEASE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* カテゴリ別リスト */}
          <div className="space-y-5">
            {CATEGORY_ORDER
              .filter(cat => activeCategory === 'all' || cat === activeCategory)
              .map(cat => {
                const list = catalog[cat]
                const createdCount = list.filter(d => findPageByName(d.name)).length
                return (
                  <div key={cat} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-slide-up">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-[--color-surface-raised]">
                      <span className="text-sm font-bold text-[--color-text-primary] font-display">
                        {DISEASE_CATEGORY_LABELS[cat]}
                      </span>
                      <span className="metric text-xs text-slate-400">{createdCount}/{list.length} 作成済み</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                      {list.map(d => {
                        const page = findPageByName(d.name)
                        return page ? (
                          <Link
                            key={d.name}
                            href={`/diseases/${page.id}`}
                            className="flex items-center gap-2.5 px-5 py-2.5 border-b border-slate-50
                              hover:bg-teal-50/40 transition-colors group"
                          >
                            <BookMarked className="w-3.5 h-3.5 text-[--color-primary] flex-shrink-0" />
                            <span className="text-sm text-[--color-text-primary] font-medium flex-1">{d.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[--color-primary]" />
                          </Link>
                        ) : (
                          <div key={d.name} className="flex items-center gap-2.5 px-5 py-2.5 border-b border-slate-50">
                            <span className="w-3.5 h-3.5 rounded-full border border-dashed border-slate-300 flex-shrink-0" />
                            <span className="text-sm text-slate-400 flex-1">{d.name}</span>
                            <span className="text-[9px] text-slate-300">準備中</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </div>
  )
}
