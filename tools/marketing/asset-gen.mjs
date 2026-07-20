/**
 * マーケ素材の一括生成スクリプト
 *
 * 生成物（デスクトップ\マーケ素材\）:
 *   画像\        フィード用ストック画像（1080x1350）
 *   リール動画\  リール用スライド動画（1080x1920・無音・15〜18秒）
 *   広告動画\    正方形の広告動画（1080x1080・無音）
 *
 * 実行: cd yuuki-rehab && node tools/marketing/asset-gen.mjs
 * 必要: sharp（プロジェクト依存）・ffmpeg（PATH上）
 *
 * 文言は医療広告ガイドライン準拠（治癒の断定・保証・体験談・比較優良表現を使わない）。
 * 動画は無音で書き出す（Instagramアプリ内で音源を付ける運用）。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

const CLINIC = {
  name: 'ゆうき整骨院',
  phone: '083-265-4545',
  hours: '平日 10:00-13:00 / 15:00-20:00',
  hours2: '土曜 10:00-15:00',
  address: '山口県下関市彦島江の浦町9丁目1-14',
}

const OUT_ROOT = path.join(os.homedir(), 'Desktop', 'マーケ素材')
const TMP = path.join(os.tmpdir(), `mk-asset-${Date.now()}`)

const FONT = `'Yu Gothic','Meiryo',sans-serif`
const NAVY1 = '#16233d'
const NAVY2 = '#2b4a75'
const TEAL = '#5eead4'
const SUB = '#bfdbe8'

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 共通の背景（ネイビーグラデ＋装飾円） */
function bg(w, h) {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${NAVY1}"/>
        <stop offset="1" stop-color="${NAVY2}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <circle cx="${w * 0.92}" cy="${h * 0.1}" r="${w * 0.2}" fill="#ffffff" opacity="0.05"/>
    <circle cx="${w * 0.06}" cy="${h * 0.92}" r="${w * 0.24}" fill="#ffffff" opacity="0.05"/>
    <circle cx="${w * 0.85}" cy="${h * 0.85}" r="${w * 0.08}" fill="${TEAL}" opacity="0.08"/>`
}

/** 中央寄せの複数行テキスト */
function centerLines(lines, w, startY, size, lineH, fill, weight = 400) {
  return lines
    .map(
      (line, i) =>
        `<text x="${w / 2}" y="${startY + i * size * lineH}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${FONT}">${esc(line)}</text>`,
    )
    .join('\n')
}

/**
 * スライド1枚のSVGを生成する
 * kind: cover(表紙) / point(本文) / cta(締め・院情報)
 */
function slideSvg({ kind, w, h, kicker, title = [], body = [], pageNo }) {
  const titleSize = Math.round(w / 11)
  const bodySize = Math.round(w / 20)
  const kickerSize = Math.round(w / 26)
  let content = ''

  if (kind === 'cover') {
    const startY = h / 2 - ((title.length - 1) * titleSize * 1.35) / 2
    content = `
      ${kicker ? `<text x="${w / 2}" y="${startY - titleSize * 1.6}" text-anchor="middle" font-size="${kickerSize}" font-weight="700" fill="${TEAL}" letter-spacing="6" font-family="${FONT}">${esc(kicker)}</text>` : ''}
      <rect x="${w / 2 - w * 0.04}" y="${startY - titleSize * 1.15}" width="${w * 0.08}" height="8" rx="4" fill="${TEAL}"/>
      ${centerLines(title, w, startY, titleSize, 1.35, '#ffffff', 700)}
      ${centerLines(body, w, startY + title.length * titleSize * 1.35 + bodySize * 0.8, bodySize, 1.6, SUB)}
      <text x="${w / 2}" y="${h - h * 0.05}" text-anchor="middle" font-size="${Math.round(bodySize * 0.8)}" font-weight="700" fill="${TEAL}" font-family="${FONT}">${esc(CLINIC.name)}</text>`
  } else if (kind === 'point') {
    const blockH = title.length * titleSize * 1.35 + (body.length > 0 ? bodySize * 0.6 + body.length * bodySize * 1.7 : 0)
    const startY = h / 2 - blockH / 2 + titleSize * 0.5
    content = `
      ${kicker ? `<text x="${w / 2}" y="${startY - titleSize * 1.5}" text-anchor="middle" font-size="${kickerSize}" font-weight="700" fill="${TEAL}" letter-spacing="4" font-family="${FONT}">${esc(kicker)}</text>` : ''}
      ${centerLines(title, w, startY, titleSize, 1.35, '#ffffff', 700)}
      ${body.length > 0 ? `<rect x="${w / 2 - w * 0.03}" y="${startY + (title.length - 1) * titleSize * 1.35 + bodySize * 1.1}" width="${w * 0.06}" height="6" rx="3" fill="${TEAL}" opacity="0.7"/>` : ''}
      ${centerLines(body, w, startY + (title.length - 1) * titleSize * 1.35 + bodySize * 1.1 + bodySize * 1.6, bodySize, 1.7, SUB)}
      <text x="${w / 2}" y="${h - h * 0.05}" text-anchor="middle" font-size="${Math.round(bodySize * 0.75)}" fill="#7d94b8" font-family="${FONT}">${esc(CLINIC.name)}</text>`
  } else if (kind === 'cta') {
    const nameSize = Math.round(w / 12)
    const phoneSize = Math.round(w / 13)
    const infoSize = Math.round(w / 24)
    const cy = h / 2
    content = `
      <text x="${w / 2}" y="${cy - nameSize * 2.1}" text-anchor="middle" font-size="${kickerSize}" font-weight="700" fill="${TEAL}" letter-spacing="6" font-family="${FONT}">${esc(kicker ?? 'ご予約・ご相談')}</text>
      <text x="${w / 2}" y="${cy - nameSize * 0.7}" text-anchor="middle" font-size="${nameSize}" font-weight="700" fill="#ffffff" font-family="${FONT}">${esc(CLINIC.name)}</text>
      <rect x="${w / 2 - w * 0.3}" y="${cy - nameSize * 0.25}" width="${w * 0.6}" height="4" rx="2" fill="${TEAL}" opacity="0.6"/>
      <text x="${w / 2}" y="${cy + phoneSize * 0.9}" text-anchor="middle" font-size="${phoneSize}" font-weight="700" fill="${TEAL}" font-family="${FONT}">${esc(CLINIC.phone)}</text>
      ${centerLines([CLINIC.hours, CLINIC.hours2, 'ネット予約・LINEは24時間受付'], w, cy + phoneSize * 2.1, infoSize, 1.7, SUB)}
      <text x="${w / 2}" y="${h - h * 0.05}" text-anchor="middle" font-size="${Math.round(infoSize * 0.8)}" fill="#7d94b8" font-family="${FONT}">${esc(CLINIC.address)}</text>`
  }

  const page = pageNo
    ? `<text x="${w - w * 0.06}" y="${h * 0.06}" text-anchor="end" font-size="${Math.round(w / 30)}" font-weight="700" fill="${TEAL}" opacity="0.8" font-family="${FONT}">${esc(pageNo)}</text>`
    : ''

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${bg(w, h)}${content}${page}</svg>`
}

