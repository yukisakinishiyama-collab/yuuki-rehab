'use client'
// ──────────────────────────────────────────────
// 問診票を撮って、患者さんの基本情報を登録する（2026-11-19 院長の依頼。DECISIONS.md）
//
// 1. 撮る … iPhone・Android・iPad のカメラで問診票を撮る（表・裏など4枚まで）。写真を選ぶこともできる
// 2. 読み取る … 写真を AI（Anthropic）へ送って文字を読み取る（押す前に、送ることを画面に出す）
// 3. 確かめる … 読み取った内容が欄に入る。写真と見比べて直す（読みにくかった欄には印）
//    - 同じ方のカルテ（予約から自動で登録したカルテなど）があれば、そのカルテに足す。無ければ新しいカルテ
//    - 今あるカルテに足すときは、空いている欄だけを埋める。カルテと問診票でちがう欄は、どちらにするかを選ぶ
// 4. 保存 … カルテ（基本情報）と、問診票の写真（資料タブの「問診票」）
// 写真なしで、基本情報を手で入れる・直すこともできる（今まで、カルテを作ったあとに直す画面が無かった）。
// 決まりは lib/karte/intake-scan.ts、AI の読み取りは lib/karte/intake-scan-server.ts。
// ──────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { nanoid } from 'nanoid'
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, ImagePlus, Loader2, ScanText, X, ZoomIn } from 'lucide-react'
import type { BodyRegion, Gender, Patient } from '@/types/patient'
import { BODY_REGION_LABELS } from '@/types/patient'
import { getPatient, getPatients, initPatientStore, savePatient } from '@/lib/patient-store'
import { calcAge } from '@/lib/rehab-algorithms'
import {
  appendNote,
  chartsForSheet,
  checkInfo,
  emptyInfo,
  infoFromPatient,
  INTAKE_PREFILL_KEY,
  intakePrefillOf,
  jstDate,
  MAX_SCAN_IMAGES,
  mergeScanIntoInfo,
  patientFromInfo,
  scanFieldLabel,
  scanIsEmpty,
  sheetNoteOf,
  type InfoProblem,
  type IntakeScanResult,
  type PatientInfoValues,
  type ScanConflict,
  type ScanFieldKey,
} from '@/lib/karte/intake-scan'
import { prepareSheetPhoto, releaseSheetPhoto, requestSheetScan, saveSheetPhotos, type SheetPhoto } from '@/lib/karte/intake-scan-client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import CameraCapture, { canUseInAppCamera } from './CameraCapture'

type Stage = 'shoot' | 'reading' | 'review' | 'saving' | 'done'
type InfoKey = keyof PatientInfoValues

const REGIONS = Object.keys(BODY_REGION_LABELS).filter((k) => k !== 'functional') as BodyRegion[]
const inputClass =
  'min-h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1'

/** 画面の欄が、読み取りのどの欄から来るか（読みにくかった欄の印を出すため） */
const UNCLEAR_OF: Partial<Record<InfoKey, ScanFieldKey>> = {
  name: 'name',
  kana: 'kana',
  birthDate: 'birthDate',
  gender: 'gender',
  phone: 'phone',
  postalCode: 'postalCode',
  address: 'address',
  email: 'email',
  occupation: 'occupation',
  emergencyContact: 'emergencyContact',
  mainComplaint: 'chiefComplaint',
  onsetDate: 'onset',
}

function conflictText(key: InfoKey, value: string): string {
  if (key === 'gender') return value === 'male' ? '男性' : value === 'female' ? '女性' : 'その他'
  if (key === 'bodyRegion') return BODY_REGION_LABELS[value as BodyRegion] ?? value
  return value
}

interface DoneInfo {
  patient: Patient
  created: boolean
  photos: number
  photosSaved: number
  photoError: string
  hasPrefill: boolean
}

