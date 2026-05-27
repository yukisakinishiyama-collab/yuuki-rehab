'use client'

/**
 * VideoUpload
 * 複数ファイルの同時選択・ドラッグ＆ドロップに対応したアップロードUI。
 * 各ファイルごとにラベル・動作種別・撮影方向を個別設定し、一括または個別登録が可能。
 */

import { useState, useRef } from 'react'
import { addVideoToCase, getCurrentUser, generateId, saveVideoUrl } from '@/lib/rehab-store'
import { saveVideoBlob } from '@/lib/video-db'
import type { CaseVideo, MovementType, VideoDirection } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, VIDEO_DIRECTION_LABELS } from '@/types/rehab'
import { Upload, X, Film, Camera, CheckCircle, Loader2, Plus } from 'lucide-react'

interface Props {
  caseId: string
  onUploaded: () => void
}

interface QueueItem {
  id: string
  file: File
  preview: string
  label: string
  direction: VideoDirection
  movementType: MovementType
  status: 'pending' | 'saving' | 'done' | 'error'
}

export default function VideoUpload({ caseId, onUploaded }: Props) {
  const user = getCurrentUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [savingAll, setSavingAll] = useState(false)

  // ── ファイル追加 ──────────────────────────────────────────────────────────────
  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('video/'))
    if (arr.length === 0) return
    const newItems: QueueItem[] = arr.map((f) => ({
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      file: f,
      preview: URL.createObjectURL(f),
      label: '',
      direction: 'front' as VideoDirection,
      movementType: 'walking' as MovementType,
      status: 'pending',
    }))
    setQueue((prev) => [...prev, ...newItems])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }

  function removeItem(id: string) {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((q) => q.id !== id)
    })
  }

  function updateItem(
    id: string,
    patch: Partial<Pick<QueueItem, 'label' | 'direction' | 'movementType'>>,
  ) {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  // ── 1件保存 ───────────────────────────────────────────────────────────────────
  async function saveOne(item: QueueItem): Promise<void> {
    if (!user) return
    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: 'saving' } : q)),
    )
    try {
      // 動画の長さを取得（既存プレビューURLを再利用）
      const duration = await new Promise<number>((resolve) => {
        const v = document.createElement('video')
        v.src = item.preview
        v.onloadedmetadata = () => resolve(Math.round(v.duration))
        v.onerror = () => resolve(0)
      })

      const videoId = generateId('video')
      await saveVideoBlob(videoId, item.file)
      saveVideoUrl(videoId, item.preview)

      const video: CaseVideo = {
        id: videoId,
        caseId,
        label: item.label || item.file.name,
        direction: item.direction,
        movementType: item.movementType,
        tags: [
          MOVEMENT_TYPE_LABELS[item.movementType],
          VIDEO_DIRECTION_LABELS[item.direction],
        ],
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id,
        fileName: item.file.name,
        duration,
      }
      addVideoToCase(caseId, video)
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'done' } : q)),
      )
    } catch {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'error' } : q)),
      )
    }
  }

  // ── 全件保存 ──────────────────────────────────────────────────────────────────
  async function handleSaveAll() {
    const pending = queue.filter((q) => q.status === 'pending')
    if (pending.length === 0) return
    setSavingAll(true)
    for (const item of pending) {
      await saveOne(item)
    }
    setSavingAll(false)
    // 完了済みを削除してコールバック
    setQueue((prev) => prev.filter((q) => q.status !== 'done'))
    onUploaded()
  }

  const pendingCount = queue.filter((q) => q.status === 'pending').length
  const doneCount = queue.filter((q) => q.status === 'done').length
  const savingCount = queue.filter((q) => q.status === 'saving').length

  return (
    <div className="space-y-5">

      {/* ── アップロードエリア ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* カメラ撮影（モバイル） */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 border-2 border-[#0d9488] bg-teal-50 hover:bg-teal-100 rounded-xl p-5 transition-colors"
        >
          <Camera className="w-8 h-8 text-[#0d9488]" />
          <div className="text-left">
            <p className="text-sm font-semibold text-[#0d9488]">カメラで撮影</p>
            <p className="text-xs text-teal-600 mt-0.5">スマートフォンで直接録画</p>
          </div>
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />

        {/* ファイル選択（複数可） */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-[#0d9488] bg-teal-50'
              : 'border-gray-300 hover:border-[#0d9488] hover:bg-gray-50'
          }`}
        >
          <Upload className="w-9 h-9 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">
            ファイルから選択 / ドラッグ＆ドロップ
          </p>
          <p className="text-xs text-gray-400 mt-1">
            <span className="font-medium text-[#0d9488]">複数ファイル同時選択対応</span>
            　·　MP4, MOV, AVI（各最大 500MB）
          </p>
          <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-500">
            <Plus className="w-3 h-3" />
            ファイルを追加
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </label>
      </div>

      {/* ── キュー一覧 ────────────────────────────────────────────────────── */}
      {queue.length > 0 && (
        <div className="space-y-3">
          {/* ヘッダー行 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-gray-700">登録待ち</span>
              <span className="px-2 py-0.5 bg-[#0d9488] text-white rounded-full text-xs font-medium">
                {pendingCount}件
              </span>
              {savingCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  保存中 {savingCount}件
                </span>
              )}
              {doneCount > 0 && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  完了 {doneCount}件
                </span>
              )}
            </div>

            <button
              onClick={handleSaveAll}
              disabled={savingAll || pendingCount === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {savingAll
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Upload className="w-3.5 h-3.5" />
              }
              {savingAll ? '登録中...' : `全て登録（${pendingCount}件）`}
            </button>
          </div>

          {/* キューアイテム */}
          {queue.map((item) => (
            <div
              key={item.id}
              className={`border rounded-xl p-3 transition-all ${
                item.status === 'done'    ? 'bg-green-50 border-green-200 opacity-70' :
                item.status === 'error'   ? 'bg-red-50 border-red-200' :
                item.status === 'saving'  ? 'bg-blue-50 border-blue-200' :
                'bg-white border-gray-200 shadow-sm'
              }`}
            >
              <div className="flex gap-3">
                {/* サムネイル */}
                <div className="w-28 h-20 rounded-lg overflow-hidden bg-black flex-shrink-0">
                  <video
                    src={item.preview}
                    className="w-full h-full object-contain"
                    muted
                    preload="metadata"
                  />
                </div>

                {/* フォーム */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* ラベル + 削除/ステータス */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={item.file.name}
                      value={item.label}
                      onChange={(e) => updateItem(item.id, { label: e.target.value })}
                      disabled={item.status !== 'pending'}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] disabled:opacity-60 disabled:bg-gray-50"
                    />
                    {item.status === 'pending' && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                        title="削除"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {item.status === 'saving' && (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                    )}
                    {item.status === 'done' && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <span className="text-xs text-red-500 flex-shrink-0">エラー</span>
                    )}
                  </div>

                  {/* 動作種別 + 撮影方向 */}
                  <div className="flex gap-2">
                    <select
                      value={item.movementType}
                      onChange={(e) =>
                        updateItem(item.id, { movementType: e.target.value as MovementType })
                      }
                      disabled={item.status !== 'pending'}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] disabled:opacity-60 disabled:bg-gray-50"
                    >
                      {(Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[]).map((mt) => (
                        <option key={mt} value={mt}>
                          {MOVEMENT_TYPE_LABELS[mt]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={item.direction}
                      onChange={(e) =>
                        updateItem(item.id, { direction: e.target.value as VideoDirection })
                      }
                      disabled={item.status !== 'pending'}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] disabled:opacity-60 disabled:bg-gray-50"
                    >
                      {(Object.keys(VIDEO_DIRECTION_LABELS) as VideoDirection[]).map((d) => (
                        <option key={d} value={d}>
                          {VIDEO_DIRECTION_LABELS[d]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ファイル情報 */}
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Film className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{item.file.name}</span>
                    <span className="ml-auto flex-shrink-0">
                      {(item.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 完了後のクリアボタン */}
          {doneCount > 0 && pendingCount === 0 && (
            <button
              onClick={() => {
                setQueue([])
                onUploaded()
              }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              完了済みをクリアして動画一覧へ
            </button>
          )}
        </div>
      )}
    </div>
  )
}
