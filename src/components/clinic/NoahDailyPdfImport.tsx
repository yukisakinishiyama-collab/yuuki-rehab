'use client'
/**
 * NOAH の「来院者日報」（PDF）を入れる（日報の画面。院長が経営を開いているときだけ）
 *
 * 2026-11-27 院長「NOAHの日報をのせます」「PDFでした」。
 * 1. PDF を選ぶ（何日分でもまとめて）→ このパソコンのブラウザの中で読む（lib/pdf-text.ts・lib/marketing/noah-daily.ts）
 * 2. 日ごとの合計（来院・施術額・負担金・徴収額・保険外・自費・商品・窓口領収）を見せる → 紙の日計と見比べる
 * 3.「この内容で保存する」→ 合計の数字だけを送る（/api/marketing/noah/daily。院長だけ）
 * お名前・受診者No・保険種別は、ブラウザの外へ出さない。
 */
import { useState } from 'react'
import { AlertCircle, Check, FileUp } from 'lucide-react'
import { extractPdfLines } from '@/lib/pdf-text'
import { NOAH_DAILY_AMOUNT_KEYS, NOAH_DAILY_LABELS, parseNoahDaily, type NoahDailySheet } from '@/lib/marketing/noah-daily'
import { shortDateLabel } from '@/lib/daily-report'
import { yen } from '@/lib/marketing/noah-analysis'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Picked {
  file: string
  sheet?: NoahDailySheet
  error?: string
}

export default function NoahDailyPdfImport({ onSaved }: { onSaved: (dates: string[]) => void }) {
  const [picked, setPicked] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setDone('')
    setError('')
    setBusy(true)
    const out: Picked[] = []
    for (const file of Array.from(list).slice(0, 31)) {
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error('ファイルが大きすぎます（20MB まで）')
        const r = parseNoahDaily(await extractPdfLines(await file.arrayBuffer()))
        out.push(r.ok ? { file: file.name, sheet: r.sheet } : { file: file.name, error: r.error })
      } catch (e) {
        out.push({ file: file.name, error: e instanceof Error ? e.message : '読めませんでした' })
      }
    }
    setPicked(out)
    setBusy(false)
  }

  // 同じ日の PDF が2つあれば、あとに選んだほう
  const byDate = new Map<string, NoahDailySheet>()
  for (const p of picked) if (p.sheet) byDate.set(p.sheet.date, p.sheet)
  const sheets = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const failed = picked.filter((p) => p.error)

  async function save() {
    if (!sheets.length) return
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/marketing/noah/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets }),
      })
      const d = (await r.json().catch(() => null)) as { ok?: boolean; saved?: string[]; error?: string } | null
      if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`)
      const saved = d.saved ?? sheets.map((s) => s.date)
      setDone(`${saved.map(shortDateLabel).join('・')} の日報を保存しました`)
      setPicked([])
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm sm:p-5" aria-label="NOAH の日報（PDF）を入れる">
      <h2 className="flex items-center gap-1.5 text-base font-black text-slate-900">
        <FileUp className="h-4 w-4 text-teal-700" aria-hidden />
        NOAH の日報（PDF）を入れる
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        NOAH の「来院者日報」を PDF に保存したもの。何日分でもまとめて選べます。読むのはこのパソコンの中だけで、お名前・受診者No・保険種別は外へ出しません（保存するのは、その日の合計の数字だけ）。
      </p>
      <label className={cn(buttonVariants(), 'mt-3 cursor-pointer gap-1.5 font-bold', busy && 'pointer-events-none opacity-50')}>
        <FileUp className="h-4 w-4" aria-hidden />
        PDF を選ぶ
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      {busy && picked.length === 0 && <p className="mt-2 text-sm text-slate-600">読んでいます…</p>}

      {picked.length > 0 && (
        <div className="mt-3 space-y-2">
          {sheets.map((s) => (
            <div key={s.date} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p className="font-bold text-slate-900">
                {shortDateLabel(s.date)}　来院 {s.visits}人・窓口領収 {yen(s.window)}
              </p>
              <p className="mt-0.5 text-xs text-slate-700">
                {NOAH_DAILY_AMOUNT_KEYS.filter((k) => k !== 'window')
                  .map((k) => `${NOAH_DAILY_LABELS[k]} ${yen(s[k])}`)
                  .join('・')}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                保険など {s.counts.insured}人・自費だけ {s.counts.selfOnly}人
                {s.counts.accident ? `・交通事故 ${s.counts.accident}人` : ''}
                {s.counts.workers ? `・労災 ${s.counts.workers}人` : ''}
                {s.pages > 1 ? `（${s.pages}ページ）` : ''}
              </p>
            </div>
          ))}
          {failed.map((p, i) => (
            <p key={`${p.file}-${i}`} className="flex items-start gap-1 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="wrap-anywhere">
                {p.file}：{p.error}
              </span>
            </p>
          ))}
          {sheets.length > 0 && (
            <>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                紙の日報のいちばん下の「日計」と、来院の人数・窓口領収額が同じか見比べてから保存してください（PDF の日計は絵になっていて読めないため、行を足して出しています）。同じ日をもう一度入れると置きかえます。
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="gap-1 font-bold" onClick={() => void save()} disabled={busy}>
                  <Check className="h-4 w-4" aria-hidden />
                  この内容で保存する（{sheets.length}日分）
                </Button>
                <Button type="button" variant="outline" onClick={() => setPicked([])} disabled={busy}>
                  やめる
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">保存できませんでした（{error}）</p>}
      {done && (
        <p className="mt-2 flex items-center gap-1 text-sm font-bold text-green-800" role="status">
          <Check className="h-4 w-4" aria-hidden />
          {done}
        </p>
      )}
    </section>
  )
}
