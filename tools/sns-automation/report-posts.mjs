#!/usr/bin/env node
/**
 * Instagram/SNS 投稿分析レポート生成
 *
 * 投稿管理表のCSVから、記入済みのKPI（再生数・保存数・LINE登録数・予約数）を集計し、
 * Markdown形式のレポートを出力する。数字はスプレッドシートに手入力されたものを使う
 * （Instagramアプリの「インサイト」画面の数字を転記する運用）。
 *
 * 使い方:
 *   node tools/sns-automation/report-posts.mjs <CSVファイル> [--save]
 *
 * --save を付けると reports/YYYYMMDD-report.md にも保存する。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const save = args.includes('--save');
const csvPath = args.find((a) => a !== '--save');

if (!csvPath || !fs.existsSync(csvPath)) {
  console.log('使い方: node report-posts.mjs <投稿管理表のCSVファイル> [--save]');
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
const rows = parseCsv(raw);
const header = rows[0];
const col = (name) => header.indexOf(name);
const num = (v) => {
  const n = Number(String(v ?? '').replaceAll(',', '').trim());
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
};

// 投稿データの読み取り
const posts = rows.slice(1).map((r) => ({
  date: r[col('投稿日')] ?? '',
  media: r[col('媒体')] ?? '',
  theme: r[col('テーマ')] ?? '',
  status: r[col('投稿ステータス')] ?? '',
  url: r[col('URL')] ?? '',
  views: num(r[col('再生数')]),
  saves: num(r[col('保存数')]),
  lineRegs: num(r[col('LINE登録数')]),
  bookings: num(r[col('予約数')]),
  memo: r[col('改善メモ')] ?? '',
}));

const withData = posts.filter((p) => p.views !== null || p.saves !== null || p.lineRegs !== null || p.bookings !== null);
const posted = posts.filter((p) => /投稿済|公開済/.test(p.status));
const awaiting = posted.filter((p) => !withData.includes(p));

const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push(`# SNS投稿 分析レポート（${today}時点）`);
lines.push('');
lines.push(`- 投稿計画: ${posts.length}件（投稿済み/公開済み: ${posted.length}件）`);
lines.push(`- 数値記入済み: ${withData.length}件`);
lines.push('');

if (withData.length === 0) {
  lines.push('## まだ分析できるデータがありません');
  lines.push('');
  lines.push('スプレッドシートの「再生数」「保存数」「LINE登録数」「予約数」列に、');
  lines.push('Instagramアプリの「インサイト」画面の数字を記入すると、このレポートで集計されます。');
  lines.push('');
  lines.push('記入のタイミング目安: 投稿から48時間後と1週間後の2回（伸び方の傾向がわかるため）。');
  if (posted.length > 0) {
    lines.push('');
    lines.push('### 数字の記入待ちの投稿');
    for (const p of posted) lines.push(`- ${p.date} [${p.media}] ${p.theme}`);
  }
} else {
  // 媒体別サマリー
  lines.push('## 媒体別サマリー');
  lines.push('');
  lines.push('| 媒体 | 投稿数 | 平均再生数 | 平均保存数 | LINE登録 | 予約 |');
  lines.push('|---|---|---|---|---|---|');
  const byMedia = {};
  for (const p of withData) (byMedia[p.media] ??= []).push(p);
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : '-');
  for (const [media, arr] of Object.entries(byMedia)) {
    const views = arr.map((p) => p.views).filter((v) => v !== null);
    const saves = arr.map((p) => p.saves).filter((v) => v !== null);
    const regs = arr.reduce((a, p) => a + (p.lineRegs ?? 0), 0);
    const books = arr.reduce((a, p) => a + (p.bookings ?? 0), 0);
    lines.push(`| ${media} | ${arr.length} | ${avg(views)} | ${avg(saves)} | ${regs} | ${books} |`);
  }
  lines.push('');

  // 再生数トップ3
  const ranked = withData.filter((p) => p.views !== null).sort((a, b) => b.views - a.views);
  if (ranked.length > 0) {
    lines.push('## 再生数トップ3');
    lines.push('');
    ranked.slice(0, 3).forEach((p, i) => {
      const saveRate = p.saves !== null && p.views > 0 ? `（保存率 ${(p.saves / p.views * 100).toFixed(1)}%）` : '';
      lines.push(`${i + 1}. **${p.theme}**（${p.date} ${p.media}）: ${p.views.toLocaleString()}回 ${saveRate}`);
    });
    lines.push('');
  }

  // 成果（LINE登録・予約）
  const totalRegs = withData.reduce((a, p) => a + (p.lineRegs ?? 0), 0);
  const totalBooks = withData.reduce((a, p) => a + (p.bookings ?? 0), 0);
  lines.push('## 集客成果');
  lines.push('');
  lines.push(`- SNS経由のLINE登録: **${totalRegs}件**`);
  lines.push(`- SNS経由の予約: **${totalBooks}件**`);
  lines.push('');

  // 保存率の高い投稿（次回の企画のヒント）
  const bySaveRate = withData
    .filter((p) => p.views !== null && p.saves !== null && p.views > 0)
    .sort((a, b) => b.saves / b.views - a.saves / a.views);
  if (bySaveRate.length > 0) {
    lines.push('## 保存率が高い投稿（読者が「あとで見返したい」内容 = 次回企画のヒント）');
    lines.push('');
    bySaveRate.slice(0, 3).forEach((p) => {
      lines.push(`- ${p.theme}: 保存率 ${(p.saves / p.views * 100).toFixed(1)}%`);
    });
    lines.push('');
  }

  if (awaiting.length > 0) {
    lines.push('## 数字の記入待ちの投稿');
    lines.push('');
    for (const p of awaiting) lines.push(`- ${p.date} [${p.media}] ${p.theme}`);
  }
}

const report = lines.join('\n');
console.log(report);

if (save) {
  const dir = path.join(__dirname, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${today.replaceAll('-', '')}-report.md`);
  fs.writeFileSync(out, report, 'utf-8');
  console.log(`\n保存しました: ${out}`);
}
