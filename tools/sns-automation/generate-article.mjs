#!/usr/bin/env node
/**
 * note/ブログ記事ドラフト生成CLI
 *
 * テーマを渡すと、ゆうき整骨院の方針・医療広告ガイドラインに沿った
 * 記事ドラフトを Claude API で生成し、drafts/ に Markdown として保存する。
 * 保存後に check-compliance.mjs によるNG表現チェックを自動実行する。
 *
 * 使い方:
 *   node tools/sns-automation/generate-article.mjs "足首の捻挫を放置するとどうなる？"
 *   node tools/sns-automation/generate-article.mjs "テーマ" --type blog
 *
 * オプション:
 *   --type note|blog|instagram  記事の種類（既定: note）
 *
 * 生成後の流れ:
 *   1. drafts/ 内のMarkdownを目視で確認・修正
 *   2. note投稿用: python tools/note-converter/convert-to-note.py drafts/xxx.md
 *   3. 投稿管理スプレッドシートにリンクを記載して承認フローへ
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

// .env.local からAPIキーを読む（Next.jsと同じファイルを共用。値はログに出さない）
function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const envPath = path.join(repoRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    // BOM付きUTF-8でも読めるよう先頭のBOMを除去する
    const content = fs.readFileSync(envPath, 'utf-8').replace(/^﻿/, '');
    const m = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

// 引数解析
const args = process.argv.slice(2);
const typeIdx = args.indexOf('--type');
const articleType = typeIdx >= 0 ? args[typeIdx + 1] : 'note';
const theme = args
  .filter((a, i) => !(typeIdx >= 0 && (i === typeIdx || i === typeIdx + 1)))
  .join(' ');

if (!theme) {
  console.log('使い方: node generate-article.mjs "記事のテーマ" [--type note|blog|instagram]');
  process.exit(1);
}

const apiKey = loadApiKey();
if (!apiKey) {
  console.error('エラー: ANTHROPIC_API_KEY が見つかりません（.env.local を確認してください）');
  process.exit(1);
}

// 院の基本情報と執筆方針（全記事共通のシステムプロンプト）
const SYSTEM_PROMPT = `あなたはゆうき整骨院（山口県下関市彦島江の浦町9-1-14）の広報ライターです。

【院の特徴】
- 外傷治療・スポーツ外傷・術前術後リハビリ・運動療法が専門
- エビデンスに基づいた施術。原因評価・再発予防・身体機能の改善を重視
- 単なる慰安・リラクゼーションではない。地域密着（下関市・彦島）
- 電話: 083-265-4545 / 診療時間: 月〜金 10:00-13:00・15:00-20:00、土 10:00-15:00、日祝休診
- 公式LINEでは症状のキーワード（膝・捻挫・股関節・術後リハビリ・料金など）を送ると自動案内が届く

【厳守 — 医療広告ガイドライン】
NG: 「必ず治る」「完全治癒」「1回で治る」「絶対に良くなる」「最先端」「No.1」「どこよりも」
   「副作用はありません」「奇跡」、効果の保証・断定、比較優良表現、体験談の広告的利用
OK: 「改善を目指す」「早期復帰をサポート」「状態に合わせた施術」「原因を評価する」
   「再発予防まで考える」「エビデンスに基づいて提案する」

【執筆方針】
- 読者は下関市周辺の一般の方（専門用語には短い説明を添える）
- 誠実で押し付けがましくないトーン。不安を過度に煽らない
- 受診が必要な危険なサイン（レッドフラッグ）があれば必ず「医療機関の受診」を促す
- 記事の最後に、無理のない自然な来院・LINE登録への導線を1つだけ入れる`;

// 記事タイプ別の指示
const TYPE_PROMPTS = {
  note: `以下のテーマでnote投稿用の記事を書いてください。

【テーマ】${theme}

【形式】
- Markdown形式。冒頭に「# タイトル」
- 2000〜3000字程度。見出し（##）で3〜5セクションに分ける
- 導入は読者の悩みへの共感から入る
- 本文は「原因の解説 → 放置リスク → 自分でできる対処 → 専門家に相談すべきタイミング」の流れを基本とする
- 最後に院の紹介と診療時間・電話番号を短く記載`,
  blog: `以下のテーマで公式サイトのブログ記事を書いてください。

【テーマ】${theme}

【形式】
- Markdown形式。冒頭に「# タイトル」（検索されやすい具体的な表現で）
- 1500〜2500字程度。見出し（##）で構造化
- 「下関市」「彦島」など地域名を自然に含める（SEO目的だが不自然な詰め込みはしない）
- 最後によくある質問（Q&A形式・2〜3問）を入れる`,
  instagram: `以下のテーマでInstagram投稿文を書いてください。

【テーマ】${theme}

【形式】
- 【投稿タイトル】【本文（400〜600字・改行多め）】【ハッシュタグ（10〜12個・地域タグ含む）】【CTA文】の構成
- 絵文字を適度に使用`,
};

if (!TYPE_PROMPTS[articleType]) {
  console.error(`エラー: --type は note / blog / instagram のいずれかを指定してください`);
  process.exit(1);
}

const client = new Anthropic({ apiKey });

console.log(`記事を生成中... (テーマ: ${theme} / タイプ: ${articleType})`);

const stream = client.messages.stream({
  model: 'claude-opus-4-8',
  max_tokens: 16000,
  thinking: { type: 'adaptive' },
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: TYPE_PROMPTS[articleType] }],
});

const message = await stream.finalMessage();
const text = message.content
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('');

if (!text) {
  console.error('エラー: 記事を生成できませんでした（stop_reason: ' + message.stop_reason + '）');
  process.exit(1);
}

// drafts/ に保存（ファイル名: 日付-タイプ-連番.md）
const draftsDir = path.join(__dirname, 'drafts');
fs.mkdirSync(draftsDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
let seq = 1;
let outPath;
do {
  outPath = path.join(draftsDir, `${today}-${articleType}-${seq}.md`);
  seq++;
} while (fs.existsSync(outPath));

fs.writeFileSync(outPath, text, 'utf-8');
console.log(`\n保存しました: ${path.relative(repoRoot, outPath)}`);
console.log(`使用トークン: 入力 ${message.usage.input_tokens} / 出力 ${message.usage.output_tokens}`);

// コンプライアンスチェックを自動実行
console.log('\n--- 医療広告ガイドラインチェック ---');
try {
  execFileSync('node', [path.join(__dirname, 'check-compliance.mjs'), outPath], { stdio: 'inherit' });
} catch {
  console.log('※ NG表現が検出されました。上記の言い換え例を参考に修正してから公開してください。');
}

console.log('\n次のステップ:');
console.log('  1. ドラフトを開いて内容を確認・修正');
if (articleType === 'note') {
  console.log(`  2. note貼り付け用HTMLに変換: python tools/note-converter/convert-to-note.py "${path.relative(repoRoot, outPath)}"`);
}
console.log('  3. 投稿管理スプレッドシートにリンクを記載して承認フローへ');
