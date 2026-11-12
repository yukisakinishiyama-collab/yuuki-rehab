'use client'
// ──────────────────────────────────────────────
// アプリの中で開くカメラ（患部の写真）
//
// ホーム画面に追加した院内アプリ（スタンドアロン表示）では、<input type="file" capture> で
// iPhone のカメラが開かないことがある。音声入力と同じブラウザの API（getUserMedia）で
// 画面の中にカメラを出し、シャッターで1枚を JPEG にして親へ渡す。
// 映像はどこにも送らない・残さない（撮った1枚だけを親が扱う）。
// ──────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Loader2, RefreshCw, X } from 'lucide-react'

type Props = {
  /** 撮れた1枚（JPEG）。親がプレビュー→保存へ進める */
  onCapture: (file: File) => void
  onClose: () => void
}

/** この端末・この開き方でアプリ内カメラが使えるか */
export function canUseInAppCamera(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof window !== 'undefined' && window.isSecureContext
}

type Facing = 'environment' | 'user'

/** 許可されていないときの案内（端末ごと）。許可を求める画面が出ないのは、端末側で「ブロック」になっているとき */
function permissionHelp(): string {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) {
    return 'カメラの使用が許可されていません。Chrome の「⋮ → 設定 → サイトの設定 → カメラ」で「ブロック中」からこのサイトを「許可」にするか、Android の「設定 → アプリ → Chrome（と ゆうき院内）→ 権限 → カメラ」を許可にしてから「もう一度試す」を押してください。'
  }
  if (/iPhone|iPad/i.test(ua)) {
    return 'カメラの使用が許可されていません。iPhone の「設定 → アプリ → Safari（またはホーム画面のアプリ）→ カメラ」を「許可」にしてから「もう一度試す」を押してください。'
  }
  return 'カメラの使用が許可されていません。ブラウザのサイト設定でカメラを「許可」にしてから「もう一度試す」を押してください。'
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // 向き・準備できたか・エラー はひとまとまり（向きを変えるときに一緒に初期化する）
  const [cam, setCam] = useState<{ facing: Facing; ready: boolean; error: string | null; attempt: number }>({ facing: 'environment', ready: false, error: null, attempt: 0 })
  const { facing, ready, error, attempt } = cam
  const setReady = (ready: boolean) => setCam(c => ({ ...c, ready }))
  const setError = (error: string | null) => setCam(c => ({ ...c, error }))
  const [canSwitch, setCanSwitch] = useState(false)
  const [shooting, setShooting] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // カメラを開く（向きを変えたら開き直す）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          await v.play().catch(() => undefined)
        }
        setReady(true)
        // 前後にカメラがあるときだけ「切替」を出す
        navigator.mediaDevices.enumerateDevices?.().then(list => {
          if (!cancelled) setCanSwitch(list.filter(d => d.kind === 'videoinput').length > 1)
        }).catch(() => undefined)
      } catch (e) {
        if (cancelled) return
        const name = e instanceof DOMException ? e.name : ''
        setError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? permissionHelp()
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'この端末でカメラが見つかりませんでした。「写真を選ぶ」から、カメラアプリで撮った写真を選んでください。'
              : 'カメラを開けませんでした。「写真を選ぶ」から、カメラアプリで撮った写真を選んでください。',
        )
      }
    })()
    return () => {
      cancelled = true
      stop()
    }
  }, [facing, attempt, stop])

  // 画面を離れたら必ず止める
  useEffect(() => stop, [stop])

  async function shoot() {
    const v = videoRef.current
    if (!v || !ready || shooting) return
    setShooting(true)
    try {
      const w = v.videoWidth
      const h = v.videoHeight
      if (!w || !h) throw new Error('映像がまだ届いていません')
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('画像を処理できませんでした')
      ctx.drawImage(v, 0, 0, w, h)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!blob) throw new Error('JPEGに変換できませんでした')
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
      stop()
      onCapture(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : '撮影できませんでした')
      setShooting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="カメラ"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">患部を撮る</span>
        <button
          type="button"
          onClick={() => { stop(); onClose() }}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-white/15 hover:bg-white/25 max-lg:min-h-10"
        >
          <X className="w-4 h-4" />閉じる
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black">
        {/* iPhone では playsInline・muted が無いと画面に出ない */}
        <video ref={videoRef} autoPlay playsInline muted className={`max-h-full max-w-full object-contain ${ready ? '' : 'opacity-0'}`} />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />カメラを開いています…
          </div>
        )}
        {error && (
          <div className="absolute inset-x-4 top-1/3 rounded-xl bg-white/95 p-4 text-sm text-gray-800 space-y-3">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setCam(c => ({ ...c, ready: false, error: null, attempt: c.attempt + 1 }))}
              className="w-full px-4 py-2 bg-teal-700 text-white text-sm font-medium rounded-lg max-lg:min-h-10"
            >
              もう一度試す
            </button>
            <button
              type="button"
              onClick={() => { stop(); onClose() }}
              className="w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg max-lg:min-h-10"
            >
              戻る
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 px-4 py-4 bg-black/80">
        <div className="w-14" />
        <button
          type="button"
          onClick={() => void shoot()}
          disabled={!ready || shooting}
          aria-label="シャッター"
          className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-white bg-white/20 text-white hover:bg-white/35 disabled:opacity-40"
        >
          {shooting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Camera className="w-7 h-7" />}
        </button>
        <button
          type="button"
          onClick={() => setCam(c => ({ ...c, facing: c.facing === 'environment' ? 'user' : 'environment', ready: false, error: null }))}
          disabled={!canSwitch || !ready}
          aria-label="カメラを切り替える"
          className="flex h-12 w-14 items-center justify-center rounded-lg text-white/90 hover:bg-white/10 disabled:opacity-0"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
