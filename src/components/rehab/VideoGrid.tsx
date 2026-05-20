'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CaseVideo } from '@/types/rehab'
import { MOVEMENT_TYPE_LABELS, VIDEO_DIRECTION_LABELS } from '@/types/rehab'
import { Play, Clock, Camera, Trash2, X, AlertTriangle } from 'lucide-react'
import { removeVideoFromCase } from '@/lib/rehab-store'

interface Props {
  videos: CaseVideo[]
  caseId: string
  onDeleted?: () => void
}

export default function VideoGrid({ videos, caseId, onDeleted }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function handleDelete(videoId: string) {
    removeVideoFromCase(caseId, videoId)
    setConfirmId(null)
    onDeleted?.()
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Play className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">動画が登録されていません</p>
      </div>
    )
  }

  return (
    <>
      {/* 削除確認ダイアログ */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">動画を削除しますか？</p>
                <p className="text-xs text-gray-500 mt-0.5">コメント・評価・描き込みも一緒に削除されます</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((v) => (
          <div key={v.id} className="relative group">
            <Link
              href={`/cases/${caseId}/videos/${v.id}`}
              className="block bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-[#0d9488] transition-all overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gradient-to-br from-[#1e3a5f] to-[#0d2a47] flex items-center justify-center">
                <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Play className="w-7 h-7 text-white ml-1" />
                </div>
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-black/40 text-white backdrop-blur-sm">
                    {VIDEO_DIRECTION_LABELS[v.direction]}
                  </span>
                </div>
                {v.duration != null && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 text-white text-xs backdrop-blur-sm">
                    <Clock className="w-3 h-3" />
                    {v.duration}s
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="font-medium text-gray-900 text-sm truncate mb-1">{v.label}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {MOVEMENT_TYPE_LABELS[v.movementType]}
                  </span>
                  <span className="flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    {v.uploadedAt.slice(0, 10)}
                  </span>
                </div>
              </div>
            </Link>

            {/* 削除ボタン */}
            <button
              onClick={(e) => { e.preventDefault(); setConfirmId(v.id) }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
              title="動画を削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
