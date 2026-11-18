'use client'
// ──────────────────────────────────────────────
// 画像レポート タブ（2026-11-18 院長の依頼）
// 患者さんのCD（DICOM）を、院のパソコンの「読影プログラム」（tools/dicom-reader）で読み取り、
// AI（Claude）の画像所見レポート（参考意見・PDF）を作ってカルテに提出する。
//  1. CDの方とカルテの方が同じかを確かめる → 検査を選ぶ → 主訴を書く → 読影を始める（10〜25分）
//  2. 下書きのPDFを確かめる → カルテに提出する（PDFはクラウドの非公開の場所へ。どの端末でも開ける）
// 氏名・患者ID・施設名はAIに渡さない（PDFの見出しにだけ、読影プログラムが入れる）。
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { AlertTriangle, CheckCircle2, Disc3, FileText, Loader2 } from 'lucide-react'
import type { ImagingReport, Patient } from '@/types/patient'
import { deleteImagingReport, saveImagingReport } from '@/lib/patient-store'
import { getCurrentUser } from '@/lib/rehab-store'
import { checkIdentity, countsLabel, splitEmphasis, toImagingReport } from '@/lib/karte/imaging'
import {
  deleteReportFile, readerCancel, readerHealth, readerJob, readerJobs, readerPdf, readerRemove, readerScan, readerSources, readerStart,
  reportUrl, uploadReportPdf,
  type ReaderHealth, type ReaderJob, type ReaderScan, type ReaderSource,
} from '@/lib/karte/imaging-client'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card } from './shared'

type Props = {
  patient: Patient
  reports: ImagingReport[]
  onUpdate: () => void
}

type Wizard =
  | { step: 'sources'; sources: ReaderSource[] }
  | { step: 'scanning'; label: string }
  | { step: 'review'; scan: ReaderScan }

const fieldClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400'

function Emphasis({ text }: { text: string }) {
  return <>{splitEmphasis(text).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}</>
}

function Summary({ summary, estimates }: Pick<ImagingReport, 'summary' | 'estimates'>) {
  return (
    <div className="space-y-3">
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-800">
        {summary.map((s, i) => <li key={i}><Emphasis text={s} /></li>)}
      </ul>
      {estimates.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">考えられる状態と見積もり</p>
          <ul className="space-y-1">
            {estimates.map((e, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm text-slate-800">
                <span className="w-12 shrink-0 text-right font-semibold tabular-nums">約{e.percent}%</span>
                <span><span className="font-medium">{e.condition}</span>{e.basis && <span className="text-slate-600">　{e.basis}</span>}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-500">統計値ではなく、読影者（AI）による主観的な見積もりです。</p>
        </div>
      )}
    </div>
  )
}

function elapsed(from: string, now: number): string {
  const sec = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000))
  return `${Math.floor(sec / 60)}分${String(sec % 60).padStart(2, '0')}秒`
}

