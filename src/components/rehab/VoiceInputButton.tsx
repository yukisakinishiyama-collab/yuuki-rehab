'use client'
// ──────────────────────────────────────────────
// 音声入力ボタン（Web Speech API・日本語）
//
// メモ欄などのテキスト入力に添えて使う共通部品。
// - タップで録音開始、もう一度タップで停止
// - 認識が確定した文章を onText で親に渡す（親が既存文に追記する）
// - 認識途中の文字列は onInterim で渡す（表示は親の任意）
// - ブラウザが非対応（Firefoxなど）の場合は何も表示しない
// - Chromeは無音が続くと自動終了するため、録音中は自動で再開する
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

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

export default function VoiceInputButton({ onText, onInterim, size = 'md', className = '' }: Props) {
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

  const dims = size === 'sm' ? 'h-8 px-2.5 text-[11px]' : 'h-9 px-3 text-xs'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      title={listening ? '音声入力を停止' : '音声で入力（日本語）'}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors flex-shrink-0 ${dims} ${
        listening
          ? 'bg-red-50 border-red-300 text-red-600'
          : 'bg-white border-gray-200 text-gray-500 hover:border-teal-300 hover:text-teal-700'
      } ${className}`}
    >
      {listening ? (
        <>
          <span className="relative flex w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <Square className="w-3 h-3" />
          停止
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
