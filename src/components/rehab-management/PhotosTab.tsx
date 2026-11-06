'use client'
// ──────────────────────────────────────────────
// 患部の写真タブ
// スマホのカメラで撮った写真を、日付・部位・説明つきでカルテに残す。
// 写真はクラウド（非公開）に置き、端末には場所と説明だけを持つ（photo-storage-server.ts / photo-client.ts）。
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { BodyRegion, KartePhoto, Patient } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'
import { deleteKartePhoto, saveKartePhoto } from '@/lib/patient-store'
import { deletePhotoFile, photoUrl, resizePhoto, uploadPhoto } from '@/lib/karte/photo-client'
import { ClearTextButton, CLEARABLE_PADDING } from './shared'

type Props = {
  patient: Patient
  photos: KartePhoto[]
  onUpdate: () => void
}

const REGIONS = Object.keys(BODY_REGION_LABELS).filter(k => k !== 'functional') as BodyRegion[]
const today = () => new Date().toISOString().split('T')[0]

export default function PhotosTab({ patient, photos, onUpdate }: Props) {
  const [date, setDate] = useState(today())
  const [region, setRegion] = useState<BodyRegion>(patient.bodyRegion)
  const [caption, setCaption] = useState('')
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<KartePhoto | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.preview) }, [pending])

  function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    setPending(prev => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return { file, preview: URL.createObjectURL(file) }
    })
  }

  async function save() {
    if (!pending || busy) return
    setBusy(true)
    setError(null)
    try {
      const resized = await resizePhoto(pending.file)
      const id = nanoid()
      const { storagePath, bytes } = await uploadPhoto({ patientId: patient.id, photoId: id, blob: resized.blob })
      saveKartePhoto({
        id,
        patientId: patient.id,
        takenDate: date,
        storagePath,
        caption: caption.trim(),
        bodyRegion: region,
        width: resized.width,
        height: resized.height,
        bytes,
        createdAt: new Date().toISOString(),
      })
      URL.revokeObjectURL(pending.preview)
      setPending(null)
      setCaption('')
      if (cameraRef.current) cameraRef.current.value = ''
      if (fileRef.current) fileRef.current.value = ''
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function remove(photo: KartePhoto) {
    if (!window.confirm(`${photo.takenDate} の写真を削除しますか？（クラウドからも消えます）`)) return
    try {
      await deletePhotoFile(photo.storagePath)
    } catch (e) {
      // クラウド側で既に無い場合も、カルテの記録は消す
      console.warn('写真の削除', e)
    }
    deleteKartePhoto(photo.id)
    setViewing(null)
    onUpdate()
  }

  function updateCaption(photo: KartePhoto, next: string) {
    saveKartePhoto({ ...photo, caption: next })
    onUpdate()
  }

  const sorted = [...photos].sort((a, b) => b.takenDate.localeCompare(a.takenDate) || b.createdAt.localeCompare(a.createdAt))
  const byDate: Record<string, KartePhoto[]> = {}
  for (const p of sorted) (byDate[p.takenDate] ??= []).push(p)

  return (
    <div className="space-y-4">
      {/* 撮る・選ぶ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <span className="block text-sm font-semibold text-gray-700">📷 患部の写真を残す</span>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => pick(e.target.files?.[0])} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 max-lg:min-h-10"
          >
            カメラで撮る
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 max-lg:min-h-10"
          >
            写真を選ぶ
          </button>
        </div>

        {pending && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.preview} alt="撮った写真" className="max-h-72 w-auto rounded-lg border border-gray-200 object-contain" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 text-xs text-gray-500 max-lg:min-h-10">
                日付
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </label>
              <label className="flex items-center gap-3 text-xs text-gray-500 max-lg:min-h-10">
                部位
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value as BodyRegion)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {REGIONS.map(r => (
                    <option key={r} value={r}>{BODY_REGION_LABELS[r]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="relative">
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, 300))}
                placeholder="説明（任意）。例：右膝 内側の腫脹。前回より引いている"
                rows={2}
                className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none ${CLEARABLE_PADDING}`}
              />
              <ClearTextButton value={caption} onChange={setCaption} multiline />
            </div>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { URL.revokeObjectURL(pending.preview); setPending(null) }}
                className="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 max-lg:min-h-10"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="px-4 py-1.5 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 disabled:opacity-40 max-lg:min-h-10"
              >
                {busy ? '保存中…' : 'カルテに保存'}
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">写真は縮小してクラウド（非公開）に保存します。院内アプリにログインした人だけが見られます。</p>
      </div>

      {/* 一覧（日付ごと） */}
      {sorted.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">まだ写真がありません</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDate).map(([d, list]) => (
            <div key={d}>
              <p className="text-xs font-semibold text-gray-600 px-1 mb-2">{d}（{list.length}枚）</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {list.map(p => (
                  <button key={p.id} type="button" onClick={() => setViewing(p)} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 max-lg:min-h-10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl(p.storagePath)} alt={p.caption || '患部の写真'} loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-xs text-white truncate">
                      {p.bodyRegion ? BODY_REGION_LABELS[p.bodyRegion] : ''}{p.caption ? ` ${p.caption}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 拡大表示 */}
      {viewing && (
        <PhotoViewer
          key={viewing.id}
          photo={viewing}
          onClose={() => setViewing(null)}
          onDelete={() => remove(viewing)}
          onCaption={next => { updateCaption(viewing, next); setViewing({ ...viewing, caption: next }) }}
        />
      )}
    </div>
  )
}

function PhotoViewer({ photo, onClose, onDelete, onCaption }: {
  photo: KartePhoto
  onClose: () => void
  onDelete: () => void
  onCaption: (next: string) => void
}) {
  const [caption, setCaption] = useState(photo.caption)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm">
          {photo.takenDate}{photo.bodyRegion ? ` · ${BODY_REGION_LABELS[photo.bodyRegion]}` : ''}
        </span>
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg bg-white/15 hover:bg-white/25 max-lg:min-h-10">閉じる</button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(photo.storagePath)} alt={photo.caption || '患部の写真'} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="px-4 py-3 space-y-2 bg-black/60">
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value.slice(0, 300))}
          onBlur={() => { if (caption !== photo.caption) onCaption(caption.trim()) }}
          placeholder="説明を書く（自動で保存）"
          rows={2}
          className="w-full rounded-lg bg-white/95 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
        />
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>{photo.width}×{photo.height} · {Math.round(photo.bytes / 1024)}KB</span>
          <button type="button" onClick={onDelete} className="px-3 py-1.5 rounded-lg text-red-200 hover:bg-white/10 max-lg:min-h-10">削除</button>
        </div>
      </div>
    </div>
  )
}
