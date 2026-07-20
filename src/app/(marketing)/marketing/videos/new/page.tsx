'use client'

/**
 * 動画登録（指示書5-2）
 * Vercel Blob へアップロード（既存 /api/upload のトークン発行を再利用）＋メタ情報を入力。
 * 患者が写る動画は掲載許可を必須にし、無許可は登録時に警告する。
 */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { PERMISSION_LABELS, PUBLISH_STATE_LABELS, type MediaPermission } from '@/lib/marketing/video-types'

export default function NewVideoPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    title: '',
    url: '',
    shotDate: '',
    place: '',
    performer: '',
    patientPresent: false,
    permission: 'none' as MediaPermission,
    disease: '',
    bodyPart: '',
    theme: '',
    orientation: '' as '' | 'portrait' | 'landscape' | 'square',
    publishState: 'unused',
    memo: '',
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleFile() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage('アップロード中…')
    try {
      const { upload } = await import('@vercel/blob/client')
      const blob = await upload(`marketing/videos/${Date.now()}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      })
      set('url', blob.url)
      if (!form.title) set('title', file.name.replace(/\.[^.]+$/, ''))
      setMessage('アップロード完了。メタ情報を入力して登録してください。')
    } catch (e) {
      setMessage(`アップロードに失敗しました: ${e instanceof Error ? e.message : '不明'}（Blob未設定の場合はURLを直接入力できます）`)
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!form.title.trim()) {
      setMessage('タイトルは必須です')
      return
    }
    if (form.patientPresent && form.permission === 'none') {
      setMessage('患者が写る動画は掲載許可（あり/条件付き）が必要です。許可がない場合は登録できますが公開工程には進めません。')
      // 登録自体は許可（ストックとして保持）。ただし警告は表示する。
    }
    setSaving(true)
    try {
      const res = await fetch('/api/marketing/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orientation: form.orientation || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      router.push('/marketing/videos')
    } catch (e) {
      setMessage(`保存に失敗しました: ${e instanceof Error ? e.message : '不明'}`)
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'
  const labelCls = 'block text-sm font-medium text-slate-700'

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold">動画を登録</h1>
      <p className="mt-1 text-sm text-slate-500">動画をアップロードするか、URLを直接入力してメタ情報を登録します。</p>

      {/* アップロード */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <label className={labelCls}>動画ファイル（最大500MB・mp4など）</label>
        <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} disabled={uploading} className="mt-1 text-sm" />
        <div className="mt-3">
          <label className={labelCls}>動画URL（アップロードすると自動入力。手入力も可）</label>
          <input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" className={`${inputCls} mt-1`} />
        </div>
      </div>

      {/* メタ情報 */}
      <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>タイトル<span className="text-rose-500">*</span></label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} className={`${inputCls} mt-1`} />
        </div>
        <div>
          <label className={labelCls}>撮影日</label>
          <input type="date" value={form.shotDate} onChange={(e) => set('shotDate', e.target.value)} className={`${inputCls} mt-1`} />
        </div>
        <div>
          <label className={labelCls}>撮影場所</label>
          <input value={form.place} onChange={(e) => set('place', e.target.value)} className={`${inputCls} mt-1`} />
        </div>
        <div>
          <label className={labelCls}>対象疾患</label>
          <input value={form.disease} onChange={(e) => set('disease', e.target.value)} placeholder="例: 足関節捻挫" className={`${inputCls} mt-1`} />
        </div>
        <div>
          <label className={labelCls}>対象部位</label>
          <input value={form.bodyPart} onChange={(e) => set('bodyPart', e.target.value)} placeholder="例: 足首" className={`${inputCls} mt-1`} />
        </div>
        <div>
          <label className={labelCls}>出演者</label>
          <input value={form.performer} onChange={(e) => set('performer', e.target.value)} className={`${inputCls} mt-1`} />
        </div>
        <div>
          <label className={labelCls}>向き</label>
          <select value={form.orientation} onChange={(e) => set('orientation', e.target.value as typeof form.orientation)} className={`${inputCls} mt-1`}>
            <option value="">未指定</option>
            <option value="portrait">縦型</option>
            <option value="landscape">横型</option>
            <option value="square">正方形</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>投稿テーマ</label>
          <input value={form.theme} onChange={(e) => set('theme', e.target.value)} className={`${inputCls} mt-1`} />
        </div>
        <div>
          <label className={labelCls}>公開状況</label>
          <select value={form.publishState} onChange={(e) => set('publishState', e.target.value)} className={`${inputCls} mt-1`}>
            {Object.entries(PUBLISH_STATE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 掲載許可（重要） */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={form.patientPresent} onChange={(e) => set('patientPresent', e.target.checked)} />
          この動画に患者が写っている
        </label>
        <div className="mt-3">
          <label className={labelCls}>掲載許可</label>
          <select value={form.permission} onChange={(e) => set('permission', e.target.value as MediaPermission)} className={`${inputCls} mt-1`}>
            {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {form.patientPresent && form.permission === 'none' ? (
          <p className="mt-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-600">
            患者が写る動画は掲載許可がないと公開工程に進めません（ストックとしての登録は可能です）。
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <label className={labelCls}>メモ</label>
        <textarea value={form.memo} onChange={(e) => set('memo', e.target.value)} rows={2} className={`${inputCls} mt-1`} />
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          onClick={submit}
          disabled={saving || uploading}
          className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? '登録中…' : '登録する'}
        </button>
        <button onClick={() => router.push('/marketing/videos')} className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600">
          キャンセル
        </button>
      </div>
    </div>
  )
}
