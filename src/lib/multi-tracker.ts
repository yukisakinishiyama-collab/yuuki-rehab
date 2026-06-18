/**
 * 多人数姿勢追跡モジュール（最大6人）
 *
 * 重心距離ベースのグリーディマッチングにより、フレーム間で人物IDを持続させる。
 * EMA（指数移動平均）でランドマークのジッターを抑制し、追跡精度を向上させる。
 *
 * アルゴリズム概要:
 *  1. 各検出の腰中点（→肩→鼻のフォールバック）を重心とする
 *  2. 既存トラックと新検出を重心距離で最近傍マッチング（greedy）
 *  3. マッチ成功 → EMA平滑化してトラック更新
 *  4. 未マッチ → MAX_LOST_FRAMES フレームまで前位置で保持し、超過したら削除
 *  5. 新規検出 → 新しいIDを割り当て
 */
import type { Landmark } from './pose-analyzer'

// ── 定数 ────────────────────────────────────────────────────────────────────

/** EMA平滑化係数（0=変化なし, 1=平滑化なし）スポーツ用に控えめに設定 */
const EMA_ALPHA = 0.38

/** 同一人物とみなすマッチング距離閾値（正規化座標 0-1） */
const MAX_MATCH_DIST = 0.22

/** 連続未検出の許容フレーム数（超過したらトラック削除） */
const MAX_LOST_FRAMES = 14

/** 人物ごとの描画色（最大6人） */
export const PERSON_COLORS = [
  '#3b82f6', // 青
  '#ef4444', // 赤
  '#22c55e', // 緑
  '#f59e0b', // 黄
  '#a855f7', // 紫
  '#ec4899', // ピンク
] as const

// ── 型定義 ──────────────────────────────────────────────────────────────────

/** 追跡中の人物1人分の状態 */
export interface TrackedPerson {
  /** 追跡ID（動画全体を通じて一定） */
  id: number
  /** EMA平滑化済みの画像座標ランドマーク（0-1 正規化） */
  landmarks: Landmark[]
  /** EMA平滑化済みのワールド座標ランドマーク（メートル相当） */
  worldLandmarks: Landmark[]
  /** 腰中点（正規化 0-1, マッチングと速度計算に使用） */
  centroid: { x: number; y: number }
  /** 描画色 */
  color: string
  /** 最後に検出されたフレーム番号 */
  lastSeenFrame: number
  /** 追跡開始からの総フレーム数 */
  age: number
  /** 現在の連続未検出フレーム数（0 = 現フレームで検出済み） */
  lostFrames: number
}

// ── モジュール内部状態 ───────────────────────────────────────────────────────
let _nextId = 0
let _tracks: TrackedPerson[] = []
let _frame = 0

// ── ユーティリティ ──────────────────────────────────────────────────────────

/** ランドマーク配列から人物の重心を計算する（腰→肩→鼻 の優先順） */
function centroidOf(lm: Landmark[]): { x: number; y: number } {
  const lh = lm[23], rh = lm[24]
  if (lh && rh && (lh.visibility ?? 1) > 0.2 && (rh.visibility ?? 1) > 0.2) {
    return { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
  }
  const ls = lm[11], rs = lm[12]
  if (ls && rs && (ls.visibility ?? 1) > 0.2 && (rs.visibility ?? 1) > 0.2) {
    return { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
  }
  return { x: lm[0]?.x ?? 0.5, y: lm[0]?.y ?? 0.5 }
}

/** ユークリッド距離 */
function euclidDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** ランドマーク配列の指数移動平均平滑化 */
function emaSmooth(prev: Landmark[], next: Landmark[], alpha: number): Landmark[] {
  if (prev.length === 0) return next
  return next.map((n, i) => {
    const p = prev[i]
    if (!p) return n
    return {
      x: p.x + alpha * (n.x - p.x),
      y: p.y + alpha * (n.y - p.y),
      z: p.z + alpha * (n.z - p.z),
      visibility: n.visibility,
    }
  })
}

// ── パブリック API ───────────────────────────────────────────────────────────

/**
 * 1フレームの検出結果をトラッカーに渡し、ID付きの TrackedPerson[] を返す。
 * 呼び出しのたびにフレームカウンタが進む。
 */
export function updateTracks(
  detections: { landmarks: Landmark[]; worldLandmarks: Landmark[] }[],
): TrackedPerson[] {
  _frame++

  const newCentroids = detections.map((d) => centroidOf(d.landmarks))
  const matched = new Set<number>()
  const updated: TrackedPerson[] = []

  // ── 既存トラック × 新検出のグリーディマッチング ────────────────────────
  for (const track of _tracks) {
    let bestIdx = -1
    let bestDist = MAX_MATCH_DIST

    for (let i = 0; i < detections.length; i++) {
      if (matched.has(i)) continue
      const d = euclidDist(track.centroid, newCentroids[i])
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }

    if (bestIdx >= 0) {
      // マッチ成功: EMA平滑化でトラック更新
      matched.add(bestIdx)
      const det = detections[bestIdx]
      updated.push({
        ...track,
        landmarks:      emaSmooth(track.landmarks,      det.landmarks,      EMA_ALPHA),
        worldLandmarks: emaSmooth(track.worldLandmarks, det.worldLandmarks, EMA_ALPHA),
        centroid:       newCentroids[bestIdx],
        lastSeenFrame:  _frame,
        age:            track.age + 1,
        lostFrames:     0,
      })
    } else {
      // 未マッチ: ロスト継続 or 削除
      const lostFrames = track.lostFrames + 1
      if (lostFrames <= MAX_LOST_FRAMES) {
        updated.push({ ...track, lostFrames, age: track.age + 1 })
      }
    }
  }

  // ── マッチしなかった検出 → 新規トラック ────────────────────────────────
  for (let i = 0; i < detections.length; i++) {
    if (matched.has(i)) continue
    const det = detections[i]
    const id = _nextId++
    updated.push({
      id,
      landmarks:      det.landmarks,
      worldLandmarks: det.worldLandmarks,
      centroid:       newCentroids[i],
      color:          PERSON_COLORS[id % PERSON_COLORS.length],
      lastSeenFrame:  _frame,
      age:            0,
      lostFrames:     0,
    })
  }

  _tracks = updated
  return _tracks
}

/** 追跡状態をリセット（動画を切り替えるとき） */
export function resetTracks(): void {
  _tracks = []
  _nextId = 0
  _frame = 0
}

/** 現在のトラック一覧を返す（読み取り専用） */
export function getCurrentTracks(): readonly TrackedPerson[] {
  return _tracks
}
