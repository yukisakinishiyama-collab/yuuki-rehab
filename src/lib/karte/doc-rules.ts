// ──────────────────────────────────────────────
// カルテの資料の決まり（純粋な関数。画面・API・テストから使う）
//
// - 入れられるファイル：PDF・画像（JPEG/PNG/WebP）・Word・Excel・PowerPoint。1つ 20MB まで
// - 保存場所：<最初に入れたカルテのID>/<資料のID>.<拡張子>（クラウドの非公開の保存場所 karte-docs）
// - リンク：http(s) の URL。DOI（10.xxxx/…）と PMID は、doi.org・PubMed の URL に直す
// - ほかのカルテに入れた論文・プロトコルは、もう一度送らずにこのカルテへ入れられる（同じ保存場所を指す）。
//   医療機関の書類・問診票・その他は、その方だけの書類なので、ほかのカルテには出さない
// - ファイルを消すのは、同じ保存場所を指す資料がほかに無いときだけ
// ──────────────────────────────────────────────
import type { KarteDoc, KarteDocCategory } from '@/types/karte-docs'

export const DOCS_KEY = 'pt_karte_docs'
/** 1つのファイルの上限 */
export const MAX_DOC_BYTES = 20 * 1024 * 1024
/** 院内アプリの API を通して送れる大きさ（これより大きいものは、クラウドへ直接送る） */
export const API_UPLOAD_MAX_BYTES = 4 * 1024 * 1024
export const MAX_TITLE = 120
export const MAX_MEMO = 1000

export const DOC_CATEGORIES: { value: KarteDocCategory; label: string }[] = [
  { value: 'paper', label: '論文' },
  { value: 'protocol', label: 'リハビリプロトコル' },
  { value: 'medical', label: '医療機関の書類' },
  { value: 'intake', label: '問診票' },
  { value: 'other', label: 'その他' },
]

export function docCategoryLabel(c: KarteDocCategory | undefined): string {
  return DOC_CATEGORIES.find((x) => x.value === c)?.label ?? 'その他'
}

/** 開き方：pdf＝画面の中で見られる／image＝画像／download＝端末のアプリで開く（Word など） */
export type DocView = 'pdf' | 'image' | 'download'

export interface DocType {
  /** 保存するときの拡張子（jpeg は jpg にそろえる） */
  ext: string
  mime: string
  label: string
  view: DocView
}

const OOXML = 'application/vnd.openxmlformats-officedocument'
const TYPES: Record<string, DocType> = {
  pdf: { ext: 'pdf', mime: 'application/pdf', label: 'PDF', view: 'pdf' },
  jpg: { ext: 'jpg', mime: 'image/jpeg', label: '画像', view: 'image' },
  jpeg: { ext: 'jpg', mime: 'image/jpeg', label: '画像', view: 'image' },
  png: { ext: 'png', mime: 'image/png', label: '画像', view: 'image' },
  webp: { ext: 'webp', mime: 'image/webp', label: '画像', view: 'image' },
  docx: { ext: 'docx', mime: `${OOXML}.wordprocessingml.document`, label: 'Word', view: 'download' },
  doc: { ext: 'doc', mime: 'application/msword', label: 'Word', view: 'download' },
  xlsx: { ext: 'xlsx', mime: `${OOXML}.spreadsheetml.sheet`, label: 'Excel', view: 'download' },
  xls: { ext: 'xls', mime: 'application/vnd.ms-excel', label: 'Excel', view: 'download' },
  pptx: { ext: 'pptx', mime: `${OOXML}.presentationml.presentation`, label: 'PowerPoint', view: 'download' },
  ppt: { ext: 'ppt', mime: 'application/vnd.ms-powerpoint', label: 'PowerPoint', view: 'download' },
}

/** ファイルを選ぶ画面に出す形式 */
export const DOC_ACCEPT = Object.keys(TYPES)
  .map((e) => `.${e}`)
  .join(',')
/** 保存場所が受けつける形式（クラウドの保存場所の設定にも使う） */
export const DOC_MIME_TYPES = [...new Set(Object.values(TYPES).map((t) => t.mime))]

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const PATH_RE = new RegExp(`^[A-Za-z0-9_-]{1,64}/[A-Za-z0-9_-]{1,64}\\.(${[...new Set(Object.values(TYPES).map((t) => t.ext))].join('|')})$`)

