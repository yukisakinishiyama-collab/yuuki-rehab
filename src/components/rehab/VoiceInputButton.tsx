'use client'
// ──────────────────────────────────────────────
// 音声入力ボタン（日本語）
//
// メモ欄などのテキスト入力に添えて使う共通部品。
// - タップで録音開始、もう一度タップで停止
// - 認識が確定した文章を onText で親に渡す（親が既存文に追記する）
// - 認識途中の文字列は onInterim で渡す（表示は親の任意。Web Speech のときだけ）
//
// 文字にする仕組み（2026-11-02〜 精度を上げるため）:
// - 文字起こしの設定（OPENAI_API_KEY）があれば、話の切れ目ごとに録音を OpenAI で文字にする（医療用語に強い）
// - 無ければ、いままでどおりブラウザの音声認識（Chrome は Google）。非対応のブラウザでは何も表示しない
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { useDictation, useServerTranscription } from '@/lib/voice/use-dictation'

// Web Speech API の最小限の型（TSの標準型に含まれないため自前定義）
interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

interface Props {
  /** 認識が確定した文章（句点区切りの断片）を受け取る */
  onText: (text: string) => void
  /** 認識途中のテキスト（表示用・確定時に空文字で呼ばれる） */
  onInterim?: (text: string) => void
  /** ボタンの大きさ（メモ欄=md / 1行入力=sm） */
  size?: 'sm' | 'md'
  className?: string
}

function buttonClass(size: 'sm' | 'md', active: boolean, className: string) {
  const dims = size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-xs'
  return `inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors flex-shrink-0 max-lg:min-h-10 ${dims} ${
    active
      ? 'bg-red-50 border-red-300 text-red-600'
      : 'bg-white border-gray-200 text-gray-500 hover:border-teal-300 hover:text-teal-700'
  } ${className}`
}

function ListeningLabel() {
  return (
    <>
      <span className="relative flex w-2.5 h-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <Square className="w-3 h-3" />
      停止
    </>
  )
}

export default function VoiceInputButton(props: Props) {
  const server = useServerTranscription()
  if (server === 'checking') return null
  return server === 'yes' ? <ServerVoiceButton {...props} /> : <WebSpeechButton {...props} />
}

/** 録音を OpenAI で文字にする（話の切れ目ごとに、話すそばから欄に入る） */
function ServerVoiceButton({ onText, onInterim, size = 'md', className = '' }: Props) {
  const dictation = useDictation({ profile: 'field', onPiece: onText })
  const { status, pending, error, setError } = dictation

  // マイクが使えないなどは、いままでどおりお知らせを出す
  useEffect(() => {
    if (!error) return
    alert(error)
    setError('')
  }, [error, setError])

  const recording = status === 'recording' || status === 'starting'
  const working = status === 'finishing' || (!recording && pending > 0)

  async function toggle() {
    if (recording) {
      await dictation.stop()
      onInterim?.('')
    } else if (!working) {
      await dictation.start()
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={recording}
      disabled={working}
      title={recording ? '音声入力を停止' : '音声で入力（日本語・医療用語に対応）'}
      className={buttonClass(size, recording, className)}
    >
      {recording ? (
        <ListeningLabel />
      ) : working ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          文字に…
        </>
      ) : (
        <>
          <Mic className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          音声入力
        </>
      )}
    </button>
  )
}

/** ブラウザの音声認識（文字起こしの設定が無いとき） */
function WebSpeechButton({ onText, onInterim, size = 'md', className = '' }: Props) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // ユーザーが停止したのか、無音で自動終了したのかを区別するための旗
  const activeRef = useRef(false)
  const callbacksRef = useRef({ onText, onInterim })
  callbacksRef.current = { onText, onInterim }

  useEffect(() => {
    // SSRでは判定できないため、マウント後に対応ブラウザか確認する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(createRecognition() !== null)
    return () => {
      activeRef.current = false
      recognitionRef.current?.stop()
    }
  }, [])

  function start() {
    const recognition = createRecognition()
    if (!recognition) return
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) {
          if (transcript.trim()) callbacksRef.current.onText(transcript.trim())
        } else {
          interim += transcript
        }
      }
      callbacksRef.current.onInterim?.(interim)
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        activeRef.current = false
        setListening(false)
        alert('マイクの使用が許可されていません。ブラウザのアドレスバーからマイクを許可してください。')
      }
      // no-speech / aborted などは onend の自動再開に任せる
    }
    recognition.onend = () => {
      callbacksRef.current.onInterim?.('')
      // 録音中のまま無音などで切れた場合は自動で再開する
      if (activeRef.current) {
        try { start() } catch { activeRef.current = false; setListening(false) }
      } else {
        setListening(false)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function toggle() {
    if (listening) {
      activeRef.current = false
      recognitionRef.current?.stop()
      setListening(false)
    } else {
      activeRef.current = true
      setListening(true)
      try { start() } catch { activeRef.current = false; setListening(false) }
    }
  }

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      title={listening ? '音声入力を停止' : '音声で入力（日本語）'}
      className={buttonClass(size, listening, className)}
    >
      {listening ? (
        <ListeningLabel />
      ) : (
        <>
          <Mic className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          音声入力
        </>
      )}
    </button>
  )
}
