// アウトカムスコア（質問票）の回答の確かめ（純粋な関数。画面と tools/test-outcome-records.mjs から使う）
// 2026-11-20 院長「アウトカムの評価で記録がつかないものがあります」：スライダーの項目は、動かさないと
// 答えたことにならず（✓ が付かない・保存の回答に入らない）、まだの項目は答えの値 0 として計算されていた。
// 保存の前に、まだの項目を番号で出す
import type { ScoreItem } from '@/data/outcome-score-defs'

export function unansweredItems(items: Pick<ScoreItem, 'id'>[], answers: Record<string, number>): Array<{ no: number; id: string }> {
  const out: Array<{ no: number; id: string }> = []
  items.forEach((item, i) => {
    const v = answers[item.id]
    if (typeof v !== 'number' || !Number.isFinite(v)) out.push({ no: i + 1, id: item.id })
  })
  return out
}
