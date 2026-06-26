'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, BookOpen, Plus, Trash2, ChevronDown, ChevronUp,
  ExternalLink, Save, Tag, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react'
import type { LiteraturePaper, PubMedSearchResult } from '@/types/literature'
import { DIAGNOSIS_CATEGORY_OPTIONS } from '@/types/literature'
import {
  getLiteratureLibrary, savePaperToLibrary, deleteLibraryPaper,
  updateLibraryPaper, isPmidSaved,
} from '@/lib/literature-store'
import {
  EVIDENCE_GRADE_LABELS, EVIDENCE_GRADE_COLORS,
} from '@/types/protocol'
import type { EvidenceGrade } from '@/types/protocol'

/* ── エビデンスグレードバッジ ── */
function GradeBadge({ grade }: { grade?: EvidenceGrade }) {
  if (!grade) return null
  return (
    <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 font-display flex-shrink-0
      ${EVIDENCE_GRADE_COLORS[grade]}`}>
      {grade}
    </span>
  )
}

/* ── PubMed検索結果カード ── */
function PubMedCard({
  paper,
  onSave,
  saved,
}: {
  paper: PubMedSearchResult
  onSave: (paper: PubMedSearchResult) => void
  saved: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-start gap-2 mb-1">
          <p className="text-sm font-semibold text-slate-800 leading-snug flex-1">{paper.title}</p>
        </div>
        <p className="text-xs text-slate-500">
          {paper.authors.length > 0 && `${paper.authors.join(', ')}${paper.authors.length >= 3 ? ' et al.' : ''} · `}
          {paper.journal}{paper.year ? ` · ${paper.year}` : ''}
        </p>

        {paper.abstract && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? 'アブストラクトを閉じる' : 'アブストラクトを見る'}
            </button>
            {expanded && (
              <p className="text-xs text-slate-600 mt-2 leading-relaxed bg-slate-50 rounded-lg p-3">
                {paper.abstract}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50">
        <a
          href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />PMID: {paper.pmid}
        </a>
        <div className="flex-1" />
        {saved ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />保存済み
          </span>
        ) : (
          <button
            onClick={() => onSave(paper)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-teal-600
              hover:bg-teal-700 transition-colors px-3 py-1.5 rounded-lg"
          >
            <Save className="w-3.5 h-3.5" />ライブラリに保存
          </button>
        )}
      </div>
    </div>
  )
}

/* ── ライブラリ論文カード ── */
function LibraryCard({
  paper,
  onDelete,
  onUpdate,
}: {
  paper: LiteraturePaper
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: Partial<LiteraturePaper>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesVal, setNotesVal] = useState(paper.notes)

  function saveNotes() {
    onUpdate(paper.id, { notes: notesVal })
    setEditingNotes(false)
  }

  const addedDate = new Date(paper.addedAt).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <GradeBadge grade={paper.evidenceGrade} />
          <p className="text-sm font-semibold text-slate-800 leading-snug flex-1">{paper.title}</p>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {paper.authors.length > 0 && `${paper.authors.join(', ')}${paper.authors.length >= 3 ? ' et al.' : ''} · `}
          {paper.journal}{paper.year ? ` · ${paper.year}` : ''}
        </p>

        {paper.diagnosisCategories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {paper.diagnosisCategories.map(c => (
              <span key={c} className="inline-flex items-center gap-0.5 text-[10px] bg-teal-50
                text-teal-700 border border-teal-100 rounded-full px-2 py-0.5">
                <Tag className="w-2.5 h-2.5" />{c}
              </span>
            ))}
          </div>
        )}

        {expanded && (
          <div className="mt-2 space-y-2">
            {paper.abstract && (
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">
                {paper.abstract}
              </p>
            )}

            {/* エビデンスグレード編集 */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 mb-1">エビデンスグレード</p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(EVIDENCE_GRADE_LABELS) as EvidenceGrade[]).map(g => (
                  <button
                    key={g}
                    onClick={() => onUpdate(paper.id, { evidenceGrade: g })}
                    className={`text-[10px] font-bold border rounded px-1.5 py-0.5 font-display transition-all
                      ${paper.evidenceGrade === g
                        ? EVIDENCE_GRADE_COLORS[g]
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                      }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 疾患カテゴリ編集 */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 mb-1">疾患カテゴリ</p>
              <div className="flex flex-wrap gap-1">
                {DIAGNOSIS_CATEGORY_OPTIONS.map(cat => {
                  const active = paper.diagnosisCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        const next = active
                          ? paper.diagnosisCategories.filter(c => c !== cat)
                          : [...paper.diagnosisCategories, cat]
                        onUpdate(paper.id, { diagnosisCategories: next })
                      }}
                      className={`text-[10px] rounded-full border px-2 py-0.5 transition-colors ${
                        active
                          ? 'bg-teal-100 text-teal-800 border-teal-300'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-teal-200'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* メモ */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 mb-1">院内メモ</p>
              {editingNotes ? (
                <div className="flex gap-2">
                  <textarea
                    value={notesVal}
                    onChange={e => setNotesVal(e.target.value)}
                    rows={2}
                    className="flex-1 text-xs border border-teal-300 rounded-lg p-2 resize-none
                      focus:outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="この文献の使い方や注意点など"
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={saveNotes}
                      className="text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700
                        rounded-lg px-2.5 py-1.5 transition-colors"
                    >保存</button>
                    <button
                      onClick={() => { setNotesVal(paper.notes); setEditingNotes(false) }}
                      className="text-xs text-slate-500 hover:text-slate-700 rounded-lg px-2 py-1.5"
                    >取消</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="w-full text-left text-xs text-slate-600 bg-slate-50 border border-slate-100
                    rounded-lg p-2.5 hover:border-teal-200 transition-colors min-h-[36px]"
                >
                  {paper.notes || <span className="text-slate-300">クリックして院内メモを追加…</span>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-100 bg-slate-50">
        <span className="text-[10px] text-slate-400">{addedDate}に追加</span>
        {paper.pmid && (
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-slate-400 hover:text-teal-600 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? '閉じる' : '詳細・編集'}
        </button>
        <button
          onClick={() => onDelete(paper.id)}
          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ── メインページ ── */
export default function LiteraturePage() {
  const [tab, setTab] = useState<'search' | 'library'>('library')
  const [query, setQuery] = useState('')
  const [keywords, setKeywords] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<PubMedSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [savedPmids, setSavedPmids] = useState<Set<string>>(new Set())
  const [library, setLibrary] = useState<LiteraturePaper[]>([])
  const [filterCat, setFilterCat] = useState<string>('all')

  const refreshLibrary = useCallback(() => {
    const papers = getLiteratureLibrary()
    setLibrary(papers)
    setSavedPmids(new Set(papers.map(p => p.pmid).filter(Boolean) as string[]))
  }, [])

  useEffect(() => { refreshLibrary() }, [refreshLibrary])

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    setSearchResults([])
    try {
      const res = await fetch('/api/pubmed-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosis: query.trim(), keywords: keywords.trim() || undefined }),
      })
      const data = await res.json() as { papers?: PubMedSearchResult[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? '検索に失敗しました')
      setSearchResults(data.papers ?? [])
      if ((data.papers ?? []).length === 0) setSearchError('該当論文が見つかりませんでした。検索語を変えてみてください。')
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : '検索エラー')
    } finally {
      setSearching(false)
    }
  }

  function handleSavePaper(result: PubMedSearchResult) {
    if (isPmidSaved(result.pmid)) return
    savePaperToLibrary({
      pmid: result.pmid,
      title: result.title,
      authors: result.authors,
      journal: result.journal,
      year: result.year,
      abstract: result.abstract,
      keywords: [],
      diagnosisCategories: [],
      evidenceGrade: undefined,
      notes: '',
      url: `https://pubmed.ncbi.nlm.nih.gov/${result.pmid}/`,
      isActive: true,
    })
    refreshLibrary()
  }

  function handleDelete(id: string) {
    if (!confirm('この文献をライブラリから削除しますか？')) return
    deleteLibraryPaper(id)
    refreshLibrary()
  }

  function handleUpdate(id: string, patch: Partial<LiteraturePaper>) {
    updateLibraryPaper(id, patch)
    refreshLibrary()
  }

  const filteredLibrary = filterCat === 'all'
    ? library
    : library.filter(p => p.diagnosisCategories.includes(filterCat))

  return (
    <div className="max-w-3xl mx-auto font-body">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[--color-text-primary] font-display flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-teal-600" />
          文献ライブラリ
        </h1>
        <p className="text-sm text-[--color-text-secondary] mt-0.5">
          PubMedから論文を検索して院内ライブラリに蓄積。プロトコル生成時に自動で参照されます。
        </p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
        <button
          onClick={() => setTab('search')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
            tab === 'search'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Search className="w-4 h-4" />PubMed検索
        </button>
        <button
          onClick={() => setTab('library')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
            tab === 'library'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />院内ライブラリ
          {library.length > 0 && (
            <span className="bg-teal-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {library.length}
            </span>
          )}
        </button>
      </div>

      {/* PubMed検索タブ */}
      {tab === 'search' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 mb-3">検索条件</p>
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">疾患名・診断名 *</label>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="例: ACL reconstruction, rotator cuff, lumbar"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800
                    placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">追加キーワード（任意）</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="例: randomized controlled trial, exercise therapy"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800
                    placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="flex items-center justify-center gap-2 bg-teal-600 text-white rounded-xl
                  py-2.5 text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 mt-1"
              >
                {searching ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />PubMedを検索中…</>
                ) : (
                  <><Search className="w-4 h-4" />PubMedで検索</>
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              ※ NCBI PubMed E-utilities を使用。英語のキーワードで検索するとより多くの結果が得られます。
            </p>
          </div>

          {searchError && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{searchError}
            </div>
          )}

          {searchResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">{searchResults.length}件の結果</p>
              <div className="space-y-3">
                {searchResults.map(r => (
                  <PubMedCard
                    key={r.pmid}
                    paper={r}
                    onSave={handleSavePaper}
                    saved={savedPmids.has(r.pmid)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ライブラリタブ */}
      {tab === 'library' && (
        <div className="space-y-4">
          {library.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">ライブラリはまだ空です</p>
              <p className="text-xs text-slate-400 mt-1">「PubMed検索」タブから論文を検索して保存してください</p>
              <button
                onClick={() => setTab('search')}
                className="mt-4 flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700
                  font-semibold mx-auto"
              >
                <Plus className="w-4 h-4" />PubMedで論文を検索する
              </button>
            </div>
          ) : (
            <>
              {/* フィルタ */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-400">フィルタ:</span>
                <button
                  onClick={() => setFilterCat('all')}
                  className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                    filterCat === 'all'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-teal-200'
                  }`}
                >
                  すべて ({library.length})
                </button>
                {DIAGNOSIS_CATEGORY_OPTIONS.filter(
                  cat => library.some(p => p.diagnosisCategories.includes(cat))
                ).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                      filterCat === cat
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-teal-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredLibrary.map(p => (
                  <LibraryCard
                    key={p.id}
                    paper={p}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>

              {filteredLibrary.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">
                  このカテゴリの文献はありません
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => setTab('search')}
                  className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700
                    font-semibold"
                >
                  <Plus className="w-4 h-4" />PubMedから追加する
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
