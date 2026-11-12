'use client'
// ──────────────────────────────────────────────
// 音声でカルテを書く「録音の本体」を、画面の枠（AppShell）に置く
//
// 以前は SOAP の入力欄の中に録音があり、タブを変えたり別の画面へ行くと録音が止まっていた。
// ここに録音を持たせることで、録音したまま他の操作（写真・評価・別のタブ）ができる。
// - 止めると AI で整理し、結果を「その患者さん・その用途（soap / memo）」宛てに持っておく
// - SOAP の入力欄（VoiceKarteCapture）が表示されていれば、すぐ欄に入れる。表示されていなければ、
//   開いたときに入れる（結果は sessionStorage にも控え、画面を読み直しても消えない）
// - 画面の下に小さな「録音中」の帯を出す（どの画面でも止められる）
// ──────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { formatElapsed, useDictation, type DictationProfile, type DictationStatus } from '@/lib/voice/use-dictation'
import { organizeTranscript } from '@/lib/voice/organize-client'
import type { VoiceMemoResult, VoiceSoapResult } from '@/lib/voice/soap-fields'

export type VoiceMode = 'soap' | 'memo'

export interface VoiceTarget {
  patientId: string
  mode: VoiceMode
}

export type VoiceOutcome =
  | { kind: 'soap'; result: VoiceSoapResult; transcript: string; failed: number }
  | { kind: 'memo'; result: VoiceMemoResult; transcript: string; failed: number }
  | { kind: 'error'; message: string; transcript: string }

interface Session {
  target: VoiceTarget
  status: DictationStatus
  elapsedMs: number
  level: number
  lastHeard: string
  pending: number
  error: string
}

interface VoiceSessionContext {
  /** いま録音中（または文字にしている途中）のもの。無ければ null */
  session: Session | null
  /** AI で整理している途中の宛先 */
  organizing: VoiceTarget | null
  /** 録音を始める。別の録音があれば false */
  start: (target: VoiceTarget) => Promise<boolean>
  stop: () => Promise<void>
  cancel: () => Promise<void>
  /** その宛先の結果を取り出す（取り出したら消える） */
  takeOutcome: (target: VoiceTarget) => VoiceOutcome | null
  /** 結果が届いたら呼ばれる（画面が表示されているときに即時に入れるため） */
  subscribe: (target: VoiceTarget, fn: () => void) => () => void
}

const Ctx = createContext<VoiceSessionContext | null>(null)

const STORE_KEY = 'voice_outcomes_v1'
const targetKey = (t: VoiceTarget) => `${t.mode}:${t.patientId}`

function loadOutcomes(): Record<string, VoiceOutcome> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') as Record<string, VoiceOutcome>
  } catch {
    return {}
  }
}
function saveOutcomes(o: Record<string, VoiceOutcome>) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(o))
  } catch {
    /* 控えなので失敗しても続ける */
  }
}

