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

// ───────────────────────────────────────────────
// 媒体（platform）— note追加対応
// ───────────────────────────────────────────────
export const Platform = z.enum(['instagram', 'google', 'note']);
export type Platform = z.infer<typeof Platform>;
export const ALL_PLATFORMS: Platform[] = ['instagram', 'google', 'note'];

// DOI / PMID の形式検証（存在検証ではなく形式の妥当性のみ）
export const DOI_RE = /^10\.\d{4,9}\/[^\s]+$/;
export const PMID_RE = /^\d{1,8}$/;

// 引用文献（実在しないDOI/PMID/著者/結果を生成してはならない。
// 確認できない場合は status を 'needs_confirmation' にする）
export const CitationSchema = z.object({
  author: z.string().max(300),          // 著者（et al. 可）
  title: z.string().max(400),           // 論文タイトル
  journal: z.string().max(200),         // 雑誌名
  year: z.union([z.number(), z.string()]).optional(),
  doi: z.string().max(200).optional(),
  pmid: z.string().max(20).optional(),
  url: z.string().max(500).optional(),  // PubMed/出版社URL
  studyDesign: z.string().max(200),     // 研究デザイン
  usedForPoint: z.string().max(300),    // 本文中で使用した論点
  status: z.enum(['verified', 'needs_confirmation']).default('needs_confirmation'),
});
export type Citation = z.infer<typeof CitationSchema>;

// 主要論文のクリティカル・アプレイザル（批判的吟味）
export const CriticalAppraisalSchema = z.object({
  citationLabel: z.string().max(400),         // どの論文か
  studyDesign: z.string().max(200),
  participantCount: z.string().max(100),      // 対象者数
  participantCharacteristics: z.string().max(400),
  intervention: z.string().max(400),          // 介入または評価方法
  primaryOutcome: z.string().max(400),        // 主要評価項目
  mainResults: z.string().max(600),           // 主な結果
  clinicalSignificance: z.string().max(400),  // 臨床的意義
  statVsClinical: z.string().max(400),        // 統計学的有意差と臨床的重要性の違い
  biasRisk: z.string().max(400),              // バイアスの可能性
  generalizability: z.string().max(400),      // 一般化可能性
  cannotConclude: z.string().max(400),        // 研究からは断定できないこと
});
export type CriticalAppraisal = z.infer<typeof CriticalAppraisalSchema>;

// note見出し画像の安全領域（上下左右のインセット px）
export const NoteSafeAreaSchema = z.object({
  top: z.number().min(0),
  right: z.number().min(0),
  bottom: z.number().min(0),
  left: z.number().min(0),
});

// note用の派生スペック（既存ImageSpecは変更しない）
export const NoteSpecSchema = z.object({
  postId: z.string().min(1).max(80),
  platform: z.literal('note'),
  topic: z.string().min(1).max(100),
  // 検索・読者
  noteTargetReader: z.string().min(1).max(300),
  noteSearchIntent: z.string().min(1).max(300),        // 読者の検索意図
  // 記事タイトルと見出し画像テキスト
  noteArticleTitle: z.string().min(1).max(60),
  noteCoverTitle: z.string().min(1).max(28, '見出し画像タイトルは28文字以内'),
  noteCoverSubtitle: z.string().max(40).optional(),
  // 記事本体
  noteArticleSummary: z.string().min(1).max(400),      // 記事要約（note-summary.txt）
  noteSections: z.object({
    intro: z.string().min(1),                           // 導入
    conclusion: z.string().min(1),                       // 今回の結論
    generalExplanation: z.string().min(1),               // 症状・病態の一般的説明
    evidence: z.string().min(1),                         // ガイドライン等で確認されていること
    patientTranslation: z.string().min(1),               // 患者向けの言い換え
    misconceptions: z.string().min(1),                   // よくある誤解
    homeCare: z.string().min(1),                         // 自宅で注意できること
    whenToSeeDoctor: z.string().min(1),                  // 受診を検討する目安
    limitations: z.string().min(1),                      // 不明な点・研究の限界
    summary: z.string().min(1),                          // まとめ
  }),
  noteKeyTakeaways: z.array(z.string().max(200)).min(1), // 要点
  noteClinicalCautions: z.array(z.string().max(300)).min(1), // 臨床上の注意
  noteReferences: z.array(CitationSchema),
  criticalAppraisals: z.array(CriticalAppraisalSchema).default([]),
  noteHashtags: z.array(z.string().max(40)).min(1),
  noteDisclaimer: z.string().min(1).max(300),
  // 3種のタイトル案
  noteTitleOptions: z.object({
    searchable: z.string().max(60),   // 患者が検索しやすい
    professional: z.string().max(60), // 専門性が伝わる
    social: z.string().max(60),       // SNSから誘導しやすい
  }),
  // 見出し画像の生成用（オーケストレーターが設定する項目もある）
  noteCoverSafeArea: NoteSafeAreaSchema,
  coverMainSubject: z.string().min(1).max(300),  // 見出し画像の主題（中央配置）
  coverScene: z.string().max(300),
  coverVisualStyle: z.string().max(200),
  coverColorDirection: z.string().max(200),
  noteOutputPaths: z.object({
    cover1280: z.string(),
    cover1920: z.string(),
    article: z.string(),
  }),
});
export type NoteSpec = z.infer<typeof NoteSpecSchema>;

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
