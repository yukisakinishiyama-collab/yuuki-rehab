'use client'
/**
 * カルテの「資料」タブ（2026-11-18 院長の依頼）
 *
 * その方の症例に関する論文・リハビリプロトコル・医療機関の書類などを、カルテに入れておく。
 * - ファイル（PDF・画像・Word・Excel・PowerPoint。1つ 20MB まで。いくつかまとめて選べる。パソコンでは枠に落としても入る）
 * - リンク（URL。DOI・PMID を入れると doi.org・PubMed の URL に直す）
 * - ほかのカルテに入れた論文・プロトコルを、もう一度送らずにこのカルテへ（同じファイルを指す。医療機関の書類・その他は出さない）
 * 種類（論文／リハビリプロトコル／医療機関の書類／その他）・題名・メモを付けられ、あとから直せる。
 * ファイルはクラウド（非公開）に置き、端末には題名・メモと保存場所だけを持つ（lib/karte/doc-*.ts）。
 * 開くときは、1時間だけ使える URL をもらって、画面の中（PDF・画像）か別の画面で開く。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { ExternalLink, FileSpreadsheet, FileText, Files, Image as ImageIcon, Link2, Paperclip, Pencil, Presentation, Trash2, Upload } from 'lucide-react'
import type { Patient } from '@/types/patient'
import type { KarteDoc, KarteDocCategory } from '@/types/karte-docs'
import { deleteKarteDoc, getKarteDocs, saveKarteDoc } from '@/lib/patient-store'
import {
  DOC_ACCEPT,
  DOC_CATEGORIES,
  MAX_DOC_BYTES,
  MAX_MEMO,
  MAX_TITLE,
  checkDocFile,
  copyDocFor,
  docCategoryLabel,
  docTypeLabel,
  docView,
  formatBytes,
  groupDocs,
  guessCategory,
  hostOf,
  isFileShared,
  normalizeDocUrl,
  reusableDocs,
  titleFromFileName,
} from '@/lib/karte/doc-rules'
import { deleteDocFile, fetchDocUrl, uploadDoc } from '@/lib/karte/doc-client'
import { jstToday } from '@/lib/contracts/member'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card } from './shared'

type Mode = 'idle' | 'files' | 'link' | 'reuse'

interface PendingFile {
  key: string
  file: File
  title: string
  category: KarteDocCategory
  /** 入れられない理由（形式・大きさ）や、送れなかった理由 */
  error?: string
}

