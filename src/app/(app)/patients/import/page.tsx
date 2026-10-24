'use client'
// ──────────────────────────────────────────────
// NOAHからカルテを取り込む
// 院のパソコンで作った取り込み用ファイル（JSON）を選ぶ → 件数を確かめる → 取り込む。
// ファイルの中身はこの端末の中だけで読む（どこにも送らない。保存後はいつものクラウド同期だけ）。
// ──────────────────────────────────────────────
import { useState } from 'react'
import Link from 'next/link'
import { FileUp, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getPatients, initPatientStore, savePatientsBulk } from '@/lib/patient-store'
import { parseImportFile, planImport, type ImportPlan } from '@/lib/noah-import'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NoahImportPage() {
  const [fileName, setFileName] = useState('')
  const [plan, setPlan] = useState<(ImportPlan & { source: string; exportedAt: string }) | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null)

  async function onFile(file: File | undefined) {
    setError('')
    setPlan(null)
    setDone(null)
    if (!file) return
    setFileName(file.name)
    try {
      const { file: data, invalid } = parseImportFile(await file.text())
      initPatientStore()
      const p = planImport(getPatients(), data.patients)
      setPlan({ ...p, invalid, source: data.source, exportedAt: data.exportedAt })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルを読めませんでした')
    }
  }

  function apply() {
    if (!plan) return
    if (!window.confirm(`新しく ${plan.create.length}人 のカルテを作り、${plan.update.length}人 のカルテに情報を足します。よろしいですか？`)) return
    savePatientsBulk([...plan.create, ...plan.update.map((u) => u.after)])
    setDone({ created: plan.create.length, updated: plan.update.length })
    setPlan(null)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/patients" className="text-sm text-slate-500 hover:text-slate-800">← カルテ一覧</Link>
        <h1 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">NOAHからカルテを取り込む</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          院のパソコンで作った取り込み用ファイル（<code>noah_patients_*.json</code>）を選んでください。
          同じ方（氏名＋生年月日）はまとめ、すでにカルテがある方には空いている欄と保険の情報だけを足します（手で書いた内容は上書きしません）。
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 hover:border-teal-400">
        <FileUp className="h-6 w-6 text-teal-700" aria-hidden />
        <span className="text-sm text-slate-700">{fileName || '取り込み用ファイルを選ぶ'}</span>
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {plan && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{plan.source}（{plan.exportedAt}）</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['新しく作る', plan.create.length],
              ['情報を足す', plan.update.length],
              ['変わらない', plan.unchanged],
              ['読めなかった', plan.invalid],
            ].map(([label, n]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
                <dd className="text-lg font-black tabular-nums text-slate-900">{n}人</dd>
              </div>
            ))}
          </dl>
          {plan.update.length > 0 && (
            <details className="text-sm text-slate-700">
              <summary className="cursor-pointer text-slate-600">情報を足すカルテ（{plan.update.length}人）</summary>
              <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5 text-xs">
                {plan.update.map((u) => (
                  <li key={u.before.id}>{u.before.name}（{u.before.birthDate}）</li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={plan.create.length + plan.update.length === 0}
            className={cn(buttonVariants({ variant: 'default' }), 'w-full sm:w-auto')}
          >
            取り込む
          </button>
        </div>
      )}

      {done && (
        <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {done.created}人のカルテを作り、{done.updated}人のカルテに情報を足しました。
          <Link href="/patients" className="underline">カルテ一覧へ</Link>
        </p>
      )}
    </div>
  )
}
