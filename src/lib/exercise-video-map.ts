// 運動名キーワード → YouTube URL マッピング
// キーワードは小文字で記述し、部分一致で検索する

const VIDEO_MAP: Array<{ keywords: string[]; url: string }> = [
  // ── 膝・ACL ──
  {
    keywords: ['terminal knee extension', 'tke', '終端伸展', 'ターミナルニーエクステンション'],
    url: 'https://www.youtube.com/watch?v=nfJ5QCx_fSg',
  },
  {
    keywords: ['quad set', 'クアッドセット', '大腿四頭筋セッティング', 'quad activation', 'quads activation'],
    url: 'https://www.youtube.com/watch?v=si7Vqiss36s',
  },
  {
    keywords: ['straight leg raise', 'slr', '下肢伸展挙上', 'ストレートレッグレイズ'],
    url: 'https://www.youtube.com/watch?v=gobteD5GWkE',
  },
  {
    keywords: ['mini squat', 'ミニスクワット', 'partial squat'],
    url: 'https://www.youtube.com/watch?v=NW5e73QTBUs',
  },
  {
    keywords: ['wall squat', 'wall sit', 'ウォールスクワット', '壁スクワット'],
    url: 'https://www.youtube.com/watch?v=hvl44EqSuTw',
  },
  {
    keywords: ['step up', 'ステップアップ', 'step-up'],
    url: 'https://www.youtube.com/watch?v=UwlBah4dx-8',
  },
  {
    keywords: ['step down', 'ステップダウン', 'step-down'],
    url: 'https://www.youtube.com/watch?v=zhCGPoCbM0s',
  },
  {
    keywords: ['single leg squat', '片脚スクワット', 'one leg squat', 'single-leg squat'],
    url: 'https://www.youtube.com/watch?v=BrG-qgRVvIk',
  },
  {
    keywords: ['single leg hop', '片脚ホップ', 'hop test'],
    url: 'https://www.youtube.com/watch?v=2VdGUqrWYMs',
  },
  {
    keywords: ['leg press', 'レッグプレス'],
    url: 'https://www.youtube.com/watch?v=WbKT5b8ydmM',
  },

  // ── 股関節・臀部 ──
  {
    keywords: ['glute bridge', 'hip bridge', 'グルートブリッジ', '股関節ブリッジ', 'ヒップリフト', 'hip lift'],
    url: 'https://www.youtube.com/watch?v=WtilA9IJX1c',
  },
  {
    keywords: ['clamshell', 'clam shell', 'クラムシェル', '股関節外転（側臥位）'],
    url: 'https://www.youtube.com/watch?v=46l1bE9LlqM',
  },
  {
    keywords: ['hip abduction', '股関節外転', 'hip abductor'],
    url: 'https://www.youtube.com/watch?v=46l1bE9LlqM',
  },
  {
    keywords: ['hip flexor', '腸腰筋', 'iliopsoas'],
    url: 'https://www.youtube.com/watch?v=QWwg3d-N6Wg',
  },

  // ── 肩関節 ──
  {
    keywords: ['pendulum', 'コドマン', 'codman', 'ペンジュラム'],
    url: 'https://www.youtube.com/watch?v=U9X3Cpe9h10',
  },
  {
    keywords: ['wall slide', 'ウォールスライド', 'scapular wall slide', '肩甲骨ウォールスライド'],
    url: 'https://www.youtube.com/watch?v=AEbcmAYbOkI',
  },
  {
    keywords: ['external rotation', '外旋', 'er exercise', '肩外旋'],
    url: 'https://www.youtube.com/watch?v=hUO4MGIVAyc',
  },
  {
    keywords: ['scapular', '肩甲骨', 'serratus', '前鋸筋'],
    url: 'https://www.youtube.com/watch?v=oMSVe7PWJ3o',
  },

  // ── 足関節・アキレス腱 ──
  {
    keywords: ['calf raise', 'heel raise', 'カーフレイズ', 'ヒールレイズ', '下腿三頭筋'],
    url: 'https://www.youtube.com/watch?v=HmgXnST4Mdw',
  },
  {
    keywords: ['eccentric calf', 'eccentric heel', '遠心性カーフレイズ', 'アルフレッドソン', 'alfredson'],
    url: 'https://www.youtube.com/watch?v=Shb5bmT-ysc',
  },
  {
    keywords: ['single leg calf', '片脚カーフレイズ', '片脚ヒールレイズ'],
    url: 'https://www.youtube.com/watch?v=POJXdGPQl1M',
  },
  {
    keywords: ['proprioception', 'balance board', 'バランスボード', '固有感覚', 'バランス訓練', 'ankle balance'],
    url: 'https://www.youtube.com/watch?v=I_vqLIwy5j4',
  },
  {
    keywords: ['ankle dorsiflexion', '足関節背屈', 'weight bearing lunge', 'ランジテスト'],
    url: 'https://www.youtube.com/watch?v=2T36FuYE8JA',
  },
]

// 運動名からYouTube URLを返す（見つからなければ undefined）
export function findVideoUrl(exerciseName: string): string | undefined {
  const lower = exerciseName.toLowerCase()
  for (const entry of VIDEO_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.url
    }
  }
  return undefined
}
