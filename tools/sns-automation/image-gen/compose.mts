/**
 * Sharp による画像整形と文字合成
 *
 * - 生成画像（1088x1360 / 1152x2048）を最終サイズ（1080x1350 / 1080x1920）へ変換
 * - タイトル・サブタイトル・院名・注意書きは画像生成AIに描かせず、
 *   ここでSVGオーバーレイとして焼き込む（文字化け・誤字を根絶するため）
 */

import sharp from 'sharp';
import type { ImageSpec } from './spec.mts';

// XMLエスケープ（SVGに埋め込む文字列用）
function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// タイトルを最大文字数で2行に分割（読点・中黒があればそこで優先的に折り返す）
function wrapTitle(title: string, maxPerLine = 13): string[] {
  if (title.length <= maxPerLine) return [title];
  const breakChars = ['、', '・', ' '];
  for (let i = Math.min(maxPerLine, title.length - 1); i >= 4; i--) {
    if (breakChars.includes(title[i])) {
      return [title.slice(0, i + 1), title.slice(i + 1)];
    }
  }
  return [title.slice(0, maxPerLine), title.slice(maxPerLine)];
}

/**
 * テキストオーバーレイのSVGを作る。
 * 上部: 半透明ネイビーの帯にタイトル（＋サブタイトル）
 * 下部: 院名と（必要な場合のみ）注意書き
 */