async function renderPng(svg, file) {
  await sharp(Buffer.from(svg)).png().toFile(file)
}

/** スライド列→ffmpegでクロスフェード動画に（無音・H.264） */
function encodeVideo(slideFiles, w, h, outFile, { dur = 4, fade = 0.6 } = {}) {
  const n = slideFiles.length
  const inputs = slideFiles.flatMap((f) => ['-loop', '1', '-t', String(dur), '-framerate', '30', '-i', f])
  let filter = ''
  let prev = '[0:v]'
  for (let i = 1; i < n; i += 1) {
    const offset = (i * (dur - fade)).toFixed(2)
    const label = i === n - 1 ? '[xf]' : `[x${i}]`
    filter += `${prev}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset}${label};`
    prev = `[x${i}]`
  }
  const total = n * dur - (n - 1) * fade
  filter += `[xf]fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 0.7).toFixed(2)}:d=0.7,format=yuv420p[v]`

  const args = [
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    '-r',
    '30',
    outFile,
  ]
  const res = spawnSync('ffmpeg', args, { encoding: 'utf-8' })
  if (res.status !== 0) {
    throw new Error(`ffmpeg失敗 (${path.basename(outFile)}): ${res.stderr?.slice(-600)}`)
  }
  return total
}

// ────────────────────────────────────────────────
// コンテンツ定義（医療広告ガイドライン準拠の文言のみ）
// ────────────────────────────────────────────────

