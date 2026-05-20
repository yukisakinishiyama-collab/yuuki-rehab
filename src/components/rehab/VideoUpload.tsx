'use client'

import { useState, useRef } from 'react'
import { addVideoToCase, getCurrentUser, generateId, saveVideoUrl } from '@/lib/rehab-store'
import type { CaseVideo, MovementType, VideoDirection } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, VIDEO_DIRECTION_LABELS } from '@/types/rehab'
import { Upload, X, Film } from 'lucide-react'

interface Props {
  caseId: string
  onUploaded: () => void
}

export default function VideoUpload({ caseId, onUploaded }: Props) {
  const user = getCurrentUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [form, setForm] = useState({
    label: '',
    direction: 'front' as VideoDirection,
    movementType: 'walking' as MovementType,
  })
  const [saving, setSaving] = useState(false)

  function handleFile(f: File) {
    if (!f.type.startsWith('video/')) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleSave() {
    if (!file || !user || !preview) return
    setSaving(true)

    // Get duration from already-created preview URL (reuse, don't create a second blob URL)
    const duration = await new Promise<number>((resolve) => {
      const v = document.createElement('video')
      v.src = preview
      v.onloadedmetadata = () => resolve(Math.round(v.duration))
      v.onerror = () => resolve(0)
    })

    const videoId = generateId('video')
    saveVideoUrl(videoId, preview)

    const video: CaseVideo = {
      id: videoId,
      caseId,
      label: form.label || file.name,
      direction: form.direction,
      movementType: form.movementType,
      tags: [MOVEMENT_TYPE_LABELS[form.movementType], VIDEO_DIRECTION_LABELS[form.direction]],
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.id,
      fileName: file.name,
      duration,
    }
    addVideoToCase(caseId, video)
    setSaving(false)
    setFile(null)
    setPreview('')
    onUploaded()
  }

  return (
    <div className="space-y-4">
      {!file ? (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-[#0d9488] bg-teal-50' : 'border-gray-300 hover:border-[#0d9488] hover:bg-gray-50'
          }`}
        >
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">
            動画ファイルをドラッグ＆ドロップ
          </p>
          <p className="text-xs text-gray-400 mt-1">または クリックしてファイルを選択</p>
          <p className="text-xs text-gray-400 mt-0.5">MP4, MOV, AVI（最大 500MB）</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              src={preview}
              controls
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => { setFile(null); setPreview('') }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">ラベル</label>
              <input
                type="text"
                placeholder={file.name}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">動作の種類</label>
              <select
                value={form.movementType}
                onChange={(e) => setForm({ ...form, movementType: e.target.value as MovementType })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              >
                {(Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[]).map((mt) => (
                  <option key={mt} value={mt}>{MOVEMENT_TYPE_LABELS[mt]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">撮影方向</label>
              <select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value as VideoDirection })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              >
                {(Object.keys(VIDEO_DIRECTION_LABELS) as VideoDirection[]).map((d) => (
                  <option key={d} value={d}>{VIDEO_DIRECTION_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Film className="w-3.5 h-3.5" />
                {file.name}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setFile(null); setPreview('') }}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#0d9488] hover:bg-[#0b8276] text-white font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              {saving ? '登録中...' : '動画を登録'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
