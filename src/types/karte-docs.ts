// ──────────────────────────────────────────────
// カルテの資料（患者さんごと。pt_karte_docs）
//
// 症例に関する論文・リハビリプロトコル・医療機関の書類などを、PDF などのファイルか、リンク（URL・DOI）で入れる。
// ファイルそのものはクラウドの非公開の保存場所（karte-docs）に置き、端末には場所と題名・メモだけを持つ。
// ほかのカルテと同じようにクラウドと同期する（15秒ごと・「すぐに反映する」）。
// 2026-11-18 院長の依頼。DECISIONS.md
// ──────────────────────────────────────────────

/** 資料の種類（論文・リハビリプロトコル・医療機関の書類・その他） */
export type KarteDocCategory = 'paper' | 'protocol' | 'medical' | 'other'

export interface KarteDoc {
  id: string
  patientId: string
  /** file＝ファイル（PDF・画像・Word など）、link＝リンク（URL） */
  kind: 'file' | 'link'
  category: KarteDocCategory
  /** 一覧に出す題名 */
  title: string
  /** メモ（どこを参考にしたか・要点など。任意） */
  memo: string
  // ── ファイルのとき ──
  /** もとのファイル名 */
  fileName?: string
  /** 拡張子（小文字。pdf・jpg・docx など） */
  ext?: string
  bytes?: number
  /** クラウド上の場所（最初に入れたカルテのID/資料のID.拡張子）。ほかのカルテから同じ資料を入れたときも同じ場所を指す */
  storagePath?: string
  // ── リンクのとき ──
  url?: string
  /** 入れた日（日本時間 YYYY-MM-DD） */
  addedDate: string
  createdAt: string
  updatedAt: string
}