export default function ImagingReportsTab({ patient, reports, onUpdate }: Props) {
  const [health, setHealth] = useState<ReaderHealth | null | 'checking'>('checking')
  const [jobs, setJobs] = useState<ReaderJob[]>([])
  const [wizard, setWizard] = useState<Wizard | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [complaint, setComplaint] = useState(patient.mainComplaint ?? '')
  const [question, setQuestion] = useState('')
  const [noText, setNoText] = useState(false)
  const [sameConfirmed, setSameConfirmed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const alive = useRef(true)

  const sorted = [...reports].sort((a, b) => (b.studyDate || b.submittedAt).localeCompare(a.studyDate || a.submittedAt))
  const active = jobs.find(j => j.status === 'queued' || j.status === 'running')

  const refresh = useCallback(async () => {
    const h = await readerHealth()
    if (!alive.current) return
    setHealth(h)
    if (!h) { setJobs([]); return }
    try {
      const list = await readerJobs(patient.id)
      // 動いている読影は、途中経過（記録）も取る
      const detailed = await Promise.all(list.map(j => (j.status === 'queued' || j.status === 'running' ? readerJob(j.id).catch(() => j) : j)))
      if (alive.current) setJobs(detailed)
    } catch {
      // 一覧が取れないだけなら、そのまま（次の確認で取り直す）
    }
  }, [patient.id])

  useEffect(() => {
    alive.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたときに、このパソコンの読影プログラムの状態を取りにいく
    void refresh()
    return () => { alive.current = false }
  }, [refresh])

  // 読影が動いている間だけ、3秒ごとに進み具合を見る
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => { setNow(Date.now()); void refresh() }, 3000)
    return () => clearInterval(t)
  }, [active, refresh])

  function fail(e: unknown, fallback: string) {
    setError(e instanceof Error && e.message ? e.message : fallback)
  }

  async function begin() {
    setError(null)
    setBusy('begin')
    try {
      const sources = await readerSources()
      if (sources.length === 0) {
        setError('CDが見つかりません。患者さんのCDをパソコンに入れてから、もう一度押してください。')
      } else if (sources.length === 1) {
        await scan(sources[0])
      } else {
        setWizard({ step: 'sources', sources })
      }
    } catch (e) {
      fail(e, 'CDを確かめられませんでした')
    } finally {
      setBusy(null)
    }
  }

  async function scan(source: ReaderSource) {
    setError(null)
    setWizard({ step: 'scanning', label: source.label })
    try {
      const result = await readerScan(source.path)
      if (!alive.current) return
      setSelected(result.studies.map(s => s.uid))
      setNoText(false)
      setSameConfirmed(false)
      setWizard({ step: 'review', scan: result })
    } catch (e) {
      setWizard(null)
      fail(e, 'CDを読めませんでした')
    }
  }

  async function start(scanResult: ReaderScan) {
    setError(null)
    setBusy('start')
    try {
      await readerStart({
        path: scanResult.path,
        studies: selected,
        patient: { id: patient.id, name: patient.name, birthDate: patient.birthDate ?? '', gender: patient.gender ?? '' },
        complaint: complaint.trim(),
        question: question.trim(),
        confirmedNoText: noText,
      })
      setWizard(null)
      setNow(Date.now())
      await refresh()
    } catch (e) {
      fail(e, '読影を始められませんでした')
    } finally {
      setBusy(null)
    }
  }

  async function openDraft(job: ReaderJob) {
    setError(null)
    // 先に空の画面を開いておく（読み込みのあとで開くと、ブラウザに止められることがある）
    const win = window.open('', '_blank')
    try {
      const url = URL.createObjectURL(await readerPdf(job.id))
      if (win) win.location.href = url
      else window.location.assign(url)
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)
    } catch (e) {
      win?.close()
      fail(e, '下書きを開けませんでした')
    }
  }

  async function submit(job: ReaderJob) {
    if (!job.result || busy) return
    setError(null)
    setBusy(job.id)
    try {
      const blob = await readerPdf(job.id)
      const id = nanoid()
      const { storagePath, bytes } = await uploadReportPdf({ patientId: patient.id, reportId: id, blob })
      saveImagingReport(toImagingReport({
        id, patientId: patient.id, result: job.result, complaint: job.complaint ?? '', storagePath, bytes,
        submittedAt: new Date().toISOString(), submittedBy: getCurrentUser()?.name,
      }))
      // カルテに入ったら、パソコンに残した下書き（PDF・図）は消す
      await readerRemove(job.id).catch(() => undefined)
      setOpenId(id)
      onUpdate()
      await refresh()
    } catch (e) {
      fail(e, 'カルテに提出できませんでした')
    } finally {
      setBusy(null)
    }
  }

  async function discard(job: ReaderJob, ask: string | null) {
    if (ask && !window.confirm(ask)) return
    setError(null)
    try {
      await readerRemove(job.id)
      await refresh()
    } catch (e) {
      fail(e, '消せませんでした')
    }
  }

  async function cancel(job: ReaderJob) {
    if (!window.confirm('読影を中止しますか？（ここまでの分はやり直しになります）')) return
    try {
      await readerCancel(job.id)
      await refresh()
    } catch (e) {
      fail(e, '中止できませんでした')
    }
  }

  async function removeReport(report: ImagingReport) {
    if (!window.confirm(`${report.studyDate || report.submittedAt.slice(0, 10)} の画像レポート（${report.region}）を削除しますか？（クラウドのPDFも消えます）`)) return
    setError(null)
    try {
      await deleteReportFile(report.storagePath)
      deleteImagingReport(report.id)
      onUpdate()
    } catch (e) {
      fail(e, '削除できませんでした')
    }
  }

  const identity = wizard?.step === 'review' ? checkIdentity(wizard.scan.patient, patient) : null
  const canStart = wizard?.step === 'review' && selected.length > 0 && noText && (identity?.level === 'ok' || sameConfirmed) && !wizard.scan.several_patients
  const ready = health !== 'checking' && health !== null
  const blocked = ready && (!health.claude || health.loggedIn === false || !health.pdf)

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      {/* ── 提出済み ── */}
      <Card className="p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileText className="h-4 w-4 text-teal-700" aria-hidden />
          提出済みの画像レポート
        </h3>
        <p className="mb-3 text-xs text-slate-500">AI（Claude）による二次読影の参考意見です。確定診断ではありません。画像の最終判断は、撮影した医療機関の医師の読影を優先してください。</p>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-600">まだありません。</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {sorted.map(r => (
              <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.region}
                      <span className="ml-2 font-normal text-slate-600">{countsLabel(r)}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      撮影日 {r.studyDate || '不明'}{r.institution ? `・${r.institution}` : ''}　提出 {r.submittedAt.slice(0, 10)}{r.submittedBy ? `（${r.submittedBy}）` : ''}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{r.headline}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={reportUrl(r.storagePath, r.fileName)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: 'sm' }))}>PDFを開く</a>
                    <a href={reportUrl(r.storagePath, r.fileName, true)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>保存する</a>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id}>
                      {openId === r.id ? '総括を閉じる' : '総括を見る'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:text-red-800" onClick={() => removeReport(r)}>削除</Button>
                  </div>
                </div>
                {openId === r.id && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {r.complaint && <p className="mb-2 text-xs text-slate-600">主訴：{r.complaint}</p>}
                    <Summary summary={r.summary} estimates={r.estimates} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── このパソコンの読影（進行中・下書き） ── */}
      {jobs.map(job => (
        <Card key={job.id} className={cn('p-4', job.status === 'done' && 'border-amber-300')}>
          {(job.status === 'queued' || job.status === 'running') && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden />
                  読影しています（{elapsed(job.created, now)}）
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => cancel(job)}>中止する</Button>
              </div>
              <p className="text-sm text-slate-700">{job.stage}</p>
              <p className="text-xs text-slate-500">10〜25分ほどかかります。この画面を閉じても、パソコンの中で続きます（終わったら、このタブに下書きが出ます）。</p>
              {job.log && job.log.length > 1 && (
                <ul className="max-h-32 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {job.log.slice(-8).map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              )}
            </div>
          )}

          {job.status === 'done' && job.result && (
            <div className="space-y-3">
              <div>
                <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">下書き（まだカルテに入っていません）</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {job.result.title_region}
                  <span className="ml-2 font-normal text-slate-600">{countsLabel({ modalities: job.result.modalities, imageCounts: job.result.counts })}</span>
                </p>
                <p className="text-xs text-slate-600">撮影日 {job.result.study_date || '不明'}{job.result.institution ? `・${job.result.institution}` : ''}　読影 {job.result.minutes}分</p>
              </div>
              <Summary summary={job.result.summary} estimates={job.result.estimates} />
              {job.warnings && job.warnings.length > 0 && (
                <p className="text-xs text-amber-800">形の整っていない所がありました（PDFをご確認ください）：{job.warnings.slice(0, 3).join(' / ')}</p>
              )}
              <p className="text-xs text-slate-600">PDFを開いて内容を確かめてから、カルテに提出してください。提出すると、このパソコンの下書きは消えます。</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => openDraft(job)}>下書きのPDFを開く</Button>
                <Button type="button" onClick={() => submit(job)} disabled={busy !== null}>
                  {busy === job.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  カルテに提出する
                </Button>
                <Button type="button" variant="ghost" className="text-red-700 hover:text-red-800" onClick={() => discard(job, 'この下書きを破棄しますか？（読影はやり直しになります）')}>破棄する</Button>
              </div>
            </div>
          )}

          {(job.status === 'error' || job.status === 'cancelled') && (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{job.status === 'cancelled' ? '読影を中止しました' : '読影できませんでした'}（{job.created.slice(0, 16).replace('T', ' ')}）</p>
                {job.status === 'error' && <p className="mt-1 text-sm text-red-700">{job.error}</p>}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => discard(job, null)}>消す</Button>
            </div>
          )}
        </Card>
      ))}

      {/* ── 新しく読み取る ── */}
      <Card className="p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Disc3 className="h-4 w-4 text-teal-700" aria-hidden />
          CDのDICOMを読み取る
        </h3>

        {health === 'checking' && <p className="text-sm text-slate-600">このパソコンの読影プログラムを確かめています…</p>}

        {health === null && (
          <div className="space-y-2 text-sm text-slate-700">
            <p>読み取りは、<b>読影プログラムを入れた院のパソコン</b>で行います。この端末では、提出済みのレポートを見ることだけできます。</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>院のパソコンで出ているときは、読影プログラムが止まっています。デスクトップの「読影プログラムを起動」を開いてから、下のボタンを押してください。</li>
              <li>ブラウザに「ローカル ネットワーク上のデバイスへのアクセス」を聞かれたら「許可」を選んでください。</li>
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={() => { setHealth('checking'); void refresh() }}>もう一度確かめる</Button>
          </div>
        )}

        {ready && !wizard && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">患者さんのCDをパソコンに入れて押すと、X線・MRI・CTの原画像をAIが全スライス読み、所見のレポート（PDF）を作ります。</p>
            {!health.claude && <p className="text-sm text-red-700">このパソコンに Claude Code が見つかりません。</p>}
            {health.claude && health.loggedIn === false && <p className="text-sm text-red-700">Claude Code のログインが切れています。コマンドプロンプトで claude を起動し、/login でログインし直してください。</p>}
            {!health.pdf && <p className="text-sm text-red-700">PDFを作るための Chrome／Edge が見つかりません。</p>}
            {health.running && !active && <p className="text-sm text-amber-800">ほかの患者さんの読影が動いています。終わってから始めてください。</p>}
            <Button type="button" onClick={begin} disabled={busy !== null || blocked || Boolean(health.running)}>
              {busy === 'begin' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              CDを読み込む
            </Button>
          </div>
        )}

        {wizard?.step === 'sources' && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">どれを読み込みますか？</p>
            <div className="flex flex-wrap gap-2">
              {wizard.sources.map(s => (
                <Button key={s.path} type="button" variant="outline" onClick={() => scan(s)}>
                  {s.kind === 'cd' ? 'CD' : s.kind === 'usb' ? 'USB' : 'フォルダ'}：{s.label}
                </Button>
              ))}
              <Button type="button" variant="ghost" onClick={() => setWizard(null)}>やめる</Button>
            </div>
          </div>
        )}

        {wizard?.step === 'scanning' && (
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden />
            「{wizard.label}」の中身を確かめています（枚数が多いと1分ほどかかります）
          </p>
        )}

        {wizard?.step === 'review' && identity && (
          <div className="space-y-4">
            {/* だれのCDか */}
            <div className={cn('rounded-lg border p-3', identity.level === 'ok' ? 'border-green-200 bg-green-50' : identity.level === 'check' ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50')}>
              <p className={cn('flex items-start gap-2 text-sm font-semibold', identity.level === 'ok' ? 'text-green-800' : identity.level === 'check' ? 'text-amber-900' : 'text-red-700')}>
                {identity.level === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                <span>{identity.message}</span>
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm text-slate-800">
                <dt className="text-slate-600">CDの方</dt>
                <dd className="break-keep wrap-anywhere">{wizard.scan.patient.name || '（お名前なし）'}　{wizard.scan.patient.birth_date || '生年月日なし'}</dd>
                <dt className="text-slate-600">このカルテ</dt>
                <dd className="break-keep wrap-anywhere">{patient.name}　{patient.birthDate || '生年月日なし'}</dd>
              </dl>
              {wizard.scan.several_patients && <p className="mt-2 text-sm text-red-700">このCDには複数の方の画像が入っています。読み取れません。</p>}
              {identity.level !== 'ok' && !wizard.scan.several_patients && (
                <label className="mt-2 flex items-start gap-2 text-sm text-slate-800 max-lg:min-h-10">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-teal-700" checked={sameConfirmed} onChange={e => setSameConfirmed(e.target.checked)} />
                  <span>このCDは、このカルテの患者さんのものです（確かめました）</span>
                </label>
              )}
            </div>

            {/* 検査 */}
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">読み取る検査</p>
              <ul className="space-y-3">
                {wizard.scan.studies.map(st => (
                  <li key={st.uid} className="rounded-lg border border-slate-200 p-3">
                    <label className="flex items-start gap-2 text-sm text-slate-800 max-lg:min-h-10">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-teal-700"
                        checked={selected.includes(st.uid)}
                        onChange={e => setSelected(prev => (e.target.checked ? [...prev, st.uid] : prev.filter(u => u !== st.uid)))}
                      />
                      <span>
                        <span className="font-semibold">{st.modalities_ja.join('・')}</span>　{st.date} {st.time}　{st.n_images}枚
                        {st.institution && <span className="text-slate-600">　{st.institution}</span>}
                      </span>
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {st.series.flatMap(se => se.thumbs.map((t, i) => (
                        <figure key={`${se.uid}-${i}`} className="w-24">
                          {/* eslint-disable-next-line @next/next/no-img-element -- このパソコンの中で作った見本（data:） */}
                          <img src={t} alt={`${se.description || se.modality} の見本`} className="h-24 w-24 rounded border border-slate-200 bg-black object-contain" />
                          <figcaption className="mt-0.5 text-xs leading-tight text-slate-600 wrap-anywhere">{se.description || se.modality}（{se.n}枚）</figcaption>
                        </figure>
                      )))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 主訴 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                主訴（痛みの場所・圧痛・痛む動作）
                <textarea value={complaint} onChange={e => setComplaint(e.target.value)} rows={3} maxLength={600} className={cn(fieldClass, 'mt-1 resize-none')}
                  placeholder="例：右足関節の前方の痛み。同部位に圧痛あり。踏み込みで痛みが強まる。" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                とくに確かめたいこと（任意）
                <input value={question} onChange={e => setQuestion(e.target.value)} maxLength={300} className={cn(fieldClass, 'mt-1')} placeholder="例：骨端線損傷はありますか" />
              </label>
              <p className="text-xs text-slate-500">お名前・患者ID・施設名はAIに渡しません（PDFの見出しにだけ入ります）。主訴の欄にお名前は書かないでください。</p>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 max-lg:min-h-10">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-teal-700" checked={noText} onChange={e => setNoText(e.target.checked)} />
              <span>上の見本の画像に、お名前・IDなどの文字が写り込んでいないことを確かめました（画像そのものはAIに送られます）</span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => start(wizard.scan)} disabled={!canStart || busy !== null}>
                {busy === 'start' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                読影を始める
              </Button>
              <Button type="button" variant="ghost" onClick={() => setWizard(null)}>やめる</Button>
              <span className="text-xs text-slate-500">10〜25分ほど・院長の Claude の使用枠を使います</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
