'use client'

// イラスト管理画面
// ChatGPT等で生成した画像をドラッグ&ドロップでアップロードすると
// Vercel Blob に保存され、再デプロイなしで各画面に即時反映される。

import { useEffect, useState, useCallback } from 'react'
import { ILLUSTRATION_SLOTS, invalidateIllustrationCache } from '@/lib/illustrations'
import { Images, UploadCloud, Trash2, Loader2, CheckCircle2, Sparkles } from 'lucide-react'

type SlotState = { url?: string; uploading?: boolean; error?: string; flash?: boolean }

export default function IllustrationsPage() {
  const [states, setStates] = useState<Record<string, SlotState>>({})
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [blobReady, setBlobReady] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/illustrations')
      .then(r => r.json())
      .then((d: { map?: Record<string, string> }) => {
        const next: Record<string, SlotState> = {}
        for (const [slot, url] of Object.entries(d.map ?? {})) next[slot] = { url }
        setStates(next)
        setBlobReady(true)
      })
      .catch(() => setBlobReady(false))
  }, [])

  const upload = useCallback(async (slot: string, file: File) => {
    setStates(s => ({ ...s, [slot]: { ...s[slot], uploading: true, error: undefined } }))
    try {
      const form = new FormData()
      form.append('slot', slot)
      form.append('file', file)
      const res = await fetch('/api/illustrations', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `アップロード失敗 (${res.status})`)
      invalidateIllustrationCache()
      setStates(s => ({ ...s, [slot]: { url: data.url, flash: true } }))
      setTimeout(() => setStates(s => ({ ...s, [slot]: { ...s[slot], flash: false } })), 2000)
    } catch (e) {
      setStates(s => ({ ...s, [slot]: { ...s[slot], uploading: false, error: (e as Error).message } }))
    }
  }, [])

  async function remove(slot: string) {
    if (!confirm('この画像を削除しますか？（各画面の表示も消えます）')) return
    await fetch(`/api/illustrations?slot=${slot}`, { method: 'DELETE' })
    invalidateIllustrationCache()
    setStates(s => ({ ...s, [slot]: {} }))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[--color-text-primary] font-display flex items-center gap-2">
          <Images className="w-5 h-5 text-[--color-primary]" />
          イラスト管理
        </h1>
        <p className="text-sm text-[--color-text-secondary] mt-1">
          ChatGPT等で生成した画像を各スロットにドラッグ&ドロップすると、
          <span className="font-semibold">再デプロイなしで</span>レポートや患者提示画面に即時反映されます。
        </p>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-xs text-violet-800 leading-relaxed">
        <span className="font-bold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />使い方</span>
        ① Downloadsの「ChatGPT画像生成依頼キット.md」をChatGPTに貼り付けて画像を生成
        ② 生成画像をダウンロード ③ 下の該当スロットにドロップ（またはクリックして選択）→ 完了
      </div>

      {blobReady === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          画像ストレージに接続できません。ネットワークをご確認ください。
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ILLUSTRATION_SLOTS.map(({ slot, label, usage }) => {
          const st = states[slot] ?? {}
          return (
            <div
              key={slot}
              onDragOver={e => { e.preventDefault(); setDragOver(slot) }}
              onDragLeave={() => setDragOver(d => (d === slot ? null : d))}
              onDrop={e => {
                e.preventDefault()
                setDragOver(null)
                const file = e.dataTransfer.files?.[0]
                if (file) upload(slot, file)
              }}
              className={`rounded-2xl border-2 bg-white p-3 flex flex-col gap-2 transition-colors ${
                dragOver === slot ? 'border-teal-400 bg-teal-50/50' : 'border-slate-200 border-dashed'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">{label}</div>
                  <div className="text-[10px] text-slate-400 leading-snug">{usage}</div>
                  <div className="text-[10px] text-slate-300 font-mono">{slot}.png</div>
                </div>
                {st.url && (
                  <button onClick={() => remove(slot)} title="削除"
                    className="text-slate-300 hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <label className="relative flex items-center justify-center h-32 rounded-xl bg-slate-50
                overflow-hidden cursor-pointer group">
                {st.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Blob動的URL
                  <img src={st.url} alt={label} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-slate-300 group-hover:text-teal-500 transition-colors">
                    <UploadCloud className="w-7 h-7" />
                    <span className="text-[10px] font-medium">ドロップ or クリック</span>
                  </span>
                )}
                {st.uploading && (
                  <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                  </span>
                )}
                {st.flash && (
                  <span className="absolute top-1.5 right-1.5 bg-teal-500 text-white rounded-full p-1 shadow">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) upload(slot, file)
                    e.target.value = ''
                  }}
                />
              </label>

              {st.error && <div className="text-[10px] text-red-500">{st.error}</div>}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        対応形式: PNG / JPEG / WebP（8MBまで）。アップロードした画像はクラウド（Vercel Blob）に保存され、
        全端末で共有されます。同じスロットに再アップロードすると差し替わります。
      </p>
    </div>
  )
}
