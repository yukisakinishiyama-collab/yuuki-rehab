'use client'
// ──────────────────────────────────────────────
// 音声からカルテを書く（施術中の会話 → SOAP／院長の口述 → メモ）
//
// 1. 「会話からカルテを書く」で録音（話の切れ目ごとに OpenAI で文字にしていく）
// 2. 止めると、Claude が患者さんの情報だけを取り出して欄に振り分ける（雑談・お名前は書かない）
// 3. 欄に入れるだけ。院長が読んで直してから「保存」を押す（2026-11-02 院長の判断）
// 音声はどこにも保存しない。文字起こしは確認用にこの画面にだけ出す（保存しない）。
// 録音の本体は画面の枠（VoiceSessionProvider）にあり、録音したまま他のタブ・画面へ行ける。
// この部品は「始める」ボタンと、結果を欄に入れる役。結果が届いたとき表示されていなければ、次に開いたときに入れる。
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Loader2, Mic, Square, Undo2, X } from 'lucide-react'
import { formatElapsed, useServerTranscription } from '@/lib/voice/use-dictation'
import { organizeTranscript } from '@/lib/voice/organize-client'
import type { VoiceMemoResult, VoiceSoapResult } from '@/lib/voice/soap-fields'
import { useVoiceSession, type VoiceOutcome } from '@/components/rehab/VoiceSession'
import { cn } from '@/lib/utils'

/** 欄に入れたあとの知らせ（親が作る）と、入れる前に戻す処理 */
export interface VoiceApplied {
  summary: ReactNode
  undo?: () => void
}

interface Props {
  mode: 'soap' | 'memo'
  /** 結果の宛先（この患者さんのカルテに入れる） */
  patientId: string
  onSoap?: (result: VoiceSoapResult) => VoiceApplied
  onMemo?: (result: VoiceMemoResult) => VoiceApplied
  /** 文字起こしの設定が無い・端末が録音に非対応のときに代わりに出すもの */
  fallback?: ReactNode
  className?: string
}

const TEXT = {
  soap: {
    button: '会話からカルテを書く',
    hint: '施術中の会話から、患者さんの訴え・所見・施術だけをS/O/A/Pの欄に振り分けます（雑談・お名前は書きません）。',
    stop: '止めて振り分ける',
    organizing: 'AIが患者さんの情報だけを振り分けています…',
  },
  memo: {
    button: '話してメモを作る',
    hint: '話した内容から言いよどみや雑談を除いて、メモの文に整えます（お名前は書きません）。',
    stop: '止めて整える',
    organizing: 'AIがメモの文に整えています…',
  },
} as const

type Phase =
  | { kind: 'idle' }
  | { kind: 'organizing' }
  | { kind: 'done'; applied: VoiceApplied; excluded: string[]; transcript: string; failed: number }
  | { kind: 'error'; message: string; transcript: string }

