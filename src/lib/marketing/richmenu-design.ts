/**
 * 公式LINEのリッチメニューの絵と、押せる場所（院長用の画面 marketing/line/richmenu から使う）
 *
 * LINE の管理画面のメニュー画像（6マス）をもとに、右下を「カルテ連携」に、上の帯の右に小さな「Instagram」、
 * 上の帯の左に小さな「予約確認」を描き足す。押せる場所は8つ。
 * 「予約確認」（2026-11-25 院長「LINEのメニューに「予約確認」のボタン…これを追加して」）は、押すと「予約確認」と
 * 送られ、その LINE に届くこれからの予約が返信で返る（lib/reservation-check.ts）。
 * 上の帯は、まん中（x 600〜1900）に院の名前があり、左（x 0〜600）が空いている（2026-11-25 に元の画像で確かめた）
 */
import { LIFF_ID, LIFF_RESERVE_URL } from '@/lib/marketing/clinic'
import { RESERVATION_CHECK_KEYWORD } from '@/lib/reservation-check'

export const RICH_W = 2500
export const RICH_H = 1686
export const NAVY = 'rgb(17,55,97)'
export const PAPER = 'rgb(251,252,252)'

/** 管理画面に置いてある今のメニュー画像（2026-10 時点）。変わったら画像を選び直せばよい */
export const DEFAULT_BASE_URL =
  'https://manager.line-scdn.net/0h4nsWPUgIa0FOLndxaTkUFmNvcSI-Rn4JMRB2fjd6ajV9FnlDIE8gdWkpNHk2G3kRe0AsdTwuNHAwTX8fdh8ncz5rNXdrHH5AIEk'

export const INSTAGRAM_URL = 'https://www.instagram.com/yu.ki__seikotsuin'
export const KARTE_LINK_URL = `https://liff.line.me/${LIFF_ID}/link`

export type RichArea = {
  bounds: { x: number; y: number; width: number; height: number }
  action: { type: 'uri'; label: string; uri: string } | { type: 'message'; label: string; text: string }
}

/** 押せる場所（画像 2500×1686 の座標） */
export const AREAS: RichArea[] = [
  { bounds: { x: 0, y: 420, width: 833, height: 590 }, action: { type: 'uri', label: '電話で予約', uri: 'tel:0832654545' } },
  { bounds: { x: 833, y: 420, width: 834, height: 590 }, action: { type: 'uri', label: 'アクセス', uri: 'https://maps.google.com/?cid=6709983637345638461' } },
  { bounds: { x: 1667, y: 420, width: 833, height: 590 }, action: { type: 'message', label: '初めての方へ', text: '初めての方へ' } },
  { bounds: { x: 0, y: 1010, width: 833, height: 676 }, action: { type: 'message', label: '料金', text: '料金' } },
  { bounds: { x: 833, y: 1010, width: 834, height: 676 }, action: { type: 'uri', label: 'ネット予約', uri: LIFF_RESERVE_URL } },
  { bounds: { x: 1667, y: 1010, width: 833, height: 676 }, action: { type: 'uri', label: 'カルテ連携', uri: KARTE_LINK_URL } },
  { bounds: { x: 2080, y: 60, width: 420, height: 320 }, action: { type: 'uri', label: 'Instagram', uri: INSTAGRAM_URL } },
  // 上の帯の左：押すと「予約確認」と送られる（返事は lib/reservation-check.ts）
  { bounds: { x: 0, y: 60, width: 420, height: 320 }, action: { type: 'message', label: RESERVATION_CHECK_KEYWORD, text: RESERVATION_CHECK_KEYWORD } },
]