function buildOverlaySvg(opts: {
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  showDisclaimer: boolean;
}): string {
  const { width: w, height: h } = opts;
  const titleLines = wrapTitle(opts.title);
  const titleSize = Math.round(w / 15.5); // 1080pxなら約70px
  const subSize = Math.round(titleSize * 0.45);
  const clinicSize = Math.round(w / 36);
  const noteSize = Math.round(w / 46);

  // 上部の帯の高さ（タイトル行数＋サブタイトルに応じて可変）
  const bandPadding = Math.round(titleSize * 0.7);
  const titleBlockH = titleLines.length * Math.round(titleSize * 1.35);
  const subBlockH = opts.subtitle ? Math.round(subSize * 1.9) : 0;
  const bandH = bandPadding * 2 + titleBlockH + subBlockH;

  const titleSpans = titleLines
    .map(
      (line, i) =>
        `<tspan x="${w / 2}" dy="${i === 0 ? 0 : Math.round(titleSize * 1.35)}">${esc(line)}</tspan>`
    )
    .join('');

  const subtitleSvg = opts.subtitle
    ? `<text x="${w / 2}" y="${bandPadding + titleBlockH + Math.round(subSize * 1.4)}" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${subSize}" fill="#F0F4FA">${esc(opts.subtitle)}</text>`
    : '';

  const disclaimerSvg = opts.showDisclaimer
    ? `<text x="${w / 2}" y="${h - Math.round(clinicSize * 3.2)}" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${noteSize}" fill="#FFFFFF" opacity="0.9">一般的な情報であり、個別の診断ではありません</text>`
    : '';

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <!-- 上部タイトル帯（半透明ネイビー） -->
  <rect x="0" y="0" width="${w}" height="${bandH}" fill="#1B2A4A" opacity="0.88"/>
  <rect x="0" y="${bandH}" width="${w}" height="${Math.max(4, Math.round(w / 200))}" fill="#D86018"/>
  <text x="${w / 2}" y="${bandPadding + titleSize}" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${titleSize}" font-weight="bold" fill="#FFFFFF">${titleSpans}</text>
  ${subtitleSvg}
  <!-- 下部: 院名帯 -->
  <rect x="0" y="${h - Math.round(clinicSize * 2.4)}" width="${w}" height="${Math.round(clinicSize * 2.4)}" fill="#1B2A4A" opacity="0.88"/>
  <text x="${w / 2}" y="${h - Math.round(clinicSize * 0.9)}" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${clinicSize}" fill="#FFFFFF">ゆうき整骨院｜下関市彦島</text>
  ${disclaimerSvg}
</svg>`;
}

/**
 * 生成画像を最終サイズへ整形し、文字を合成して保存する。
 */
export async function composeFinal(opts: {
  sourcePng: Buffer;
  outWidth: number;
  outHeight: number;
  spec: ImageSpec;
  showDisclaimer: boolean;
  outFile: string;
}): Promise<void> {
  const svg = buildOverlaySvg({
    width: opts.outWidth,
    height: opts.outHeight,
    title: opts.spec.title,
    subtitle: opts.spec.subtitle,
    showDisclaimer: opts.showDisclaimer,
  });

  await sharp(opts.sourcePng)
    .resize(opts.outWidth, opts.outHeight, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(opts.outFile);
}

/**
 * note見出し画像（1.91:1）用のオーバーレイ。
 * - タイトルは中央寄せ・2行以内・安全領域内（端に寄せない）
 * - 院名は控えめに下部中央
 * - 長い注意書きは入れない
 */
function buildNoteCoverSvg(opts: {
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  safe: { top: number; right: number; bottom: number; left: number };
}): string {
  const { width: w, height: h, safe } = opts;
  const titleLines = wrapTitle(opts.title, 14).slice(0, 2); // 2行以内
  const titleSize = Math.round(w / 17); // 1280pxなら約75px
  const subSize = Math.round(titleSize * 0.42);
  const clinicSize = Math.round(w / 46);

  // タイトルブロックを縦中央よりやや上に配置（安全領域内）
  const titleBlockH = titleLines.length * Math.round(titleSize * 1.3);
  const blockTop = Math.max(safe.top, Math.round(h * 0.32) - titleBlockH / 2);

  const titleSpans = titleLines
    .map((line, i) => `<tspan x="${w / 2}" dy="${i === 0 ? 0 : Math.round(titleSize * 1.3)}">${esc(line)}</tspan>`)
    .join('');

  const subtitleSvg = opts.subtitle
    ? `<text x="${w / 2}" y="${blockTop + titleBlockH + Math.round(subSize * 1.6)}" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${subSize}" fill="#F0F4FA">${esc(opts.subtitle)}</text>`
    : '';

  // 可読性のための上下グラデーション・スクリム
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1B2A4A" stop-opacity="0.72"/>
      <stop offset="45%" stop-color="#1B2A4A" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#1B2A4A" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#scrim)"/>
  <text x="${w / 2}" y="${blockTop + titleSize}" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${titleSize}" font-weight="bold" fill="#FFFFFF">${titleSpans}</text>
  ${subtitleSvg}
  <rect x="${w / 2 - Math.round(w * 0.09)}" y="${h - safe.bottom - Math.round(clinicSize * 1.9)}" width="${Math.round(w * 0.18)}" height="${Math.max(3, Math.round(w / 320))}" fill="#D86018"/>
  <text x="${w / 2}" y="${h - safe.bottom - Math.round(clinicSize * 0.6)}" text-anchor="middle" font-family="Yu Gothic, Meiryo, sans-serif" font-size="${clinicSize}" fill="#FFFFFF" opacity="0.92">ゆうき整骨院｜下関市彦島</text>
</svg>`;
}

export async function composeNoteCover(opts: {
  sourcePng: Buffer;
  outWidth: number;
  outHeight: number;
  title: string;
  subtitle?: string;
  safe: { top: number; right: number; bottom: number; left: number };
  outFile: string;
}): Promise<void> {
  const svg = buildNoteCoverSvg({
    width: opts.outWidth,
    height: opts.outHeight,
    title: opts.title,
    subtitle: opts.subtitle,
    safe: opts.safe,
  });
  await sharp(opts.sourcePng)
    .resize(opts.outWidth, opts.outHeight, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(opts.outFile);
}

/**
 * モックモード用: 単色のプレースホルダ画像を生成する（API課金なしで全工程を検証するため）
 */
export async function mockImage(width: number, height: number): Promise<Buffer> {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#2E4A7A"/>
  <circle cx="${width / 2}" cy="${height * 0.62}" r="${width / 4}" fill="#F0F4FA" opacity="0.35"/>
  <text x="${width / 2}" y="${height * 0.63}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(width / 20)}" fill="#FFFFFF" opacity="0.6">MOCK</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