export function isValidDocId(id: string): boolean {
  return ID_RE.test(id)
}

export function isValidDocPath(path: string): boolean {
  return PATH_RE.test(path)
}

export function extOf(fileName: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(fileName.trim())
  return m ? m[1].toLowerCase() : ''
}

export function docTypeOf(fileNameOrExt: string): DocType | null {
  const key = fileNameOrExt.includes('.') ? extOf(fileNameOrExt) : fileNameOrExt.toLowerCase()
  return TYPES[key] ?? null
}

export function formatBytes(n: number | undefined): string {
  if (!n || n <= 0) return ''
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))}KB` : `${(n / (1024 * 1024)).toFixed(1)}MB`
}

export type DocFileCheck = { ok: true; type: DocType } | { ok: false; error: string }

/** 入れられるファイルか（形式と大きさ） */
export function checkDocFile(fileName: string, bytes: number): DocFileCheck {
  const ext = extOf(fileName)
  const type = TYPES[ext]
  if (!type) {
    const heic = ext === 'heic' || ext === 'heif'
    return {
      ok: false,
      error: heic
        ? 'iPhone の写真の形式（HEIC）は入れられません。JPEG か PDF にしてから入れてください。'
        : `この形式${ext ? `（.${ext}）` : ''}は入れられません。PDF・画像（JPEG・PNG）・Word・Excel・PowerPoint のファイルを選んでください。`,
    }
  }
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: '中身が空のファイルです。' }
  if (bytes > MAX_DOC_BYTES) {
    return { ok: false, error: `ファイルが大きすぎます（${formatBytes(bytes)}）。1つ ${formatBytes(MAX_DOC_BYTES)} までです。` }
  }
  return { ok: true, type }
}

export function docStoragePath(patientId: string, docId: string, ext: string): string {
  return `${patientId}/${docId}.${ext}`
}

/** ファイル名から題名（拡張子を取る） */
export function titleFromFileName(fileName: string): string {
  const base = fileName.trim().replace(/\.[A-Za-z0-9]{1,8}$/, '')
  return (base.normalize('NFC').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || '資料').slice(0, MAX_TITLE)
}

/** ファイル名から種類の見当（「プロトコル」が入っていればプロトコル。ほかは論文） */
export function guessCategory(fileName: string): KarteDocCategory {
  if (/プロトコル|protocol|クリニカルパス|リハビリ計画/i.test(fileName)) return 'protocol'
  if (/問診/.test(fileName)) return 'intake'
  if (/紹介状|診療情報|手術記録|指示書|検査結果|報告書/.test(fileName)) return 'medical'
  return 'paper'
}

export type DocUrlCheck = { ok: true; url: string; title: string } | { ok: false; error: string }

/** リンクを確かめて整える（DOI・PMID は URL に直す。http・https だけ） */
export function normalizeDocUrl(raw: string): DocUrlCheck {
  const s = raw.trim()
  if (!s) return { ok: false, error: 'リンク（URL）を入れてください。' }
  if (s.length > 2000) return { ok: false, error: 'リンクが長すぎます。' }
  const doi = /^(?:doi:\s*)?(10\.\d{4,9}\/\S+)$/i.exec(s)
  if (doi) return { ok: true, url: `https://doi.org/${doi[1]}`, title: `DOI ${doi[1]}`.slice(0, MAX_TITLE) }
  const pmid = /^pmid:?\s*(\d{4,9})$/i.exec(s)
  if (pmid) return { ok: true, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}/`, title: `PubMed ${pmid[1]}` }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : /^[^\s/]+\.[^\s/]+/.test(s) ? `https://${s}` : s
  let u: URL
  try {
    u = new URL(withScheme)
  } catch {
    return { ok: false, error: 'リンクの形が正しくありません（https:// から始まる URL か、DOI を入れてください）。' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'https:// か http:// から始まるリンクだけ入れられます。' }
  if (!u.hostname.includes('.')) return { ok: false, error: 'リンクの形が正しくありません。' }
  const doiPath = u.hostname.endsWith('doi.org') ? decodeURIComponent(u.pathname.replace(/^\//, '')) : ''
  const pubmed = /pubmed\.ncbi\.nlm\.nih\.gov$/.test(u.hostname) ? /^\/(\d+)/.exec(u.pathname)?.[1] : ''
  const title = doiPath ? `DOI ${doiPath}` : pubmed ? `PubMed ${pubmed}` : u.hostname.replace(/^www\./, '')
  return { ok: true, url: u.toString(), title: title.slice(0, MAX_TITLE) }
}

/** リンクの行に出すサイト名 */
export function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : ''
  } catch {
    return ''
  }
}