/** 登録する押せる場所（描き足すものの選び方に合わせる） */
export function richMenuAreas(opts: { karte: boolean; insta: boolean; check: boolean }): RichArea[] {
  return AREAS.filter((a) => (a.action.label === 'Instagram' ? opts.insta : a.action.label === RESERVATION_CHECK_KEYWORD ? opts.check : true)).map((a) =>
    a.action.label === 'カルテ連携' && !opts.karte ? { ...a, action: { type: 'uri' as const, label: 'Instagram', uri: INSTAGRAM_URL } } : a,
  )
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** 右下のマスを「カルテ連携」に描き替える */
export function drawKarte(g: CanvasRenderingContext2D) {
  const grad = g.createLinearGradient(0, 1045, 0, 1575)
  grad.addColorStop(0, PAPER)
  grad.addColorStop(1, 'rgb(243,247,251)')
  g.fillStyle = grad
  g.fillRect(1690, 1045, 730, 530)
  g.strokeStyle = NAVY
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const cx = 2040
  const top = 1100
  g.lineWidth = 18
  roundRect(g, cx - 85, top + 16, 170, 200, 20)
  g.stroke()
  roundRect(g, cx - 36, top, 72, 36, 12)
  g.fillStyle = PAPER
  g.fill()
  g.stroke()
  g.lineWidth = 14
  g.beginPath()
  g.moveTo(cx - 48, top + 88)
  g.lineTo(cx + 48, top + 88)
  g.moveTo(cx - 48, top + 132)
  g.lineTo(cx + 12, top + 132)
  g.stroke()
  g.lineWidth = 16
  g.fillStyle = PAPER
  g.beginPath()
  g.ellipse(cx + 118, top + 40, 62, 48, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.beginPath()
  g.moveTo(cx + 76, top + 78)
  g.lineTo(cx + 62, top + 104)
  g.lineTo(cx + 100, top + 86)
  g.closePath()
  g.fillStyle = PAPER
  g.fill()
  g.lineWidth = 12
  g.stroke()
  g.fillStyle = PAPER
  g.beginPath()
  g.ellipse(cx + 118, top + 40, 55, 41, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = NAVY
  for (const x of [cx + 96, cx + 118, cx + 140]) {
    g.beginPath()
    g.arc(x, top + 40, 7, 0, Math.PI * 2)
    g.fill()
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 100px "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif'
  g.fillText('カルテ連携', 2055, 1418)
  g.font = 'bold 38px "Yu Gothic", "Meiryo", "Hiragino Sans", sans-serif'
  g.fillText('LINEとカルテを結びつけ', 2055, 1505)
}

/** 上の帯の右に、小さな Instagram ボタンを描く */
export function drawInstagram(g: CanvasRenderingContext2D) {
  const x = 2110
  const y = 100
  const w = 360
  const h = 240
  g.lineJoin = 'round'
  g.lineCap = 'round'
  roundRect(g, x, y, w, h, 30)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.fill()
  g.strokeStyle = NAVY
  g.lineWidth = 8
  g.stroke()
  // Instagram の形（角丸四角＋丸＋点）
  const ix = x + w / 2
  const iy = y + 92
  g.lineWidth = 12
  roundRect(g, ix - 55, iy - 55, 110, 110, 30)
  g.stroke()
  g.beginPath()
  g.arc(ix, iy, 26, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = NAVY
  g.beginPath()
  g.arc(ix + 32, iy - 32, 8, 0, Math.PI * 2)
  g.fill()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 44px "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif'
  g.fillText('Instagram', ix, y + 192)
}

/**
 * 上の帯の左に、小さな「予約確認」ボタンを描く（Instagram と同じ大きさの枠で、左右にそろえる）。
 * スマホでは画像が横 400 ほどに縮むので、字は枠に入るいちばん大きいくらい（62px）にしている
 */
export function drawReservationCheck(g: CanvasRenderingContext2D) {
  const x = 30
  const y = 100
  const w = 360
  const h = 240
  g.lineJoin = 'round'
  g.lineCap = 'round'
  roundRect(g, x, y, w, h, 30)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.fill()
  g.strokeStyle = NAVY
  g.lineWidth = 8
  g.stroke()
  // カレンダーの形（角丸四角＋上の帯＋つまみ2つ）と、チェックの印
  const ix = x + w / 2
  const iy = y + 80
  g.lineWidth = 11
  roundRect(g, ix - 50, iy - 42, 100, 88, 16)
  g.stroke()
  g.beginPath()
  g.moveTo(ix - 50, iy - 14)
  g.lineTo(ix + 50, iy - 14)
  g.moveTo(ix - 24, iy - 58)
  g.lineTo(ix - 24, iy - 32)
  g.moveTo(ix + 24, iy - 58)
  g.lineTo(ix + 24, iy - 32)
  g.stroke()
  g.lineWidth = 12
  g.beginPath()
  g.moveTo(ix - 22, iy + 14)
  g.lineTo(ix - 5, iy + 30)
  g.lineTo(ix + 25, iy + 1)
  g.stroke()
  g.fillStyle = NAVY
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 62px "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif'
  g.fillText(RESERVATION_CHECK_KEYWORD, ix, y + 186)
}