const chip = (on: boolean) =>
  cn(
    'min-h-10 rounded-full border px-3 text-sm transition-colors lg:min-h-8',
    on ? 'border-teal-700 bg-teal-700 font-bold text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  )

const field = 'min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40'

function DocIcon({ doc }: { doc: Pick<KarteDoc, 'kind' | 'ext'> }) {
  const cls = 'h-5 w-5 text-teal-700'
  if (doc.kind === 'link') return <Link2 className={cls} aria-hidden />
  const view = docView(doc)
  if (view === 'image') return <ImageIcon className={cls} aria-hidden />
  if (doc.ext === 'xlsx' || doc.ext === 'xls') return <FileSpreadsheet className={cls} aria-hidden />
  if (doc.ext === 'pptx' || doc.ext === 'ppt') return <Presentation className={cls} aria-hidden />
  return <FileText className={cls} aria-hidden />
}

function CategoryChips({ value, onChange }: { value: KarteDocCategory; onChange: (v: KarteDocCategory) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="資料の種類">
      <span className="text-xs font-bold text-slate-500">種類</span>
      {DOC_CATEGORIES.map((c) => (
        <button key={c.value} type="button" aria-pressed={value === c.value} onClick={() => onChange(c.value)} className={chip(value === c.value)}>
          {c.label}
        </button>
      ))}
    </div>
  )
}

export default function DocsTab({ patient, docs, onUpdate }: { patient: Patient; docs: KarteDoc[]; onUpdate: () => void }) {
  const [mode, setMode] = useState<Mode>('idle')
  const [pending, setPending] = useState<PendingFile[]>([])
  const [category, setCategory] = useState<KarteDocCategory>('paper')
  const [memo, setMemo] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [editing, setEditing] = useState<{ id: string; title: string; category: KarteDocCategory; memo: string } | null>(null)
  const [viewing, setViewing] = useState<KarteDoc | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ほかのカルテに入っている論文・プロトコル（このカルテにまだ無いもの）。docs が変わるたびに読み直す
  // eslint-disable-next-line react-hooks/exhaustive-deps -- docs は「読み直しの合図」
  const others = useMemo(() => reusableDocs(getKarteDocs(), patient.id), [docs, patient.id])
  const shownOthers = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? others.filter((d) => `${d.title} ${d.fileName ?? ''} ${d.url ?? ''}`.toLowerCase().includes(q)) : others
  }, [others, filter])
  const groups = useMemo(() => groupDocs(docs), [docs])

  function reset() {
    setMode('idle')
    setPending([])
    setMemo('')
    setLinkUrl('')
    setLinkTitle('')
    setFilter('')
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function pickFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    setError('')
    setNotice('')
    const items: PendingFile[] = files.slice(0, 10).map((file) => {
      const check = checkDocFile(file.name, file.size)
      return { key: nanoid(8), file, title: titleFromFileName(file.name), category: guessCategory(file.name), error: check.ok ? undefined : check.error }
    })
    if (files.length > 10) setError('一度に入れられるのは10個までです。残りは、もう一度選んでください。')
    setPending((prev) => (mode === 'files' ? [...prev, ...items].slice(0, 10) : items))
    setMode('files')
  }

  async function saveFiles() {
    const targets = pending.filter((p) => !p.error)
    if (targets.length === 0 || busy) return
    setError('')
    const left: PendingFile[] = pending.filter((p) => p.error)
    // メモは、1つだけ入れるときに付ける（いくつかまとめて入れるときは、入れたあとで資料ごとに書く）
    const memoText = targets.length === 1 ? memo.trim().slice(0, MAX_MEMO) : ''
    let saved = 0
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]
      setBusy(`保存しています…（${i + 1}／${targets.length}）`)
      try {
        const id = nanoid()
        const up = await uploadDoc({ patientId: patient.id, docId: id, file: p.file })
        const now = new Date().toISOString()
        saveKarteDoc({
          id,
          patientId: patient.id,
          kind: 'file',
          category: p.category,
          title: (p.title.trim() || titleFromFileName(p.file.name)).slice(0, MAX_TITLE),
          memo: memoText,
          fileName: p.file.name.slice(0, 200),
          ext: up.ext,
          bytes: up.bytes,
          storagePath: up.storagePath,
          addedDate: jstToday(),
          createdAt: now,
          updatedAt: now,
        })
        saved += 1
      } catch (e) {
        left.push({ ...p, error: e instanceof Error ? e.message : '保存できませんでした' })
      }
    }
    setBusy('')
    if (saved > 0) onUpdate()
    if (left.length === 0) {
      reset()
      setNotice(`${saved}件の資料を入れました。`)
    } else {
      setPending(left)
      setError(saved > 0 ? `${saved}件は入れました。下の${left.length}件は入れられませんでした。` : '入れられませんでした。下の理由を確かめてください。')
    }
  }

  function saveLink() {
    const check = normalizeDocUrl(linkUrl)
    if (!check.ok) {
      setError(check.error)
      return
    }
    if (docs.some((d) => d.url === check.url)) {
      setError('同じリンクが、もうこのカルテに入っています。')
      return
    }
    const now = new Date().toISOString()
    saveKarteDoc({
      id: nanoid(),
      patientId: patient.id,
      kind: 'link',
      category,
      title: (linkTitle.trim() || check.title).slice(0, MAX_TITLE),
      memo: memo.trim().slice(0, MAX_MEMO),
      url: check.url,
      addedDate: jstToday(),
      createdAt: now,
      updatedAt: now,
    })
    reset()
    setNotice('リンクを入れました。')
    onUpdate()
  }

  function addExisting(src: KarteDoc) {
    saveKarteDoc(copyDocFor(src, patient.id, nanoid(), new Date().toISOString(), jstToday()))
    setNotice(`「${src.title}」をこのカルテに入れました。`)
    onUpdate()
  }

  async function remove(doc: KarteDoc) {
    const shared = isFileShared(doc, getKarteDocs())
    const tail = doc.kind === 'link' ? '' : shared ? '（ほかのカルテでも使っている資料なので、ファイルは残ります）' : '（クラウドのファイルも消えます）'
    if (!window.confirm(`「${doc.title}」をこのカルテから削除しますか？${tail}`)) return
    if (doc.kind === 'file' && doc.storagePath && !shared) {
      try {
        await deleteDocFile(doc.storagePath)
      } catch (e) {
        // クラウド側で既に無い場合も、カルテの記録は消す
        console.warn('資料の削除', e)
      }
    }
    deleteKarteDoc(doc.id)
    setNotice('')
    onUpdate()
  }

  function saveEdit(doc: KarteDoc) {
    if (!editing) return
    saveKarteDoc({
      ...doc,
      title: (editing.title.trim() || doc.title).slice(0, MAX_TITLE),
      category: editing.category,
      memo: editing.memo.trim().slice(0, MAX_MEMO),
      updatedAt: new Date().toISOString(),
    })
    setEditing(null)
    onUpdate()
  }

  const okCount = pending.filter((p) => !p.error).length

  return (
    <div className="space-y-4">
      {/* ── 入れる ── */}
      <Card
        className={cn('space-y-3 p-4', dragOver && 'ring-2 ring-teal-500')}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            pickFiles(e.dataTransfer.files)
          }}
          className="space-y-3"
        >
          <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <Paperclip className="h-4 w-4 text-teal-700" aria-hidden />
            資料を入れる（論文・リハビリプロトコルなど）
          </p>
          <div className="flex flex-wrap gap-2">
            {/* スマホでは display:none の入力を click() で開けないことがあるため、<label> で直接開く（入力は sr-only） */}
            <label className={cn(buttonVariants({ size: 'sm' }), 'cursor-pointer')}>
              <Upload className="h-4 w-4" aria-hidden />
              ファイルを選ぶ（PDF など）
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={DOC_ACCEPT}
                className="sr-only"
                onChange={(e) => pickFiles(e.target.files)}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                reset()
                setMode('link')
              }}
            >
              <Link2 className="h-4 w-4" aria-hidden />
              リンク（URL・DOI）を入れる
            </Button>
            {others.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  reset()
                  setMode('reuse')
                }}
              >
                <Files className="h-4 w-4" aria-hidden />
                ほかのカルテの資料から選ぶ（{others.length}）
              </Button>
            )}
          </div>

          {/* ファイル */}
          {mode === 'files' && pending.length > 0 && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <ul className="space-y-2">
                {pending.map((p) => (
                  <li key={p.key} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-xs text-slate-500">
                          {p.file.name}（{formatBytes(p.file.size)}）
                        </p>
                        {p.error ? (
                          <p role="alert" className="mt-1 text-sm font-bold text-amber-900">
                            {p.error}
                          </p>
                        ) : (
                          <div className="mt-1 flex flex-wrap gap-2">
                            <input
                              value={p.title}
                              maxLength={MAX_TITLE}
                              onChange={(e) => setPending((prev) => prev.map((x) => (x.key === p.key ? { ...x, title: e.target.value } : x)))}
                              placeholder="題名"
                              aria-label={`${p.file.name} の題名`}
                              className={cn(field, 'min-w-0 flex-1 basis-56')}
                            />
                            <select
                              value={p.category}
                              onChange={(e) => setPending((prev) => prev.map((x) => (x.key === p.key ? { ...x, category: e.target.value as KarteDocCategory } : x)))}
                              aria-label={`${p.file.name} の種類`}
                              className={cn(field, 'w-auto bg-white')}
                            >
                              {DOC_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(busy)}
                        onClick={() => setPending((prev) => prev.filter((x) => x.key !== p.key))}
                      >
                        外す
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {okCount === 1 ? (
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value.slice(0, MAX_MEMO))}
                  rows={2}
                  placeholder="メモ（任意）。例：術後12週までの荷重と可動域の進め方。主治医の指示を優先"
                  aria-label="メモ"
                  className={cn(field, 'resize-none py-2')}
                />
              ) : (
                okCount > 1 && <p className="text-xs text-slate-600">メモは、入れたあとで、えんぴつのボタンから資料ごとに書けます。</p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {busy && <span className="mr-auto text-sm text-slate-700">{busy}</span>}
                <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={reset}>
                  やめる
                </Button>
                <Button size="sm" disabled={Boolean(busy) || okCount === 0} onClick={saveFiles}>
                  {busy ? '保存中…' : `カルテに入れる${okCount > 1 ? `（${okCount}件）` : ''}`}
                </Button>
              </div>
            </div>
          )}

          {/* リンク */}
          {mode === 'link' && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <label className="block text-sm">
                <span className="font-bold text-slate-700">リンク（URL・DOI・PMID）</span>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  inputMode="url"
                  autoCapitalize="none"
                  placeholder="例：https://pubmed.ncbi.nlm.nih.gov/19589822/　または　10.1136/bmj.b2684"
                  className={cn(field, 'mt-1')}
                />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-slate-700">題名（任意）</span>
                <input
                  value={linkTitle}
                  maxLength={MAX_TITLE}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="例：足関節捻挫の再発とバランス運動（Hupperets 2009）"
                  className={cn(field, 'mt-1')}
                />
              </label>
              <CategoryChips value={category} onChange={setCategory} />
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value.slice(0, MAX_MEMO))}
                rows={2}
                placeholder="メモ（任意）。例：この方の再発予防の説明に使う"
                className={cn(field, 'resize-none py-2')}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={reset}>
                  やめる
                </Button>
                <Button size="sm" onClick={saveLink}>
                  カルテに入れる
                </Button>
              </div>
            </div>
          )}

          {/* ほかのカルテの資料 */}
          {mode === 'reuse' && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                ほかのカルテに入れた論文・リハビリプロトコルです。えらぶと、同じ資料がこのカルテにも入ります（ファイルは送り直しません）。
              </p>
              {others.length > 6 && (
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="題名でさがす" aria-label="題名でさがす" className={field} />
              )}
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {shownOthers.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
                    <DocIcon doc={d} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-bold text-slate-900">{d.title}</p>
                      <p className="text-xs text-slate-500">
                        {docCategoryLabel(d.category)}・{docTypeLabel(d)}
                        {d.kind === 'file' ? `・${formatBytes(d.bytes)}` : `・${hostOf(d.url)}`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addExisting(d)}>
                      このカルテに入れる
                    </Button>
                  </li>
                ))}
                {shownOthers.length === 0 && <li className="py-3 text-center text-sm text-slate-600">見つかりません</li>}
              </ul>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={reset}>
                  閉じる
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-bold text-amber-900">
              {error}
            </p>
          )}
          {notice && !error && (
            <p role="status" className="text-sm font-bold text-teal-800">
              {notice}
            </p>
          )}
          <p className="text-xs text-slate-500">
            PDF・画像（JPEG・PNG）・Word・Excel・PowerPoint を、1つ {formatBytes(MAX_DOC_BYTES)} まで入れられます
            <span className="max-lg:hidden">（この枠にファイルを落としても入ります）</span>
            。クラウド（非公開）に保存し、院内アプリにログインした人だけが見られます。
          </p>
        </div>
      </Card>

      {/* ── 一覧（種類ごと） ── */}
      {docs.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">まだ資料がありません</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.category} aria-label={g.label}>
              <h3 className="mb-2 px-1 text-xs font-bold text-slate-600">
                {g.label}（{g.docs.length}件）
              </h3>
              <ul className="space-y-2">
                {g.docs.map((d) => {
                  const isEditing = editing?.id === d.id
                  return (
                    <li key={d.id}>
                      <Card className="p-3">
                        <div className="flex flex-wrap items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                            <DocIcon doc={d} />
                          </span>
                          <div className="min-w-0 flex-1 basis-48">
                            {isEditing && editing ? (
                              <div className="space-y-2">
                                <input
                                  value={editing.title}
                                  maxLength={MAX_TITLE}
                                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                  aria-label="題名"
                                  className={field}
                                />
                                <CategoryChips value={editing.category} onChange={(v) => setEditing({ ...editing, category: v })} />
                                <textarea
                                  value={editing.memo}
                                  onChange={(e) => setEditing({ ...editing, memo: e.target.value.slice(0, MAX_MEMO) })}
                                  rows={3}
                                  placeholder="メモ（任意）"
                                  aria-label="メモ"
                                  className={cn(field, 'resize-none py-2')}
                                />
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                                    やめる
                                  </Button>
                                  <Button size="sm" onClick={() => saveEdit(d)}>
                                    保存
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="break-words text-sm font-bold text-slate-900">{d.title}</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {docTypeLabel(d)}
                                  {d.kind === 'file' ? (formatBytes(d.bytes) ? `・${formatBytes(d.bytes)}` : '') : hostOf(d.url) ? `・${hostOf(d.url)}` : ''}
                                  ・{d.addedDate} に追加
                                </p>
                                {d.memo && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{d.memo}</p>}
                              </>
                            )}
                          </div>
                          {!isEditing && (
                            <div className="flex shrink-0 items-center gap-1.5">
                              {d.kind === 'link' && d.url ? (
                                <a href={d.url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                                  <ExternalLink className="h-4 w-4" aria-hidden />
                                  開く
                                </a>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => setViewing(d)}>
                                  開く
                                </Button>
                              )}
                              <Button
                                size="icon-sm"
                                variant="outline"
                                aria-label={`「${d.title}」の題名・種類・メモを直す`}
                                title="題名・種類・メモを直す"
                                onClick={() => setEditing({ id: d.id, title: d.title, category: d.category, memo: d.memo })}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button size="icon-sm" variant="ghost" aria-label={`「${d.title}」を削除`} title="削除" onClick={() => remove(d)}>
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {viewing && <DocViewer key={viewing.id} doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

/** ファイルを開く（PDF・画像は画面の中で。スマホ・タブレットと Word などは、別の画面・端末のアプリで） */
function DocViewer({ doc, onClose }: { doc: KarteDoc; onClose: () => void }) {
  const view = docView(doc)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchDocUrl(doc, view === 'download')
      .then((u) => {
        if (alive) setUrl(u)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : '開けませんでした')
      })
    return () => {
      alive = false
    }
  }, [doc, view])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const openLabel = view === 'download' ? `端末に保存して開く（${docTypeLabel(doc)}）` : '資料を開く'
  const bigLink = 'inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-base font-bold text-slate-900 hover:bg-slate-100'

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-900/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-white">
        <p className="min-w-0 flex-1 basis-40 break-words text-sm font-bold">{doc.title}</p>
        {url && view !== 'download' && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            // 指で操作する端末の PDF は、まん中の大きな「資料を開く」があるので、ここには出さない
            className={cn(
              'items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25 max-lg:min-h-10',
              view === 'pdf' ? 'hidden pointer-fine:inline-flex' : 'inline-flex',
            )}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            別の画面で開く
          </a>
        )}
        <button type="button" onClick={onClose} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25 max-lg:min-h-10">
          閉じる
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-2">
        {error ? (
          <p role="alert" className="max-w-md rounded-xl bg-white px-4 py-3 text-sm text-slate-800">
            資料を開けませんでした（{error}）。通信を確かめて、もう一度お試しください。
          </p>
        ) : !url ? (
          <p className="text-sm text-white/80">読み込んでいます…</p>
        ) : view === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={doc.title} className="max-h-full max-w-full object-contain" />
        ) : view === 'pdf' ? (
          <>
            {/* マウスの端末（パソコン）：画面の中で見る */}
            <iframe src={url} title={doc.title} className="hidden h-full w-full rounded-lg bg-white pointer-fine:block" />
            {/* 指で操作する端末：PDF は画面の中だと1ページ目しか出ないことがあるので、別の画面で開く */}
            <div className="space-y-3 text-center pointer-fine:hidden">
              <a href={url} target="_blank" rel="noopener noreferrer" className={bigLink}>
                <ExternalLink className="h-5 w-5" aria-hidden />
                {openLabel}
              </a>
              <p className="text-sm text-white/80">スマホ・タブレットでは、別の画面で開きます。</p>
            </div>
          </>
        ) : (
          <div className="space-y-3 text-center">
            <a href={url} className={bigLink}>
              <ExternalLink className="h-5 w-5" aria-hidden />
              {openLabel}
            </a>
            <p className="text-sm text-white/80">この形式は、端末のアプリ（Word など）で開きます。</p>
          </div>
        )}
      </div>
    </div>
  )
}