/** リール動画（1080x1920） */
const REELS = [
  {
    file: 'リール01_肩こりセルフケア.mp4',
    slides: [
      { kind: 'cover', kicker: 'SELF CARE', title: ['デスクワークで', '肩がガチガチ…'], body: ['そんな毎日になっていませんか？'] },
      { kind: 'point', kicker: 'なぜ？', title: ['同じ姿勢が続くと'], body: ['肩まわりの筋肉がこわばり', '血流が滞りやすくなります'] },
      { kind: 'point', kicker: 'ワンポイント', title: ['1時間に1回', '肩を大きく回す'], body: ['前に10回・後ろに10回', 'こまめなリセットが大切です'] },
      { kind: 'point', title: ['つらさが続くときは', '我慢しないで'], body: ['状態に合わせたケアで', '改善を目指しましょう'] },
      { kind: 'cta' },
    ],
  },
  {
    file: 'リール02_朝の腰の重さ.mp4',
    slides: [
      { kind: 'cover', kicker: 'LOW BACK', title: ['朝起きると', '腰が重い…'], body: ['そんな日が続いていませんか？'] },
      { kind: 'point', kicker: '原因は？', title: ['寝姿勢や', '筋力バランスの影響も'], body: ['日常のクセが腰の負担に', 'つながっていることがあります'] },
      { kind: 'point', kicker: 'ワンポイント', title: ['起き上がる前に', 'ひざ抱えストレッチ'], body: ['仰向けでひざを胸に近づけ', '10秒×3回が目安です'] },
      { kind: 'point', title: ['お一人おひとりの', '状態に合わせて'], body: ['施術とセルフケアの両面で', '改善を目指します'] },
      { kind: 'cta' },
    ],
  },
  {
    file: 'リール03_捻挫を放置しない.mp4',
    slides: [
      { kind: 'cover', kicker: 'SPORTS', title: ['その捻挫', 'そのままに', 'していませんか？'] },
      { kind: 'point', kicker: '注意', title: ['放置すると'], body: ['関節が不安定なまま', 'クセになることもあります'] },
      { kind: 'point', kicker: '大切なこと', title: ['早めの応急処置と', '段階的なケア'], body: ['安静・冷却から運動再開まで', '順序立てて進めることが大切です'] },
      { kind: 'point', title: ['競技復帰まで', 'サポートします'], body: ['スポーツの動きに合わせた', 'リハビリメニューをご提案'] },
      { kind: 'cta' },
    ],
  },
  {
    file: 'リール04_院紹介.mp4',
    slides: [
      { kind: 'cover', kicker: 'ABOUT US', title: ['ゆうき整骨院って', 'どんなところ？'] },
      { kind: 'point', kicker: '01', title: ['国家資格者が', '丁寧に確認'], body: ['お一人おひとりの状態を', '確認してから施術します'] },
      { kind: 'point', kicker: '02', title: ['平日は夜8時まで', '土曜も受付'], body: ['お仕事や学校帰りにも', '通いやすい診療時間です'] },
      { kind: 'point', kicker: '03', title: ['予約はネット・LINEで', 'いつでも'], body: ['24時間いつでも', 'スマホから予約できます'] },
      { kind: 'cta' },
    ],
  },
]

