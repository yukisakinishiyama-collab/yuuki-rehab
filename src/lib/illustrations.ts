// アプリ内イラストのスロット管理
//
// ChatGPT等で生成した画像を「イラスト管理」画面からアップロードすると
// Vercel Blob に保存され、再デプロイなしで各画面に即時反映される。
// 解決順: Blob にアップロードされた画像 > public/illustrations/ の静的ファイル > 非表示

export interface IllustrationSlot {
  slot: string
  label: string
  usage: string
}

export const ILLUSTRATION_SLOTS: IllustrationSlot[] = [
  { slot: 'report-cover',           label: 'がんばりレポート表紙',   usage: 'がんばりレポート右上（未設定時は既存イラスト）' },
  { slot: 'cheer-goal',             label: '応援・つぎの目標',       usage: 'がんばりレポート「つぎの目標」欄' },
  { slot: 'cheer-recovery',         label: '応援・歩行練習',         usage: '汎用（今後の拡張用）' },
  { slot: 'cheer-stamp',            label: '応援・メダル',           usage: '汎用（今後の拡張用）' },
  { slot: 'fracture-cast-forearm',  label: '骨折・前腕ギプス',       usage: '骨折プロトコルの患者提示画面' },
  { slot: 'fracture-clavicle-band', label: '骨折・鎖骨バンド',       usage: '汎用（鎖骨骨折の説明用）' },
  { slot: 'fracture-foot-walk',     label: '骨折・歩行装具',         usage: '汎用（下肢骨折の説明用）' },
  { slot: 'dislocation-sling',      label: '脱臼・三角巾固定',       usage: '脱臼プロトコルの患者提示画面' },
  { slot: 'dislocation-innermuscle', label: '脱臼・インナー訓練',    usage: '汎用（再脱臼予防の説明用）' },
  { slot: 'sprain-icing',           label: '捻挫・アイシング',       usage: '汎用（急性期対応の説明用）' },
  { slot: 'sprain-taping',          label: '捻挫・テーピング',       usage: '捻挫プロトコルの患者提示画面・足の捻挫の症例説明' },
  { slot: 'sprain-balance',         label: '捻挫・バランス訓練',     usage: '汎用（再発予防の説明用）' },
  // 疾患ライブラリ（患者説明モード）用の部位別イラスト
  { slot: 'category-knee',          label: '部位別・膝',             usage: '疾患ライブラリ: 膝の症例の患者説明' },
  { slot: 'category-shoulder',      label: '部位別・肩',             usage: '疾患ライブラリ: 肩の症例の患者説明' },
  { slot: 'category-hip',           label: '部位別・股関節',         usage: '疾患ライブラリ: 股関節の症例の患者説明' },
  { slot: 'category-ankle-foot',    label: '部位別・足関節/足部',    usage: '疾患ライブラリ: 足の症例の患者説明' },
  { slot: 'category-elbow-hand',    label: '部位別・肘/手',          usage: '疾患ライブラリ: 肘・手の症例の患者説明' },
  { slot: 'category-spine',         label: '部位別・脊椎/腰',        usage: '疾患ライブラリ: 首・腰の症例の患者説明' },
]

export const ILLUSTRATION_SLOT_NAMES = ILLUSTRATION_SLOTS.map(s => s.slot)

// ── クライアント側: スロット→URL マップの取得（モジュールキャッシュ付き） ──

let cache: Promise<Record<string, string>> | null = null

export function fetchIllustrationMap(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return Promise.resolve({})
  cache ??= fetch('/api/illustrations')
    .then(r => (r.ok ? r.json() : { map: {} }))
    .then((d: { map?: Record<string, string> }) => d.map ?? {})
    .catch(() => ({}))
  return cache
}

export function invalidateIllustrationCache(): void {
  cache = null
}

/** プロトコルのタイトルから患者提示画面用のイラストスロットを推定する */
export function slotForProtocolTitle(title: string): string | null {
  if (title.includes('骨折')) return 'fracture-cast-forearm'
  if (title.includes('脱臼')) return 'dislocation-sling'
  if (title.includes('捻挫') || title.includes('靭帯') || title.includes('靱帯')) return 'sprain-taping'
  return null
}

/**
 * 疾患ライブラリの症例（疾患名＋部位カテゴリ）から患者説明用のイラストスロットを推定する。
 * 外傷（骨折・脱臼・捻挫）は専用イラスト、それ以外は部位別イラストにフォールバック。
 */
export function slotForDisease(name: string, category: string): string {
  const categorySlot = `category-${category.replace(/_/g, '-')}`

  if (name.includes('骨折')) {
    if (name.includes('鎖骨')) return 'fracture-clavicle-band'
    // 下肢の骨折は歩行装具のイラスト
    if (category === 'ankle_foot' || /足|脛|踵|距骨|中足|Jones|下腿/.test(name)) return 'fracture-foot-walk'
    return 'fracture-cast-forearm'
  }
  if (name.includes('脱臼')) {
    if (category === 'shoulder' || name.includes('肩')) return 'dislocation-sling'
    return categorySlot
  }
  if (name.includes('捻挫') || name.includes('靭帯') || name.includes('靱帯')) {
    if (category === 'ankle_foot') return 'sprain-taping'
    return categorySlot
  }
  return categorySlot
}
