/**
 * ImageSpec — 画像生成指示書の型定義とZodスキーマ
 *
 * 投稿テーマから作られる「画像生成の設計図」。LLMが生成したJSONを
 * このスキーマで検証してから画像生成に進む（不正なJSONを弾く安全弁）。
 */

import { z } from 'zod';

// 用途（サイズとレイアウトが変わる）
export const IntendedUse = z.enum(['instagram_feed', 'instagram_reel_cover', 'google_post']);
export type IntendedUse = z.infer<typeof IntendedUse>;

export const ImageSpecSchema = z.object({
  // 識別子: YYYY-MM-DD-topic 形式のフォルダ名に使う
  postId: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, 'postIdは半角英数字とハイフンのみ'),
  // 投稿テーマ（日本語可）
  topic: z.string().min(1).max(100),
  // 用途
  intendedUse: IntendedUse,
  // 対象読者（例: 部活動をする学生とその保護者）
  targetAudience: z.string().min(1).max(200),
  // 主題（画像の中心に描くもの）
  mainSubject: z.string().min(1).max(300),
  // 場面（どこで・どんな状況か）
  scene: z.string().min(1).max(300),
  // 構図（余白の位置指定を含む）
  composition: z.string().min(1).max(300),
  // 表現形式（フラットイラスト等）
  visualStyle: z.string().min(1).max(200),
  // 光の方向・質
  lighting: z.string().min(1).max(200),
  // 色の方向性（院のブランド: ネイビー基調・オレンジ差し色）
  colorDirection: z.string().min(1).max(200),
  // 医学的制約（不自然な人体を描かない等、テーマ固有の注意）
  medicalConstraints: z.array(z.string().max(200)).min(1),
  // 禁止事項（文字・ロゴ・誇張表現など）
  negativeConstraints: z.array(z.string().max(200)).min(1),
  // 後工程でSharpが焼き込むタイトル（画像生成AIには渡さない）
  title: z.string().min(1).max(26, 'タイトルは26文字以内'),
  // サブタイトル（省略可）
  subtitle: z.string().max(40).optional(),
  // 引用論文・出典（なければ空配列だが、captionに根拠を書く場合は必須）
  sourceReferences: z.array(
    z.object({
      label: z.string().max(300),   // 論文名・ガイドライン名など
      url: z.string().max(500).optional(),
    })
  ),
  // 出力先フォルダ（オーケストレーターが設定。LLMには生成させない）
  outputPath: z.string().min(1),
});

export type ImageSpec = z.infer<typeof ImageSpecSchema>;

// 誇大広告・禁止表現（タイトル/サブタイトル/キャプションの検査に使う）
export const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /完全(に)?治(癒|り|る)/, reason: '治癒の保証' },
  { pattern: /必ず(治|良くな|改善)/, reason: '効果の保証' },
  { pattern: /絶対(に)?(治|良くな|効)/, reason: '効果の保証' },
  { pattern: /(1|一)回で(治|改善|効果)/, reason: '施術回数と効果の断定' },
  { pattern: /(日本|地域|下関)(一|No\.?1|ナンバーワン)/i, reason: '比較優良広告' },
  { pattern: /最(高|先端|新)の(技術|治療|施術)/, reason: '最上級表現' },
  { pattern: /奇跡/, reason: '誇大広告' },
  { pattern: /副作用は(一切)?(あり|ござい)ません/, reason: 'リスクの否定' },
  { pattern: /完治/, reason: '治癒の保証' },
];
