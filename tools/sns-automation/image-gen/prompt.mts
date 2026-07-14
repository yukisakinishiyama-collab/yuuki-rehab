/**
 * ImageSpec → 画像生成プロンプト変換
 *
 * 規定の順序（用途→対象読者→主題→場面→構図→視点・動作→表現形式→光・色→
 * 医学的制約→禁止事項）でプロンプトを組み立てる。
 * タイトル・院名などの文字は画像生成AIに描かせない（後工程でSharpが焼き込む）。
 */

import type { ImageSpec } from './spec.mts';

// 全画像共通の医学的制約（ImageSpec側の制約に加えて必ず付与する）
const BASE_MEDICAL_CONSTRAINTS = [
  '人体の構造を解剖学的に不自然に描かない（関節の向き・本数・比率を正確に）',
  '病変・断裂・損傷を確定診断のように断定的に描かない',
  '痛みを赤い炎・稲妻・爆発などの記号で誇張しない',
  '治癒・改善・完治を保証するような描写をしない',
  '医師・医療機関・他院を否定的に描かない',
];

// 全画像共通の禁止事項
const BASE_NEGATIVE_CONSTRAINTS = [
  '文字・数字・ロゴ・ウォーターマーク・署名を一切描かない',
  '実在の人物・有名人に似せない',
  '不気味・恐怖を感じさせる表現をしない',
];

const USE_LABELS: Record<ImageSpec['intendedUse'], string> = {
  instagram_feed: 'Instagramフィード投稿の表紙画像（縦長4:5）',
  instagram_reel_cover: 'Instagramリール/ストーリーズ用画像（縦長9:16）',
  google_post: 'Googleビジネスプロフィール投稿用画像（縦長4:5）',
};

export function buildImagePrompt(spec: ImageSpec): string {
  const lines: string[] = [];
  lines.push(`【用途】${USE_LABELS[spec.intendedUse]}。整骨院のSNS投稿に使う、誠実で専門性の伝わるイラスト。`);
  lines.push(`【対象読者】${spec.targetAudience}`);
  lines.push(`【主題】${spec.mainSubject}`);
  lines.push(`【場面】${spec.scene}`);
  lines.push(`【構図】${spec.composition}。画像上部3分の1は、後からタイトル文字を重ねるため、主題を置かずシンプルな背景の余白として空けること。`);
  lines.push(`【表現形式】${spec.visualStyle}`);
  lines.push(`【光・色】${spec.lighting}。${spec.colorDirection}`);
  lines.push(`【医学的制約】${[...BASE_MEDICAL_CONSTRAINTS, ...spec.medicalConstraints].map((c) => `・${c}`).join('\n')}`);
  lines.push(`【禁止事項】${[...BASE_NEGATIVE_CONSTRAINTS, ...spec.negativeConstraints].map((c) => `・${c}`).join('\n')}`);
  return lines.join('\n\n');
}

// 用途ごとの生成サイズと最終サイズ
export function sizesFor(use: ImageSpec['intendedUse']): {
  genWidth: number; genHeight: number; outWidth: number; outHeight: number; apiSize: string;
} {
  if (use === 'instagram_reel_cover') {
    // 縦長9:16。生成1152x2048 → 最終1080x1920
    return { genWidth: 1152, genHeight: 2048, outWidth: 1080, outHeight: 1920, apiSize: '1152x2048' };
  }
  // 縦長4:5。生成1088x1360 → 最終1080x1350
  return { genWidth: 1088, genHeight: 1360, outWidth: 1080, outHeight: 1350, apiSize: '1088x1360' };
}
