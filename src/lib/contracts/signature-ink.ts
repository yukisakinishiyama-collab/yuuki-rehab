// ──────────────────────────────────────────────
// 署名欄の「どの指（ペン）の線を書くか」の決まり（純粋な関数。画面とテストから使う）
//
// 2026-11-19 院長から「タブレットで文字を記入するときに変に反応するので書きにくい」。
// 前の作りは、署名欄に触れたものを全部「1本のペン」として扱っていたので、書いている途中で手のひらや
// もう1本の指が触れると、指と手のひらの間に線が何本も引かれていた（指 → 手のひら → 指 … と線をつないでしまう）。
//
// 決まり:
// 1. 線を書くのは、いちどに1つ（指1本かペン1本）だけ。書いている間に触れたほかの指・手のひらは、受けつけない
// 2. ペン（Apple Pencil など）が優先。ペンが触れたら、そのとき書いていた指・手のひらの線は消して、ペンの線にする。
//    ペンを使っている間と、ペンを離してから PEN_GUARD_MS の間は、指・手のひらを受けつけない
// 3. 手のひらが先に触れていたとき：先に触れたものが「ほとんど動いていない」（手のひら）なら、あとから触れた指を
//    書く指にして、手のひらの点は消す
// 4. 端末が「この指はちがった」と取り消したとき（pointercancel。ペンを使うと、端末が手のひらを取り消す）は、
//    指・手のひらの線なら消す（ペン・マウスの線は残す）
// 5. 書いている途中のはずの指から STALE_MS の間なにも届かなければ、もう離れたものとして扱う
//    （「離した」の知らせが届かなかったときに、署名欄が書けなくならないように）
// 書いた線は、1画ずつ持つ（1つ戻す・描き直しのため）。座標は署名欄の左上からの px。
// ──────────────────────────────────────────────

export type InkPointerType = 'mouse' | 'pen' | 'touch'

export interface InkPoint {
  x: number
  y: number
}

export interface InkStroke {
  type: InkPointerType
  points: InkPoint[]
}

/** ペンを使ったあと、指・手のひらを受けつけない時間（画と画の間に、手のひらが触れ直すため） */
export const PEN_GUARD_MS = 3000
/** 触れてからの動きがこれより小さいものは、手のひらかもしれない（あとから触れた指に書く役をゆずる） */
export const PALM_EXTENT_PX = 20
/** 長く触れているのに、動きが小さいものも、手のひらかもしれない */
export const PALM_SLOW_MS = 600
export const PALM_SLOW_EXTENT_PX = 40
/**
 * 書いている途中のはずの指から、この時間なにも届かなかったら、もう離れたものとして扱う
 * （「離した」の知らせが届かなかったときに、次の指を受けつけなくならないように）
 */
export const STALE_MS = 1500
/** これより近い点は足さない（同じ場所の点が何十個も入らないように） */
export const MIN_STEP_PX = 0.5

export interface InkPointer {
  pointerId: number
  type: InkPointerType
  x: number
  y: number
  /** 時刻（ms。performance.now() など、後戻りしない時計） */
  t: number
  /** マウスのボタン（0＝左）。指・ペンでは見ない */
  button?: number
}

export interface InkDownResult {
  /** 書き始める（false＝受けつけない：書いている途中のほかの指・手のひら・ペンのあとの指 など） */
  accepted: boolean
  /** 前に書いていた線（手のひらと見たもの）を消した。全体を描き直す */
  removed: boolean
}

interface ActiveStroke {
  pointerId: number
  type: InkPointerType
  stroke: InkStroke
  startT: number
  startX: number
  startY: number
  /** 触れた場所から、いちばん遠くまで動いた距離 */
  extent: number
  /** この指から、最後に知らせが届いた時刻 */
  lastT: number
}

function normalizeType(type: string): InkPointerType {
  return type === 'pen' || type === 'touch' ? type : 'mouse'
}

export class InkArbiter {
  private list: InkStroke[] = []
  private active: ActiveStroke | null = null
  private lastPenAt = Number.NEGATIVE_INFINITY

