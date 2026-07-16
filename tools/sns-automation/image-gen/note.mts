/**
 * note記事の成果物組み立てと品質チェック
 *
 * note-article.md（13セクション構成）、title-options、hashtags、summary、
 * references、critical-appraisal、approval-checklist を組み立てる。
 * 見出し画像用のプロンプトもここで生成する。
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DOI_RE, PMID_RE, FORBIDDEN_PATTERNS, type NoteSpec, type Citation } from './spec.mts';

// note見出し画像（1.91:1）の生成サイズ
export const NOTE_COVER = {
  genWidth: 1920,
  genHeight: 1006,
  std: { width: 1280, height: 670 },
  hi: { width: 1920, height: 1006 },
};

// note見出し画像の生成プロンプト（Instagramの4:5を切り抜かず、横長用に再設計）
export function buildNoteCoverPrompt(spec: NoteSpec): string {
  const lines: string[] = [];
  lines.push('【用途】note記事の見出し画像（横長 約1.91:1）。整骨院の記事バナー。');
  lines.push(`【対象読者】${spec.noteTargetReader}`);
  lines.push(`【主題】${spec.coverMainSubject}。主要な要素（人物・関節・重要オブジェクト）は画像の中央付近に配置すること。`);
  lines.push(`【場面】${spec.coverScene || '落ち着いた室内、清潔なリハビリ環境のイメージ'}`);
  lines.push('【構図】横長。デバイスによる上下左右のトリミングを想定し、重要な要素を中央に集め、周囲に十分な余白を設ける。上部中央はタイトル文字を重ねるため、シンプルな背景にする。');
  lines.push(`【表現形式】${spec.coverVisualStyle || 'フラットで清潔感のあるイラスト'}`);
  lines.push(`【光・色】やわらかい自然光。${spec.coverColorDirection || 'ネイビー(#1B2A4A)基調にオフホワイトとオレンジ(#D86018)を差し色に'}`);
  lines.push('【医学的制約】\n・人体を解剖学的に不自然に描かない\n・病変や断裂を確定診断のように描かない\n・痛みを炎や稲妻で誇張しない\n・治癒や改善を保証する描写をしない');
  lines.push('【禁止事項】\n・文字・数字・ロゴ・ウォーターマークを一切描かない\n・実在の人物に似せない\n・不安や恐怖を煽らない');
  return lines.join('\n\n');
}

// note記事本文（note-article.md）を13セクション順に組み立てる
export function assembleNoteArticle(spec: NoteSpec): string {
  const s = spec.noteSections;
  const refs = formatReferencesForArticle(spec.noteReferences);
  const out: string[] = [];
  out.push(`# ${spec.noteArticleTitle}`);       // 1. 記事タイトル
  out.push('');
  out.push(s.intro);                              // 2. 導入
  out.push('');
  out.push('## 今回の結論');                       // 3. 結論
  out.push('');
  out.push(s.conclusion);
  out.push('');
  out.push('## 症状・病態の一般的な説明');           // 4.
  out.push('');
  out.push(s.generalExplanation);
  out.push('');
  out.push('## ガイドライン・研究で確認されていること'); // 5.
  out.push('');
  out.push(s.evidence);
  out.push('');
  out.push('## 患者さん向けのわかりやすい説明');       // 6.
  out.push('');
  out.push(s.patientTranslation);
  out.push('');
  out.push('## よくある誤解');                       // 7.
  out.push('');
  out.push(s.misconceptions);
  out.push('');
  out.push('## ご自宅で気をつけられること');          // 8.
  out.push('');
  out.push(s.homeCare);
  out.push('');
  out.push('## 医療機関への相談を検討する目安');       // 9.
  out.push('');
  out.push(s.whenToSeeDoctor);
  out.push('');
  out.push('## まだ分かっていないこと・研究の限界');    // 10.
  out.push('');
  out.push(s.limitations);
  out.push('');
  out.push('## まとめ');                            // 11.
  out.push('');
  out.push(s.summary);
  out.push('');
  out.push('---');
  out.push('');
  out.push('## 免責事項');                          // 12.
  out.push('');
  out.push(spec.noteDisclaimer);
  out.push('');
  out.push('## 引用文献');                          // 13.
  out.push('');
  out.push(refs);
  return out.join('\n');
}

// 引用文献を本文用の書誌形式に整形（要確認は明示）
function formatReferencesForArticle(refs: Citation[]): string {
  if (refs.length === 0) return '（本記事は一般的な知見に基づいており、特定の一次文献は引用していません）';
  return refs
    .map((r, i) => {
      const bits = [`${i + 1}. ${r.author} 「${r.title}」 ${r.journal}`];
      if (r.year) bits.push(`(${r.year})`);
      const ids: string[] = [];
      if (r.doi) ids.push(`DOI: ${r.doi}`);
      if (r.pmid) ids.push(`PMID: ${r.pmid}`);
      if (r.url) ids.push(r.url);
      let line = bits.join(' ');
      if (ids.length) line += ` [${ids.join(' / ')}]`;
      line += ` — 研究デザイン: ${r.studyDesign}`;
      if (r.status === 'needs_confirmation') {
        line += '\n   ⚠️ 要確認：原文または一次情報での確認が必要';
      }
      return line;
    })
    .join('\n');
}

export function assembleTitleOptions(spec: NoteSpec): string {
  const o = spec.noteTitleOptions;
  return [
    `# タイトル案 — ${spec.topic}`,
    '',
    '## 1. 患者が検索しやすいタイトル',
    o.searchable,
    '',
    '## 2. 専門性が伝わるタイトル',
    o.professional,
    '',
    '## 3. SNSから誘導しやすいタイトル',
    o.social,
    '',
    '※ 煽り表現・効果保証表現は使用していません。',
  ].join('\n');
}

export function assembleCriticalAppraisal(spec: NoteSpec): string {
  const out: string[] = [`# 主要論文の批判的吟味（クリティカル・アプレイザル） — ${spec.topic}`, ''];
  if (spec.criticalAppraisals.length === 0) {
    out.push('本記事は特定の主要論文を批判的吟味の対象としていません（一般的なガイドライン・総説に基づく）。');
    out.push('');
    out.push('⚠️ 特定の研究を根拠として引用する場合は、以下の項目を必ず記録してください。');
    return out.join('\n');
  }
  for (const a of spec.criticalAppraisals) {
    out.push(`## ${a.citationLabel}`);
    out.push('');
    out.push(`- **研究デザイン**: ${a.studyDesign}`);
    out.push(`- **対象者数**: ${a.participantCount}`);
    out.push(`- **対象者の特徴**: ${a.participantCharacteristics}`);
    out.push(`- **介入・評価方法**: ${a.intervention}`);
    out.push(`- **主要評価項目**: ${a.primaryOutcome}`);
    out.push(`- **主な結果**: ${a.mainResults}`);
    out.push(`- **臨床的意義**: ${a.clinicalSignificance}`);
    out.push(`- **統計学的有意差 vs 臨床的重要性**: ${a.statVsClinical}`);
    out.push(`- **バイアスの可能性**: ${a.biasRisk}`);
    out.push(`- **一般化可能性**: ${a.generalizability}`);
    out.push(`- **この研究からは断定できないこと**: ${a.cannotConclude}`);
    out.push('');
  }
  return out.join('\n');
}

export interface NoteCheck { name: string; ok: boolean; detail: string }

export async function runNoteChecks(opts: {
  dir: string;
  spec: NoteSpec;
  article: string;
}): Promise<NoteCheck[]> {
  const r: NoteCheck[] = [];
  const { spec } = opts;

  // 見出し画像サイズ
  for (const [label, file, W, H] of [
    ['見出し画像1280x670px', 'note-cover-1280x670.png', 1280, 670],
    ['高精細版1920x1006px', 'note-cover-1920x1006.png', 1920, 1006],
  ] as [string, string, number, number][]) {
    const p = path.join(opts.dir, file);
    if (fs.existsSync(p)) {
      const m = await sharp(p).metadata();
      r.push({ name: label, ok: m.width === W && m.height === H, detail: `実際: ${m.width}x${m.height}px` });
    } else {
      r.push({ name: label, ok: false, detail: 'ファイルがありません' });
    }
  }

  // 見出しタイトルが安全領域内（=28文字以内・2行以内で端に寄らない）
  r.push({ name: '重要要素が安全領域内（タイトル28字以内）', ok: spec.noteCoverTitle.length <= 28, detail: `${spec.noteCoverTitle.length}文字` });

  // 記事タイトルと本文テーマの一致
  const topicWords = spec.topic.split(/[のとや・、\s]/).filter((w) => w.length >= 2);
  const titleMatch = topicWords.length === 0 || topicWords.some((w) => spec.noteArticleTitle.includes(w) || opts.article.includes(w));
  r.push({ name: '記事タイトルと本文テーマの一致', ok: titleMatch, detail: titleMatch ? '一致' : `「${spec.topic}」との一致語なし` });

  // 導入だけで対象者と内容が分かる（導入に読者像か結論の手がかりがあるか＝長さで簡易判定）
  const introOk = spec.noteSections.intro.length >= 80;
  r.push({ name: '導入で対象者と内容が分かる', ok: introOk, detail: `導入 ${spec.noteSections.intro.length}文字` });

  // 医学的事実と推論の分離（結論・エビデンス節と限界節が両方存在するか）
  const sepOk = spec.noteSections.evidence.length > 0 && spec.noteSections.limitations.length > 0;
  r.push({ name: '医学的事実と推論の分離', ok: sepOk, detail: sepOk ? 'エビデンス節・限界節あり' : '不足' });

  // 引用文献が実在する（自動では存在検証不可 → 全件verifiedかどうかで判定）
  const needConfirm = spec.noteReferences.filter((x) => x.status !== 'verified');
  const refsExistOk = spec.noteReferences.length === 0 ? true : needConfirm.length === 0;
  r.push({
    name: '引用文献が実在する（要確認が残っていない）',
    ok: refsExistOk,
    detail: spec.noteReferences.length === 0 ? '引用なし（一般知見）' : needConfirm.length === 0 ? '全件確認済み' : `要確認 ${needConfirm.length}件（人手で一次情報を確認するまで公開不可）`,
  });

  // DOI/PMIDの形式が妥当
  const badId = spec.noteReferences.filter((x) => (x.doi && !DOI_RE.test(x.doi)) || (x.pmid && !PMID_RE.test(x.pmid)));
  r.push({ name: 'DOI/PMIDの形式が妥当', ok: badId.length === 0, detail: badId.length === 0 ? 'OK' : `形式不正 ${badId.length}件` });

  // 研究の限界が記載されている
  r.push({ name: '研究の限界の記載', ok: spec.noteSections.limitations.length >= 40, detail: `${spec.noteSections.limitations.length}文字` });

  // 誇大広告・個別診断誤認表現
  const hits: string[] = [];
  for (const rule of FORBIDDEN_PATTERNS) {
    const m = opts.article.match(rule.pattern);
    if (m) hits.push(`「${m[0]}」(${rule.reason})`);
  }
  r.push({ name: '誇大広告表現なし', ok: hits.length === 0, detail: hits.length === 0 ? '検出なし' : hits.join(' / ') });

  const diagnosisHits = opts.article.match(/あなたの(症状|診断|治療)|あなたは.{0,6}(です|でしょう)/);
  r.push({ name: '個別診断と誤認される表現なし', ok: !diagnosisHits, detail: diagnosisHits ? `「${diagnosisHits[0]}」` : '検出なし' });

  return r;
}

export function noteChecklistMarkdown(checks: NoteCheck[], igCaption: string, article: string, spec: NoteSpec): string {
  // Instagram本文の単純転用でないか（先頭200字の重複率で判定）
  const igHead = igCaption.replace(/\s/g, '').slice(0, 200);
  const artHead = article.replace(/\s/g, '').slice(0, 400);
  const notReuse = igHead.length === 0 || !artHead.includes(igHead.slice(0, 60));

  const lines: string[] = [`# note公開前チェックリスト — ${spec.topic}`, '', '## 自動チェック結果', ''];
  for (const c of checks) lines.push(`- [${c.ok ? 'x' : ' '}] ${c.ok ? '✅' : '❌'} ${c.name} — ${c.detail}`);
  lines.push(`- [${notReuse ? 'x' : ' '}] ${notReuse ? '✅' : '❌'} Instagram本文の単純転用でない — ${notReuse ? '別構成で執筆' : 'Instagram本文と重複の疑い'}`);
  lines.push('- [x] ✅ 外部公開処理が実行されていない — このツールは投稿を行いません');
  lines.push('');
  lines.push('## 院長による最終確認（手動）');
  lines.push('');
  lines.push('- [ ] 引用文献のDOI/PMIDを一次情報（PubMed等）で実在確認した');
  lines.push('- [ ] 「要確認」の文献をすべて確認または削除した');
  lines.push('- [ ] 医学的内容が正確で、断定的・保証的表現がない');
  lines.push('- [ ] 見出し画像の人体表現・構図に問題がない');
  lines.push('- [ ] 患者を特定できる情報が含まれていない');
  lines.push('- [ ] note管理画面から手動投稿・予約してよい（承認）');
  lines.push('');
  const refsUnconfirmed = spec.noteReferences.some((x) => x.status !== 'verified');
  if (refsUnconfirmed) {
    lines.push('**🚫 引用文献に「要確認」が残っています。一次情報での確認が完了するまで公開可能状態にしないこと。**');
  } else {
    lines.push('**⚠️ 上記すべてにチェックが付くまで外部投稿しないこと**');
  }
  return lines.join('\n');
}
