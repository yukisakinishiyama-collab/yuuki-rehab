'use client'
/**
 * 指やペンで書く署名欄（タブレット・スマホ・マウス）
 * 書いた署名を PNG（data:image/png;base64,…）にして onChange で返す。「1つ戻す」「書き直す」で消す。
 *
 * 2026-11-11 の見直し（「同意書を記入してもらっても登録できない」）:
 * - 書けたかどうかを欄の上に出す（「✓ 署名を受け付けました」）。まだなら、押したときに赤い枠で知らせる（missing）
 * - setPointerCapture が使えない端末でも書けるように（失敗しても書く処理は続ける）
 * - 画面を回す・幅が変わると、書いた線を残したまま大きさを合わせ直す
 *
 * 2026-11-19 の見直し（「タブレットで文字を記入するときに変に反応するので書きにくい」）:
 * - 線を書くのは、いちどに指1本（ペン1本）だけ。前は、書いている途中で手のひらやもう1本の指が触れると、
 *   指と手のひらの間に線が何本も引かれていた。どれを書くかの決まりは lib/contracts/signature-ink.ts
 *   （ペンが優先・ペンのあとの手のひらは受けつけない・先に触れた手のひらはあとから触れた指にゆずる）
 * - 書いている間と書いた直後は、ほかの指・手のひらでページが動かない・拡大しないようにする
 * - 線をなめらかにつなぐ（点と点の間を曲線で）。端末が間引いた細かい動きも使う（getCoalescedEvents）
 * - 書いている途中で、画面がずれないようにする。前は、1画目を書き終えた瞬間に親へ知らせていて、下の
 *   「完了の前に、あと○つ」の枠が縮んで（消えて）画面全体がずれ、2画目からちがう場所に線が入っていた。
 *   PNG にして親へ知らせるのは、書く手が止まってから（署名欄の外を押したら、すぐ）。親の枠も低くならないようにした
 *   （ContractsTab の NoShrink）。見出しの行も、書けたかどうかで形が変わらないようにした
 * - タブレット・パソコンでは欄を高くする（150 → 200px）。「1つ戻す」を足した
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { InkArbiter, padHeightFor, segmentForPoint, segmentsOf, tailSegment, type InkSegment } from '@/lib/contracts/signature-ink'

const LINE_WIDTH = 2.8
const INK_COLOR = '#0f172a'
/** 書く手が止まってから、PNG にして親へ知らせるまで（ms） */
const EMIT_DELAY_MS = 450
/** 書いた直後、ほかの指・手のひらでページが動かないようにしておく時間（ms。画と画の間） */
const SCROLL_LOCK_MS = 600

// ── 書いている間、ほかの指・手のひらでページを動かさない（どの署名欄で書いていても、ページ全体で1つ） ──
// touchmove を止められるのは「止めるかもしれない」と先に登録してある聞き手だけなので、署名欄が画面にある間は
// 登録したままにする（中身は時刻を比べるだけ。書いていないときは何もしない）。
let scrollLockUntil = 0
let scrollLockUsers = 0
function blockWhileWriting(e: Event) {
  if (performance.now() < scrollLockUntil && e.cancelable) e.preventDefault()
}
const BLOCKING = { passive: false, capture: true } as const
// touchmove＝指でのスクロール、gesturestart・gesturechange＝iPad・iPhone の2本指での拡大（Safari だけの知らせ）
const BLOCKED_EVENTS = ['touchmove', 'gesturestart', 'gesturechange'] as const
function useScrollLock(): () => void {
  useEffect(() => {
    scrollLockUsers += 1
    if (scrollLockUsers === 1) for (const type of BLOCKED_EVENTS) document.addEventListener(type, blockWhileWriting, BLOCKING)
    return () => {
      scrollLockUsers -= 1
      if (scrollLockUsers === 0) for (const type of BLOCKED_EVENTS) document.removeEventListener(type, blockWhileWriting, BLOCKING)
    }
  }, [])
  // 書くたびに、少し先の時刻までのばす（線を書いている間と、画と画の間）
  return () => {
    scrollLockUntil = performance.now() + SCROLL_LOCK_MS
  }
}