export default function IntakeScanFlow({ patientId }: { patientId?: string }) {
  const today = jstDate()
  const [ready, setReady] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  /** カルテの中から開いたとき（そのカルテに足す・直す） */
  const [fixed, setFixed] = useState<Patient | null>(null)
  const [missing, setMissing] = useState(false)
  const [photos, setPhotos] = useState<SheetPhoto[]>([])
  const [stage, setStage] = useState<Stage>('shoot')
  const [scan, setScan] = useState<IntakeScanResult | null>(null)
  /** 保存先：'new'＝新しいカルテ／カルテの ID／''＝まだ選んでいない */
  const [targetId, setTargetId] = useState('new')
  const [values, setValues] = useState<PatientInfoValues>(emptyInfo)
  const [filled, setFilled] = useState<InfoKey[]>([])
  const [conflicts, setConflicts] = useState<ScanConflict[]>([])
  const [addNote, setAddNote] = useState(true)
  const [error, setError] = useState('')
  const [problems, setProblems] = useState<InfoProblem[]>([])
  const [camera, setCamera] = useState(false)
  const [busyPhoto, setBusyPhoto] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [done, setDone] = useState<DoneInfo | null>(null)
  // ホーム画面のアプリでも開けるよう、使える端末ではアプリ内カメラを出す（サーバー側では false）
  const inAppCamera = useSyncExternalStore(() => () => {}, canUseInAppCamera, () => false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<SheetPhoto[]>([])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  // 画面を離れたら、写真の控えを端末から消す
  useEffect(() => () => photosRef.current.forEach(releaseSheetPhoto), [])

  // カルテの一覧を読む（ほかの端末・予約からの自動登録で増えたカルテを取りこぼさないよう、クラウドとそろえてから）
  useEffect(() => {
    let alive = true
    ;(async () => {
      initPatientStore()
      try {
        const { pullAtStartup, isSyncEnabled } = await import('@/lib/sync-service')
        if (isSyncEnabled()) await pullAtStartup()
      } catch {
        // そろえられなくても、この端末のカルテで続ける
      }
      if (!alive) return
      const list = getPatients()
      setPatients(list)
      if (patientId) {
        const p = list.find((x) => x.id === patientId) ?? null
        if (p) {
          setFixed(p)
          setTargetId(p.id)
          setValues(infoFromPatient(p))
        } else {
          setMissing(true)
        }
      }
      setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [patientId])

  const matches = useMemo(
    () => (scan && !fixed ? chartsForSheet(patients, { name: scan.name, kana: scan.kana, phone: scan.phone, birthDate: scan.birthDate }) : []),
    [scan, fixed, patients],
  )
  const target = targetId && targetId !== 'new' ? (patients.find((p) => p.id === targetId) ?? null) : null
  const unclear = useMemo(() => new Set<ScanFieldKey>(scan?.unclear ?? []), [scan])
  const sheetNote = scan ? sheetNoteOf(scan, today) : ''

  /** 保存先を決めて、欄を入れ直す（今あるカルテなら、その値に問診票の内容を重ねる） */
  function applyTarget(id: string, result: IntakeScanResult | null, list: Patient[] = patients) {
    setTargetId(id)
    setProblems([])
    const base = id && id !== 'new' ? (list.find((p) => p.id === id) ?? null) : null
    const current = base ? infoFromPatient(base) : emptyInfo()
    if (!result) {
      setValues(current)
      setFilled([])
      setConflicts([])
      return
    }
    const merged = mergeScanIntoInfo(current, result)
    setValues(merged.values)
    setFilled(merged.filled)
    setConflicts(merged.conflicts)
  }

  async function addFiles(files: FileList | File[] | null | undefined) {
    const list = Array.from(files ?? [])
    if (list.length === 0) return
    setError('')
    setBusyPhoto(true)
    const room = MAX_SCAN_IMAGES - photosRef.current.length
    const added: SheetPhoto[] = []
    let failed = ''
    for (const file of list.slice(0, Math.max(0, room))) {
      try {
        added.push(await prepareSheetPhoto(file))
      } catch (e) {
        failed = e instanceof Error ? e.message : '写真を読み込めませんでした'
      }
    }
    setBusyPhoto(false)
    if (added.length) setPhotos((prev) => [...prev, ...added])
    if (failed) setError(failed)
    else if (list.length > room) setError(`写真は${MAX_SCAN_IMAGES}枚までです。`)
    if (cameraRef.current) cameraRef.current.value = ''
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const hit = prev.find((p) => p.id === id)
      if (hit) releaseSheetPhoto(hit)
      return prev.filter((p) => p.id !== id)
    })
  }

  async function read() {
    if (photos.length === 0 || stage === 'reading') return
    setError('')
    setStage('reading')
    try {
      const result = await requestSheetScan(photos)
      if (!result.isIntakeSheet || scanIsEmpty(result)) {
        setStage('shoot')
        setError('問診票の文字を読み取れませんでした。紙の全体が入るように、明るい場所で撮り直してください（手で入力することもできます）。')
        return
      }
      // 読み取っている間に増えたカルテ（予約からの自動登録など）も見る
      const list = getPatients()
      setPatients(list)
      setScan(result)
      if (fixed) {
        applyTarget(fixed.id, result, list)
      } else {
        const found = chartsForSheet(list, { name: result.name, kana: result.kana, phone: result.phone, birthDate: result.birthDate })
        // お名前のほかにも同じもの（生年月日・電話）があるカルテが1つだけなら、最初からそのカルテを選んでおく。
        // お名前だけ同じ・候補が2つ以上のときは、どのカルテかを人が選ぶ（ちがう方のカルテに書きこまないため）
        const strong = found.filter((m) => m.strong)
        applyTarget(found.length === 0 ? 'new' : strong.length === 1 ? strong[0].patient.id : '', result, list)
      }
      setStage('review')
      window.scrollTo({ top: 0 })
    } catch (e) {
      setStage('shoot')
      setError(e instanceof Error ? e.message : '読み取れませんでした')
    }
  }

  function manual() {
    setError('')
    setScan(null)
    applyTarget(fixed ? fixed.id : 'new', null)
    setStage('review')
  }

  function set<K extends InfoKey>(key: K, value: PatientInfoValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setProblems((list) => list.filter((p) => p.key !== key))
  }

  /** カルテと問診票でちがう欄：問診票の値にする */
  function takeSheet(c: ScanConflict) {
    setValues((v) => ({ ...v, [c.key]: c.sheet }))
    setConflicts((list) => list.filter((x) => x.key !== c.key))
    setFilled((list) => (list.includes(c.key) ? list : [...list, c.key]))
  }

  async function save() {
    setError('')
    if (!targetId) {
      setError('保存先のカルテを選んでください（上の「どのカルテに保存しますか」）。')
      document.getElementById('scan-target')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const found = checkInfo(values, today)
    setProblems(found)
    if (found.length > 0) {
      document.getElementById(`scan-${found[0].key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    // 今あるカルテは、保存の直前に読み直す（開いている間にほかの端末で変わった欄を、古い値で上書きしないため）
    const base = targetId === 'new' ? null : (getPatient(targetId) ?? null)
    if (targetId !== 'new' && !base) {
      setError('保存先のカルテが見つかりませんでした。カルテの一覧から開き直してください。')
      return
    }
    setStage('saving')
    const note = scan && addNote ? sheetNote : ''
    const patient = patientFromInfo(
      base,
      { ...values, therapistNotes: appendNote(values.therapistNotes, note) },
      { id: nanoid(), now: new Date().toISOString(), today },
    )
    savePatient(patient)
    let photosSaved = 0
    let photoError = ''
    if (photos.length > 0) {
      const r = await saveSheetPhotos(patient.id, photos, today)
      photosSaved = r.saved
      photoError = r.error
    }
    // カルテの「問診票」タブの欄に入れる下書き（この端末のこの画面の間だけ。保存はスタッフが確かめてから）
    const prefill = scan ? intakePrefillOf(scan) : null
    if (prefill) {
      try {
        sessionStorage.setItem(`${INTAKE_PREFILL_KEY}:${patient.id}`, JSON.stringify(prefill))
      } catch {
        // 下書きを渡せないだけ
      }
    }
    setDone({ patient, created: !base, photos: photos.length, photosSaved, photoError, hasPrefill: Boolean(prefill) })
    setStage('done')
    window.scrollTo({ top: 0 })
  }

  function restart() {
    photos.forEach(releaseSheetPhoto)
    setPhotos([])
    setScan(null)
    setDone(null)
    setError('')
    setProblems([])
    setFilled([])
    setConflicts([])
    setAddNote(true)
    setPatients(getPatients())
    setTargetId(fixed ? fixed.id : 'new')
    setValues(fixed ? infoFromPatient(getPatient(fixed.id) ?? fixed) : emptyInfo())
    setStage('shoot')
  }

  const backHref = fixed ? `/patients/${fixed.id}` : '/patients'
  const title = fixed ? `${fixed.name}さんの基本情報` : '問診票を撮って登録'

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500" role="status">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        カルテを読み込んでいます…
      </div>
    )
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <p className="text-sm text-slate-700">このカルテが見つかりませんでした。カルテの一覧から開き直してください。</p>
        <Link href="/patients" className={cn(buttonVariants({ variant: 'outline' }))}>
          カルテの一覧へ
        </Link>
      </div>
    )
  }

  // ── 完了 ──
  if (stage === 'done' && done) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-teal-700" aria-hidden />
            <p className="text-lg font-black text-slate-900">{done.created ? '新しいカルテを登録しました' : 'カルテに保存しました'}</p>
            <p className="break-keep text-base font-bold text-slate-900 wrap-anywhere">{done.patient.name}さん</p>
            {done.photos > 0 && done.photosSaved === done.photos && (
              <p className="text-sm text-slate-600">問診票の写真（{done.photosSaved}枚）は、カルテの「資料」タブの「問診票」に入れました。</p>
            )}
            {done.photos > 0 && done.photosSaved < done.photos && (
              <p role="alert" className="rounded-lg bg-amber-50 p-3 text-left text-sm text-amber-900">
                基本情報は保存しましたが、問診票の写真は{done.photosSaved > 0 ? `${done.photos - done.photosSaved}枚` : ''}保存できませんでした（{done.photoError}）。
                紙の問診票を残しておき、あとでカルテの「資料」タブから入れてください。
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Link href={`/patients/${done.patient.id}`} className={cn(buttonVariants({ size: 'lg' }))}>
                カルテを開く
              </Link>
              {done.hasPrefill && (
                <Link href={`/patients/${done.patient.id}?tab=intake`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
                  症状などを、カルテの問診票の欄にも入れる
                </Link>
              )}
              {!fixed && (
                <Button variant="outline" size="lg" onClick={restart}>
                  続けて次の方を登録する
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const reviewing = stage === 'review' || stage === 'saving'
  const saving = stage === 'saving'

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* 見出し */}
      <div>
        <Link href={backHref} className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 max-lg:min-h-10">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {fixed ? 'カルテへ戻る' : 'カルテの一覧へ'}
        </Link>
        <h1 className="break-keep text-2xl font-semibold tracking-tight text-slate-900 wrap-anywhere">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {reviewing
            ? scan
              ? '読み取った内容を、写真と見比べて確かめてください。直したら、いちばん下の保存を押します。'
              : '基本情報を入れて、いちばん下の保存を押します。'
            : '問診票をカメラで撮ると、お名前・生年月日・ご連絡先・症状を読み取って、登録の欄に入れます。'}
        </p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      {/* ── 1. 撮る ── */}
      {!reviewing && (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap gap-2">
              {inAppCamera ? (
                <Button onClick={() => { setError(''); setCamera(true) }} disabled={photos.length >= MAX_SCAN_IMAGES || stage === 'reading'} size="lg">
                  <Camera className="h-5 w-5" aria-hidden />
                  カメラで撮る
                </Button>
              ) : (
                // スマホのブラウザでは display:none の入力を click() で開けないことがあるため、<label> で直接開く（入力は sr-only）
                <label className={cn(buttonVariants({ size: 'lg' }), 'cursor-pointer', (photos.length >= MAX_SCAN_IMAGES || stage === 'reading') && 'pointer-events-none opacity-50')}>
                  <Camera className="h-5 w-5" aria-hidden />
                  カメラで撮る
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void addFiles(e.target.files)} />
                </label>
              )}
              <label className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'cursor-pointer', (photos.length >= MAX_SCAN_IMAGES || stage === 'reading') && 'pointer-events-none opacity-50')}>
                <ImagePlus className="h-5 w-5" aria-hidden />
                写真を選ぶ
                <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void addFiles(e.target.files)} />
              </label>
            </div>

            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>紙の全体が入るように、真上から撮ります。影や光の反射が入らない、明るい場所で。</li>
              <li>裏面や2枚目があるときは、続けて撮ります（{MAX_SCAN_IMAGES}枚まで）。</li>
            </ul>

            {busyPhoto && (
              <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                写真を準備しています…
              </p>
            )}

            {photos.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p, i) => (
                  <li key={p.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <button type="button" onClick={() => { setZoom(1); setViewing(i) }} className="block w-full" aria-label={`${i + 1}枚目を大きく見る`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.preview} alt={`問診票の写真 ${i + 1}枚目`} className="h-40 w-full object-contain" />
                    </button>
                    <span className="absolute left-1.5 top-1.5 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs font-bold text-white">{i + 1}枚目</span>
                    {stage !== 'reading' && (
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        aria-label={`${i + 1}枚目を消す`}
                        className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow hover:bg-white"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3 border-t border-slate-200 pt-4">
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                「AIで読み取る」を押すと、問診票の写真を AI（Anthropic・米国の会社のサービス）へ送って、文字を読み取ります。
                読み取った内容はそのまま保存されません。次の画面で確かめて、直してから保存します。
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => void read()} disabled={photos.length === 0 || stage === 'reading' || busyPhoto}>
                  {stage === 'reading' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ScanText className="h-5 w-5" aria-hidden />}
                  {stage === 'reading' ? '読み取っています…（10〜30秒）' : 'AIで読み取る'}
                </Button>
                {stage !== 'reading' && (
                  <button type="button" onClick={manual} className="text-sm font-medium text-teal-700 underline underline-offset-4 max-lg:min-h-10">
                    写真なしで、手で入力する
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 3. 確かめる ── */}
      {reviewing && (
        <div className={cn('grid gap-5', photos.length > 0 && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]')}>
          {/* 写真（PC は左に置いたまま。スマホは上に小さく出し、右下のボタンでいつでも大きく見られる） */}
          {photos.length > 0 && (
            <div className="lg:sticky lg:top-4 lg:self-start">
              <Card>
                <CardContent className="space-y-2 p-3">
                  <p className="text-sm font-bold text-slate-700">問診票の写真（押すと大きく見られます）</p>
                  <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto lg:max-h-[70vh] lg:grid-cols-1">
                    {photos.map((p, i) => (
                      <button key={p.id} type="button" onClick={() => { setZoom(1); setViewing(i) }} className="block overflow-hidden rounded-lg border border-slate-200" aria-label={`${i + 1}枚目を大きく見る`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.preview} alt={`問診票の写真 ${i + 1}枚目`} className="w-full object-contain" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="min-w-0 space-y-4">
            {/* 保存先のカルテ */}
            {!fixed && scan && matches.length > 0 && (
              <Card id="scan-target" className={cn('scroll-mt-24', !targetId && 'border-amber-400')}>
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm font-bold text-slate-900">どのカルテに保存しますか</p>
                  <p className="text-sm text-slate-600">同じ方かもしれないカルテがあります。同じ方なら、そのカルテに足します（空いている欄だけを埋めます）。</p>
                  <div className="space-y-2" role="radiogroup" aria-label="保存先のカルテ">
                    {matches.map((m) => (
                      <label key={m.patient.id} className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3', targetId === m.patient.id ? 'border-teal-700 bg-teal-50' : 'border-slate-200 bg-white')}>
                        <input type="radio" name="scan-target" className="mt-1 h-5 w-5 shrink-0 accent-teal-700" checked={targetId === m.patient.id} onChange={() => applyTarget(m.patient.id, scan)} />
                        <span className="min-w-0 text-sm">
                          <span className="break-keep font-bold text-slate-900 wrap-anywhere">{m.patient.name}さんのカルテに足す</span>
                          <span className="block text-slate-600">
                            {m.reason}
                            {m.patient.autoCreatedFrom === 'reservation' ? '・予約から自動で登録したカルテ' : ''}
                            {m.patient.birthDate ? `・生年月日 ${m.patient.birthDate}` : ''}
                            {m.patient.phone ? `・電話 ${m.patient.phone}` : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                    <label className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3', targetId === 'new' ? 'border-teal-700 bg-teal-50' : 'border-slate-200 bg-white')}>
                      <input type="radio" name="scan-target" className="mt-1 h-5 w-5 shrink-0 accent-teal-700" checked={targetId === 'new'} onChange={() => applyTarget('new', scan)} />
                      <span className="text-sm">
                        <span className="font-bold text-slate-900">別の方です。新しいカルテを作る</span>
                      </span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {target && (
              <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
                <b className="break-keep wrap-anywhere">{target.name}さん</b>のカルテに保存します。
                {scan ? 'カルテに入っていた欄はそのままにして、空いていた欄に問診票の内容を入れました。' : ''}
              </p>
            )}

            {scan && scan.unclear.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  読みにくかった欄があります（{scan.unclear.map(scanFieldLabel).join('・')}）。写真と見比べて確かめてください。
                </span>
              </p>
            )}

            <Card>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <h2 className="text-base font-bold text-slate-900">基本情報</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field k="name" label="お名前" required {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="山田 太郎" autoComplete="off" className={inputClass} />
                  </Field>
                  <Field k="kana" label="ふりがな" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input value={values.kana} onChange={(e) => set('kana', e.target.value)} placeholder="やまだ たろう" autoComplete="off" className={inputClass} />
                  </Field>
                  <Field
                    k="birthDate"
                    label="生年月日"
                    note={[scan?.birthText ? `問診票の書き方：${scan.birthText}` : '', values.birthDate && Number.isFinite(calcAge(values.birthDate)) ? `${calcAge(values.birthDate)}歳` : ''].filter(Boolean).join('　')}
                    {...{ filled, unclear, problems, conflicts, takeSheet }}
                  >
                    <input type="date" value={values.birthDate} max={today} onChange={(e) => set('birthDate', e.target.value)} className={inputClass} />
                  </Field>
                  <Field k="gender" label="性別" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <select value={values.gender} onChange={(e) => set('gender', e.target.value as Gender)} className={inputClass}>
                      <option value="other">その他・未記入</option>
                      <option value="male">男性</option>
                      <option value="female">女性</option>
                    </select>
                  </Field>
                  <Field k="phone" label="電話番号" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input type="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="090-0000-0000" autoComplete="off" className={inputClass} />
                  </Field>
                  <Field k="emergencyContact" label="緊急連絡先" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input value={values.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} placeholder="お名前・続柄・電話番号" autoComplete="off" className={inputClass} />
                  </Field>
                  <Field k="postalCode" label="郵便番号" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input value={values.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="750-0000" inputMode="numeric" autoComplete="off" className={inputClass} />
                  </Field>
                  <Field k="address" label="住所" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input value={values.address} onChange={(e) => set('address', e.target.value)} autoComplete="off" className={inputClass} />
                  </Field>
                  <Field k="email" label="メール" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input type="email" value={values.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" className={inputClass} />
                  </Field>
                  <Field k="occupation" label="職業・学校" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input value={values.occupation} onChange={(e) => set('occupation', e.target.value)} autoComplete="off" className={inputClass} />
                  </Field>
                </div>

                <h2 className="border-t border-slate-200 pt-4 text-base font-bold text-slate-900">症状</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field k="mainComplaint" label="主訴" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                      <input value={values.mainComplaint} onChange={(e) => set('mainComplaint', e.target.value)} placeholder="例：右膝の痛み" autoComplete="off" className={inputClass} />
                    </Field>
                  </div>
                  <Field k="bodyRegion" label="対象部位" note={filled.includes('bodyRegion') ? '主訴の言葉から選びました。ちがえば直してください' : ''} {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <select value={values.bodyRegion} onChange={(e) => set('bodyRegion', e.target.value as BodyRegion)} className={inputClass}>
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {BODY_REGION_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field k="onsetDate" label="発症日" note={scan?.onsetText ? `問診票の書き方：${scan.onsetText}` : ''} {...{ filled, unclear, problems, conflicts, takeSheet }}>
                    <input type="date" value={values.onsetDate} max={today} onChange={(e) => set('onsetDate', e.target.value)} className={inputClass} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field k="therapistNotes" label="担当者メモ" {...{ filled, unclear, problems, conflicts, takeSheet }}>
                      <textarea value={values.therapistNotes} onChange={(e) => set('therapistNotes', e.target.value)} rows={3} className={cn(inputClass, 'resize-y')} />
                    </Field>
                  </div>
                </div>

                {sheetNote && (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-800 max-lg:min-h-10">
                      <input type="checkbox" checked={addNote} onChange={(e) => setAddNote(e.target.checked)} className="h-5 w-5 accent-teal-700" />
                      問診票のほかの内容を、担当者メモのうしろに足す
                    </label>
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{sheetNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={() => { setStage('shoot'); setProblems([]) }} disabled={saving}>
                {photos.length > 0 ? '写真を撮り直す' : '問診票を撮って読み取る'}
              </Button>
              <Button size="lg" onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
                {saving ? '保存しています…' : target ? 'このカルテに保存する' : '新しいカルテを登録する'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* スマホ：欄を直している間も、写真をすぐ大きく見られる */}
      {reviewing && photos.length > 0 && viewing === null && (
        <button
          type="button"
          onClick={() => { setZoom(1); setViewing(0) }}
          className="fixed bottom-24 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-bold text-white shadow-lg hover:bg-teal-800 lg:hidden"
        >
          <ZoomIn className="h-4 w-4" aria-hidden />
          写真を見る
        </button>
      )}

      {/* 写真を大きく見る */}
      {viewing !== null && photos[viewing] && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" role="dialog" aria-modal="true" aria-label="問診票の写真">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-white">
            <div className="flex items-center gap-2">
              {photos.length > 1 &&
                photos.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setViewing(i)} aria-pressed={viewing === i} className={cn('min-h-10 rounded-lg px-3 text-sm font-bold', viewing === i ? 'bg-white text-slate-900' : 'bg-white/15 text-white')}>
                    {i + 1}枚目
                  </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} className="min-h-10 rounded-lg bg-white/15 px-3 text-sm font-bold disabled:opacity-40" aria-label="小さくする">
                −
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} className="min-h-10 rounded-lg bg-white/15 px-3 text-sm font-bold disabled:opacity-40" aria-label="大きくする">
                ＋
              </button>
              <button type="button" onClick={() => setViewing(null)} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-white/15 px-3 text-sm font-bold">
                <X className="h-4 w-4" aria-hidden />
                閉じる
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[viewing].preview} alt={`問診票の写真 ${viewing + 1}枚目`} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} className="mx-auto block" />
          </div>
        </div>
      )}

      {camera && (
        <CameraCapture
          title="問診票を撮る"
          document
          onClose={() => setCamera(false)}
          onCapture={(file) => {
            setCamera(false)
            void addFiles([file])
          }}
        />
      )}
    </div>
  )
}

/** 1つの欄（見出し・問診票から入れた印・読みにくかった印・カルテとちがうときの選びなおし・入力の誤り） */
function Field({
  k,
  label,
  required,
  note,
  filled,
  unclear,
  problems,
  conflicts,
  takeSheet,
  children,
}: {
  k: InfoKey
  label: string
  required?: boolean
  note?: string
  filled: InfoKey[]
  unclear: Set<ScanFieldKey>
  problems: InfoProblem[]
  conflicts: ScanConflict[]
  takeSheet: (c: ScanConflict) => void
  children: React.ReactNode
}) {
  const fromSheet = filled.includes(k)
  const scanKey = UNCLEAR_OF[k]
  const hard = Boolean(scanKey && unclear.has(scanKey))
  const problem = problems.find((p) => p.key === k)
  const conflict = conflicts.find((c) => c.key === k)
  return (
    <div
      id={`scan-${k}`}
      className={cn(
        'scroll-mt-24 space-y-1 rounded-lg',
        // 入力の枠の色は、中の入力欄に掛ける（誤り＝赤・読みにくかった＝黄・ふつう＝灰）
        problem ? '[&_input]:border-red-500 [&_select]:border-red-500' : hard ? '[&_input]:border-amber-500 [&_input]:bg-amber-50 [&_select]:border-amber-500' : '[&_input]:border-slate-300 [&_select]:border-slate-300 [&_textarea]:border-slate-300',
      )}
    >
      <label className="block space-y-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-700">
          {label}
          {required && <span className="text-red-600">*</span>}
          {fromSheet && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800">問診票から</span>}
          {hard && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">写真で確かめる</span>}
        </span>
        {children}
      </label>
      {note && <p className="text-xs text-slate-600">{note}</p>}
      {conflict && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 p-2 text-sm text-sky-900">
          <span className="min-w-0 break-words">
            カルテの値のままにしています。問診票では「{conflictText(k, conflict.sheet)}」
          </span>
          <button type="button" onClick={() => takeSheet(conflict)} className="min-h-10 rounded-lg border border-sky-300 bg-white px-3 text-sm font-bold text-sky-900 hover:bg-sky-100">
            問診票の値にする
          </button>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {problem.message}
        </p>
      )}
    </div>
  )
}
