'use client'

import { useState, useRef } from 'react'
import { Upload, Camera, CheckCircle, Loader2, User, Mail, Phone, Activity } from 'lucide-react'

const SERVICE_TYPES = [
  { value: 'sports',  label: 'スポーツ・競技フォーム改善' },
  { value: 'rehab',   label: 'リハビリ・回復確認' },
  { value: 'posture', label: '姿勢・日常動作改善' },
  { value: 'team',    label: 'チーム・法人依頼' },
  { value: 'other',   label: 'その他' },
]

const SPORT_SUGGESTIONS = [
  'サッカー', 'バスケットボール', '野球', '陸上', '水泳', 'テニス',
  'バレーボール', 'バレエ', 'ダンス', 'ゴルフ', 'マラソン', '姿勢改善',
]

export default function SubmitForm() {
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '',
    age: '', gender: 'male',
    serviceType: 'sports', sport: '', requestNote: '',
  })
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleFile(f: File) {
    if (!f.type.startsWith('video/')) { setErrors({ video: '動画ファイルを選択してください' }); return }
    if (f.size > 500 * 1024 * 1024) { setErrors({ video: 'ファイルサイズは500MB以下にしてください' }); return }
    setVideoFile(f)
    setErrors((e) => { const n = { ...e }; delete n.video; return n })
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.clientName.trim()) e.clientName = '氏名を入力してください'
    if (!form.clientEmail.trim()) e.clientEmail = 'メールアドレスを入力してください'
    if (form.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail)) e.clientEmail = '正しいメールアドレスを入力してください'
    if (!form.sport.trim()) e.sport = 'スポーツ・目的を入力してください'
    if (!videoFile) e.video = '動画ファイルを選択してください'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setStatus('submitting')

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    fd.append('video', videoFile!)

    try {
      const res = await fetch('/api/submit', { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? '送信に失敗しました') }
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '送信に失敗しました')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="bg-white/95 rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">送信が完了しました</h2>
        <p className="text-gray-600 text-sm mb-4">
          動画を受け付けました。解析完了後、<strong>{form.clientEmail}</strong> にレポートをお送りします。
        </p>
        <p className="text-xs text-gray-400">通常3〜5営業日以内にご連絡します</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/95 rounded-2xl shadow-2xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">動作解析の依頼</h2>
        <p className="text-sm text-gray-500 mt-1">動画をアップロードしてください。解析後、メールでレポートをお送りします。</p>
      </div>

      {/* 氏名・連絡先 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <User className="w-3.5 h-3.5" /> お客様情報
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="氏名" error={errors.clientName} required>
            <input type="text" placeholder="山田 太郎" value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })} className={ic} />
          </Field>
          <Field label="年齢（任意）">
            <input type="number" min={0} max={120} placeholder="25" value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })} className={ic} />
          </Field>
        </div>
        <Field label="メールアドレス（レポート送付先）" error={errors.clientEmail} required>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="email" placeholder="example@email.com" value={form.clientEmail}
              onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} className={`${ic} pl-9`} />
          </div>
        </Field>
        <Field label="電話番号（任意）">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="tel" placeholder="090-1234-5678" value={form.clientPhone}
              onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} className={`${ic} pl-9`} />
          </div>
        </Field>
      </div>

      {/* 依頼内容 */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Activity className="w-3.5 h-3.5" /> 依頼内容
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="依頼の種類">
            <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} className={ic}>
              {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="スポーツ・目的" error={errors.sport} required>
            <input type="text" placeholder="例：サッカー / 姿勢改善" value={form.sport}
              onChange={(e) => setForm({ ...form, sport: e.target.value })} className={ic} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SPORT_SUGGESTIONS.filter((s) => s !== form.sport).map((s) => (
            <button key={s} type="button" onClick={() => setForm({ ...form, sport: s })}
              className="px-2 py-0.5 rounded-full text-xs border border-gray-300 text-gray-500 hover:border-[#0d9488] hover:text-[#0d9488] transition-colors">
              {s}
            </button>
          ))}
        </div>
        <Field label="気になること・伝えたいこと（任意）">
          <textarea rows={3} placeholder="例：右膝の着地時に違和感がある。スポーツ復帰前に確認したい。"
            value={form.requestNote} onChange={(e) => setForm({ ...form, requestNote: e.target.value })} className={ic} />
        </Field>
      </div>

      {/* 動画アップロード */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">動画ファイル *</div>

        {videoFile ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 truncate">{videoFile.name}</p>
              <p className="text-xs text-green-600">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button type="button" onClick={() => setVideoFile(null)} className="text-xs text-red-500 hover:text-red-700">変更</button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* カメラ撮影 */}
            <button type="button" onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center gap-3 border-2 border-[#0d9488] bg-teal-50 hover:bg-teal-100 rounded-xl p-4 transition-colors">
              <Camera className="w-7 h-7 text-[#0d9488]" />
              <div className="text-left">
                <p className="text-sm font-semibold text-[#0d9488]">カメラで撮影して送る</p>
                <p className="text-xs text-teal-600">スマートフォンで今すぐ録画</p>
              </div>
            </button>
            <input ref={cameraInputRef} type="file" accept="video/*" capture="environment" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {/* ファイル選択 */}
            <label className="flex items-center gap-3 border-2 border-dashed border-gray-300 hover:border-[#0d9488] bg-gray-50 hover:bg-gray-100 rounded-xl p-4 cursor-pointer transition-colors">
              <Upload className="w-7 h-7 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">ファイルから選択</p>
                <p className="text-xs text-gray-400">MP4, MOV, AVI（最大500MB）</p>
              </div>
              <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          </div>
        )}
        {errors.video && <p className="text-xs text-red-600">{errors.video}</p>}
      </div>

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{errorMsg}</div>
      )}

      <button type="submit" disabled={status === 'submitting'}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#0d9488] hover:bg-[#0b8276] text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm">
        {status === 'submitting' ? <><Loader2 className="w-4 h-4 animate-spin" />送信中...</> : <>動画を送って解析を依頼する</>}
      </button>
    </form>
  )
}

const ic = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488] focus:border-transparent'

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
