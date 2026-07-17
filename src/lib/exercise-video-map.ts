// 運動名キーワード → YouTube URL マッピング
// キーワードは小文字で記述し、部分一致で検索する
// 先にマッチしたエントリが優先されるため、具体的な種目名を汎用的な種目名より上に置くこと
//
// URL は2種類:
// - 直接リンク: 動作確認済みの特定動画
// - 検索リンク: YouTube検索結果（リンク切れ・誤動画のリスクがないため新規追加分はこちらを使用）

function searchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

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
    keywords: ['ヒールスライド', 'heel slide', '膝関節可動域', '膝屈伸rom', '膝rom', '膝の可動域'],
    url: searchUrl('膝 可動域訓練 ヒールスライド リハビリ'),
  },
  {
    keywords: ['ミニスクワット', 'mini squat', 'partial squat'],
    url: 'https://www.youtube.com/watch?v=NW5e73QTBUs',
  },
  {
    keywords: ['wall squat', 'wall sit', 'ウォールスクワット', '壁スクワット'],
    url: 'https://www.youtube.com/watch?v=hvl44EqSuTw',
  },
  {
    keywords: ['single leg squat', '片脚スクワット', 'one leg squat', 'single-leg squat'],
    url: 'https://www.youtube.com/watch?v=BrG-qgRVvIk',
  },
  {
    keywords: ['スプリットスクワット', 'split squat', 'ランジ', 'lunge'],
    url: searchUrl('スプリットスクワット やり方 フォーム'),
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
    keywords: ['single leg hop', '片脚ホップ', 'hop test'],
    url: 'https://www.youtube.com/watch?v=2VdGUqrWYMs',
  },
  {
    keywords: ['leg press', 'レッグプレス'],
    url: 'https://www.youtube.com/watch?v=WbKT5b8ydmM',
  },
  {
    // 汎用スクワット（ミニ・ウォール・片脚・スプリットの後に置く）
    keywords: ['スクワット', 'squat'],
    url: searchUrl('スクワット 正しいフォーム リハビリ'),
  },
  {
    keywords: ['ハムストリング', 'hamstring', 'レッグカール', 'ノルディック', 'nordic'],
    url: searchUrl('ハムストリング 強化 トレーニング リハビリ'),
  },
  {
    keywords: ['デッドリフト', 'deadlift', 'ヒップヒンジ', 'hip hinge'],
    url: searchUrl('デッドリフト フォーム 初心者 軽負荷'),
  },
  {
    keywords: ['ジャンプ', 'jump', '着地', 'landing'],
    url: searchUrl('ジャンプ 着地 トレーニング ACL 膝'),
  },
  {
    keywords: ['階段昇降', 'stair'],
    url: searchUrl('階段昇降 訓練 リハビリ 手すり'),
  },
  {
    keywords: ['立ち上がり', 'sit to stand'],
    url: searchUrl('立ち上がり訓練 リハビリ 方法'),
  },

  // ── 股関節・臀部 ──
  {
    keywords: ['glute bridge', 'hip bridge', 'グルートブリッジ', '股関節ブリッジ', 'ヒップリフト', 'hip lift', 'ブリッジ'],
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
    keywords: ['pendulum', 'コドマン', 'codman', 'ペンジュラム', 'コードマン', '振り子'],
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
    keywords: ['ローテーターカフ', 'rotator cuff', 'カフ強化', 'インナーマッスル'],
    url: searchUrl('ローテーターカフ チューブ トレーニング'),
  },
  {
    keywords: ['棒体操', 'wand exercise'],
    url: searchUrl('肩 棒体操 リハビリ 外転 外旋'),
  },
  {
    keywords: ['滑車', 'プーリー', 'pulley'],
    url: searchUrl('肩 プーリー訓練 自動介助運動'),
  },
  {
    keywords: ['scapular', '肩甲骨', 'serratus', '前鋸筋'],
    url: 'https://www.youtube.com/watch?v=oMSVe7PWJ3o',
  },
  {
    keywords: ['ストレッチング', '積極的なストレッチ'],
    url: searchUrl('肩関節 ストレッチ 可動域改善'),
  },

  // ── 足関節・アキレス腱 ──
  {
    keywords: ['eccentric calf', 'eccentric heel', '遠心性カーフレイズ', 'アルフレッドソン', 'alfredson'],
    url: 'https://www.youtube.com/watch?v=Shb5bmT-ysc',
  },
  {
    keywords: ['single leg calf', '片脚カーフレイズ', '片脚ヒールレイズ', 'カーフレイズ（片脚'],
    url: 'https://www.youtube.com/watch?v=POJXdGPQl1M',
  },
  {
    keywords: ['calf raise', 'heel raise', 'カーフレイズ', 'ヒールレイズ', '下腿三頭筋'],
    url: 'https://www.youtube.com/watch?v=HmgXnST4Mdw',
  },
  {
    keywords: ['レジスタンスバンド', 'チューブ', 'セラバンド', '外反・底屈'],
    url: searchUrl('足関節 チューブトレーニング 外反 底屈'),
  },
  {
    keywords: ['ポンピング', 'アンクルポンプ', 'ankle pump'],
    url: searchUrl('足首 ポンプ運動 やり方'),
  },
  {
    keywords: ['ankle dorsiflexion', '足関節背屈', 'weight bearing lunge', 'ランジテスト'],
    url: 'https://www.youtube.com/watch?v=2T36FuYE8JA',
  },
  {
    keywords: ['足関節rom', '足関節可動域', '足首', '足趾'],
    url: searchUrl('足関節 可動域訓練 リハビリ'),
  },

  // ── バランス・アジリティ ──
  {
    keywords: ['片脚立位', 'single leg stance', 'single leg balance'],
    url: searchUrl('片脚立位 バランス訓練 リハビリ'),
  },
  {
    keywords: ['proprioception', 'balance board', 'バランスボード', '固有感覚', 'バランス訓練', 'ankle balance', '不安定面'],
    url: 'https://www.youtube.com/watch?v=I_vqLIwy5j4',
  },
  {
    keywords: ['アジリティ', 'agility', 'ラダー', 'カッティング', '切り返し', '方向転換'],
    url: searchUrl('アジリティ ラダートレーニング リハビリ'),
  },
  {
    keywords: ['側方ステップ', 'サイドステップ', 'lateral step', '前後左右ステップ'],
    url: searchUrl('サイドステップ トレーニング リハビリ'),
  },
  {
    keywords: ['スポーツ特異的', 'スポーツ復帰', 'sport specific', '競技・仕事特有', '職業・スポーツ'],
    url: searchUrl('競技復帰 トレーニング ドリル リハビリ'),
  },

  // ── 体幹・腰 ──
  {
    keywords: ['ドローイン', 'draw-in', '腹横筋', 'ニュートラルポジション'],
    url: searchUrl('ドローイン 腹横筋 やり方'),
  },
  {
    keywords: ['プランク', 'plank'],
    url: searchUrl('プランク サイドプランク 正しいフォーム'),
  },
  {
    keywords: ['バードドッグ', 'bird dog'],
    url: searchUrl('バードドッグ やり方 体幹'),
  },
  {
    keywords: ['骨盤傾斜', 'pelvic tilt', 'ペルビックティルト'],
    url: searchUrl('骨盤傾斜運動 やり方 腰痛'),
  },
  {
    keywords: ['腹臥位伸展', 'マッケンジー', '膝抱え'],
    url: searchUrl('マッケンジー体操 腰痛 伸展'),
  },
  {
    keywords: ['胸椎', 'thoracic'],
    url: searchUrl('胸椎モビリティ エクササイズ'),
  },

  // ── 歩行・有酸素・その他 ──
  {
    keywords: ['松葉杖', 'crutch', '部分荷重'],
    url: searchUrl('松葉杖 歩行 方法 部分荷重'),
  },
  {
    keywords: ['歩行'],
    url: searchUrl('歩行訓練 リハビリ ポイント'),
  },
  {
    keywords: ['有酸素', 'エルゴメーター', 'エアロバイク', '自転車', 'ウォーキング', '水中歩行'],
    url: searchUrl('有酸素運動 リハビリ エアロバイク'),
  },
  {
    keywords: ['アイシング', 'icing', 'price', 'rice処置'],
    url: searchUrl('アイシング 正しい方法 スポーツ外傷'),
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
