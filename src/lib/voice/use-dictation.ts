'use client'
/**
 * 録音 → 区切りごとにサーバーで文字にする（OpenAI）→ 順番どおりにつなぐ（画面用のフック）
 *
 * - profile 'field'   … 1つの欄に話して入れる（短く区切って、話すそばから文字を返す）
 * - profile 'session' … 施術中の会話をまとめて録る（長めに区切る。最大1時間ほど）
 * 録音中も前の区切りを文字にしていくので、止めたあとは最後の区切りの分だけ待てばよい。
 * 音声はどこにも保存しない（文字にしたら捨てる）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChunkRecorder, chunkRecordingSupported, type ChunkInfo } from './chunk-recorder'

export type DictationProfile = 'field' | 'session'
export type DictationStatus = 'idle' | 'starting' | 'recording' | 'finishing'

const PROFILES: Record<DictationProfile, { minMs: number; maxMs: number; silenceMs: number }> = {
  field: { minMs: 1_500, maxMs: 30_000, silenceMs: 700 },
  session: { minMs: 12_000, maxMs: 55_000, silenceMs: 600 },
}
/** 声がこれより短い区切りは送らない（無音・物音だけの録音で、ありもしない文が出るのを防ぐ） */
const MIN_VOICED_MS = 300
export const FAILED_MARK = '［聞き取れなかった部分］'
/** 録音の上限（会話をまとめて録るとき） */
export const SESSION_LIMIT_MS = 60 * 60 * 1000

let configuredPromise: Promise<boolean> | null = null

/** サーバーの文字起こし（OpenAI）が使えるか。1回だけ確かめて覚えておく */
export function checkServerTranscription(): Promise<boolean> {
  if (!configuredPromise) {
    configuredPromise = fetch('/api/voice/transcribe', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { configured: false }))
      .then((data: { configured?: boolean }) => Boolean(data?.configured))
      .catch(() => {
        configuredPromise = null
        return false
      })
  }
  return configuredPromise
}

/** この端末で、サーバーの文字起こしを使えるか（'checking' のあいだはボタンを出さない） */
export function useServerTranscription(): 'checking' | 'yes' | 'no' {
  const [state, setState] = useState<'checking' | 'yes' | 'no'>('checking')
  useEffect(() => {
    let alive = true
    const check = chunkRecordingSupported() ? checkServerTranscription() : Promise.resolve(false)
    void check.then((ok) => {
      if (alive) setState(ok ? 'yes' : 'no')
    })
    return () => {
      alive = false
    }
  }, [])
  return state
}

type TranscribeTry = { ok: true; text: string } | { ok: false; retry: boolean; message: string }

async function transcribeOnce(blob: Blob, context: string): Promise<TranscribeTry> {
  const form = new FormData()
  form.append('audio', blob, 'voice')
  form.append('context', context)
  try {
    const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form })
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
    if (res.ok) return { ok: true, text: String(data.text ?? '').trim() }
    return { ok: false, retry: res.status === 429 || (res.status >= 500 && res.status !== 503), message: data.error ?? `HTTP ${res.status}` }
  } catch {
    return { ok: false, retry: true, message: '通信できませんでした' }
  }
}

/** 文字にする（うまくいかなければ少し待って、あと2回まで） */
async function transcribeWithRetry(blob: Blob, context: string): Promise<{ text: string } | { error: string }> {
  let last = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1500))
    const r = await transcribeOnce(blob, context)
    if (r.ok) return { text: r.text }
    last = r.message
    if (!r.retry) break
  }
  return { error: last }
}

function micErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'マイクの使用が許可されていません。アドレスバーの鍵のマークからマイクを許可してください。'
  }
  if (name === 'NotFoundError') return 'マイクが見つかりません。'
  if (name === 'NotReadableError') return 'マイクをほかのアプリが使っています。'
  return 'マイクを使えませんでした。'
}

interface WakeLockLike {
  release: () => Promise<void>
}

export interface DictationResult {
  transcript: string
  /** 文字にできなかった区切りの数 */
  failed: number
}

