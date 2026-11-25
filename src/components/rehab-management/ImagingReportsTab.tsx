'use client'
// ──────────────────────────────────────────────
// 画像レポート タブ（2026-11-18 院長の依頼）
// 患者さんのCD（DICOM）を、院のパソコンの「読影プログラム」（tools/dicom-reader）で読み取り、
// AI（Claude）の画像所見レポート（参考意見・PDF）を作ってカルテに提出する。
//  1. CDの方とカルテの方が同じかを確かめる → 検査を選ぶ → 主訴を書く → 読影を始める（10〜25分）
//  2. 下書きのPDFを確かめる → カルテに提出する（PDFはクラウドの非公開の場所へ。どの端末でも開ける）
//  3. 院長が気づいたことをAIに相談（2026-11-23 院長の依頼）：提出済みのレポートごとに「気づいたこと・場所」を書き、
//     CDをもう一度読み込む → AIが原画像のその場所を見直す（5〜15分）→ 答え（PDF）を確かめて「カルテに残す」
// 氏名・患者ID・施設名はAIに渡さない（PDFの見出しにだけ、読影プログラムが入れる）。
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import { AlertTriangle, CheckCircle2, Disc3, FileText, Loader2, ScanSearch } from 'lucide-react'
import type { ImagingConsult, ImagingConsultVerdict, ImagingReport, Patient } from '@/types/patient'
import { deleteImagingReport, saveImagingReport } from '@/lib/patient-store'
import { getCurrentUser } from '@/lib/rehab-store'
import {
  CONSULT_VERDICTS, MAX_LOCATION_CHARS, MAX_OBSERVATION_CHARS, checkIdentity, consultPrior, countsLabel, readerCanConsult, reportFilePaths,
  splitEmphasis, studiesForReport, toImagingConsult, toImagingReport, type IdentityCheck,
} from '@/lib/karte/imaging'
import {
  deleteReportFile, isConsultResult, readerCancel, readerHealth, readerJob, readerJobs, readerPdf, readerRemove, readerScan, readerSources,
  readerStart, readerStartConsult, reportUrl, uploadReportPdf,
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

/** CDを読み込む目的：新しく読影する／提出済みのレポートについて相談する */
type Purpose = { kind: 'read' } | { kind: 'consult'; reportId: string }

type Wizard =
  | { step: 'sources'; sources: ReaderSource[]; purpose: Purpose }
  | { step: 'scanning'; label: string; purpose: Purpose }
  | { step: 'review'; scan: ReaderScan; purpose: Purpose; dateMatched: boolean }

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

const VERDICT_TONE = {
  teal: 'bg-teal-100 text-teal-900',
  amber: 'bg-amber-100 text-amber-900',
  slate: 'bg-slate-200 text-slate-800',
} as const

function VerdictBadge({ verdict }: { verdict: ImagingConsultVerdict }) {
  const v = CONSULT_VERDICTS[verdict] ?? CONSULT_VERDICTS.cannot_judge
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold', VERDICT_TONE[v.tone])}>{v.label}</span>
}

function ConsultAnswer({ answer, next }: { answer: string[]; next: string[] }) {
  return (
    <div className="space-y-2">
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-800">
        {answer.map((s, i) => <li key={i}><Emphasis text={s} /></li>)}
      </ul>
      {next.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">次に確かめること</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
            {next.map((s, i) => <li key={i}><Emphasis text={s} /></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function Observation({ observation, location }: { observation: string; location?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
      <p><span className="text-xs font-semibold text-slate-600">気づいたこと　</span>{observation}</p>
      {location && <p className="mt-0.5"><span className="text-xs font-semibold text-slate-600">場所　</span>{location}</p>}
    </div>
  )
}

/** CDの中身を確かめる（だれのCDか・どの検査か・見本の画像）。読影と相談で共通 */
function CdReview({
  scan, patient, identity, selected, setSelected, sameConfirmed, setSameConfirmed, noText, setNoText, note, extra, actions,
}: {
  scan: ReaderScan
  patient: Patient
  identity: IdentityCheck
  selected: string[]
  setSelected: (fn: (prev: string[]) => string[]) => void
  sameConfirmed: boolean
  setSameConfirmed: (v: boolean) => void
  noText: boolean
  setNoText: (v: boolean) => void
  note?: ReactNode
  extra?: ReactNode
  actions: ReactNode
}) {
  return (
    <div className="space-y-4">
      {/* だれのCDか */}
      <div className={cn('rounded-lg border p-3', identity.level === 'ok' ? 'border-green-200 bg-green-50' : identity.level === 'check' ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50')}>
        <p className={cn('flex items-start gap-2 text-sm font-semibold', identity.level === 'ok' ? 'text-green-800' : identity.level === 'check' ? 'text-amber-900' : 'text-red-700')}>
          {identity.level === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          <span>{identity.message}</span>
        </p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm text-slate-800">
          <dt className="text-slate-600">CDの方</dt>
          <dd className="break-keep wrap-anywhere">{scan.patient.name || '（お名前なし）'}　{scan.patient.birth_date || '生年月日なし'}</dd>
          <dt className="text-slate-600">このカルテ</dt>
          <dd className="break-keep wrap-anywhere">{patient.name}　{patient.birthDate || '生年月日なし'}</dd>
        </dl>
        {scan.several_patients && <p className="mt-2 text-sm text-red-700">このCDには複数の方の画像が入っています。読み取れません。</p>}
        {identity.level !== 'ok' && !scan.several_patients && (
          <label className="mt-2 flex items-start gap-2 text-sm text-slate-800 max-lg:min-h-10">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-teal-700" checked={sameConfirmed} onChange={e => setSameConfirmed(e.target.checked)} />
            <span>このCDは、このカルテの患者さんのものです（確かめました）</span>
          </label>
        )}
      </div>

      {/* 検査 */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">読み取る検査</p>
        {note}
        <ul className="space-y-3">
          {scan.studies.map(st => (
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

      {extra}

      <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 max-lg:min-h-10">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-teal-700" checked={noText} onChange={e => setNoText(e.target.checked)} />
        <span>上の見本の画像に、お名前・IDなどの文字が写り込んでいないことを確かめました（画像そのものはAIに送られます）</span>
      </label>

      {actions}
    </div>
  )
}

/** CDを探している・選んでいるところ（読影と相談で共通） */
function CdPicking({ wizard, onPick, onCancel }: { wizard: Wizard; onPick: (s: ReaderSource) => void; onCancel: () => void }) {
  if (wizard.step === 'sources') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-700">どれを読み込みますか？</p>
        <div className="flex flex-wrap gap-2">
          {wizard.sources.map(s => (
            <Button key={s.path} type="button" variant="outline" onClick={() => onPick(s)}>
              {s.kind === 'cd' ? 'CD' : s.kind === 'usb' ? 'USB' : 'フォルダ'}：{s.label}
            </Button>
          ))}
          <Button type="button" variant="ghost" onClick={onCancel}>やめる</Button>
        </div>
      </div>
    )
  }
  if (wizard.step === 'scanning') {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-700">
        <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden />
        「{wizard.label}」の中身を確かめています（枚数が多いと1分ほどかかります）
      </p>
    )
  }
  return null
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
  // 相談：どのレポートの欄を開いているか・気づいたこと・場所・どの相談の答えを広げているか
  const [consultFor, setConsultFor] = useState<string | null>(null)
  const [observation, setObservation] = useState('')
  const [location, setLocation] = useState('')
  const [openConsult, setOpenConsult] = useState<string | null>(null)
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

  async function begin(purpose: Purpose) {
    setError(null)
    setBusy(purpose.kind === 'read' ? 'begin' : `consult-begin:${purpose.reportId}`)
    try {
      const sources = await readerSources()
      if (sources.length === 0) {
        setError('CDが見つかりません。患者さんのCDをパソコンに入れてから、もう一度押してください。')
      } else if (sources.length === 1) {
        await scan(sources[0], purpose)
      } else {
        setWizard({ step: 'sources', sources, purpose })
      }
    } catch (e) {
      fail(e, 'CDを確かめられませんでした')
    } finally {
      setBusy(null)
    }
  }

  async function scan(source: ReaderSource, purpose: Purpose) {
    setError(null)
    setWizard({ step: 'scanning', label: source.label, purpose })
    try {
      const result = await readerScan(source.path)
      if (!alive.current) return
      // 相談のときは、レポートと同じ撮影日の検査を選んでおく
      const report = purpose.kind === 'consult' ? reports.find(r => r.id === purpose.reportId) : undefined
      const pick = report ? studiesForReport(result.studies, report) : { uids: result.studies.map(s => s.uid), matched: true }
      setSelected(pick.uids)
      setNoText(false)
      setSameConfirmed(false)
      setWizard({ step: 'review', scan: result, purpose, dateMatched: pick.matched })
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

  async function startConsult(scanResult: ReaderScan, report: ImagingReport) {
    setError(null)
    setBusy('start')
    try {
      await readerStartConsult({
        path: scanResult.path,
        studies: selected,
        patient: { id: patient.id, name: patient.name, birthDate: patient.birthDate ?? '', gender: patient.gender ?? '' },
        complaint: report.complaint ?? '',
        confirmedNoText: noText,
        reportId: report.id,
        observation: observation.trim(),
        location: location.trim(),
        prior: consultPrior(report),
      })
      setWizard(null)
      setConsultFor(null)
      setObservation('')
      setLocation('')
      setNow(Date.now())
      await refresh()
    } catch (e) {
      fail(e, 'AIに見直しを頼めませんでした')
    } finally {
      setBusy(null)
    }
  }

  async function saveConsult(job: ReaderJob) {
    const result = job.result
    const report = reports.find(r => r.id === job.reportId)
    if (!isConsultResult(result) || !report || busy) return
    setError(null)
    setBusy(job.id)
    try {
      const blob = await readerPdf(job.id)
      const id = nanoid()
      const { storagePath, bytes } = await uploadReportPdf({ patientId: patient.id, reportId: id, blob })
      const consult = toImagingConsult({
        id, result, observation: job.observation ?? '', location: job.location, storagePath, bytes,
        askedAt: new Date().toISOString(), askedBy: getCurrentUser()?.name,
      })
      saveImagingReport({ ...report, consults: [...(report.consults ?? []), consult] })
      // カルテに入ったら、パソコンに残した答え（PDF・図）は消す
      await readerRemove(job.id).catch(() => undefined)
      setOpenConsult(id)
      onUpdate()
      await refresh()
    } catch (e) {
      fail(e, 'カルテに残せませんでした')
    } finally {
      setBusy(null)
    }
  }

  async function removeConsult(report: ImagingReport, consult: ImagingConsult) {
    if (!window.confirm(`${consult.askedAt.slice(0, 10)} の相談（${consult.headline}）を削除しますか？（クラウドのPDFも消えます）`)) return
    setError(null)
    try {
      await deleteReportFile(consult.storagePath)
      saveImagingReport({ ...report, consults: (report.consults ?? []).filter(c => c.id !== consult.id) })
      onUpdate()
    } catch (e) {
      fail(e, '削除できませんでした')
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
    if (!job.result || isConsultResult(job.result) || busy) return
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
    const n = report.consults?.length ?? 0
    if (!window.confirm(`${report.studyDate || report.submittedAt.slice(0, 10)} の画像レポート（${report.region}）を削除しますか？（クラウドのPDF${n ? `と、AIへの相談 ${n}件` : ''}も消えます）`)) return
    setError(null)
    try {
      // 相談のPDFを先に消し、最後にレポートのPDF（途中で失敗したら、カルテの記録は残す）
      for (const path of reportFilePaths(report).reverse()) await deleteReportFile(path)
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
  const canConsult = ready && readerCanConsult(health)
  const readWizard = wizard?.purpose.kind === 'read' ? wizard : null
  const consultWizard = (reportId: string) => (wizard?.purpose.kind === 'consult' && wizard.purpose.reportId === reportId ? wizard : null)

  /** 提出済みのレポートの「気づいたことをAIに相談」の欄 */
  function consultPanel(r: ImagingReport) {
    const w = consultWizard(r.id)
    return (
      <div className="mt-3 space-y-3 rounded-lg border border-teal-200 bg-teal-50/40 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ScanSearch className="h-4 w-4 text-teal-700" aria-hidden />
          気づいたことを、AIに原画像で見直してもらう
        </p>
        {health === 'checking' && <p className="text-sm text-slate-600">このパソコンの読影プログラムを確かめています…</p>}
        {health === null && (
          <p className="text-sm text-slate-700">
            AIに画像を見直してもらうのは、<b>読影プログラムを入れた院のパソコン</b>でだけできます（CDをもう一度読み込みます）。院のパソコンでこのカルテを開いてください。
          </p>
        )}
        {ready && !canConsult && (
          <p className="text-sm text-amber-800">
            このパソコンの読影プログラムが古い版です（相談に対応していません）。読影プログラムを新しくしてから使ってください（tools/dicom-reader/install.ps1 をもう一度）。
          </p>
        )}
        {canConsult && !w && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              気づいたこと（必須）
              <textarea value={observation} onChange={e => setObservation(e.target.value)} rows={3} maxLength={MAX_OBSERVATION_CHARS}
                className={cn(fieldClass, 'mt-1 resize-none')}
                placeholder="例：MRIのSTIRで、外側の大腿骨顆に骨挫傷のような高信号があるように見えます。レポートでは触れられていません。" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              場所（任意。シリーズ・何枚目・部位）
              <input value={location} onChange={e => setLocation(e.target.value)} maxLength={MAX_LOCATION_CHARS} className={cn(fieldClass, 'mt-1')}
                placeholder="例：MRI 冠状断 STIR の 12〜14枚目、外側" />
            </label>
            <p className="text-xs text-slate-500">
              CDをもう一度パソコンに入れて読み込むと、AIがその場所の原画像を前後のスライス・別の断面と合わせて見直し、答えをPDFにします（5〜15分・院長の Claude の使用枠を使います）。お名前は書かないでください。
            </p>
            {blocked && <p className="text-sm text-red-700">このパソコンの読影プログラムの準備ができていません（下の「CDのDICOMを読み取る」の欄をご覧ください）。</p>}
            {health.running && !active && <p className="text-sm text-amber-800">ほかの読影・見直しが動いています。終わってから始めてください。</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => begin({ kind: 'consult', reportId: r.id })}
                disabled={!observation.trim() || busy !== null || blocked || Boolean(health.running) || wizard !== null}>
                {busy === `consult-begin:${r.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                CDを読み込む
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConsultFor(null)}>閉じる</Button>
            </div>
          </div>
        )}
        {w && w.step !== 'review' && <CdPicking wizard={w} onPick={s => scan(s, w.purpose)} onCancel={() => setWizard(null)} />}
        {w?.step === 'review' && identity && (
          <CdReview
            scan={w.scan} patient={patient} identity={identity} selected={selected} setSelected={setSelected}
            sameConfirmed={sameConfirmed} setSameConfirmed={setSameConfirmed} noText={noText} setNoText={setNoText}
            note={!w.dateMatched && (
              <p className="mb-2 text-sm text-amber-800">このCDに、レポートの撮影日（{r.studyDate}）と同じ日の検査がありません。見直す検査を選んでください。</p>
            )}
            extra={<Observation observation={observation.trim()} location={location.trim()} />}
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => startConsult(w.scan, r)} disabled={!canStart || !observation.trim() || busy !== null}>
                  {busy === 'start' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  AIに見直してもらう
                </Button>
                <Button type="button" variant="ghost" onClick={() => setWizard(null)}>やめる</Button>
                <span className="text-xs text-slate-500">5〜15分ほど・院長の Claude の使用枠を使います</span>
              </div>
            )}
          />
        )}
      </div>
    )
  }

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
                    <Button type="button" variant="outline" size="sm" onClick={() => setConsultFor(consultFor === r.id ? null : r.id)} aria-expanded={consultFor === r.id}>
                      <ScanSearch className="mr-1 h-4 w-4" aria-hidden />
                      気づいたことをAIに相談
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

                {/* AIへの相談（見直し）の記録 */}
                {(r.consults?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">AIへの相談（{r.consults!.length}件）</p>
                    <ul className="space-y-2">
                      {[...r.consults!].reverse().map(c => (
                        <li key={c.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="flex flex-wrap items-center gap-2 text-sm">
                                <VerdictBadge verdict={c.verdict} />
                                <span className="font-medium text-slate-900">{c.headline}</span>
                              </p>
                              <p className="text-xs text-slate-600">{c.askedAt.slice(0, 10)}{c.askedBy ? `（${c.askedBy}）` : ''}　気づいたこと：{c.observation}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <a href={reportUrl(c.storagePath, c.fileName)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>PDFを開く</a>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenConsult(openConsult === c.id ? null : c.id)} aria-expanded={openConsult === c.id}>
                                {openConsult === c.id ? '閉じる' : '答えを見る'}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:text-red-800" onClick={() => removeConsult(r, c)}>削除</Button>
                            </div>
                          </div>
                          {openConsult === c.id && (
                            <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
                              <Observation observation={c.observation} location={c.location} />
                              <ConsultAnswer answer={c.answer} next={c.next} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {consultFor === r.id && consultPanel(r)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── このパソコンの読影・見直し（進行中・下書き） ── */}
      {jobs.map(job => {
        const isConsult = job.kind === 'consult'
        const target = isConsult ? reports.find(r => r.id === job.reportId) : undefined
        return (
          <Card key={job.id} className={cn('p-4', job.status === 'done' && 'border-amber-300')}>
            {(job.status === 'queued' || job.status === 'running') && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden />
                    {isConsult ? '画像を見直しています' : '読影しています'}（{elapsed(job.created, now)}）
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => cancel(job)}>中止する</Button>
                </div>
                {isConsult && <Observation observation={job.observation ?? ''} location={job.location} />}
                <p className="text-sm text-slate-700">{job.stage}</p>
                <p className="text-xs text-slate-500">
                  {isConsult
                    ? '5〜15分ほどかかります。この画面を閉じても、パソコンの中で続きます（終わったら、このタブに答えが出ます）。'
                    : '10〜25分ほどかかります。この画面を閉じても、パソコンの中で続きます（終わったら、このタブに下書きが出ます）。'}
                </p>
                {job.log && job.log.length > 1 && (
                  <ul className="max-h-32 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {job.log.slice(-8).map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                )}
              </div>
            )}

            {job.status === 'done' && isConsultResult(job.result) && (
              <div className="space-y-3">
                <div>
                  <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">AIの答え（まだカルテに残していません）</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {target ? `${target.region}（撮影日 ${target.studyDate || '不明'}）の画像レポートについての相談` : 'この相談の画像レポートが、このカルテに見つかりません（削除されたかもしれません）'}
                    <span className="ml-2 text-xs text-slate-500">見直し {job.result.minutes}分</span>
                  </p>
                </div>
                <Observation observation={job.observation ?? ''} location={job.location} />
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <VerdictBadge verdict={job.result.verdict} />
                  <span className="font-semibold text-slate-900">{job.result.headline}</span>
                </p>
                <ConsultAnswer answer={job.result.answer} next={job.result.next} />
                {job.warnings && job.warnings.length > 0 && (
                  <p className="text-xs text-amber-800">形の整っていない所がありました（PDFをご確認ください）：{job.warnings.slice(0, 3).join(' / ')}</p>
                )}
                <p className="text-xs text-slate-600">AIの参考意見です。PDF（図つき）で見直した場所を確かめてから、カルテに残してください。残すと、このパソコンの答えは消えます。</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => openDraft(job)}>PDFを開く</Button>
                  <Button type="button" onClick={() => saveConsult(job)} disabled={busy !== null || !target}>
                    {busy === job.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                    カルテに残す
                  </Button>
                  <Button type="button" variant="ghost" className="text-red-700 hover:text-red-800" onClick={() => discard(job, 'このAIの答えを破棄しますか？（見直しはやり直しになります）')}>破棄する</Button>
                </div>
              </div>
            )}

            {job.status === 'done' && job.result && !isConsultResult(job.result) && (
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
                  <p className="text-sm font-semibold text-slate-800">
                    {job.status === 'cancelled'
                      ? (isConsult ? '見直しを中止しました' : '読影を中止しました')
                      : (isConsult ? '見直しできませんでした' : '読影できませんでした')}
                    （{job.created.slice(0, 16).replace('T', ' ')}）
                  </p>
                  {job.status === 'error' && <p className="mt-1 text-sm text-red-700">{job.error}</p>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => discard(job, null)}>消す</Button>
              </div>
            )}
          </Card>
        )
      })}

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
              <li>ブラウザが「このパソコンの中のアプリ（ローカル ネットワーク）へのアクセス」の許可を聞いてきたら「許可」を選んでください。「ブロック」にしたときは、アドレス欄の左のアイコン →「サイトの設定」で「許可」に直せます。</li>
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
            <Button type="button" onClick={() => begin({ kind: 'read' })} disabled={busy !== null || blocked || Boolean(health.running)}>
              {busy === 'begin' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              CDを読み込む
            </Button>
          </div>
        )}

        {ready && wizard && !readWizard && <p className="text-sm text-slate-600">相談のためにCDを読み込んでいます（上の画像レポートの欄）。</p>}

        {readWizard && readWizard.step !== 'review' && <CdPicking wizard={readWizard} onPick={s => scan(s, readWizard.purpose)} onCancel={() => setWizard(null)} />}

        {readWizard?.step === 'review' && identity && (
          <CdReview
            scan={readWizard.scan} patient={patient} identity={identity} selected={selected} setSelected={setSelected}
            sameConfirmed={sameConfirmed} setSameConfirmed={setSameConfirmed} noText={noText} setNoText={setNoText}
            extra={(
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
            )}
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => start(readWizard.scan)} disabled={!canStart || busy !== null}>
                  {busy === 'start' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  読影を始める
                </Button>
                <Button type="button" variant="ghost" onClick={() => setWizard(null)}>やめる</Button>
                <span className="text-xs text-slate-500">10〜25分ほど・院長の Claude の使用枠を使います</span>
              </div>
            )}
          />
        )}
      </Card>
    </div>
  )
}
