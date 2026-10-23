'use client'

/**
 * 経営メニューの「隠しモード」
 *
 * 院内アプリの画面は、受付や施術中に患者さんの目に入ることがある。
 * 売上などの経営の数字（売上・来院、集客の効果、目標のガイド）は、ふだんはメニューにも出さず、
 * 院長が「隠しコマンド」を入れたときだけ表示する。
 *
 * - 開き方: 院内アプリのロゴ（PCは左上、スマホは上の「ゆうき整骨院 院内アプリ」の文字）を、2秒以内に5回続けて押す
 *           PCのキーボードでは、入力欄の外で Shift を押しながら K を3回
 * - 開いている間: メニューに「経営」が出る。今日の画面に昨日の締め（売上）が出る
 * - 閉じ方: 「隠す」ボタン、または操作がないまま10分たつと自動で閉じる（経営の画面は目隠しになる）
 * - 状態はこのタブの中だけ（sessionStorage）。ブラウザを閉じれば必ず隠れた状態から始まる
 *
 * これは見た目を隠すためのもので、守りはパスワード（proxy の Basic 認証）と、院長だけが見られるAPIが担う。
 */
import { useSyncExternalStore } from 'react'

const KEY = 'clinic:keiei-until'
const EVENT = 'clinic:keiei-mode'
/** 操作がないまま、この時間がたつと自動で隠れる */
export const KEIEI_IDLE_MS = 10 * 60 * 1000

function readUntil(): number {
  try {
    return Number(window.sessionStorage.getItem(KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

function writeUntil(until: number | null) {
  try {
    if (until === null) window.sessionStorage.removeItem(KEY)
    else window.sessionStorage.setItem(KEY, String(until))
  } catch {
    // 保存できない環境でも、このページの中では動く（下の memory を使う）
  }
  memory = until ?? 0
  window.dispatchEvent(new Event(EVENT))
}

let memory = 0

function isOpenNow(): boolean {
  if (typeof window === 'undefined') return false
  const until = Math.max(readUntil(), memory)
  return until > Date.now()
}

export function openKeiei() {
  writeUntil(Date.now() + KEIEI_IDLE_MS)
}

export function closeKeiei() {
  writeUntil(null)
}

/** 開いている間の操作で、自動で隠れるまでの時間をのばす（呼びすぎないよう30秒に1回まで） */
let lastExtend = 0
export function extendKeiei() {
  if (!isOpenNow()) return
  const now = Date.now()
  if (now - lastExtend < 30_000) return
  lastExtend = now
  writeUntil(now + KEIEI_IDLE_MS)
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  // 時間切れを見落とさないよう、15秒ごとに確かめる
  const timer = window.setInterval(onChange, 15_000)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
    window.clearInterval(timer)
  }
}

/** 経営メニューが開いているか（サーバー側の表示では常に「隠れている」） */
export function useKeieiOpen(): boolean {
  return useSyncExternalStore(subscribe, isOpenNow, () => false)
}

/**
 * 「2秒以内に5回」の押し方を数える。5回目で開く（開いていれば何もしない）。
 * 戻り値が true のとき開いた。
 */
let taps: number[] = []
export function countSecretTap(): boolean {
  const now = Date.now()
  taps = [...taps.filter((t) => now - t < 2000), now]
  if (taps.length >= 5) {
    taps = []
    if (!isOpenNow()) {
      openKeiei()
      return true
    }
  }
  return false
}

/** キーボード：入力欄の外で Shift＋K を3回（1.5秒以内） */
let keys: number[] = []
export function countSecretKey(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  if (typing || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'k') return false
  const now = Date.now()
  keys = [...keys.filter((t) => now - t < 1500), now]
  if (keys.length >= 3) {
    keys = []
    if (!isOpenNow()) {
      openKeiei()
      return true
    }
  }
  return false
}
