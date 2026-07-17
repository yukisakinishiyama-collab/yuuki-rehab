/**
 * テンプレート投稿画像の生成（共通モジュール）
 *
 * /api/marketing/image（プレビュー・ダウンロード用）と
 * publishers.ts（Instagram自動投稿用）の両方から使う。
 * ネイビーブランド・日本語折返し対応。sharpでSVG→PNG化。
 */
import sharp from 'sharp'
import { DEFAULT_CLINIC_PROFILE } from './clinic'

export const IMAGE_SIZES: Record<string, { w: number; h: number }> = {
  instagram: { w: 1080, h: 1080 },
  instagram_portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  google: { w: 1200, h: 900 },
  note: { w: 1280, h: 670 },
}

/** 日本語をおおよその文字数で改行する（SVGは自動折返し不可のため） */
function wrapText(text: string, perLine: number, maxLines: number): string[] {
  const lines: string[] = []
  let rest = text.trim()
  while (rest.length > 0 && lines.length < maxLines) {
    lines.push(rest.slice(0, perLine))
    rest = rest.slice(perLine)
  }
  if (rest.length > 0 && lines.length > 0) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, perLine - 1) + '…'
  }
  return lines
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** テンプレート画像PNGを生成する */
export async function renderTemplateImage(
  title: string,
  subtitle: string,
  sizeKey: keyof typeof IMAGE_SIZES = 'instagram',
): Promise<Buffer> {
  const { w, h } = IMAGE_SIZES[sizeKey] ?? IMAGE_SIZES.instagram
  const safeTitle = title.slice(0, 60)
  const safeSubtitle = subtitle.slice(0, 60)

  const titleSize = Math.round(w / 12)
  const perLine = Math.floor((w * 0.84) / titleSize)
  const titleLines = wrapText(safeTitle, perLine, 3)
  const subSize = Math.round(titleSize * 0.45)
  const subLines = safeSubtitle ? wrapText(safeSubtitle, Math.floor((w * 0.84) / subSize), 2) : []

  const centerY = h / 2 - ((titleLines.length - 1) * titleSize * 1.3) / 2 - (subLines.length > 0 ? subSize : 0)
  const titleSpans = titleLines
    .map(
      (line, i) =>
        `<text x="${w / 2}" y="${centerY + i * titleSize * 1.3}" text-anchor="middle" font-size="${titleSize}" font-weight="700" fill="#ffffff" font-family="'Yu Gothic','Meiryo',sans-serif">${escapeXml(line)}</text>`,
    )
    .join('')
  const subStartY = centerY + titleLines.length * titleSize * 1.3 + subSize * 0.5
  const subSpans = subLines
    .map(
      (line, i) =>
        `<text x="${w / 2}" y="${subStartY + i * subSize * 1.5}" text-anchor="middle" font-size="${subSize}" fill="#bfdbe8" font-family="'Yu Gothic','Meiryo',sans-serif">${escapeXml(line)}</text>`,
    )
    .join('')

  const svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#16233d"/>
        <stop offset="1" stop-color="#2b4a75"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <circle cx="${w * 0.9}" cy="${h * 0.12}" r="${w * 0.18}" fill="#ffffff" opacity="0.05"/>
    <circle cx="${w * 0.08}" cy="${h * 0.9}" r="${w * 0.22}" fill="#ffffff" opacity="0.05"/>
    <rect x="${w * 0.08}" y="${h / 2 - titleSize * 2.2}" width="${w * 0.06}" height="6" fill="#5eead4"/>
    ${titleSpans}
    ${subSpans}
    <text x="${w / 2}" y="${h - Math.round(h * 0.06)}" text-anchor="middle" font-size="${Math.round(subSize * 0.8)}" font-weight="700" fill="#5eead4" font-family="'Yu Mincho','Yu Gothic',serif">${escapeXml(DEFAULT_CLINIC_PROFILE.name)}</text>
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}
