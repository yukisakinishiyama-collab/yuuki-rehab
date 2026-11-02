'use client'
/**
 * マイクの音を、話の切れ目（無音）ごとに短い録音に分けて渡す（ブラウザ専用）
 *
 * - サーバーが1回に受け取れる大きさ（4.5MB）を超えないよう、長くても maxMs で区切る
 * - 話の途中で切ると言葉が欠けるので、minMs を過ぎたあと silenceMs 無音が続いたところで区切る
 * - 区切りごとに新しい MediaRecorder で録り直す（どの録音も単独で再生できるファイルになる）
 * - 声がほとんど無い録音（voicedMs が短い）は、受け取った側で捨てられるよう情報を付ける
 */

export interface ChunkInfo {
  /** 何番目の録音か（0から。この順に並べる） */
  seq: number
  durationMs: number
  /** 声がしていた長さ（無音だけの録音を送らないため） */
  voicedMs: number
}

export interface ChunkRecorderOptions {
  /** これより短くは区切らない */
  minMs: number
  /** これより長くはしない（無音が無くても区切る） */
  maxMs: number
  /** この長さの無音で区切る */
  silenceMs: number
  onChunk: (blob: Blob, info: ChunkInfo) => void
  /** 声の大きさ（0〜1。画面のメーター用） */
  onLevel?: (level: number) => void
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

/** この端末・ブラウザで区切り録音ができるか */
export function chunkRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    Boolean(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)
  )
}

function pickMimeType(): string {
  for (const type of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type
    } catch {
      // 判定できないブラウザはブラウザに任せる
    }
  }
  return ''
}

export class ChunkRecorder {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private recorder: MediaRecorder | null = null
  private timer: number | null = null
  private mime = ''
  private seq = 0
  private chunkStart = 0
  private voicedMs = 0
  private silentSince: number | null = null
  /** 周りの音の大きさ（ゆっくり追いかける） */
  private noise = 0.01
  private stops: Promise<void>[] = []
  private discard = false

  constructor(private readonly opts: ChunkRecorderOptions) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    })
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AC()
    await this.ctx.resume().catch(() => {})
    const source = this.ctx.createMediaStreamSource(this.stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    source.connect(this.analyser)
    this.mime = pickMimeType()
    this.beginChunk()

    const buf = new Float32Array(this.analyser.fftSize)
    let last = performance.now()
    this.timer = window.setInterval(() => {
      if (!this.analyser) return
      const now = performance.now()
      const dt = now - last
      last = now
      this.analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i]
      const rms = Math.sqrt(sum / buf.length)
      // 静かなときの音の大きさを覚えて、それより十分大きい音を「声」とみなす
      this.noise = rms < this.noise * 1.5 ? this.noise * 0.95 + rms * 0.05 : this.noise * 0.999 + rms * 0.001
      const speaking = rms > Math.max(0.012, this.noise * 3)
      this.opts.onLevel?.(Math.min(1, rms / 0.15))
      if (speaking) {
        this.voicedMs += dt
        this.silentSince = null
      } else if (this.silentSince === null) {
        this.silentSince = now
      }
      const length = now - this.chunkStart
      const silentFor = this.silentSince === null ? 0 : now - this.silentSince
      if ((length >= this.opts.minMs && silentFor >= this.opts.silenceMs) || length >= this.opts.maxMs) {
        this.cut()
      }
    }, 100)
  }

  private beginChunk() {
    if (!this.stream) return
    const options: MediaRecorderOptions = { audioBitsPerSecond: 32_000 }
    if (this.mime) options.mimeType = this.mime
    const recorder = new MediaRecorder(this.stream, options)
    const parts: Blob[] = []
    const seq = this.seq
    this.seq += 1
    const startedAt = performance.now()
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) parts.push(e.data)
    }
    this.stops.push(
      new Promise<void>((resolve) => {
        recorder.onstop = () => {
          if (!this.discard) {
            const blob = new Blob(parts, { type: recorder.mimeType || this.mime || 'audio/webm' })
            const info: ChunkInfo = { seq, durationMs: performance.now() - startedAt, voicedMs: this.voicedFor.get(seq) ?? 0 }
            this.opts.onChunk(blob, info)
          }
          resolve()
        }
      }),
    )
    recorder.start()
    this.recorder = recorder
    this.chunkStart = startedAt
    this.voicedMs = 0
    this.silentSince = null
  }

  /** 区切ったときの「声がしていた長さ」（onstop は後から来るので、区切った時点の値を取っておく） */
  private voicedFor = new Map<number, number>()

  private finishCurrent() {
    const recorder = this.recorder
    if (!recorder) return
    this.voicedFor.set(this.seq - 1, this.voicedMs)
    this.recorder = null
    if (recorder.state !== 'inactive') recorder.stop()
  }

  /** いまの録音を締めて、すぐ次の録音を始める */
  private cut() {
    this.finishCurrent()
    this.beginChunk()
  }

  private async teardown() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.finishCurrent()
    await Promise.all(this.stops)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.analyser = null
    await this.ctx?.close().catch(() => {})
    this.ctx = null
  }

  /** 録音を止める（最後の録音も onChunk で渡してから終わる） */
  async stop(): Promise<void> {
    await this.teardown()
  }

  /** 録音をやめる（まだ渡していない録音は捨てる） */
  async cancel(): Promise<void> {
    this.discard = true
    await this.teardown()
  }
}