function paint(ctx: CanvasRenderingContext2D, seg: InkSegment) {
  ctx.beginPath()
  if (seg.kind === 'dot') {
    ctx.arc(seg.x, seg.y, LINE_WIDTH / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.moveTo(seg.x1, seg.y1)
  if (seg.kind === 'line') ctx.lineTo(seg.x2, seg.y2)
  else ctx.quadraticCurveTo(seg.cx, seg.cy, seg.x2, seg.y2)
  ctx.stroke()
}

export default function SignaturePad({
  id,
  label,
  onChange,
  height,
  missing = false,
}: {
  /** 「まだのもの」から飛んでくるための目印 */
  id?: string
  label: string
  onChange: (dataUrl: string | null) => void
  /** 欄の高さ（px）。無ければ、幅に合わせて決める（スマホ 150・タブレットとパソコン 200） */
  height?: number
  /** 署名して完了するを押したのに、まだ書いていない */
  missing?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** どの指（ペン）の線を書くかと、書いた線（1画ずつ） */
  const [ink] = useState(() => new InkArbiter())
  const [empty, setEmpty] = useState(true)
  const dprRef = useRef(1)
  /** 書いている間と書いた直後は、ほかの指・手のひらでページを動かさない */
  const touchLock = useScrollLock()
  /** 親へ知らせる予定（書く手が止まるのを待っている） */
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const context = useCallback((): CanvasRenderingContext2D | null => {
    const ctx = canvasRef.current?.getContext('2d') ?? null
    if (!ctx) return null
    const dpr = dprRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineWidth = LINE_WIDTH
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = INK_COLOR
    ctx.fillStyle = INK_COLOR
    return ctx
  }, [])

  /** 書いた線を全部描き直す（大きさが変わった・1画消した・手のひらの線を消した） */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = context()
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    for (const stroke of ink.strokes) for (const seg of segmentsOf(stroke.points)) paint(ctx, seg)
  }, [context, ink])

  /** 横幅を最大900pxに縮めて PNG にする（保存の大きさを抑える） */
  const exportPng = useCallback((): string | null => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null
    const scale = Math.min(1, 900 / canvas.width)
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(canvas.width * scale))
    out.height = Math.max(1, Math.round(canvas.height * scale))
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, out.width, out.height)
    const url = out.toDataURL('image/png')
    return url.startsWith('data:image/png;base64,') ? url : null
  }, [])

  /** いまの署名を親へ知らせる */
  const emit = useCallback(() => {
    if (pending.current) {
      clearTimeout(pending.current)
      pending.current = null
    }
    onChangeRef.current(ink.isEmpty ? null : exportPng())
  }, [exportPng, ink])

  /**
   * 書く手が止まったら知らせる。書いている間（画と画の間も）は知らせない：親の画面（「あと○つ」など）が
   * 描き直されて、次の画の書き出しが遅れたり、画面がずれたりしないように。
   * 署名欄の外を押したときは、待たずに知らせる（下の useEffect）
   */
  const emitSoon = useCallback(() => {
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(emit, EMIT_DELAY_MS)
  }, [emit])

  // 大きさを合わせる（画面の細かさに合わせて、線がにじまないように）。幅が変わったら、書いた線を描き直す
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const fit = () => {
      const width = wrap.clientWidth
      if (width <= 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const h = height ?? padHeightFor(width)
      const w = Math.round(width * dpr)
      const hh = Math.round(h * dpr)
      if (canvas.width === w && canvas.height === hh && dprRef.current === dpr) return
      dprRef.current = dpr
      canvas.width = w
      canvas.height = hh
      canvas.style.width = `${width}px`
      canvas.style.height = `${h}px`
      redraw()
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fit())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [height, redraw])

  // 署名欄の外を押したとき・キーを押したとき・画面を離れるときは、待っていた知らせをすぐ送る
  // （「署名して完了する」を押したときに、親が最後の1画まで持っているように）
  useEffect(() => {
    const flush = () => {
      if (pending.current) emit()
    }
    const outside = (e: Event) => {
      if (e.target !== canvasRef.current) flush()
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', flush, true)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', flush, true)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', flush)
      if (pending.current) clearTimeout(pending.current)
    }
  }, [emit])

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const r = ink.down({
      pointerId: e.pointerId,
      type: e.pointerType === 'pen' || e.pointerType === 'touch' ? e.pointerType : 'mouse',
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now(),
      button: e.button,
    })
    if (r.removed) redraw()
    if (!r.accepted) {
      if (r.removed) {
        setEmpty(ink.isEmpty)
        emitSoon()
      }
      return
    }
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // つかめない端末でも、書く処理はそのまま続ける
    }
    touchLock()
    // 書いている間は、親へ知らせない（線が終わったら、あらためて予定する）
    if (pending.current) {
      clearTimeout(pending.current)
      pending.current = null
    }
    setEmpty(false)
    if (!r.removed) {
      const ctx = context()
      const points = ink.current?.points
      const seg = points ? segmentForPoint(points, 0) : null
      if (ctx && seg) paint(ctx, seg)
    }
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const now = performance.now()
    if (e.pointerType === 'pen') ink.penSeen(now)
    if (!ink.isActivePointer(e.pointerId)) return
    e.preventDefault()
    touchLock()
    const stroke = ink.current
    const ctx = context()
    if (!stroke) return
    const rect = e.currentTarget.getBoundingClientRect()
    // 端末がまとめて届けた細かい動きも使う（速く書いても、線が角ばらない）
    const native = e.nativeEvent
    const parts = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    const events = parts.length > 0 ? parts : [native]
    for (const ev of events) {
      const added = ink.move(e.pointerId, ev.clientX - rect.left, ev.clientY - rect.top, now)
      if (!added || !ctx) continue
      const seg = segmentForPoint(stroke.points, stroke.points.length - 1)
      if (seg) paint(ctx, seg)
    }
  }

  /** 線を書き終えた（離した・欄の外へ出た） */
  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = ink.current
    if (!ink.up(e.pointerId, performance.now())) return
    touchLock()
    const ctx = context()
    const tail = stroke ? tailSegment(stroke.points) : null
    if (ctx && tail) paint(ctx, tail)
    setEmpty(ink.isEmpty)
    emitSoon()
  }

  /** 端末が取り消した（手のひらと判断された指など） */
  function cancel(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = ink.current
    const r = ink.cancel(e.pointerId, performance.now())
    if (r === 'none') return
    if (r === 'removed') {
      redraw()
    } else {
      const ctx = context()
      const tail = stroke ? tailSegment(stroke.points) : null
      if (ctx && tail) paint(ctx, tail)
    }
    setEmpty(ink.isEmpty)
    emitSoon()
  }

  function undo() {
    if (!ink.undo()) return
    redraw()
    setEmpty(ink.isEmpty)
    emit()
  }

  function clear() {
    ink.clear()
    redraw()
    setEmpty(true)
    emit()
  }

  const frame = missing && empty ? 'border-red-500 bg-red-50/40' : empty ? 'border-slate-300 bg-white' : 'border-teal-600 bg-white'

  return (
    <div id={id} className="scroll-mt-24">
      {/* 見出しは、書けたかどうかで高さ・幅が変わらない形にする（名前の下に、いつも1行ぶんの知らせ。
          スマホの幅では、ボタンをいつも下の段に）。書きはじめた瞬間に行が折り返すと、署名欄が指の下から動いてしまうため */}
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span className="text-sm font-bold text-slate-700">
          <span className="block">{label}</span>
          {empty ? (
            <span className={`block text-xs font-bold ${missing ? 'text-red-700' : 'text-slate-500'}`}>{missing ? '← まだ書かれていません' : '（まだ）'}</span>
          ) : (
            <span className="block text-xs font-bold text-teal-700">✓ 署名を受け付けました</span>
          )}
        </span>
        <span className="flex shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={empty}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            1つ戻す
          </button>
          <button
            type="button"
            onClick={clear}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            書き直す
          </button>
        </span>
      </div>
      {/* 欄の中では、文字の選択・長押しのメニュー・拡大が出ないようにする（書く手に反応させない） */}
      <div
        ref={wrapRef}
        className={`relative touch-none select-none overflow-hidden rounded-xl border-2 border-dashed ${frame}`}
        style={{ WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        <canvas
          ref={canvasRef}
          aria-label={`${label}（指やペンで書いてください）`}
          className="block w-full touch-none select-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
          onLostPointerCapture={up}
          onPointerLeave={up}
          onContextMenu={(e) => e.preventDefault()}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            ここに指やペンで署名してください
          </span>
        )}
        <span className="pointer-events-none absolute bottom-6 left-4 right-4 border-b border-slate-200" aria-hidden />
      </div>
    </div>
  )
}
