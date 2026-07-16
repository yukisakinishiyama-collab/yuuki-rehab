#!/usr/bin/env node
/**
 * Google口コミ返信 下書き生成CLI
 *
 * Googleビジネスプロフィールに届いた口コミの本文を渡すと、
 * 医療広告ガイドラインに配慮した返信の下書きを3案生成する。
 * 返信はあくまで下書きであり、投稿前に必ず院長が確認・修正すること。
 *
 * 使い方:
 *   node tools/sns-automation/generate-review-reply.mjs "口コミの本文" [--stars 1-5]
 *
 * 例:
 *   node tools/sns-automation/generate-review-reply.mjs "捻挫で通いました。丁寧に見てもらえて助かりました" --stars 5
 *   node tools/sns-automation/generate-review-reply.mjs "待ち時間が長かった" --stars 2
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

// .env.local からAPIキーを読む（BOM対応。値はログに出さない）
function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const envPath = path.join(repoRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8').replace(/^﻿/, '');
    const m = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

// 引数解析
const args = process.argv.slice(2);
const starsIdx = args.indexOf('--stars');
const stars = starsIdx >= 0 ? Number(args[starsIdx + 1]) : null;
const review = args
  .filter((a, i) => !(starsIdx >= 0 && (i === starsIdx || i === starsIdx + 1)))
  .join(' ');

if (!review) {
  console.log('使い方: node generate-review-reply.mjs "口コミの本文" [--stars 1-5]');
  process.exit(1);
}

const apiKey = loadApiKey();
if (!apiKey) {
  console.error('エラー: ANTHROPIC_API_KEY が見つかりません（.env.local を確認してください）');
  process.exit(1);
}

const SYSTEM_PROMPT = `あなたはゆうき整骨院（山口県下関市彦島）の院長として、Googleビジネスプロフィールの口コミに返信します。

【返信の基本方針】
- まず来院と口コミ投稿への感謝を伝える
- 誠実で温かく、かしこまりすぎないトーン（150〜250字程度）
- 定型文っぽさを避け、口コミの内容に具体的に触れる

【厳守事項】
- 口コミに書かれていない症状・治療内容・来院日などの個人情報を返信で明かさない（本人確認になる記載はNG。口コミ本文に書かれている範囲の話題のみ言及可）
- 医療広告ガイドライン順守: 「必ず治る」「完全に」等の効果保証をしない
- 低評価・批判的な口コミには: 言い訳をせず、まず不快な思いをさせたことへの謝罪 → 指摘への感謝 → 改善の姿勢 → 直接連絡の窓口案内（083-265-4545）の順で。反論・患者側の落ち度の指摘は絶対にしない
- 医学的な相談への回答はせず、来院・電話での相談を案内する

【出力形式】
返信案を3案、以下の形式で出力:

## 案1（標準）
（返信文）

## 案2（少しカジュアル）
（返信文）

## 案3（簡潔）
（返信文）

## 注意点
（この口コミに返信する際に院長が気をつけるべき点があれば1〜2行。なければ「特になし」）`;

const client = new Anthropic({ apiKey });

const starsInfo = stars ? `【評価】星${stars}つ\n` : '';
console.log('返信下書きを生成中...\n');

const stream = client.messages.stream({
  model: 'claude-opus-4-8',
  max_tokens: 16000,
  thinking: { type: 'adaptive' },
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: `${starsInfo}【口コミ本文】\n${review}` }],
});

const message = await stream.finalMessage();
const text = message.content
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('');

if (!text) {
  console.error('エラー: 返信を生成できませんでした（stop_reason: ' + message.stop_reason + '）');
  process.exit(1);
}

console.log(text);
console.log('\n※ これは下書きです。投稿前に必ず内容を確認・修正してください。');