  /** 書いた線（1画ずつ。書いている途中の線も入る） */
  get strokes(): readonly InkStroke[] {
    return this.list
  }

  get isEmpty(): boolean {
    return this.list.length === 0
  }

  /** いま線を書いている途中か */
  get isDrawing(): boolean {
    return this.active !== null
  }

  /** この指（ペン）が、いま線を書いているものか */
  isActivePointer(pointerId: number): boolean {
    return this.active?.pointerId === pointerId
  }

  /** いま書いている線（無ければ null） */
  get current(): InkStroke | null {
    return this.active?.stroke ?? null
  }

  /** ペンが近くにある（触れていなくても、浮かせて動かしている）ことを知らせる */
  penSeen(t: number): void {
    if (t > this.lastPenAt) this.lastPenAt = t
  }

  /** 書いている線が、手のひらのように見えるか（ほとんど動いていない） */
  private looksLikePalm(t: number): boolean {
    const a = this.active
    if (!a || a.type !== 'touch') return false
    if (a.extent < PALM_EXTENT_PX) return true
    return t - a.startT > PALM_SLOW_MS && a.extent < PALM_SLOW_EXTENT_PX
  }

  private dropActive(): void {
    const a = this.active
    if (!a) return
    const i = this.list.lastIndexOf(a.stroke)
    if (i >= 0) this.list.splice(i, 1)
    this.active = null
  }

  private begin(p: InkPointer, type: InkPointerType): void {
    const stroke: InkStroke = { type, points: [{ x: p.x, y: p.y }] }
    this.list.push(stroke)
    this.active = { pointerId: p.pointerId, type, stroke, startT: p.t, startX: p.x, startY: p.y, extent: 0, lastT: p.t }
  }

  /** 触れた（押した） */
  down(input: InkPointer): InkDownResult {
    const type = normalizeType(input.type)
    if (type === 'mouse' && (input.button ?? 0) !== 0) return { accepted: false, removed: false }
    if (type === 'pen') this.penSeen(input.t)
    let removed = false

    if (this.active?.pointerId === input.pointerId) {
      // 同じ指の「触れた」がもう一度来た（離した知らせが届かなかった）。前の線はそこで終わりにする
      this.active = null
    }
    if (this.active && input.t - this.active.lastT > STALE_MS) {
      // 書いている途中のはずの指から、しばらく何も届いていない。動いていなかったなら手のひら（消す）、
      // 動いていたなら、離した知らせが届かなかった線（そこで終わりにして残す）
      if (this.looksLikePalm(input.t)) {
        this.dropActive()
        removed = true
      } else {
        this.active = null
      }
    }

    const a = this.active
    if (type === 'touch') {
      // ペンを使っている間・使った直後の指は、手のひら
      if (a?.type === 'pen') return { accepted: false, removed }
      if (input.t - this.lastPenAt < PEN_GUARD_MS) return { accepted: false, removed }
    }
    if (!a) {
      this.begin(input, type)
      return { accepted: true, removed }
    }

    // ここから下は、ほかのものが書いている途中
    if (type === 'pen' && a.type === 'touch') {
      // ペンが優先。先に触れていた指・手のひらの線は消す
      this.dropActive()
      this.begin(input, type)
      return { accepted: true, removed: true }
    }
    if (type === 'touch' && a.type === 'touch' && this.looksLikePalm(input.t)) {
      // 先に触れていたのは手のひら（ほとんど動いていない）。あとから触れた指で書く
      this.dropActive()
      this.begin(input, type)
      return { accepted: true, removed: true }
    }
    return { accepted: false, removed }
  }

