#!/usr/bin/env node
/**
 * 医療広告ガイドライン コンプライアンスチェッカー（記事ファイル用）
 *
 * Markdown/テキスト記事から、医療広告ガイドラインに抵触しうる表現を検出する。
 * ルール本体は lib/rules.mjs にある。APIは使わない完全ローカルのチェック。
 *
 * 使い方:
 *   node tools/sns-automation/check-compliance.mjs <ファイル...>
 *   node tools/sns-automation/check-compliance.mjs --all   # 既存記事を一括チェック
 *
 * 終了コード: 違反あり=1 / なし=0（CIや他スクリプトから利用可能）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkText } from './lib/rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ファイル一覧の解決
let files = process.argv.slice(2);
if (files[0] === '--all') {
  const targets = [
    path.join(__dirname, '..', 'note-converter'),
    path.join(__dirname, 'drafts'),
  ];
  files = [];
  for (const dir of targets) {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.md')) files.push(path.join(dir, f));
      }
    }
  }
}

if (files.length === 0) {
  console.log('使い方: node check-compliance.mjs <ファイル...> または --all');
  process.exit(0);
}

let ngCount = 0;
let warnCount = 0;
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`ファイルが見つかりません: ${file}`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf-8');
  const findings = checkText(text, path.basename(file));
  for (const f of findings) {
    const mark = f.level === 'NG' ? '❌' : '⚠️';
    console.log(`${mark} [${f.level}] ${f.label}:${f.line} 「${f.match}」 — ${f.reason} → 言い換え例: ${f.suggestion}`);
    if (f.level === 'NG') ngCount++; else warnCount++;
  }
}

console.log('---');
console.log(`チェック完了: ${files.length}ファイル / NG ${ngCount}件 / 注意 ${warnCount}件`);
process.exit(ngCount > 0 ? 1 : 0);
