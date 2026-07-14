/**
 * 品質確認（自動チェック）
 *
 * 完成フォルダに対して以下を検査し、結果を approval-checklist.md 用に返す:
 * - 画像ファイルの存在・サイズ
 * - タイトルの文字数
 * - 禁止表現・誇大広告表現の有無（タイトル・サブタイトル・キャプション）
 * - 引用論文情報の存在
 * - 投稿本文と画像テーマの一致（キャプションにトピック語が含まれるか）
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { FORBIDDEN_PATTERNS, type ImageSpec } from './spec.mts';

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export async function runQualityChecks(opts: {
  dir: string;
  spec: ImageSpec;
  caption: string;
  finalImage: string; // ファイル名（dir相対）
  expectWidth: number;
  expectHeight: number;
}): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const finalPath = path.join(opts.dir, opts.finalImage);

  // 1. 画像ファイルが存在する
  const exists = fs.existsSync(finalPath);
  results.push({ name: '画像ファイルの存在', ok: exists, detail: exists ? opts.finalImage : 'ファイルがありません' });

  // 2. 画像サイズ
  if (exists) {
    const meta = await sharp(finalPath).metadata();
    const ok = meta.width === opts.expectWidth && meta.height === opts.expectHeight;
    results.push({
      name: `画像サイズ ${opts.expectWidth}x${opts.expectHeight}px`,
      ok,
      detail: `実際: ${meta.width}x${meta.height}px`,
    });
  } else {
    results.push({ name: '画像サイズ', ok: false, detail: '画像がないため未確認' });
  }

  // 3. タイトル文字数（26文字以内）
  const titleOk = opts.spec.title.length <= 26;
  results.push({ name: 'タイトル26文字以内', ok: titleOk, detail: `${opts.spec.title.length}文字` });

  // 4. 禁止表現・誇大広告表現（タイトル・サブタイトル・キャプション）
  const textToCheck = [opts.spec.title, opts.spec.subtitle ?? '', opts.caption].join('\n');
  const hits: string[] = [];
  for (const rule of FORBIDDEN_PATTERNS) {
    const m = textToCheck.match(rule.pattern);
    if (m) hits.push(`「${m[0]}」(${rule.reason})`);
  }
  results.push({
    name: '禁止表現・誇大広告表現なし',
    ok: hits.length === 0,
    detail: hits.length === 0 ? '検出なし' : hits.join(' / '),
  });

  // 5. 引用論文情報が存在する
  const hasRefs = opts.spec.sourceReferences.length > 0;
  results.push({
    name: '引用・出典情報',
    ok: hasRefs,
    detail: hasRefs ? `${opts.spec.sourceReferences.length}件` : 'なし（本文に医学的主張がある場合は出典を追加してください）',
  });

  // 6. 投稿本文と画像テーマの一致（トピックの主要語がキャプションに含まれるか）
  const topicWords = opts.spec.topic.split(/[のとや・、\s]/).filter((w) => w.length >= 2);
  const matched = topicWords.filter((w) => opts.caption.includes(w));
  const themeOk = topicWords.length === 0 || matched.length > 0;
  results.push({
    name: '投稿本文と画像テーマの一致',
    ok: themeOk,
    detail: themeOk ? `一致語: ${matched.join('・') || '(トピック語なし)'}` : `本文に「${opts.spec.topic}」に関する語が見つかりません`,
  });

  return results;
}

export function checklistMarkdown(results: CheckResult[], spec: ImageSpec): string {
  const lines: string[] = [];
  lines.push(`# 公開前チェックリスト — ${spec.topic}`);
  lines.push('');
  lines.push('## 自動チェック結果');
  lines.push('');
  for (const r of results) {
    lines.push(`- [${r.ok ? 'x' : ' '}] ${r.ok ? '✅' : '❌'} ${r.name} — ${r.detail}`);
  }
  lines.push('');
  lines.push('## 院長による最終確認（手動）');
  lines.push('');
  lines.push('- [ ] 画像の人体表現に不自然な点がない');
  lines.push('- [ ] 画像が不安を煽る表現になっていない');
  lines.push('- [ ] 本文の医学的内容が正確である');
  lines.push('- [ ] 患者を特定できる情報が含まれていない');
  lines.push('- [ ] 公開してよい（承認）');
  lines.push('');
  lines.push('**⚠️ 上記すべてにチェックが付くまで外部投稿しないこと**');
  return lines.join('\n');
}