  /** 動いた。線に足した点を返す（足さなかったら null） */
  move(pointerId: number, x: number, y: number, t: number): InkPoint | null {
    const a = this.active
    if (!a || a.pointerId !== pointerId) return null
    if (a.type === 'pen') this.penSeen(t)
    a.lastT = t
    const points = a.stroke.points
    const last = points[points.length - 1]
    if (Math.hypot(x - last.x, y - last.y) < MIN_STEP_PX) return null
    const point = { x, y }
    points.push(point)
    const far = Math.hypot(x - a.startX, y - a.startY)
    if (far > a.extent) a.extent = far
    return point
  }

  /** 離した。書いていた線が終わったら true */
  up(pointerId: number, t: number): boolean {
    const a = this.active
    if (!a || a.pointerId !== pointerId) return false
    if (a.type === 'pen') this.penSeen(t)
    this.active = null
    return true
  }

  /**
   * 端末が取り消した（pointercancel）。
   * - removed … 書いていた指・手のひらの線を消した（全体を描き直す）
   * - kept … 書いていたペン・マウスの線を、そこまでで終わりにした
   * - none … 書いていた線ではない
   */
  cancel(pointerId: number, t: number): 'removed' | 'kept' | 'none' {
    const a = this.active
    if (!a || a.pointerId !== pointerId) return 'none'
    if (a.type === 'touch') {
      this.dropActive()
      return 'removed'
    }
    this.up(pointerId, t)
    return 'kept'
  }

  /** いちばん新しい1画を消す（書いている途中なら、その線）。消したら true */
  undo(): boolean {
    if (this.active) {
      this.dropActive()
      return true
    }
    return this.list.pop() !== undefined
  }

  /** 全部消す（書き直す） */
  clear(): void {
    this.list = []
    this.active = null
    this.lastPenAt = Number.NEGATIVE_INFINITY
  }
}

// ── 線の形（なめらかにつなぐ） ───────────────────────

/**
 * 線の1区切り。画面は、これを順に描く（丸い線の端でつなぐ）。
 * - dot … 点（触れただけ）
 * - line … まっすぐな線
 * - curve … (cx, cy) へ引っぱられる曲線（点と点の間を角ばらせない）
 */
export type InkSegment =
  | { kind: 'dot'; x: number; y: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'curve'; x1: number; y1: number; cx: number; cy: number; x2: number; y2: number }

const mid = (a: InkPoint, b: InkPoint): InkPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * i 番目の点を足したときに描く区切り（i は 0 から）。
 * 点と点の「まん中」から「まん中」へ、間の点に引っぱられる曲線でつなぐ（動かした速さで点がまばらでも、角ばらない）。
 */
export function segmentForPoint(points: readonly InkPoint[], i: number): InkSegment | null {
  const p = points[i]
  if (!p) return null
  if (i === 0) return { kind: 'dot', x: p.x, y: p.y }
  const prev = points[i - 1]
  const m = mid(prev, p)
  if (i === 1) return { kind: 'line', x1: prev.x, y1: prev.y, x2: m.x, y2: m.y }
  const before = mid(points[i - 2], prev)
  return { kind: 'curve', x1: before.x, y1: before.y, cx: prev.x, cy: prev.y, x2: m.x, y2: m.y }
}

/** 線を書き終えたときに描く、最後の区切り（まん中から最後の点まで）。1点だけの線には無い */
export function tailSegment(points: readonly InkPoint[]): InkSegment | null {
  const n = points.length
  if (n < 2) return null
  const m = mid(points[n - 2], points[n - 1])
  return { kind: 'line', x1: m.x, y1: m.y, x2: points[n - 1].x, y2: points[n - 1].y }
}

/** 1画ぶんの区切りを全部（描き直すとき） */
export function segmentsOf(points: readonly InkPoint[]): InkSegment[] {
  const out: InkSegment[] = []
  for (let i = 0; i < points.length; i += 1) {
    const s = segmentForPoint(points, i)
    if (s) out.push(s)
  }
  const tail = tailSegment(points)
  if (tail) out.push(tail)
  return out
}

/** 署名欄の高さ（px）。幅が広い端末（タブレット・パソコン）では、書きやすいように高くする */
export function padHeightFor(width: number): number {
  return width >= 560 ? 200 : 150
}
