'use client'
/**
 * 「誕生日のご挨拶」の設定カード（集客 → LINE導線）
 * オン／オフ・文面・この先14日の対象・最近の送信。見本を院長のLINEへ送れる。
 */
import { useEffect, useState } from 'react'
import { Cake, Send } from 'lucide-react'

interface Data {
  settings: { enabled: boolean; template: string; updatedAt?: string }
  defaultTemplate: string
  upcoming: Array<{ key: string; name: string; birthDate: string; inDays: number }>
  recent: Array<{ at: string; name: string; ok: boolean; error?: string }>
  lineConfigured: boolean
}

export default function BirthdayCard() {
  const [data, setData] = useState<Data | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [template, setTemplate] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/marketing/line/birthday', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: Data & { ok?: boolean; error?: string }) => {
        if (!d.ok) throw new Error(d.error ?? '読み込めませんでした')
        setData(d)
        setEnabled(d.settings.enabled)
        setTemplate(d.settings.template)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '読み込めませんでした'))
  }, [])

  const save = async (next?: { enabled?: boolean }) => {
    setBusy('保存中…')
    setError('')
    setMessage('')
    try {
      const body = { enabled: next?.enabled ?? enabled, template }
      const res = await fetch('/api/marketing/line/birthday', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error ?? `HTTP ${res.status}`)
      if (next?.enabled !== undefined) setEnabled(next.enabled)
      setMessage(body.enabled ? '保存しました。誕生日の朝9時ごろに送ります' : '保存しました（いまは送りません）')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
    } finally {
      setBusy('')
    }
  }

  const sample = async () => {
    setBusy('見本を送信中…')
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/marketing/line/birthday', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sample: true, template }) })
      const d = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error ?? `HTTP ${res.status}`)
      setMessage('院長のLINEへ見本を送りました')
    } catch (e) {
      setError(e instanceof Error ? e.message : '送れませんでした')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Cake className="h-4 w-4 text-pink-600" />
          誕生日のご挨拶（カルテ連携した方へ、誕生日の朝9時ごろに自動で1通）
        </h2>
        <label className="inline-flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={enabled} disabled={!data || !!busy} onChange={(e) => void save({ enabled: e.target.checked })} />
          {enabled ? '送る（オン）' : '送らない（オフ）'}
        </label>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        対象は、カルテ連携で生年月日を入れた方だけ。同じ年に2回は送りません。1通ごとに公式LINEの配信数を使います（無料枠を超えると月の料金に影響）。
      </p>
      {data && !data.lineConfigured && <p className="mt-1 text-xs text-amber-700">LINEチャネルが未接続のため送れません。</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_280px]">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            文面（{'{name}'} がお名前に変わります）
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void save()} disabled={!data || !!busy} className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              文面を保存
            </button>
            <button type="button" onClick={sample} disabled={!data || !!busy} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Send className="h-3.5 w-3.5" />
              院長のLINEに見本を送る
            </button>
            {data && template !== data.defaultTemplate && (
              <button type="button" onClick={() => setTemplate(data.defaultTemplate)} className="text-xs text-slate-500 underline">
                最初の文面に戻す
              </button>
            )}
            {busy && <span className="text-xs text-slate-500">{busy}</span>}
            {message && <span className="text-xs text-emerald-700">{message}</span>}
            {error && <span className="text-xs text-red-700">{error}</span>}
          </div>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <p className="font-bold text-slate-700">この先14日に誕生日の方 {data ? `${data.upcoming.length}名` : ''}</p>
            {data && data.upcoming.length === 0 && <p className="text-slate-500">いません（連携した方が増えると出ます）</p>}
            <ul className="mt-1 space-y-0.5">
              {data?.upcoming.map((u) => (
                <li key={u.key} className="flex justify-between">
                  <span>{u.name}</span>
                  <span className="text-slate-500">{u.inDays === 0 ? '今日' : `${u.inDays}日後`}（{u.birthDate.slice(5).replace('-', '/')}）</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-bold text-slate-700">最近の送信</p>
            {data && data.recent.length === 0 && <p className="text-slate-500">まだありません</p>}
            <ul className="mt-1 space-y-0.5">
              {data?.recent.map((r, i) => (
                <li key={`${r.at}-${i}`} className="flex justify-between">
                  <span>
                    {r.name}
                    {!r.ok && <span className="ml-1 text-red-600">失敗{r.error ? `（${r.error}）` : ''}</span>}
                  </span>
                  <span className="text-slate-500">{r.at.slice(5, 10).replace('-', '/')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