export function VoiceSessionProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<VoiceTarget | null>(null)
  const [organizing, setOrganizing] = useState<VoiceTarget | null>(null)
  const targetRef = useRef<VoiceTarget | null>(null)
  const listeners = useRef(new Map<string, Set<() => void>>())
  const stopRef = useRef<() => Promise<void>>(async () => {})
  // 用途ごとに区切り方が違う（session=長め・1時間まで / field=短め）。録音の本体は1つなので、両方を用意して使い分ける
  const soapDictation = useDictation({ profile: 'session', onLimit: () => void stopRef.current() })
  const memoDictation = useDictation({ profile: 'field' })
  const dictationFor = useCallback((mode: VoiceMode) => (mode === 'soap' ? soapDictation : memoDictation), [soapDictation, memoDictation])

  const notify = useCallback((t: VoiceTarget) => {
    for (const fn of listeners.current.get(targetKey(t)) ?? []) fn()
  }, [])

  const putOutcome = useCallback((t: VoiceTarget, outcome: VoiceOutcome) => {
    const all = loadOutcomes()
    all[targetKey(t)] = outcome
    saveOutcomes(all)
    notify(t)
  }, [notify])

  const start = useCallback(async (t: VoiceTarget) => {
    if (targetRef.current) return false
    targetRef.current = t
    setTarget(t)
    const ok = await dictationFor(t.mode).start()
    if (!ok) {
      targetRef.current = null
      setTarget(null)
    }
    return ok
  }, [dictationFor])

  const stop = useCallback(async () => {
    const t = targetRef.current
    if (!t) return
    const d = dictationFor(t.mode)
    const { transcript, failed } = await d.stop()
    targetRef.current = null
    setTarget(null)
    if (!transcript.replace(/［聞き取れなかった部分］/g, '').trim()) {
      putOutcome(t, { kind: 'error', message: '声を聞き取れませんでした。マイクに近づいて、もう一度お試しください。', transcript: '' })
      return
    }
    setOrganizing(t)
    try {
      if (t.mode === 'soap') {
        const result = await organizeTranscript('soap', transcript)
        putOutcome(t, { kind: 'soap', result, transcript, failed })
      } else {
        const result = await organizeTranscript('memo', transcript)
        putOutcome(t, { kind: 'memo', result, transcript, failed })
      }
    } catch (e) {
      putOutcome(t, { kind: 'error', message: e instanceof Error ? e.message : String(e), transcript })
    } finally {
      setOrganizing(null)
    }
  }, [dictationFor, putOutcome])
  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  const cancel = useCallback(async () => {
    const t = targetRef.current
    if (!t) return
    await dictationFor(t.mode).cancel()
    targetRef.current = null
    setTarget(null)
  }, [dictationFor])

  const takeOutcome = useCallback((t: VoiceTarget) => {
    const all = loadOutcomes()
    const key = targetKey(t)
    const o = all[key] ?? null
    if (o) {
      delete all[key]
      saveOutcomes(all)
    }
    return o
  }, [])

  const subscribe = useCallback((t: VoiceTarget, fn: () => void) => {
    const key = targetKey(t)
    const set = listeners.current.get(key) ?? new Set<() => void>()
    set.add(fn)
    listeners.current.set(key, set)
    return () => { set.delete(fn) }
  }, [])

  const d = target ? dictationFor(target.mode) : null
  const session = useMemo<Session | null>(
    () => (target && d ? { target, status: d.status, elapsedMs: d.elapsedMs, level: d.level, lastHeard: d.pieces.join('').slice(-90), pending: d.pending, error: d.error } : null),
    [target, d],
  )

  const value = useMemo<VoiceSessionContext>(
    () => ({ session, organizing, start, stop, cancel, takeOutcome, subscribe }),
    [session, organizing, start, stop, cancel, takeOutcome, subscribe],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useVoiceSession(): VoiceSessionContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('VoiceSessionProvider の中で使ってください')
  return ctx
}

/** 画面の下に出す「録音中」の帯（どの画面にいても止められる）。録音も整理もしていないときは何も出さない */
export function VoiceFloatingBar({ activePatientId }: { activePatientId?: string }) {
  const { session, organizing, stop, cancel } = useVoiceSession()
  if (!session && !organizing) return null
  const t = session?.target ?? organizing!
  const elsewhere = activePatientId !== t.patientId
  const recording = session && (session.status === 'recording' || session.status === 'starting')
  const finishing = session?.status === 'finishing'
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-40 flex justify-center px-3 pointer-events-none"
    >
      <div className="pointer-events-auto flex max-w-xl w-full items-center gap-2 rounded-full border border-red-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {recording && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${organizing ? 'bg-teal-600' : 'bg-red-500'}`} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {organizing ? (
            <span className="inline-flex items-center gap-1 text-teal-800"><Loader2 className="h-3.5 w-3.5 animate-spin" />AIが整理しています…{elsewhere ? '（カルテに戻ると書き込まれます）' : ''}</span>
          ) : finishing ? (
            <span className="text-slate-700">残りを文字にしています…</span>
          ) : (
            <span className="text-red-700 font-semibold">
              <Mic className="inline h-3.5 w-3.5 mr-1" />録音中 {formatElapsed(session!.elapsedMs)}
              <span className="ml-2 font-normal text-slate-600">{t.mode === 'soap' ? '会話→SOAP' : '口述→メモ'}{elsewhere ? '（他の画面を見ても録音は続きます）' : ''}</span>
            </span>
          )}
        </span>
        {session && (
          <>
            <button type="button" onClick={() => void cancel()} disabled={!!finishing} className="h-9 shrink-0 rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 max-lg:min-h-10">やめる</button>
            <button type="button" onClick={() => void stop()} disabled={!!finishing} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 max-lg:min-h-10">
              {finishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3 w-3" />}止める
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export type { DictationProfile }