/** 広告動画（1080x1080） */
const ADS = [
  {
    file: '広告01_痛みの相談.mp4',
    slides: [
      { kind: 'cover', kicker: 'CONSULTATION', title: ['肩・腰・ひざの', '痛み', 'ご相談ください'] },
      { kind: 'point', title: ['原因を確認し', '状態に合わせた', '施術プランをご提案'], body: [] },
      { kind: 'point', title: ['ネット予約は', '24時間受付'], body: ['待ち時間の少ない', '予約制です'] },
      { kind: 'cta' },
    ],
  },
  {
    file: '広告02_初めての方へ.mp4',
    slides: [
      { kind: 'cover', kicker: 'FIRST VISIT', title: ['初めての方へ'] },
      { kind: 'point', title: ['丁寧な', 'カウンセリングから'], body: ['気になることは', '何でもお聞かせください'] },
      { kind: 'point', title: ['施術内容と料金は', '事前にご説明'], body: ['ご納得いただいてから', '施術を始めますのでご安心を'] },
      { kind: 'cta' },
    ],
  },
]

/** フィード用ストック画像（1080x1350） */
const IMAGES = [
  { file: '画像01_肩こりセルフケア.png', slide: { kind: 'cover', kicker: 'SELF CARE', title: ['デスクワークの', '肩こり対策'], body: ['1時間に1回、肩を大きく回して', 'こわばりをリセットしましょう'] } },
  { file: '画像02_朝の腰の重さ.png', slide: { kind: 'cover', kicker: 'LOW BACK', title: ['朝の腰の重さ', '気になりませんか？'], body: ['寝姿勢や筋力バランスの影響も。', '続くときはご相談ください'] } },
  { file: '画像03_捻挫は早めのケア.png', slide: { kind: 'cover', kicker: 'SPORTS', title: ['捻挫は早めの', 'ケアが大切'], body: ['応急処置から競技復帰まで', '段階的にサポートします'] } },
  { file: '画像04_初めての方へ.png', slide: { kind: 'cover', kicker: 'FIRST VISIT', title: ['初めての方へ'], body: ['丁寧なカウンセリングと説明から。', '施術内容と料金は事前にご案内します'] } },
  { file: '画像05_予約案内.png', slide: { kind: 'cta', kicker: 'RESERVATION' } },
  { file: '画像06_診療時間.png', slide: { kind: 'cta', kicker: '診療時間のご案内' } },
]

// ────────────────────────────────────────────────
// 実行
// ────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(TMP, { recursive: true })
  const dirs = {
    img: path.join(OUT_ROOT, '画像'),
    reel: path.join(OUT_ROOT, 'リール動画'),
    ad: path.join(OUT_ROOT, '広告動画'),
  }
  Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }))

  // 画像
  for (const item of IMAGES) {
    const svg = slideSvg({ ...item.slide, w: 1080, h: 1350 })
    await renderPng(svg, path.join(dirs.img, item.file))
    console.log(`画像: ${item.file}`)
  }

  // リール動画（9:16）
  for (const reel of REELS) {
    const files = []
    for (const [i, s] of reel.slides.entries()) {
      const f = path.join(TMP, `${reel.file}-${i}.png`)
      await renderPng(slideSvg({ ...s, w: 1080, h: 1920, pageNo: s.kind === 'point' && s.kicker?.match(/^\d+$/) ? undefined : undefined }), f)
      files.push(f)
    }
    const total = encodeVideo(files, 1080, 1920, path.join(dirs.reel, reel.file))
    console.log(`リール: ${reel.file}（${total.toFixed(1)}秒）`)
  }

  // 広告動画（1:1）
  for (const ad of ADS) {
    const files = []
    for (const [i, s] of ad.slides.entries()) {
      const f = path.join(TMP, `${ad.file}-${i}.png`)
      await renderPng(slideSvg({ ...s, w: 1080, h: 1080 }), f)
      files.push(f)
    }
    const total = encodeVideo(files, 1080, 1080, path.join(dirs.ad, ad.file))
    console.log(`広告: ${ad.file}（${total.toFixed(1)}秒）`)
  }

  fs.rmSync(TMP, { recursive: true, force: true })
  console.log(`\n完了: ${OUT_ROOT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