export function useDictation({
  profile,
  onPiece,
  onLimit,
}: {
  profile: DictationProfile
  onPiece?: (text: string) => void
  /** 録音の上限（会話は1時間）に達したとき。無ければそのまま止める */
  onLimit?: () => void
}) {
  const [status, setStatus] = useState<DictationStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [level, setLevel] = useState(0)
  const [pieces, setPieces] = useState<string[]>([])
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')

  const recorderRef = useRef<ChunkRecorder | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const textsRef = useRef<string[]>([])
  const sessionRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockLike | null>(null)
  const onPieceRef = useRef(onPiece)
  const onLimitRef = useRef(onLimit)
  const limitFiredRef = useRef(false)
  const stopRef = useRef<() => Promise<DictationResult>>(async () => ({ transcript: '', failed: 0 }))

  useEffect(() => {
    onPieceRef.current = onPiece
    onLimitRef.current = onLimit
  }, [onPiece, onLimit])

  const releaseExtras = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
    void wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
    setLevel(0)
  }, [])

  // 画面を離れたら録音をやめる（マイクを開いたままにしない）
  useEffect(() => {
    return () => {
      sessionRef.current += 1
      void recorderRef.current?.cancel()
      recorderRef.current = null
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      void wakeLockRef.current?.release().catch(() => {})
    }
  }, [])

  const enqueue = useCallback((blob: Blob, info: ChunkInfo, session: number) => {
    if (info.voicedMs < MIN_VOICED_MS || blob.size === 0) return
    setPending((n) => n + 1)
    queueRef.current = queueRef.current.then(async () => {
      try {
        if (sessionRef.current !== session) return
        const context = textsRef.current.filter((t) => t !== FAILED_MARK).join('').slice(-300)
        const r = await transcribeWithRetry(blob, context)
        if (sessionRef.current !== session) return
        if ('error' in r) {
          textsRef.current = [...textsRef.current, FAILED_MARK]
          setError(`一部を文字にできませんでした（${r.error}）`)
        } else if (r.text) {
          textsRef.current = [...textsRef.current, r.text]
          onPieceRef.current?.(r.text)
        }
        setPieces(textsRef.current)
      } finally {
        setPending((n) => Math.max(0, n - 1))
      }
    })
  }, [])

  const start = useCallback(async (): Promise<boolean> => {
    if (recorderRef.current) return false
    setError('')
    setStatus('starting')
    textsRef.current = []
    setPieces([])
    setElapsedMs(0)
    sessionRef.current += 1
    const session = sessionRef.current
    const recorder = new ChunkRecorder({
      ...PROFILES[profile],
      onChunk: (blob, info) => enqueue(blob, info, session),
      onLevel: setLevel,
    })
    try {
      await recorder.start()
    } catch (e) {
      await recorder.cancel().catch(() => {})
      setStatus('idle')
      setError(micErrorMessage(e))
      return false
    }
    recorderRef.current = recorder
    limitFiredRef.current = false
    const startedAt = Date.now()
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      setElapsedMs(elapsed)
      // 録りっぱなしにしない（会話は1時間まで。それ以上は自動で止める）
      if (profile === 'session' && elapsed >= SESSION_LIMIT_MS && !limitFiredRef.current) {
        limitFiredRef.current = true
        if (onLimitRef.current) onLimitRef.current()
        else void stopRef.current()
      }
    }, 500)
    // 録音中に画面が消えない（スマホの自動ロックで録音が止まらない）ように
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> } }
      wakeLockRef.current = (await nav.wakeLock?.request('screen')) ?? null
    } catch {
      // 対応していない端末はそのまま
    }
    setStatus('recording')
    return true
  }, [enqueue, profile])

  /** 録音を止めて、残りを文字にし終えるのを待つ */
  const stop = useCallback(async (): Promise<DictationResult> => {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      setStatus('finishing')
      releaseExtras()
      await recorder.stop()
    }
    await queueRef.current
    setStatus('idle')
    const texts = textsRef.current
    return { transcript: texts.join('\n'), failed: texts.filter((t) => t === FAILED_MARK).length }
  }, [releaseExtras])

  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  /** 録音をやめる（文字にした分も捨てる） */
  const cancel = useCallback(async () => {
    sessionRef.current += 1
    const recorder = recorderRef.current
    recorderRef.current = null
    releaseExtras()
    await recorder?.cancel()
    textsRef.current = []
    setPieces([])
    setPending(0)
    setStatus('idle')
  }, [releaseExtras])

  return { status, elapsedMs, level, pieces, pending, error, setError, start, stop, cancel }
}

/** 0:00 の形 */
export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
