#!/usr/bin/env node
/**
 * 医療広告ガイドライン コンプライアンスチェッカー
 *
 * Markdown/テキスト記事から、医療広告ガイドラインに抵触しうる表現を検出する。
 * APIは使わない完全ローカルのチェックなので、何度でも無料で実行できる。
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// NG表現ルール。pattern は正規表現、reason は理由、suggestion は言い換え例
const RULES = [
  { pattern: /完全(に)?治(癒|り|る)/g, reason: '治癒の保証（虚偽・誇大広告）', suggestion: '「改善を目指す」「回復をサポートする」' },
  { pattern: /必ず(治|良くな|改善)/g, reason: '効果の保証', suggestion: '「改善が期待できる」「〜を目指す」' },
  { pattern: /絶対(に)?(治|良くな|効)/g, reason: '効果の保証', suggestion: '「状態に合わせた施術を行う」' },
  { pattern: /(1|一)回で(治|改善|効果)/g, reason: '施術回数と効果の断定', suggestion: '「経過を見ながら通院計画をご提案」' },
  { pattern: /(日本|地域|下関)(一|No\.?1|ナンバーワン)/gi, reason: '比較優良広告', suggestion: '客観的事実（開業年数・資格等）のみ記載' },
  { pattern: /どこよりも/g, reason: '比較優良広告', suggestion: '削除、または自院の特徴の説明に変更' },
  { pattern: /最(高|先端|新)の(技術|治療|施術)/g, reason: '最上級表現（誇大広告）', suggestion: '「エビデンスに基づいた施術」' },
  { pattern: /奇跡/g, reason: '誇大広告', suggestion: '削除' },
  { pattern: /副作用は(一切)?(あり|ござい)ません/g, reason: 'リスクの否定（虚偽広告）', suggestion: 'リスク・注意点も併記する' },
  { pattern: /誰でも(治|効果|改善)/g, reason: '効果の保証', suggestion: '「状態に合わせてご提案します」' },
  { pattern: /治療効果を保証/g, reason: '効果の保証', suggestion: '削除' },
  { pattern: /満足度\s*\d+\s*[%％]/g, reason: '体験談・満足度の広告利用は原則不可', suggestion: '削除、または調査主体等の根拠を明示' },
  { pattern: /(芸能人|有名人|プロ選手)(も)?(多数)?(来院|愛用|推薦)/g, reason: '著名人の来院実績による誘引', suggestion: '削除' },
  { pattern: /永久に|二度と(痛|再発)/g, reason: '効果の永続性の保証', suggestion: '「再発予防を目指したケアを行う」' },
  { pattern: /(がん|癌|腫瘍)(が|も)(治|消え)/g, reason: '重大疾病の治癒標榜（違法）', suggestion: '削除。医科受診を促す記載に変更' },
];

// 注意喚起レベル（グレーゾーン）のルール
const WARN_RULES = [
  { pattern: /痛みが(消え|なくな)(る|ます|ります)/g, reason: '効果の断定に読まれる可能性', suggestion: '「痛みの軽減を目指す」' },
  { pattern: /即効/g, reason: '効果の即時性の強調', suggestion: '「早期の改善を目指す」' },
  { pattern: /(治した|治します)/g, reason: '治癒の断定', suggestion: '「施術・サポートを行った」' },
];

function checkText(text, fileName) {
  const findings = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let m;
      while ((m = rule.pattern.exec(line)) !== null) {
        findings.push({ level: 'NG', file: fileName, line: i + 1, match: m[0], reason: rule.reason, suggestion: rule.suggestion });
      }
    }
    for (const rule of WARN_RULES) {
      rule.pattern.lastIndex = 0;
      let m;
      while ((m = rule.pattern.exec(line)) !== null) {
        findings.push({ level: '注意', file: fileName, line: i + 1, match: m[0], reason: rule.reason, suggestion: rule.suggestion });
      }
    }
  });
  return findings;
}

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
    console.log(`${mark} [${f.level}] ${f.file}:${f.line} 「${f.match}」 — ${f.reason} → 言い換え例: ${f.suggestion}`);
    if (f.level === 'NG') ngCount++; else warnCount++;
  }
}

console.log('---');
console.log(`チェック完了: ${files.length}ファイル / NG ${ngCount}件 / 注意 ${warnCount}件`);
process.exit(ngCount > 0 ? 1 : 0);
