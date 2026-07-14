#!/usr/bin/env node
/**
 * 投稿管理表 一括チェッカー
 *
 * 「ゆうき整骨院_投稿管理表」をCSVエクスポートしたファイルを読み込み、
 * 各投稿のテキスト列（タイトル・冒頭フック・台本・キャプション等）に対して
 * 医療広告ガイドラインチェックを実行する。結果は「広告表現チェック」列に
 * 記入する内容としてそのまま使える形式で出力する。
 *
 * あわせて、本文が未作成の記事枠（note/ブログの「(記事形式)」行）を一覧表示し、
 * generate-article.mjs で生成するためのコマンドを提案する。
 *
 * 使い方:
 *   node tools/sns-automation/check-posts.mjs <CSVファイル>
 *
 * CSVの取得方法: Googleスプレッドシートで「ファイル → ダウンロード → CSV」
 */

import fs from 'node:fs';
import { checkText } from './lib/rules.mjs';

// RFC4180準拠の簡易CSVパーサー（引用符内の改行・カンマ・エスケープ対応）
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.log('使い方: node check-posts.mjs <投稿管理表のCSVファイル>');
  console.log('CSVの取得: スプレッドシートで「ファイル → ダウンロード → CSV」');
  process.exit(1);
}

// BOM除去して読み込み
const raw = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
const rows = parseCsv(raw);
const header = rows[0];
const posts = rows.slice(1);

// チェック対象のテキスト列
const TEXT_COLUMNS = ['タイトル', '冒頭フック', '台本', 'キャプション', 'ハッシュタグ', 'LINE誘導文', 'Google投稿文', 'YouTubeタイトル'];
const col = (name) => header.indexOf(name);

let ngTotal = 0;
let warnTotal = 0;
const missingArticles = [];

console.log(`投稿管理表チェック: ${posts.length}件の投稿計画\n`);

for (const post of posts) {
  const date = post[col('投稿日')] ?? '?';
  const media = post[col('媒体')] ?? '?';
  const theme = post[col('テーマ')] ?? '?';
  const label = `${date} ${media}「${theme}」`;

  // テキスト列を結合してチェック
  const findings = [];
  for (const c of TEXT_COLUMNS) {
    const idx = col(c);
    if (idx < 0) continue;
    for (const f of checkText(post[idx], c)) findings.push(f);
  }

  if (findings.length === 0) {
    console.log(`✅ ${label} — 問題なし`);
  } else {
    for (const f of findings) {
      const mark = f.level === 'NG' ? '❌' : '⚠️';
      console.log(`${mark} ${label} [${f.label}列]「${f.match}」 — ${f.reason} → ${f.suggestion}`);
      if (f.level === 'NG') ngTotal++; else warnTotal++;
    }
  }

  // 記事本文が未作成のnote/ブログ枠を検出（目的欄が「(記事形式)」で台本・キャプションが空）
  const isArticle = media === 'note' || media === 'ブログ';
  const body = [post[col('台本')], post[col('キャプション')], post[col('Google投稿文')]].join('').trim();
  if (isArticle && (body === '' || body === '(記事形式)')) {
    missingArticles.push({ date, media, theme, title: post[col('タイトル')] || post[col('投稿目的')] || theme });
  }
}

console.log('---');
console.log(`チェック完了: NG ${ngTotal}件 / 注意 ${warnTotal}件`);
console.log('※「問題なし」の行は、スプレッドシートの「広告表現チェック」列に「チェック済み(問題なし)」と記入できます。');

if (missingArticles.length > 0) {
  console.log(`\n📝 本文が未作成の記事枠: ${missingArticles.length}件`);
  for (const a of missingArticles) {
    const type = a.media === 'note' ? 'note' : 'blog';
    console.log(`  ${a.date} [${a.media}] ${a.theme}`);
    console.log(`    → node tools/sns-automation/generate-article.mjs "${a.title}" --type ${type}`);
  }
}

process.exit(ngTotal > 0 ? 1 : 0);