export function docView(doc: Pick<KarteDoc, 'kind' | 'ext'>): DocView | 'link' {
  if (doc.kind === 'link') return 'link'
  return TYPES[doc.ext ?? '']?.view ?? 'download'
}

export function docTypeLabel(doc: Pick<KarteDoc, 'kind' | 'ext'>): string {
  if (doc.kind === 'link') return 'リンク'
  return TYPES[doc.ext ?? '']?.label ?? 'ファイル'
}

/** 端末のアプリで開くとき（Word など）のファイル名 */
export function downloadName(doc: Pick<KarteDoc, 'title' | 'ext' | 'fileName'>): string {
  const raw = [...(doc.title || doc.fileName || '資料')].filter((ch) => ch.charCodeAt(0) >= 32).join('')
  const base = raw.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '資料'
  return doc.ext && !base.toLowerCase().endsWith(`.${doc.ext}`) ? `${base}.${doc.ext}` : base
}

// ── 並べ方 ──────────────────────────────────

export function groupDocs(docs: KarteDoc[]): { category: KarteDocCategory; label: string; docs: KarteDoc[] }[] {
  return DOC_CATEGORIES.map((c) => ({
    category: c.value,
    label: c.label,
    docs: docs
      .filter((d) => (DOC_CATEGORIES.some((x) => x.value === d.category) ? d.category : 'other') === c.value)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  })).filter((g) => g.docs.length > 0)
}

// ── 同じ資料を、ほかのカルテにも ─────────────────────

/** 同じ資料かどうかを見分ける印（保存場所か URL） */
export function docKey(doc: Pick<KarteDoc, 'storagePath' | 'url'>): string {
  return doc.storagePath ? `f:${doc.storagePath}` : doc.url ? `u:${doc.url}` : ''
}

/** このファイルを指している資料が、ほかにもある（あるなら、ファイルは消さない） */
export function isFileShared(doc: KarteDoc, all: KarteDoc[]): boolean {
  if (!doc.storagePath) return false
  return all.some((d) => d.id !== doc.id && d.storagePath === doc.storagePath)
}

/**
 * ほかのカルテに入っていて、このカルテに入れられる資料（論文・リハビリプロトコルだけ。新しい順・同じ資料は1つ）。
 * 医療機関の書類・その他は、その方だけの書類のことがあるので出さない。だれのカルテの資料かも出さない
 */
export function reusableDocs(all: KarteDoc[], patientId: string): KarteDoc[] {
  const mine = new Set(all.filter((d) => d.patientId === patientId).map(docKey))
  const seen = new Set<string>()
  return all
    .filter((d) => d.patientId !== patientId && (d.category === 'paper' || d.category === 'protocol'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((d) => {
      const k = docKey(d)
      if (!k || mine.has(k) || seen.has(k)) return false
      seen.add(k)
      return true
    })
}

/** ほかのカルテの資料を、このカルテに入れる（同じ保存場所を指す新しい1件。メモは写さない＝その方についてのメモのことがあるため） */
export function copyDocFor(src: KarteDoc, patientId: string, id: string, nowIso: string, today: string): KarteDoc {
  return {
    id,
    patientId,
    kind: src.kind,
    category: src.category,
    title: src.title,
    memo: '',
    fileName: src.fileName,
    ext: src.ext,
    bytes: src.bytes,
    storagePath: src.storagePath,
    url: src.url,
    addedDate: today,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

// ── バックアップ ────────────────────────────────

/** カルテの控え（pt_karte_docs の JSON の文字列）から、ファイルの保存場所の一覧（同じ場所は1つ・形のおかしいものは除く） */
export function docFilePathsOf(raw: string | undefined | null): string[] {
  if (!raw) return []
  try {
    const list = JSON.parse(raw) as Array<{ storagePath?: unknown }>
    if (!Array.isArray(list)) return []
    const paths = list.map((d) => (typeof d?.storagePath === 'string' ? d.storagePath : '')).filter(isValidDocPath)
    return [...new Set(paths)]
  } catch {
    return []
  }
}
