#!/usr/bin/env node
/**
 * Instagram/Google投稿用 画像＋本文 自動生成オーケストレーター
 *
 * 投稿テーマから、承認用の成果物一式（画像・本文・出典・チェックリスト）を生成する。
 * 外部投稿は一切行わない（承認用フォルダに保存するまで）。
 *
 * フロー:
 *   1. テーマ→投稿本文案・医学的事実/患者向け説明の分離（Claude API）
 *   2. ImageSpec(JSON)生成（Claude API）→ 3. Zod検証
 *   4. ImageSpec→画像プロンプト → 5. gpt-image-2で画像生成（OpenAI）
 *   6. PNG保存 → 7. Sharpで最終サイズへ整形＋文字合成
 *   8. 品質チェック → 9. content/ に成果物一式を保存
 *
 * 使い方:
 *   node tools/sns-automation/image-gen/generate-post-image.mts "テーマ" [--use instagram_feed|instagram_reel_cover|google_post] [--quality medium|high] [--mock]
 *
 *   --mock : OpenAI画像生成を呼ばず、プレースホルダ画像で全工程を検証（課金なし）
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { ImageSpecSchema, type ImageSpec, type IntendedUse } from './spec.mts';
import { buildImagePrompt, sizesFor } from './prompt.mts';
import { loadOpenAiKey, generateImage } from './openai-client.mts';
import { composeFinal, mockImage } from './compose.mts';
import { runQualityChecks, checklistMarkdown } from './checks.mts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..');

// 引数解析
const args = process.argv.slice(2);
const getOpt = (name: string, def?: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const mock = args.includes('--mock');
const use = (getOpt('--use', 'instagram_feed')) as IntendedUse;
const quality = (getOpt('--quality', 'medium')) as 'medium' | 'high';
const theme = args.filter((a, i) => !a.startsWith('--') && args[i - 1]?.startsWith('--') !== true).join(' ')
  || args.filter((a) => !a.startsWith('--') && a !== use && a !== quality).join(' ');

if (!theme) {
  console.log('使い方: node generate-post-image.mts "テーマ" [--use instagram_feed|instagram_reel_cover|google_post] [--quality medium|high] [--mock]');
  process.exit(1);
}

// Anthropicキー（本文・ImageSpec生成用）
function loadAnthropicKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const p = path.join(repoRoot, '.env.local');
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf-8').replace(/^﻿/, '');
    const m = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const anthropicKey = loadAnthropicKey();
if (!anthropicKey) {
  console.error('エラー: ANTHROPIC_API_KEY が見つかりません（.env.local を確認してください）');
  process.exit(1);
}

const openaiKey = mock ? null : loadOpenAiKey(repoRoot);
if (!mock && !openaiKey) {
  console.error('エラー: OPENAI_API_KEY が見つかりません。.env に OPENAI_API_KEY=... を設定するか、--mock で検証してください');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: anthropicKey });

// --- ステップ1-3: 本文案とImageSpecをClaudeで生成 ---
const PLANNER_SYSTEM = `あなたはゆうき整骨院（下関市彦島）のSNS投稿の企画・原稿担当です。
医療広告ガイドラインを厳守し、効果保証・比較優良・最上級表現・誇大表現を使いません。
「改善を目指す」「状態に合わせた」等の慎重な表現を用い、危険な兆候には受診を促します。
院情報: 電話083-265-4545 / 月〜金 10:00-13:00・15:00-20:00、土 10:00-15:00、日祝休診。`;

const plannerUser = `次のテーマでSNS投稿の企画をJSONで出力してください。テーマ: 「${theme}」／用途: ${use}

以下のJSON形式のみを出力（前後に説明文やコードフェンスを付けない）:
{
  "caption": "投稿本文（Instagram/Google投稿用。300〜500字。医学的説明は患者向けにやさしく。最後に電話とLINE案内。末尾に『※症状や経過には個人差があります』）",
  "medicalFacts": ["この投稿の医学的根拠となる事実を2〜4個。断定を避けた表現で"],
  "patientExplanation": "上記を患者向けにかみ砕いた一文",
  "imageSpec": {
    "topic": "${theme}",
    "intendedUse": "${use}",
    "targetAudience": "この投稿の対象読者（日本語）",
    "mainSubject": "画像の主題。人体を描く場合も解剖学的に自然に、断定的な病変描写はしない",
    "scene": "場面設定",
    "composition": "構図。上部3分の1はタイトル用に空ける",
    "visualStyle": "フラットイラスト等の表現形式",
    "lighting": "やわらかい自然光 等",
    "colorDirection": "ネイビー(#1B2A4A)を基調にオフホワイトとオレンジ(#D86018)を差し色に",
    "medicalConstraints": ["このテーマ固有の医学的注意を1〜3個"],
    "negativeConstraints": ["このテーマで避けたい描写を1〜3個"],
    "title": "画像に焼き込むタイトル（26文字以内・体言止め推奨）",
    "subtitle": "サブタイトル（任意・40文字以内）",
    "sourceReferences": [{"label": "参考にした一般的な知見やガイドライン名（特定論文が不要なら一般的記述でよい）"}]
  }
}`;

console.log(`[1-3] 投稿本文とImageSpecを生成中... (テーマ: ${theme} / 用途: ${use})`);

const planStream = anthropic.messages.stream({
  model: 'claude-opus-4-8',
  max_tokens: 16000,
  thinking: { type: 'adaptive' },
  system: PLANNER_SYSTEM,
  messages: [{ role: 'user', content: plannerUser }],
});
const planMsg = await planStream.finalMessage();
const planText = planMsg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');

let plan: {
  caption: string;
  medicalFacts: string[];
  patientExplanation: string;
  imageSpec: Record<string, unknown>;
};
try {
  const jsonStr = planText.slice(planText.indexOf('{'), planText.lastIndexOf('}') + 1);
  plan = JSON.parse(jsonStr);
} catch {
  console.error('エラー: 企画JSONの解析に失敗しました');
  process.exit(1);
}

// postId と outputPath を確定してImageSpecを組み立て
const today = new Date().toISOString().slice(0, 10);
// postIdは半角英数字とハイフンのみ（フォルダ名・スキーマ制約）。
// 日本語トピックはASCII化できないため、用途＋トピックの短いハッシュでスラグを作る。
const asciiSlug = String(plan.imageSpec.topic ?? theme)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 30);
const topicHash = createHash('sha1').update(String(plan.imageSpec.topic ?? theme)).digest('hex').slice(0, 6);
const slug = asciiSlug || `${use.replace(/_/g, '-')}-${topicHash}`;
const postId = `${today}-${slug}`;
const outDir = path.join(repoRoot, 'content', postId);
fs.mkdirSync(outDir, { recursive: true });

const specCandidate = {
  ...plan.imageSpec,
  postId,
  outputPath: outDir,
};

// ステップ3: Zod検証
const parsed = ImageSpecSchema.safeParse(specCandidate);
if (!parsed.success) {
  console.error('エラー: ImageSpecの検証に失敗しました:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}
const spec: ImageSpec = parsed.data;
console.log(`[3] ImageSpec検証OK (postId: ${postId})`);

// --- ステップ4-5: プロンプト生成→画像生成 ---
const prompt = buildImagePrompt(spec);
const sz = sizesFor(spec.intendedUse);

console.log(`[4-5] 画像生成中... (${mock ? 'モックモード' : `gpt-image-2 / ${sz.apiSize} / quality=${quality}`})`);
let sourcePng: Buffer;
try {
  sourcePng = mock
    ? await mockImage(sz.genWidth, sz.genHeight)
    : await generateImage({ apiKey: openaiKey!, prompt, size: sz.apiSize, quality });
} catch (err) {
  console.error(`エラー: ${(err as Error).message}`);
  process.exit(1);
}

// ステップ6-7: 原画保存＋最終整形
const originalPath = path.join(outDir, 'generated-original.png');
fs.writeFileSync(originalPath, sourcePng);

const finalName = spec.intendedUse === 'instagram_reel_cover' ? 'instagram-1080x1920.png' : 'instagram-1080x1350.png';
const finalPath = path.join(outDir, finalName);
// リールカバーには注意書きを入れない（縦長で下部が隠れやすいため）。フィード/Google投稿には入れる。
const showDisclaimer = spec.intendedUse !== 'instagram_reel_cover';
await composeFinal({
  sourcePng,
  outWidth: sz.outWidth,
  outHeight: sz.outHeight,
  spec,
  showDisclaimer,
  outFile: finalPath,
});
console.log(`[6-7] 画像を整形・文字合成しました: ${finalName}`);

// --- ステップ8: 品質チェック ---
const checks = await runQualityChecks({
  dir: outDir,
  spec,
  caption: plan.caption,
  finalImage: finalName,
  expectWidth: sz.outWidth,
  expectHeight: sz.outHeight,
});

// --- ステップ9: 成果物保存 ---
fs.writeFileSync(path.join(outDir, 'image-spec.json'), JSON.stringify(spec, null, 2), 'utf-8');
fs.writeFileSync(path.join(outDir, 'image-prompt.txt'), prompt, 'utf-8');

const captionMd = [
  `# 投稿本文 — ${spec.topic}`,
  '',
  '## キャプション（そのまま投稿に使用）',
  '',
  plan.caption,
  '',
  '## 患者向けの要点',
  '',
  plan.patientExplanation,
].join('\n');
fs.writeFileSync(path.join(outDir, 'caption.md'), captionMd, 'utf-8');

const refsMd = [
  `# 医学的根拠・出典 — ${spec.topic}`,
  '',
  '## 医学的事実（投稿の根拠）',
  '',
  ...plan.medicalFacts.map((f) => `- ${f}`),
  '',
  '## 参考・出典',
  '',
  ...(spec.sourceReferences.length
    ? spec.sourceReferences.map((r) => `- ${r.label}${r.url ? ` (${r.url})` : ''}`)
    : ['- （一般的な知見に基づく。特定の出典なし）']),
].join('\n');
fs.writeFileSync(path.join(outDir, 'references.md'), refsMd, 'utf-8');

fs.writeFileSync(path.join(outDir, 'approval-checklist.md'), checklistMarkdown(checks, spec), 'utf-8');

// 結果表示
console.log('\n[8] 品質チェック:');
let allOk = true;
for (const r of checks) {
  console.log(`  ${r.ok ? '✅' : '❌'} ${r.name} — ${r.detail}`);
  if (!r.ok) allOk = false;
}
console.log(`\n[9] 承認用フォルダに保存しました: content/${postId}/`);
console.log('    image-spec.json / image-prompt.txt / generated-original.png');
console.log(`    ${finalName} / caption.md / references.md / approval-checklist.md`);
console.log(`\n${allOk ? '✅ 自動チェックはすべて通過' : '⚠️ 未通過の項目があります'}。院長の最終確認・承認まで外部投稿はしないでください。`);
process.exit(allOk ? 0 : 1);
