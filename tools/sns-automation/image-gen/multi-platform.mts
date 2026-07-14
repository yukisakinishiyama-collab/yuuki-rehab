/**
 * 媒体別（--platform）オーケストレーター
 *
 * 一つのテーマと共有の医学的根拠から、Instagram / Google / note の
 * それぞれに適した成果物を個別に生成する。--platform 指定時のみ使われ、
 * 未指定時の既存フロー（generate-post-image.mts 本体）には影響しない。
 *
 * 出力: content/YYYY-MM-DD-topic/{shared,instagram,google,note}/
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  ImageSpecSchema, NoteSpecSchema, ALL_PLATFORMS,
  type ImageSpec, type NoteSpec, type Platform,
} from './spec.mts';
import { buildImagePrompt, sizesFor } from './prompt.mts';
import { generateImage } from './openai-client.mts';
import { composeFinal, composeNoteCover, mockImage } from './compose.mts';
import { runQualityChecks, checklistMarkdown } from './checks.mts';
import {
  NOTE_COVER, buildNoteCoverPrompt, assembleNoteArticle, assembleTitleOptions,
  assembleCriticalAppraisal, runNoteChecks, noteChecklistMarkdown,
} from './note.mts';

const CLINIC = '院: ゆうき整骨院（下関市彦島）電話083-265-4545 / 月〜金 10:00-13:00・15:00-20:00、土 10:00-15:00、日祝休診';
const GUIDELINE = `医療広告ガイドライン厳守: 効果保証・比較優良・最上級・誇大表現を使わない。「必ず治る」「完全に改善」「絶対に必要」等の断定禁止。相関を因果として書かない。保存療法/手術の一方を一律推奨しない。医師・他院・他職種を否定しない。危険な兆候には受診を促す。`;

function extractJson<T>(text: string): T {
  const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(jsonStr) as T;
}

export async function runMultiPlatform(opts: {
  theme: string;
  platform: string;
  quality: 'medium' | 'high';
  mock: boolean;
  anthropicKey: string;
  openaiKey: string | null;
  repoRoot: string;
}): Promise<number> {
  const platforms: Platform[] =
    opts.platform === 'all' ? ALL_PLATFORMS : ([opts.platform] as Platform[]);
  for (const p of platforms) {
    if (!ALL_PLATFORMS.includes(p)) {
      console.error(`エラー: --platform は instagram / google / note / all のいずれか（受領: ${opts.platform}）`);
      return 1;
    }
  }

  const anthropic = new Anthropic({ apiKey: opts.anthropicKey });
  const callJson = async <T>(system: string, user: string): Promise<T> => {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system,
      messages: [{ role: 'user', content: user }],
    });
    const msg = await stream.finalMessage();
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return extractJson<T>(text);
  };

  // フォルダ準備
  const today = new Date().toISOString().slice(0, 10);
  const hash = createHash('sha1').update(opts.theme).digest('hex').slice(0, 6);
  const postId = `${today}-${hash}`;
  const baseDir = path.join(opts.repoRoot, 'content', postId);
  const sharedDir = path.join(baseDir, 'shared');
  fs.mkdirSync(sharedDir, { recursive: true });

  // ── 共有の医学的根拠（全媒体で共通） ──
  console.log(`[共有] 医学的根拠を作成中... (テーマ: ${opts.theme})`);
  const shared = await callJson<{
    medicalFacts: string[];
    sourceReferences: { label: string; note?: string }[];
  }>(
    `あなたはゆうき整骨院の医療監修担当です。${GUIDELINE}\n${CLINIC}`,
    `テーマ「${opts.theme}」について、投稿の根拠となる医学的事実をまとめてください。確定した事実と臨床的推論を区別し、断定を避けてください。存在しない研究結果を作らないこと。JSONのみ出力:
{
  "medicalFacts": ["確定的な一般的事実、または『〜と考えられている』等の推論を明示した事実。3〜6個"],
  "sourceReferences": [{"label": "一般に参照される知見・ガイドライン名（特定論文が不要ならその旨）", "note": "任意"}]
}`
  );
  fs.writeFileSync(path.join(sharedDir, 'medical-facts.json'), JSON.stringify({ topic: opts.theme, medicalFacts: shared.medicalFacts }, null, 2), 'utf-8');
  fs.writeFileSync(path.join(sharedDir, 'source-references.json'), JSON.stringify({ topic: opts.theme, sourceReferences: shared.sourceReferences }, null, 2), 'utf-8');

  const factsBlock = shared.medicalFacts.map((f) => `・${f}`).join('\n');
  let allOk = true;

  // ── Instagram / Google（既存ImageSpecパイプラインを再利用） ──
  for (const platform of platforms.filter((p) => p === 'instagram' || p === 'google')) {
    const dir = path.join(baseDir, platform);
    fs.mkdirSync(dir, { recursive: true });
    const useLabel = platform === 'instagram' ? 'instagram_feed' : 'google_post';
    console.log(`[${platform}] 本文とImageSpecを作成中...`);

    const plan = await callJson<{ caption: string; imageSpec: Record<string, unknown> }>(
      `あなたはゆうき整骨院のSNS担当です。${GUIDELINE}\n${CLINIC}`,
      `次の医学的事実を踏まえ、${platform === 'instagram' ? 'Instagramフィード投稿' : 'Googleビジネスプロフィール投稿'}の本文とImageSpecをJSONで作成してください。
医学的事実:\n${factsBlock}\nテーマ: 「${opts.theme}」

JSONのみ出力:
{
  "caption": "${platform === 'instagram' ? 'Instagram本文300〜500字' : 'Google投稿本文200〜400字'}。患者向けにやさしく。電話とLINE案内。末尾『※症状や経過には個人差があります』",
  "imageSpec": {
    "topic": "${opts.theme}", "intendedUse": "${useLabel}",
    "targetAudience": "対象読者", "mainSubject": "画像主題（人体は自然に、病変を断定的に描かない）",
    "scene": "場面", "composition": "構図。上部3分の1はタイトル用に空ける",
    "visualStyle": "フラットイラスト等", "lighting": "やわらかい自然光",
    "colorDirection": "ネイビー(#1B2A4A)基調にオフホワイトとオレンジ(#D86018)",
    "medicalConstraints": ["テーマ固有の注意1〜3個"], "negativeConstraints": ["避けたい描写1〜3個"],
    "title": "画像に焼き込むタイトル26文字以内", "subtitle": "サブタイトル40字以内(任意)",
    "sourceReferences": [{"label": "参考知見"}]
  }
}`
    );

    const specCand = { ...plan.imageSpec, postId: `${postId}-${platform}`, outputPath: dir };
    const parsed = ImageSpecSchema.safeParse(specCand);
    if (!parsed.success) {
      console.error(`[${platform}] ImageSpec検証失敗: ${parsed.error.issues.map((i) => `${i.path.join('.')}:${i.message}`).join(', ')}`);
      allOk = false;
      continue;
    }
    const spec: ImageSpec = parsed.data;
    const prompt = buildImagePrompt(spec);
    const sz = sizesFor(spec.intendedUse);
    const src = opts.mock
      ? await mockImage(sz.genWidth, sz.genHeight)
      : await generateImage({ apiKey: opts.openaiKey!, prompt, size: sz.apiSize, quality: opts.quality });

    fs.writeFileSync(path.join(dir, 'generated-original.png'), src);
    const finalName = platform === 'instagram' ? 'instagram-1080x1350.png' : 'google-post-image.png';
    await composeFinal({ sourcePng: src, outWidth: sz.outWidth, outHeight: sz.outHeight, spec, showDisclaimer: true, outFile: path.join(dir, finalName) });

    fs.writeFileSync(path.join(dir, 'image-spec.json'), JSON.stringify(spec, null, 2), 'utf-8');
    if (platform === 'instagram') fs.writeFileSync(path.join(dir, 'image-prompt.txt'), prompt, 'utf-8');
    const textFile = platform === 'instagram' ? 'caption.md' : 'post-text.md';
    fs.writeFileSync(path.join(dir, textFile), `# ${platform === 'instagram' ? 'Instagram本文' : 'Google投稿本文'} — ${opts.theme}\n\n${plan.caption}\n`, 'utf-8');

    const checks = await runQualityChecks({ dir, spec, caption: plan.caption, finalImage: finalName, expectWidth: sz.outWidth, expectHeight: sz.outHeight });
    fs.writeFileSync(path.join(dir, 'approval-checklist.md'), checklistMarkdown(checks, spec), 'utf-8');
    const ok = checks.every((c) => c.ok);
    if (!ok) allOk = false;
    console.log(`[${platform}] ${ok ? '✅ 完了' : '⚠️ 未通過あり'} → content/${postId}/${platform}/`);
  }

  // ── note ──
  if (platforms.includes('note')) {
    const dir = path.join(baseDir, 'note');
    fs.mkdirSync(dir, { recursive: true });
    console.log('[note] 記事とnote-specを作成中...');

    const raw = await callJson<Record<string, unknown>>(
      `あなたはゆうき整骨院の記事執筆・医療監修担当です。${GUIDELINE}
専門用語は直後に一般向け説明を添える。短い段落と小見出し。確定事実と臨床的推論を区別。単一症例や低品質研究を一般化しない。相関を因果と書かない。原著論文は対象者・研究デザイン・主要な限界も記載。
**存在しないDOI・PMID・著者・研究結果を絶対に生成しない。確認できない引用は status を "needs_confirmation" にする。**
${CLINIC}`,
      `次の医学的事実を土台に、note記事一式をJSONで作成してください。Instagram本文の引き延ばしにせず、note用に構成し直すこと。本文は2000〜4000字（必要なら6000字まで）。
医学的事実:\n${factsBlock}\nテーマ: 「${opts.theme}」

JSONのみ出力（noteSectionsは各節の本文テキスト。専門用語には説明を添える）:
{
  "noteArticleTitle": "記事タイトル", "noteCoverTitle": "見出し画像タイトル28字以内", "noteCoverSubtitle": "サブ40字以内(任意)",
  "noteTargetReader": "対象読者", "noteSearchIntent": "読者の検索意図",
  "noteArticleSummary": "記事要約200〜400字",
  "noteSections": {
    "intro": "導入（対象者と内容が分かるように）", "conclusion": "今回の結論",
    "generalExplanation": "症状・病態の一般的説明", "evidence": "ガイドライン等で確認されていること（確定事実）",
    "patientTranslation": "患者向けの言い換え", "misconceptions": "よくある誤解",
    "homeCare": "自宅で注意できること", "whenToSeeDoctor": "受診を検討する目安（緊急性があれば明確に）",
    "limitations": "まだ不明な点・研究の限界", "summary": "まとめ"
  },
  "noteKeyTakeaways": ["要点3〜5個"], "noteClinicalCautions": ["臨床上の注意2〜4個"],
  "noteReferences": [{"author":"","title":"","journal":"","year":"","doi":"(あれば)","pmid":"(あれば)","url":"(あれば)","studyDesign":"","usedForPoint":"","status":"needs_confirmation"}],
  "criticalAppraisals": [{"citationLabel":"","studyDesign":"","participantCount":"","participantCharacteristics":"","intervention":"","primaryOutcome":"","mainResults":"","clinicalSignificance":"","statVsClinical":"","biasRisk":"","generalizability":"","cannotConclude":""}],
  "noteHashtags": ["#タグ を5〜10個"], "noteDisclaimer": "免責事項（一般的情報であり個別の診断ではない旨）",
  "noteTitleOptions": {"searchable":"患者が検索しやすいタイトル","professional":"専門性が伝わるタイトル","social":"SNSから誘導しやすいタイトル"},
  "coverMainSubject": "見出し画像の主題（中央配置・人体は自然に）", "coverScene": "場面", "coverVisualStyle": "表現形式", "coverColorDirection": "配色"
}
※特定論文を引用しない場合は noteReferences と criticalAppraisals を空配列に。引用する場合は実在するもののみ、確認できなければ status を needs_confirmation に。`
    );

    // オーケストレーター側で設定する項目を付与
    const safe = { top: Math.round(NOTE_COVER.hi.height * 0.12), right: Math.round(NOTE_COVER.hi.width * 0.09), bottom: Math.round(NOTE_COVER.hi.height * 0.12), left: Math.round(NOTE_COVER.hi.width * 0.09) };
    const noteCand = {
      ...raw,
      postId: `${postId}-note`,
      platform: 'note',
      topic: opts.theme,
      noteCoverSafeArea: safe,
      noteOutputPaths: { cover1280: 'note-cover-1280x670.png', cover1920: 'note-cover-1920x1006.png', article: 'note-article.md' },
    };
    const parsed = NoteSpecSchema.safeParse(noteCand);
    if (!parsed.success) {
      console.error(`[note] note-spec検証失敗: ${parsed.error.issues.map((i) => `${i.path.join('.')}:${i.message}`).join(', ')}`);
      return 1;
    }
    const spec: NoteSpec = parsed.data;

    // 見出し画像（横長1.91:1）を生成 → 標準版・高精細版
    const coverPrompt = buildNoteCoverPrompt(spec);
    const src = opts.mock
      ? await mockImage(NOTE_COVER.genWidth, NOTE_COVER.genHeight)
      : await generateImage({ apiKey: opts.openaiKey!, prompt: coverPrompt, size: `${NOTE_COVER.genWidth}x${NOTE_COVER.genHeight}`, quality: opts.quality });
    fs.writeFileSync(path.join(dir, 'note-cover-original.png'), src);
    // 安全領域は最終サイズ基準で再計算して合成
    for (const [file, W, H] of [['note-cover-1280x670.png', 1280, 670], ['note-cover-1920x1006.png', 1920, 1006]] as [string, number, number][]) {
      const s = { top: Math.round(H * 0.12), right: Math.round(W * 0.09), bottom: Math.round(H * 0.12), left: Math.round(W * 0.09) };
      await composeNoteCover({ sourcePng: src, outWidth: W, outHeight: H, title: spec.noteCoverTitle, subtitle: spec.noteCoverSubtitle, safe: s, outFile: path.join(dir, file) });
    }

    // 記事・各種成果物
    const article = assembleNoteArticle(spec);
    fs.writeFileSync(path.join(dir, 'note-spec.json'), JSON.stringify(spec, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dir, 'note-image-prompt.txt'), coverPrompt, 'utf-8');
    fs.writeFileSync(path.join(dir, 'note-article.md'), article, 'utf-8');
    fs.writeFileSync(path.join(dir, 'note-summary.txt'), spec.noteArticleSummary, 'utf-8');
    fs.writeFileSync(path.join(dir, 'note-title-options.md'), assembleTitleOptions(spec), 'utf-8');
    fs.writeFileSync(path.join(dir, 'note-hashtags.txt'), spec.noteHashtags.join(' '), 'utf-8');
    fs.writeFileSync(path.join(dir, 'note-references.md'), `# 引用文献 — ${opts.theme}\n\n${article.slice(article.indexOf('## 引用文献') + 7).trim()}\n`, 'utf-8');
    fs.writeFileSync(path.join(dir, 'note-critical-appraisal.md'), assembleCriticalAppraisal(spec), 'utf-8');

    // Instagram本文（あれば）との重複判定用
    let igCaption = '';
    const igCap = path.join(baseDir, 'instagram', 'caption.md');
    if (fs.existsSync(igCap)) igCaption = fs.readFileSync(igCap, 'utf-8');

    const checks = await runNoteChecks({ dir, spec, article });
    fs.writeFileSync(path.join(dir, 'note-approval-checklist.md'), noteChecklistMarkdown(checks, igCaption, article, spec), 'utf-8');
    const ok = checks.every((c) => c.ok);
    if (!ok) allOk = false;
    console.log(`[note] ${ok ? '✅ 自動チェック通過' : '⚠️ 未通過あり（要確認の引用等）'} → content/${postId}/note/`);
  }

  console.log(`\n承認用フォルダ: content/${postId}/`);
  console.log(`対象媒体: ${platforms.join(', ')}`);
  console.log(`${allOk ? '✅ 自動チェックはすべて通過' : '⚠️ 未通過の項目があります（各approval-checklistを確認）'}。院長の承認まで外部投稿はしません。`);
  return allOk ? 0 : 1;
}