export default function VoiceKarteCapture({ mode, patientId, onSoap, onMemo, fallback = null, className }: Props) {
  const server = useServerTranscription()
  const voice = useVoiceSession()
  const target = { patientId, mode }
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [showText, setShowText] = useState(false)
  const text = TEXT[mode]

  // 録音が終わるころには親の関数が新しくなっているので、いつも最新を使う
  const handlersRef = useRef({ onSoap, onMemo })
  useEffect(() => {
    handlersRef.current = { onSoap, onMemo }
  }, [onSoap, onMemo])

  /** 文字起こしから、もう一度 AI で整理し直す（失敗したときの再試行） */
  async function organize(transcript: string, failed: number) {
    setPhase({ kind: 'organizing' })
    try {
      if (mode === 'soap') {
        const result = await organizeTranscript('soap', transcript)
        applyOutcome({ kind: 'soap', result, transcript, failed })
      } else {
        const result = await organizeTranscript('memo', transcript)
        applyOutcome({ kind: 'memo', result, transcript, failed })
      }
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e), transcript })
    }
  }

  /** 届いた結果を欄に入れる */
  function applyOutcome(o: VoiceOutcome) {
    if (o.kind === 'error') {
      setPhase({ kind: 'error', message: o.message, transcript: o.transcript })
      return
    }
    if (o.kind === 'soap') {
      const applied = handlersRef.current.onSoap?.(o.result) ?? { summary: null }
      setPhase({ kind: 'done', applied, excluded: o.result.excluded, transcript: o.transcript, failed: o.failed })
    } else {
      const applied = handlersRef.current.onMemo?.(o.result) ?? { summary: null }
      setPhase({ kind: 'done', applied, excluded: o.result.excluded, transcript: o.transcript, failed: o.failed })
    }
  }

  // 表示したとき（他の画面で止めた分）と、表示中に結果が届いたときに欄に入れる
  const { takeOutcome, subscribe } = voice
  useEffect(() => {
    const pick = () => {
      const o = takeOutcome({ patientId, mode })
      if (o) applyOutcome(o)
    }
    pick()
    return subscribe({ patientId, mode }, pick)
  }, [patientId, mode, takeOutcome, subscribe])

  async function startRecording() {
    setPhase({ kind: 'idle' })
    setShowText(false)
    const ok = await voice.start(target)
    if (!ok && voice.session) {
      setPhase({ kind: 'error', message: '別の録音が続いています。画面下の帯で止めてから始めてください。', transcript: '' })
    }
  }

  if (server === 'checking') return null
  if (server === 'no') return <>{fallback}</>

  const mine = voice.session && voice.session.target.patientId === patientId && voice.session.target.mode === mode ? voice.session : null
  const organizingMine = voice.organizing?.patientId === patientId && voice.organizing?.mode === mode
  const status = mine?.status ?? 'idle'
  const elapsedMs = mine?.elapsedMs ?? 0
  const level = mine?.level ?? 0
  const pending = mine?.pending ?? 0
  const error = mine?.error ?? ''
  const recording = status === 'recording' || status === 'starting'
  const finishing = status === 'finishing'
  const lastHeard = mine?.lastHeard ?? ''

  // ── 録音中・文字にしている途中 ──
  if (recording || finishing) {
    return (
      <div className={cn('rounded-xl border border-red-200 bg-red-50 p-3 space-y-2', className)} role="status" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
            <span className="relative flex h-2.5 w-2.5">
              {recording && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            {recording ? `録音中 ${formatElapsed(elapsedMs)}` : '残りを文字にしています…'}
          </span>
          {recording && (
            <span className="h-2 w-20 overflow-hidden rounded-full bg-red-100" aria-hidden>
              <span className="block h-full rounded-full bg-red-500 transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void voice.cancel()}
              disabled={finishing}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 max-lg:min-h-10"
            >
              やめる
            </button>
            <button
              type="button"
              onClick={() => void voice.stop()}
              disabled={finishing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 max-lg:min-h-10"
            >
              {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              {text.stop}
            </button>
          </div>
        </div>
        {lastHeard ? (
          <p className="text-xs text-slate-600">
            <span className="font-semibold">聞き取った言葉：</span>…{lastHeard}
            {pending > 0 && <span className="ml-1 text-slate-500">（文字にしています）</span>}
          </p>
        ) : (
          <p className="text-xs text-slate-600">
            {pending > 0 ? '文字にしています…' : mode === 'soap' ? 'ふだんどおり会話してください。話の切れ目ごとに文字にしていきます。録音したまま他のタブや画面を見ても大丈夫です。' : '話し終わったら「止めて整える」を押してください。'}
          </p>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    )
  }

  // ── AIで整理中 ──
  if (phase.kind === 'organizing' || organizingMine) {
    return (
      <div className={cn('flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800', className)} role="status" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" />
        {text.organizing}
      </div>
    )
  }

  const startButton = (
    <button
      type="button"
      onClick={() => void startRecording()}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-3.5 text-sm font-semibold text-white hover:bg-teal-800"
    >
      <Mic className="h-4 w-4" />
      {text.button}
    </button>
  )

  return (
    <div className={cn('space-y-2', className)}>
      {/* ── 書き込んだ結果 ── */}
      {phase.kind === 'done' && (
        <div className="space-y-2 rounded-xl border border-teal-300 bg-teal-50 p-3" role="status" aria-live="polite">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1.5 text-sm text-teal-900">{phase.applied.summary}</div>
            <button
              type="button"
              onClick={() => setPhase({ kind: 'idle' })}
              aria-label="お知らせを閉じる"
              className="flex h-7 w-7 items-center justify-center rounded-full text-teal-800 hover:bg-teal-100 max-lg:min-h-10 max-lg:min-w-10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {phase.failed > 0 && (
            <p className="text-xs text-amber-800">一部（{phase.failed}か所）を文字にできませんでした。抜けている内容がないか確かめてください。</p>
          )}
          {phase.excluded.length > 0 && (
            <p className="text-xs text-slate-600">書かなかった話：{phase.excluded.join('・')}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {phase.applied.undo && (
              <button
                type="button"
                onClick={() => {
                  phase.applied.undo?.()
                  setPhase({ kind: 'idle' })
                }}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-teal-300 bg-white px-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 max-lg:min-h-10"
              >
                <Undo2 className="h-3.5 w-3.5" />
                書き込む前に戻す
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowText((v) => !v)}
              aria-expanded={showText}
              className="h-8 rounded-lg px-2.5 text-xs font-semibold text-teal-800 underline underline-offset-2 hover:bg-teal-100 max-lg:min-h-10"
            >
              {showText ? '文字起こしを閉じる' : '文字起こしを見る（確認用）'}
            </button>
          </div>
          {showText && (
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-teal-200 bg-white p-2 text-xs text-slate-700">
              {phase.transcript}
            </p>
          )}
        </div>
      )}

      {/* ── うまくいかなかったとき ── */}
      {phase.kind === 'error' && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {phase.message}
          </p>
          {phase.transcript && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void organize(phase.transcript, 0)}
                className="h-8 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 max-lg:min-h-10"
              >
                もう一度振り分ける
              </button>
              <button
                type="button"
                onClick={() => setShowText((v) => !v)}
                className="h-8 rounded-lg px-2.5 text-xs font-semibold text-red-800 underline underline-offset-2 max-lg:min-h-10"
              >
                {showText ? '文字起こしを閉じる' : '文字起こしを見る'}
              </button>
            </div>
          )}
          {showText && phase.transcript && (
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-red-200 bg-white p-2 text-xs text-slate-700">
              {phase.transcript}
            </p>
          )}
        </div>
      )}

      {/* ── 始める ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-teal-200 bg-white p-3">
        {startButton}
        <p className="min-w-[12rem] flex-1 text-xs text-slate-600">
          {text.hint}
          {mode === 'soap' && <span className="block mt-0.5">録音の前に、患者さんへ「記録のため録音します」とひと言お伝えください。音声は残しません。</span>}
        </p>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
