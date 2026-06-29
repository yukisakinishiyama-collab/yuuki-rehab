// ──────────────────────────────────────────────
// 臨床アウトカムスコア定義（問診票・選択肢・閾値）
// ──────────────────────────────────────────────
import type { ScoreId } from '@/types/outcome-scores'

export interface ScoreOption { value: number; label: string }
export interface ScoreItem {
  id: string
  question: string
  hint?: string
  type: 'radio' | 'number' | 'slider'
  options?: ScoreOption[]
  min?: number; max?: number; unit?: string
}
export interface ScoreThreshold {
  label: string; min: number; max: number
  color: 'green' | 'yellow' | 'orange' | 'red'
}
export interface ScoreDef {
  id: ScoreId
  shortName: string
  fullName: string
  regions: string[]
  maxScore: number
  higherIsBetter: boolean
  unit: string
  items: ScoreItem[]
  thresholds: ScoreThreshold[]
  reference: string
  calculate: (answers: Record<string, number>) => { total: number; subscores?: Record<string, number>; interp: string; color: 'green' | 'yellow' | 'orange' | 'red' }
}

// ────────── LYSHOLM ──────────
const lysholm: ScoreDef = {
  id: 'lysholm', shortName: 'Lysholm', fullName: 'Lysholm膝関節スコア',
  regions: ['knee'], maxScore: 100, higherIsBetter: true, unit: '点',
  reference: 'Lysholm & Gillquist (1982)',
  items: [
    { id: 'limp', question: '跛行（びっこ）', type: 'radio', options: [
      { value: 5, label: 'なし' }, { value: 3, label: '軽度または周期的' }, { value: 0, label: '重度または常時' }] },
    { id: 'support', question: '補助具の使用', type: 'radio', options: [
      { value: 5, label: '不要' }, { value: 3, label: '杖または松葉杖で荷重可' }, { value: 2, label: '松葉杖で荷重不可' }, { value: 0, label: '荷重不可（松葉杖2本）' }] },
    { id: 'locking', question: 'ロッキング（膝のひっかかり・固定）', type: 'radio', options: [
      { value: 15, label: 'ロッキングなし・ひっかかりなし' }, { value: 10, label: 'ひっかかりはあるがロッキングなし' },
      { value: 6, label: '時々ロッキングあり' }, { value: 2, label: '検査時にロッキング' }, { value: 0, label: '固定したロッキング' }] },
    { id: 'instability', question: '不安定感（膝が崩れる）', type: 'radio', options: [
      { value: 25, label: 'なし' }, { value: 20, label: '激しい活動でまれに' },
      { value: 15, label: '激しい活動でよく（または特定の激しい活動が不可）' },
      { value: 10, label: '日常生活でまれに' }, { value: 5, label: '日常生活でよく' }, { value: 0, label: 'すべての活動で' }] },
    { id: 'pain', question: '痛み', type: 'radio', options: [
      { value: 25, label: 'なし' }, { value: 20, label: '激しい運動後のみ（軽度）' },
      { value: 15, label: '激しい運動中・後に著明に' }, { value: 10, label: '2km以上歩行後に著明に' },
      { value: 5, label: '2km以下歩行後に著明に' }, { value: 0, label: '常時' }] },
    { id: 'swelling', question: '腫脹', type: 'radio', options: [
      { value: 10, label: 'なし' }, { value: 6, label: '激しい運動後のみ' },
      { value: 2, label: '普通の運動後' }, { value: 0, label: '常時' }] },
    { id: 'stairs', question: '階段昇降', type: 'radio', options: [
      { value: 10, label: '問題なし' }, { value: 6, label: '少し問題あり' },
      { value: 2, label: '1段ずつしか降りられない' }, { value: 0, label: '不可' }] },
    { id: 'squat', question: 'しゃがみ込み', type: 'radio', options: [
      { value: 5, label: '問題なし' }, { value: 4, label: '少し問題あり' },
      { value: 2, label: '90°超は不可' }, { value: 1, label: '少ししかできない' }, { value: 0, label: '不可' }] },
  ],
  thresholds: [
    { label: '優（Excellent）', min: 95, max: 100, color: 'green' },
    { label: '良（Good）', min: 84, max: 94, color: 'yellow' },
    { label: '可（Fair）', min: 65, max: 83, color: 'orange' },
    { label: '不良（Poor）', min: 0, max: 64, color: 'red' },
  ],
  calculate(a) {
    const keys = ['limp','support','locking','instability','pain','swelling','stairs','squat']
    const total = keys.reduce((s, k) => s + (a[k] ?? 0), 0)
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, interp: t.label, color: t.color }
  },
}

// ────────── IKDC ──────────
const ikdc: ScoreDef = {
  id: 'ikdc', shortName: 'IKDC', fullName: 'IKDC 主観的膝評価スコア',
  regions: ['knee'], maxScore: 100, higherIsBetter: true, unit: '点',
  reference: 'Irrgang et al. (2001) AJSM',
  items: [
    { id: 'q1', question: '痛みなしで行える最高の活動レベルはどれですか？', type: 'radio', options: [
      { value: 4, label: '非常に激しい活動（ジャンプ・急旋回：バスケ・サッカーなど）' },
      { value: 3, label: '激しい活動（重作業・スキー・テニス）' },
      { value: 2, label: '中程度の活動（ジョギング・ランニング）' },
      { value: 1, label: '軽い活動（歩行・家事）' },
      { value: 0, label: '膝の痛みで何もできない' }] },
    { id: 'q2', question: '過去4週間、どれくらいの頻度で膝に痛みがありましたか？', type: 'radio', options: [
      { value: 4, label: '全くない' }, { value: 3, label: '月に1回以下' },
      { value: 2, label: '週に1回' }, { value: 1, label: '毎日' }, { value: 0, label: '常時' }] },
    { id: 'q3', question: '痛みがある場合、どれくらい強いですか？（0=痛みなし、10=最大の痛み）', type: 'slider', min: 0, max: 10,
      hint: '0が「痛みなし」、10が「想像しうる最大の痛み」' },
    { id: 'q4', question: '過去4週間、膝のこわばりや腫脹はどの程度でしたか？', type: 'radio', options: [
      { value: 3, label: 'まったくない' }, { value: 2, label: '軽度' },
      { value: 1, label: '中程度' }, { value: 0, label: '強度' }] },
    { id: 'q5', question: '腫脹なしで行える最高の活動レベルはどれですか？', type: 'radio', options: [
      { value: 4, label: '非常に激しい活動（バスケ・サッカーなど）' },
      { value: 3, label: '激しい活動（スキー・テニス）' },
      { value: 2, label: '中程度の活動（ジョギング）' },
      { value: 1, label: '軽い活動（歩行・家事）' },
      { value: 0, label: '腫脹で何もできない' }] },
    { id: 'q6', question: '過去4週間で、膝がロック（固定）したり引っかかったりしましたか？', type: 'radio', options: [
      { value: 1, label: 'いいえ' }, { value: 0, label: 'はい' }] },
    { id: 'q7', question: '膝崩れ（ガクッとなる）なしで行える最高の活動レベルはどれですか？', type: 'radio', options: [
      { value: 4, label: '非常に激しい活動（バスケ・サッカーなど）' },
      { value: 3, label: '激しい活動（スキー・テニス）' },
      { value: 2, label: '中程度の活動（ジョギング）' },
      { value: 1, label: '軽い活動（歩行・家事）' },
      { value: 0, label: '膝崩れで何もできない' }] },
    { id: 'q8', question: '現在、日常的に参加できる最高の活動レベルはどれですか？', type: 'radio', options: [
      { value: 4, label: '非常に激しい活動（バスケ・サッカー）' },
      { value: 3, label: '激しい活動（スキー・テニス）' },
      { value: 2, label: '中程度の活動（ジョギング）' },
      { value: 1, label: '軽い活動（歩行）' },
      { value: 0, label: '膝のために何もできない' }] },
    { id: 'q9', question: '階段を上る', type: 'radio', options: [
      { value: 4, label: '問題なし' }, { value: 3, label: 'わずかに困難' },
      { value: 2, label: '中程度に困難' }, { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'q10', question: '階段を下る', type: 'radio', options: [
      { value: 4, label: '問題なし' }, { value: 3, label: 'わずかに困難' },
      { value: 2, label: '中程度に困難' }, { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'q11', question: '膝立ち・正座', type: 'radio', options: [
      { value: 4, label: '問題なし' }, { value: 3, label: 'わずかに困難' },
      { value: 2, label: '中程度に困難' }, { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'q12', question: 'しゃがみ込み', type: 'radio', options: [
      { value: 4, label: '問題なし' }, { value: 3, label: 'わずかに困難' },
      { value: 2, label: '中程度に困難' }, { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'q13', question: '椅子から立ち上がる', type: 'radio', options: [
      { value: 4, label: '問題なし' }, { value: 3, label: 'わずかに困難' },
      { value: 2, label: '中程度に困難' }, { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'q14', question: 'まっすぐ走る', type: 'radio', options: [
      { value: 4, label: '問題なし' }, { value: 3, label: 'わずかに困難' },
      { value: 2, label: '中程度に困難' }, { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'q15', question: 'ジャンプして患側で着地する', type: 'radio', options: [
      { value: 4, label: '問題なし' }, { value: 3, label: 'わずかに困難' },
      { value: 2, label: '中程度に困難' }, { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'q16', question: '急停止・急な方向転換', type: 'radio', options: [
      { value: 4, label: '問題なし' }, { value: 3, label: 'わずかに困難' },
      { value: 2, label: '中程度に困難' }, { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'q17', question: '現在の膝の機能はどの程度ですか？（0=全く機能しない、10=受傷前と同じ）', type: 'slider', min: 0, max: 10 },
  ],
  thresholds: [
    { label: '優（Excellent）', min: 85, max: 100, color: 'green' },
    { label: '良（Good）', min: 70, max: 84, color: 'yellow' },
    { label: '可（Fair）', min: 50, max: 69, color: 'orange' },
    { label: '不良（Poor）', min: 0, max: 49, color: 'red' },
  ],
  calculate(a) {
    // Q3,Q17はVAS 0-10（反転: 10→4点換算）
    const vas3 = (a['q3'] ?? 0)      // 0=no pain=best → 逆転
    const vasScore3 = ((10 - vas3) / 10) * 10  // max10
    const q17 = (a['q17'] ?? 0)
    const vasScore17 = (q17 / 10) * 10  // max10
    const radioKeys = ['q1','q2','q4','q5','q6','q7','q8','q9','q10','q11','q12','q13','q14','q15','q16']
    const maxRadio = [4,4,3,4,1,4,4,4,4,4,4,4,4,4,4].reduce((s,v)=>s+v,0) // 57
    const radioSum = radioKeys.reduce((s,k,i) => s + (a[k]??0), 0)
    const rawTotal = radioSum + vasScore3 + vasScore17
    const maxTotal = maxRadio + 10 + 10 // 77
    const total = Math.round((rawTotal / maxTotal) * 100)
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, interp: t.label, color: t.color }
  },
}

// ────────── TEGNER ──────────
const tegner: ScoreDef = {
  id: 'tegner', shortName: 'Tegner', fullName: 'Tegner活動スコア（膝）',
  regions: ['knee'], maxScore: 10, higherIsBetter: true, unit: '点',
  reference: 'Tegner & Lysholm (1985)',
  items: [
    { id: 'level', question: '現在の活動レベルを最もよく表すものを選んでください', type: 'radio', options: [
      { value: 10, label: 'レベル10：国際レベルの競技スポーツ（サッカー・バスケなど）' },
      { value: 9, label: 'レベル9：全国レベルの競技スポーツ（サッカー・バスケなど）' },
      { value: 8, label: 'レベル8：競技スポーツ（バドミントン・スカッシュ・ジュニアサッカーなど）' },
      { value: 7, label: 'レベル7：競技スポーツ（テニス・陸上・モトクロス・ハンドボール）' },
      { value: 6, label: 'レベル6：レクリエーションスポーツ（テニス・バドミントン・ハンドボール）' },
      { value: 5, label: 'レベル5：競技スポーツ（自転車・クロスカントリースキー）／重作業／競技的ラケットスポーツ' },
      { value: 4, label: 'レベル4：レクリエーションスポーツ（クロスカントリースキー）／適度な肉体労働' },
      { value: 3, label: 'レベル3：水泳、森林作業' },
      { value: 2, label: 'レベル2：平地歩行、家事' },
      { value: 1, label: 'レベル1：仕事（座り仕事）' },
      { value: 0, label: 'レベル0：傷病手当・障害年金' }] },
  ],
  thresholds: [
    { label: '競技レベル（7-10）', min: 7, max: 10, color: 'green' },
    { label: 'レクリエーション（4-6）', min: 4, max: 6, color: 'yellow' },
    { label: '軽活動（2-3）', min: 2, max: 3, color: 'orange' },
    { label: '日常生活のみ（0-1）', min: 0, max: 1, color: 'red' },
  ],
  calculate(a) {
    const total = a['level'] ?? 0
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, interp: t.label, color: t.color }
  },
}

// ────────── ASES ──────────
const ases: ScoreDef = {
  id: 'ases', shortName: 'ASES', fullName: 'ASES肩スコア（American Shoulder and Elbow Surgeons）',
  regions: ['shoulder'], maxScore: 100, higherIsBetter: true, unit: '点',
  reference: 'Richards et al. (1994)',
  items: [
    { id: 'pain', question: '肩の痛みをVASで評価してください（0=痛みなし、10=最大の痛み）', type: 'slider', min: 0, max: 10,
      hint: '過去1週間の最大の痛みを記入してください' },
    { id: 'f1', question: 'コートやセーターを着る', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f2', question: '患側を下にして寝る', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f3', question: '背中を洗う・ブラジャーを留める', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f4', question: 'トイレの後処理をする', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f5', question: '頭の後ろに手を持っていく（外旋）', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f6', question: '手を置いて棚の上に物を置く（挙上）', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f7', question: '重い物（4.5kg以上）を持ち上げる', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f8', question: '柔らかいボールを投げる（アンダースロー）', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f9', question: '通常の仕事をする', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
    { id: 'f10', question: '通常のスポーツをする', type: 'radio', options: [
      { value: 3, label: '困難なし' }, { value: 2, label: 'わずかに困難' },
      { value: 1, label: '非常に困難' }, { value: 0, label: '不可' }] },
  ],
  thresholds: [
    { label: '優（Excellent）', min: 85, max: 100, color: 'green' },
    { label: '良（Good）', min: 70, max: 84, color: 'yellow' },
    { label: '可（Fair）', min: 40, max: 69, color: 'orange' },
    { label: '不良（Poor）', min: 0, max: 39, color: 'red' },
  ],
  calculate(a) {
    const pain = a['pain'] ?? 0
    const painScore = 50 - (pain * 5)  // VAS 0→50点, 10→0点
    const funcKeys = ['f1','f2','f3','f4','f5','f6','f7','f8','f9','f10']
    const funcSum = funcKeys.reduce((s, k) => s + (a[k] ?? 0), 0)
    const funcScore = (funcSum / 30) * 50
    const total = Math.round(painScore + funcScore)
    const subscores = { 痛み: Math.round(painScore), 機能: Math.round(funcScore) }
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, subscores, interp: t.label, color: t.color }
  },
}

// ────────── CONSTANT-MURLEY ──────────
const constant: ScoreDef = {
  id: 'constant', shortName: 'Constant', fullName: 'Constant-Murleyスコア',
  regions: ['shoulder'], maxScore: 100, higherIsBetter: true, unit: '点',
  reference: 'Constant & Murley (1987)',
  items: [
    { id: 'pain', question: '安静時・労作時の肩の痛み（0=最大の痛み、15=全く痛みなし）', type: 'slider', min: 0, max: 15,
      hint: '15点満点：痛みなし=15、軽度=10、中程度=5、重度=0' },
    { id: 'adl_activity', question: '作業レベル（活動強度）', type: 'radio', options: [
      { value: 10, label: '制限なし（フルスポーツ・重労働）' },
      { value: 8, label: '肩の上まで可能' },
      { value: 6, label: '腰より上まで可能' },
      { value: 4, label: '腰まで可能' },
      { value: 2, label: '腰より下のみ可能' }] },
    { id: 'adl_sleep', question: '睡眠障害', type: 'radio', options: [
      { value: 2, label: '支障なし' }, { value: 1, label: '時々目が覚める' }, { value: 0, label: '毎晩目が覚める' }] },
    { id: 'adl_work', question: '仕事への支障（肩を使う仕事・家事）', type: 'radio', options: [
      { value: 4, label: '支障なし' }, { value: 3, label: '軽度の支障' }, { value: 2, label: '中程度の支障' },
      { value: 1, label: '高度の支障' }, { value: 0, label: '仕事不可' }] },
    { id: 'adl_recreation', question: 'レクリエーション・スポーツへの支障', type: 'radio', options: [
      { value: 4, label: '支障なし' }, { value: 3, label: '軽度の支障' }, { value: 2, label: '中程度の支障' },
      { value: 1, label: '高度の支障' }, { value: 0, label: 'スポーツ不可' }] },
    { id: 'rom_ff', question: '前方挙上（屈曲）の角度', type: 'radio', options: [
      { value: 10, label: '151°以上' }, { value: 8, label: '121〜150°' }, { value: 6, label: '91〜120°' },
      { value: 4, label: '61〜90°' }, { value: 2, label: '31〜60°' }, { value: 0, label: '30°以下' }] },
    { id: 'rom_le', question: '側方挙上（外転）の角度', type: 'radio', options: [
      { value: 10, label: '151°以上' }, { value: 8, label: '121〜150°' }, { value: 6, label: '91〜120°' },
      { value: 4, label: '61〜90°' }, { value: 2, label: '31〜60°' }, { value: 0, label: '30°以下' }] },
    { id: 'rom_er', question: '外旋の到達部位', type: 'radio', options: [
      { value: 10, label: '頭頂部より上' }, { value: 8, label: '頭頂部' }, { value: 6, label: '耳' },
      { value: 4, label: '口' }, { value: 2, label: '頸部' }, { value: 0, label: '頸部より届かない' }] },
    { id: 'rom_ir', question: '内旋の到達部位（背部）', type: 'radio', options: [
      { value: 10, label: '肩甲骨より上' }, { value: 8, label: '肩甲骨' }, { value: 6, label: '第3腰椎' },
      { value: 4, label: '仙骨' }, { value: 2, label: '臀部（股関節）' }, { value: 0, label: '臀部より届かない' }] },
    { id: 'strength', question: '外転筋力（kg）', type: 'number', min: 0, max: 25, unit: 'kg',
      hint: '最大25点。1kg = 1点。肘伸展位で外転90°保持の等尺性筋力' },
  ],
  thresholds: [
    { label: '優（Excellent）', min: 85, max: 100, color: 'green' },
    { label: '良（Good）', min: 70, max: 84, color: 'yellow' },
    { label: '可（Fair）', min: 55, max: 69, color: 'orange' },
    { label: '不良（Poor）', min: 0, max: 54, color: 'red' },
  ],
  calculate(a) {
    const pain = a['pain'] ?? 0
    const adl = (a['adl_activity']??0) + (a['adl_sleep']??0) + (a['adl_work']??0) + (a['adl_recreation']??0)
    const rom = (a['rom_ff']??0) + (a['rom_le']??0) + (a['rom_er']??0) + (a['rom_ir']??0)
    const str = Math.min(a['strength'] ?? 0, 25)
    const total = Math.min(100, pain + adl + rom + str)
    const subscores = { 痛み: pain, ADL: adl, ROM: rom, 筋力: str }
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, subscores, interp: t.label, color: t.color }
  },
}

// ────────── CAIT ──────────
const cait: ScoreDef = {
  id: 'cait', shortName: 'CAIT', fullName: 'Cumberland足関節不安定性テスト（CAIT）',
  regions: ['ankle'], maxScore: 30, higherIsBetter: true, unit: '点',
  reference: 'Hiller et al. (2006) Manual Therapy',
  items: [
    { id: 'q1', question: '足関節に痛みがある', type: 'radio', options: [
      { value: 5, label: 'まったくない' }, { value: 4, label: '激しい運動中のみ' },
      { value: 3, label: '普通の運動中' }, { value: 2, label: '日常生活動作中' },
      { value: 1, label: '歩行中' }, { value: 0, label: '安静時' }] },
    { id: 'q2', question: '足関節が不安定（ぐらつく）な感じがある', type: 'radio', options: [
      { value: 4, label: 'まったくない' }, { value: 3, label: '激しい運動中のみ（競技中）' },
      { value: 2, label: '軽い運動中（ジョギング）' }, { value: 1, label: '歩行中' }, { value: 0, label: '立位（安静）中' }] },
    { id: 'q3', question: '方向転換時に足関節がぐらつく（急な動き・方向転換）', type: 'radio', options: [
      { value: 3, label: 'まったくない' }, { value: 2, label: '時々' }, { value: 1, label: 'よく' }, { value: 0, label: '常に' }] },
    { id: 'q4', question: '階段を下るときに足関節がぐらつく', type: 'radio', options: [
      { value: 3, label: 'まったくない' }, { value: 2, label: '速足の時のみ' },
      { value: 1, label: '時々' }, { value: 0, label: '常に' }] },
    { id: 'q5', question: '片脚立ちで足関節がぐらつく', type: 'radio', options: [
      { value: 2, label: 'まったくない' }, { value: 1, label: '時々' }, { value: 0, label: '常に' }] },
    { id: 'q6', question: '凸凹な地面を歩くとき足関節がぐらつく', type: 'radio', options: [
      { value: 3, label: 'まったくない' }, { value: 2, label: '速足の時のみ' },
      { value: 1, label: '時々' }, { value: 0, label: '常に' }] },
    { id: 'q7', question: '足関節の捻挫はありますか？', type: 'radio', options: [
      { value: 4, label: 'なし' }, { value: 3, label: '1回' }, { value: 2, label: '2回' },
      { value: 1, label: '3回以上' }, { value: 0, label: '毎日のようにぐらつく' }] },
    { id: 'q8', question: '足関節の捻挫（最後の捻挫）から何日以内に通常の活動に戻れましたか？', type: 'radio', options: [
      { value: 2, label: '1日以内' }, { value: 1, label: '2〜7日' }, { value: 0, label: '1週間以上' }] },
    { id: 'q9', question: '運動・スポーツ中のサポーター・テーピングの使用', type: 'radio', options: [
      { value: 1, label: '使用せず（または使用必要なし）' }, { value: 0, label: '常に使用' }] },
  ],
  thresholds: [
    { label: '安定（Stable）', min: 28, max: 30, color: 'green' },
    { label: '軽度不安定', min: 24, max: 27, color: 'yellow' },
    { label: '慢性足関節不安定性（CAI）', min: 0, max: 23, color: 'red' },
  ],
  calculate(a) {
    const keys = ['q1','q2','q3','q4','q5','q6','q7','q8','q9']
    const total = keys.reduce((s, k) => s + (a[k] ?? 0), 0)
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, interp: `${t.label}（${total}/30点）`, color: t.color }
  },
}

// ────────── ATRS ──────────
const atrs: ScoreDef = {
  id: 'atrs', shortName: 'ATRS', fullName: 'アキレス腱断裂スコア（ATRS）',
  regions: ['ankle'], maxScore: 100, higherIsBetter: true, unit: '点',
  reference: 'Nilsson-Helander et al. (2007) Knee Surg Sports Traumatol Arthrosc',
  items: [
    { id: 'q1', question: '踵への荷重時の症状（痛み・こわばり）', type: 'slider', min: 0, max: 10,
      hint: '0＝最大の症状あり、10＝症状なし（完全）' },
    { id: 'q2', question: '運動開始時の症状', type: 'slider', min: 0, max: 10, hint: '0＝最大、10＝なし' },
    { id: 'q3', question: '運動中の症状', type: 'slider', min: 0, max: 10, hint: '0＝最大、10＝なし' },
    { id: 'q4', question: '運動後の症状', type: 'slider', min: 0, max: 10, hint: '0＝最大、10＝なし' },
    { id: 'q5', question: '平地を歩く能力の低下', type: 'slider', min: 0, max: 10, hint: '0＝全く歩けない、10＝制限なし' },
    { id: 'q6', question: '階段昇降の能力の低下', type: 'slider', min: 0, max: 10, hint: '0＝全く不可、10＝制限なし' },
    { id: 'q7', question: '走る能力の低下', type: 'slider', min: 0, max: 10, hint: '0＝全く走れない、10＝制限なし' },
    { id: 'q8', question: 'ジャンプする能力の低下', type: 'slider', min: 0, max: 10, hint: '0＝全く不可、10＝制限なし' },
    { id: 'q9', question: '肉体的な労働・スポーツの能力の低下', type: 'slider', min: 0, max: 10, hint: '0＝全く不可、10＝制限なし' },
    { id: 'q10', question: '疲労感・脱力感', type: 'slider', min: 0, max: 10, hint: '0＝最大の脱力感、10＝なし（健側と同じ）' },
  ],
  thresholds: [
    { label: '優（Excellent）', min: 90, max: 100, color: 'green' },
    { label: '良（Good）', min: 75, max: 89, color: 'yellow' },
    { label: '可（Fair）', min: 50, max: 74, color: 'orange' },
    { label: '不良（Poor）', min: 0, max: 49, color: 'red' },
  ],
  calculate(a) {
    const keys = ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10']
    const total = keys.reduce((s, k) => s + (a[k] ?? 0), 0)
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, interp: t.label, color: t.color }
  },
}

// ────────── FAAM-ADL ──────────
const faamAdl: ScoreDef = {
  id: 'faam_adl', shortName: 'FAAM-ADL', fullName: 'FAAM 日常生活サブスケール（Foot and Ankle Ability Measure）',
  regions: ['ankle'], maxScore: 100, higherIsBetter: true, unit: '%',
  reference: 'Martin et al. (2005) J Bone Joint Surg Am',
  items: [
    { id: 'f1',  question: '立つ（立位保持）', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f2',  question: '平地を歩く', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f3',  question: '裸足で平地を歩く', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f4',  question: '丘・坂道を上る', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f5',  question: '丘・坂道を下る', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f6',  question: '階段を上る', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f7',  question: '階段を下る', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f8',  question: '縁石・段差を上り下りする', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f9',  question: 'つま先立ち', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f10', question: '起立（椅子から立ち上がる）', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f11', question: '小走りする', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f12', question: 'まっすぐ走る（速歩〜ジョギング）', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f13', question: '凸凹な地面を歩く', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f14', question: '速く起き上がる・素早い移動', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f15', question: '旅行（長距離移動）', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f16', question: '家事（炊事・掃除・洗濯）', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f17', question: '日常生活での活動', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f18', question: '個人的なケア（入浴・着替え）', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f19', question: '仕事・仕事に関連した活動', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f20', question: '軽いレクリエーション・スポーツ', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
    { id: 'f21', question: '自動車の運転', type: 'radio', options: [{ value: 4, label: '困難なし' },{ value: 3, label: 'わずかに困難' },{ value: 2, label: '中程度に困難' },{ value: 1, label: '非常に困難' },{ value: 0, label: '不可' }] },
  ],
  thresholds: [
    { label: '優（Excellent）', min: 92, max: 100, color: 'green' },
    { label: '良（Good）', min: 80, max: 91, color: 'yellow' },
    { label: '可（Fair）', min: 60, max: 79, color: 'orange' },
    { label: '不良（Poor）', min: 0, max: 59, color: 'red' },
  ],
  calculate(a) {
    const keys = Array.from({length: 21}, (_, i) => `f${i+1}`)
    const answered = keys.filter(k => a[k] !== undefined)
    if (answered.length === 0) return { total: 0, interp: '未回答', color: 'red' }
    const sum = answered.reduce((s, k) => s + (a[k] ?? 0), 0)
    const total = Math.round((sum / (answered.length * 4)) * 100)
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, interp: t.label, color: t.color }
  },
}

// ────────── HARRIS HIP SCORE ──────────
const hhs: ScoreDef = {
  id: 'hhs', shortName: 'HHS', fullName: 'Harris股関節スコア（Harris Hip Score）',
  regions: ['hip'], maxScore: 100, higherIsBetter: true, unit: '点',
  reference: 'Harris (1969) J Bone Joint Surg Am',
  items: [
    { id: 'pain', question: '痛み（最も重要な項目）', type: 'radio', options: [
      { value: 44, label: '痛みなし' }, { value: 40, label: '軽微（時々、活動に支障なし）' },
      { value: 30, label: '軽度（通常の活動はできる。稀に中程度の痛み）' },
      { value: 20, label: '中程度（活動が制限される。時々強い痛み）' },
      { value: 10, label: '強い痛み（著しく活動が制限される）' },
      { value: 0,  label: '完全な機能障害（膝をかばって歩けない）' }] },
    { id: 'limp', question: '歩行：跛行', type: 'radio', options: [
      { value: 11, label: 'なし' }, { value: 8, label: '軽度' }, { value: 5, label: '中程度' }, { value: 0, label: '重度または歩行不可' }] },
    { id: 'support', question: '歩行：補助具', type: 'radio', options: [
      { value: 11, label: '不要' }, { value: 7, label: '杖（長距離のみ）' }, { value: 5, label: '杖（常時）' },
      { value: 3, label: '松葉杖（1本）' }, { value: 2, label: '松葉杖（2本）' }, { value: 0, label: '歩行不可' }] },
    { id: 'distance', question: '歩行距離', type: 'radio', options: [
      { value: 11, label: '無制限' }, { value: 8, label: '6ブロック（約500m）以上' },
      { value: 5, label: '2〜3ブロック（200m程度）' }, { value: 2, label: '室内のみ' }, { value: 0, label: '歩行不可' }] },
    { id: 'stairs', question: '階段昇降', type: 'radio', options: [
      { value: 4, label: '手すりなしで通常通り' }, { value: 2, label: '手すりを使えば通常通り' },
      { value: 1, label: '何らかの方法で可能' }, { value: 0, label: '不可' }] },
    { id: 'shoes', question: '靴・靴下の着脱', type: 'radio', options: [
      { value: 4, label: '容易にできる' }, { value: 2, label: '困難だができる' }, { value: 0, label: '不可' }] },
    { id: 'sitting', question: '座位', type: 'radio', options: [
      { value: 5, label: '1時間以上普通の椅子に楽に座れる' }, { value: 3, label: '30分は高い椅子に座れる' },
      { value: 0, label: '座位が不快' }] },
    { id: 'transport', question: '公共交通機関の利用', type: 'radio', options: [
      { value: 1, label: '可能' }, { value: 0, label: '不可' }] },
    { id: 'deformity', question: '変形（固定屈曲拘縮・外転拘縮・肢長差など）', type: 'radio', options: [
      { value: 4, label: '変形なし（または軽微）' }, { value: 0, label: '変形あり' }] },
    { id: 'rom', question: '関節可動域（総合的な評価）', type: 'radio', options: [
      { value: 5, label: 'ほぼ正常（屈曲≥110°、外転≥20°、内旋≥15°）' },
      { value: 4, label: '軽度制限（屈曲80-109°）' }, { value: 3, label: '中程度制限（屈曲60-79°）' },
      { value: 1, label: '高度制限（屈曲<60°）' }, { value: 0, label: '著しい制限' }] },
  ],
  thresholds: [
    { label: '優（Excellent）', min: 90, max: 100, color: 'green' },
    { label: '良（Good）', min: 80, max: 89, color: 'yellow' },
    { label: '可（Fair）', min: 70, max: 79, color: 'orange' },
    { label: '不良（Poor）', min: 0, max: 69, color: 'red' },
  ],
  calculate(a) {
    const keys = ['pain','limp','support','distance','stairs','shoes','sitting','transport','deformity','rom']
    const total = Math.min(100, keys.reduce((s, k) => s + (a[k] ?? 0), 0))
    const subscores = {
      痛み: a['pain'] ?? 0,
      歩行: (a['limp']??0) + (a['support']??0) + (a['distance']??0),
      ADL: (a['stairs']??0) + (a['shoes']??0) + (a['sitting']??0) + (a['transport']??0),
    }
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, subscores, interp: t.label, color: t.color }
  },
}

// ────────── HOOS Jr. ──────────
const hoosJr: ScoreDef = {
  id: 'hoos_jr', shortName: 'HOOS Jr.', fullName: 'HOOS Jr.（股関節障害・変形性股関節症 短縮版）',
  regions: ['hip'], maxScore: 100, higherIsBetter: true, unit: '点',
  reference: 'Collins et al. (2016) Clin Orthop Relat Res',
  items: [
    { id: 'q1', question: '階段を下る（降りる）', type: 'radio', options: [
      { value: 0, label: 'なし（困難なし）' }, { value: 1, label: '軽度' }, { value: 2, label: '中程度' },
      { value: 3, label: '高度' }, { value: 4, label: '非常に高度（ほぼ不可）' }],
      hint: '困難度を選んでください（0=困難なし、4=ほぼ不可）' },
    { id: 'q2', question: '股関節の痛みレベル（全体的な）', type: 'radio', options: [
      { value: 0, label: 'なし' }, { value: 1, label: '軽度' }, { value: 2, label: '中程度' },
      { value: 3, label: '高度' }, { value: 4, label: '最大の痛み' }] },
    { id: 'q3', question: 'かがんで床から物を拾う', type: 'radio', options: [
      { value: 0, label: 'なし（困難なし）' }, { value: 1, label: '軽度' }, { value: 2, label: '中程度' },
      { value: 3, label: '高度' }, { value: 4, label: '非常に高度（ほぼ不可）' }] },
    { id: 'q4', question: '平地を歩く（15分程度）', type: 'radio', options: [
      { value: 0, label: 'なし（困難なし）' }, { value: 1, label: '軽度' }, { value: 2, label: '中程度' },
      { value: 3, label: '高度' }, { value: 4, label: '非常に高度（ほぼ不可）' }] },
    { id: 'q5', question: '車の乗り降り', type: 'radio', options: [
      { value: 0, label: 'なし（困難なし）' }, { value: 1, label: '軽度' }, { value: 2, label: '中程度' },
      { value: 3, label: '高度' }, { value: 4, label: '非常に高度（ほぼ不可）' }] },
    { id: 'q6', question: '椅子から立ち上がる', type: 'radio', options: [
      { value: 0, label: 'なし（困難なし）' }, { value: 1, label: '軽度' }, { value: 2, label: '中程度' },
      { value: 3, label: '高度' }, { value: 4, label: '非常に高度（ほぼ不可）' }] },
  ],
  thresholds: [
    { label: '優（Excellent）', min: 85, max: 100, color: 'green' },
    { label: '良（Good）', min: 70, max: 84, color: 'yellow' },
    { label: '可（Fair）', min: 50, max: 69, color: 'orange' },
    { label: '不良（Poor）', min: 0, max: 49, color: 'red' },
  ],
  calculate(a) {
    const keys = ['q1','q2','q3','q4','q5','q6']
    const sum = keys.reduce((s, k) => s + (a[k] ?? 0), 0)
    const total = Math.round(100 - ((sum / 24) * 100))
    const t = this.thresholds.find(th => total >= th.min && total <= th.max)!
    return { total, interp: t.label, color: t.color }
  },
}

// ────────── ODI ──────────
const odi: ScoreDef = {
  id: 'odi', shortName: 'ODI', fullName: 'Oswestry腰痛機能障害質問票（ODI v2.1）',
  regions: ['lumbar'], maxScore: 100, higherIsBetter: false, unit: '%',
  reference: 'Fairbank et al. (1980) Physiotherapy; Revised 2000',
  items: [
    { id: 's1', question: 'Section 1：痛みの強さ', type: 'radio', options: [
      { value: 0, label: '現在、痛みはない' }, { value: 1, label: '現在、非常に軽度の痛みがある' },
      { value: 2, label: '現在、中程度の痛みがある' }, { value: 3, label: '現在、かなりひどい痛みがある' },
      { value: 4, label: '現在、非常にひどい痛みがある' }, { value: 5, label: '現在、これ以上ない最悪の痛みがある' }] },
    { id: 's2', question: 'Section 2：セルフケア（洗面・着替えなど）', type: 'radio', options: [
      { value: 0, label: '痛みなく普通にできる' }, { value: 1, label: '普通にできるが痛みを伴う' },
      { value: 2, label: 'ゆっくりで注意が必要だが介助は不要' }, { value: 3, label: '多少の介助が必要' },
      { value: 4, label: '毎日のほとんどの動作に介助が必要' }, { value: 5, label: '自分でできない、床に倒れている' }] },
    { id: 's3', question: 'Section 3：物を持つ（リフティング）', type: 'radio', options: [
      { value: 0, label: '重い物も痛みなく持てる' }, { value: 1, label: '重い物も持てるが痛みを伴う' },
      { value: 2, label: '痛みがあるが床から重い物を持てる' }, { value: 3, label: '床から痛みなく持てないが腰より上なら可' },
      { value: 4, label: '非常に軽い物しか持てない' }, { value: 5, label: '何も持てない・運べない' }] },
    { id: 's4', question: 'Section 4：歩行', type: 'radio', options: [
      { value: 0, label: '距離に関係なく歩ける（痛みなし）' }, { value: 1, label: '1km以上は歩けないが距離制限なし' },
      { value: 2, label: '500m以上は歩けない' }, { value: 3, label: '100m以上は歩けない' },
      { value: 4, label: '杖または松葉杖を使ってのみ歩ける' }, { value: 5, label: 'ほとんど床に寝ている、這って移動' }] },
    { id: 's5', question: 'Section 5：座位', type: 'radio', options: [
      { value: 0, label: '好きなだけ座れる' }, { value: 1, label: '好きな椅子なら1時間座れる' },
      { value: 2, label: '1時間以上は座れない' }, { value: 3, label: '30分以上は座れない' },
      { value: 4, label: '10分以上は座れない' }, { value: 5, label: '全く座れない' }] },
    { id: 's6', question: 'Section 6：立位', type: 'radio', options: [
      { value: 0, label: '必要なだけ立っていられる（痛みなし）' }, { value: 1, label: '必要なだけ立っていられるが痛む' },
      { value: 2, label: '1時間以上は立っていられない' }, { value: 3, label: '30分以上は立っていられない' },
      { value: 4, label: '10分以上は立っていられない' }, { value: 5, label: '全く立っていられない' }] },
    { id: 's7', question: 'Section 7：睡眠', type: 'radio', options: [
      { value: 0, label: '痛みで睡眠が妨げられることはない' }, { value: 1, label: '鎮痛薬で6時間以上眠れる' },
      { value: 2, label: '鎮痛薬で4〜6時間眠れる' }, { value: 3, label: '鎮痛薬でも4時間未満しか眠れない' },
      { value: 4, label: '鎮痛薬でも2時間未満しか眠れない' }, { value: 5, label: '全く眠れない' }] },
    { id: 's8', question: 'Section 8：社会生活（趣味・スポーツ含む）', type: 'radio', options: [
      { value: 0, label: '社会生活が通常通りで、痛みを伴わない' }, { value: 1, label: '社会生活が通常通りだが、痛みを伴う' },
      { value: 2, label: 'ほぼ社会生活ができる（エネルギーを使う活動を除く）' },
      { value: 3, label: '腰痛により社会生活に参加できない（自宅での社会参加は可）' },
      { value: 4, label: 'ほとんど家にいることが多い' }, { value: 5, label: '全く社会参加できない' }] },
    { id: 's9', question: 'Section 9：旅行', type: 'radio', options: [
      { value: 0, label: 'どこへでも痛みなく旅行できる' }, { value: 1, label: 'どこへでも行けるが痛みを伴う' },
      { value: 2, label: '痛みがあるが2時間以内の旅行なら可' }, { value: 3, label: '1時間以内の旅行に限られる' },
      { value: 4, label: '30分以内の旅行に限られる' }, { value: 5, label: '旅行できない（医療的な移動のみ）' }] },
    { id: 's10', question: 'Section 10：性生活（該当する場合）', type: 'radio', options: [
      { value: 0, label: '通常通りで痛みを伴わない' }, { value: 1, label: '通常通りだが痛みを伴う' },
      { value: 2, label: 'ほぼ通常通りだが非常に痛みを伴う' }, { value: 3, label: '痛みにより著しく制限される' },
      { value: 4, label: 'ほとんどできない' }, { value: 5, label: 'できない' }] },
  ],
  thresholds: [
    { label: '最小限の障害（0-20%）', min: 0, max: 20, color: 'green' },
    { label: '中等度の障害（21-40%）', min: 21, max: 40, color: 'yellow' },
    { label: '高度の障害（41-60%）', min: 41, max: 60, color: 'orange' },
    { label: '重度の障害（61-80%）', min: 61, max: 80, color: 'red' },
    { label: '完全な障害（81-100%）', min: 81, max: 100, color: 'red' },
  ],
  calculate(a) {
    const keys = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10']
    const answered = keys.filter(k => a[k] !== undefined)
    if (answered.length === 0) return { total: 0, interp: '未回答', color: 'red' }
    const sum = answered.reduce((s, k) => s + (a[k] ?? 0), 0)
    const total = Math.round((sum / (answered.length * 5)) * 100)
    const t = this.thresholds.find(th => total >= th.min && total <= th.max) ?? this.thresholds[this.thresholds.length-1]
    return { total, interp: t.label, color: t.color }
  },
}

// ────────── NDI ──────────
const ndi: ScoreDef = {
  id: 'ndi', shortName: 'NDI', fullName: '頚部障害指数（Neck Disability Index v2）',
  regions: ['cervical'], maxScore: 100, higherIsBetter: false, unit: '%',
  reference: 'Vernon & Mior (1991) J Manipulative Physiol Ther',
  items: [
    { id: 's1', question: 'Section 1：痛みの強さ', type: 'radio', options: [
      { value: 0, label: '現在、痛みはない' }, { value: 1, label: '現在、非常に軽度の痛みがある' },
      { value: 2, label: '現在、中程度の痛みがある' }, { value: 3, label: '現在、かなりひどい痛みがある' },
      { value: 4, label: '現在、非常にひどい痛みがある' }, { value: 5, label: '現在、これ以上ない最悪の痛みがある' }] },
    { id: 's2', question: 'Section 2：セルフケア（洗面・着替え・食事など）', type: 'radio', options: [
      { value: 0, label: '痛みなく普通にできる' }, { value: 1, label: '普通にできるが痛みを伴う' },
      { value: 2, label: 'ゆっくりで注意が必要だが介助は不要' }, { value: 3, label: '多少の介助が必要' },
      { value: 4, label: '毎日の動作のほとんどに介助が必要' }, { value: 5, label: '自分でできない' }] },
    { id: 's3', question: 'Section 3：物を持ち上げる', type: 'radio', options: [
      { value: 0, label: '重い物も痛みなく持てる' }, { value: 1, label: '重い物も持てるが痛みを伴う' },
      { value: 2, label: '痛みがあるが床から重い物を持てる' }, { value: 3, label: '中程度の重さまでしか持てない' },
      { value: 4, label: '非常に軽い物しか持てない' }, { value: 5, label: '何も持てない' }] },
    { id: 's4', question: 'Section 4：読書', type: 'radio', options: [
      { value: 0, label: '首の痛みなく好きなだけ読める' }, { value: 1, label: '首の痛みはあるが好きなだけ読める' },
      { value: 2, label: '首の痛みで1時間以上は読めない' }, { value: 3, label: '首の痛みで30分以上は読めない' },
      { value: 4, label: '首の痛みで10分以上は読めない' }, { value: 5, label: '全く読めない' }] },
    { id: 's5', question: 'Section 5：頭痛', type: 'radio', options: [
      { value: 0, label: '全く頭痛はない' }, { value: 1, label: '時々軽度の頭痛がある' },
      { value: 2, label: '時々中程度の頭痛がある' }, { value: 3, label: '頻繁に中程度の頭痛がある' },
      { value: 4, label: '頻繁にひどい頭痛がある' }, { value: 5, label: 'ほぼ常時頭痛がある' }] },
    { id: 's6', question: 'Section 6：集中力', type: 'radio', options: [
      { value: 0, label: '全く問題なく集中できる' }, { value: 1, label: '若干困難だが集中できる' },
      { value: 2, label: '集中するのがかなり困難' }, { value: 3, label: '集中するのが非常に困難' },
      { value: 4, label: '集中するのが極めて困難' }, { value: 5, label: '全く集中できない' }] },
    { id: 's7', question: 'Section 7：仕事', type: 'radio', options: [
      { value: 0, label: '必要なだけ仕事（家事）ができる' }, { value: 1, label: '普通の仕事（家事）ができるが痛む' },
      { value: 2, label: 'ほとんどの仕事ができるが体力・精力を要する活動はできない' },
      { value: 3, label: '普通の仕事（家事）を半分しかできない' }, { value: 4, label: '仕事（家事）をほとんどできない' },
      { value: 5, label: '全く仕事（家事）ができない' }] },
    { id: 's8', question: 'Section 8：運転', type: 'radio', options: [
      { value: 0, label: '首の痛みなく好きなだけ運転できる' }, { value: 1, label: '好きなだけ運転できるが痛みを伴う' },
      { value: 2, label: '首の痛みで2時間以上は運転できない' }, { value: 3, label: '首の痛みで1時間以上は運転できない' },
      { value: 4, label: '首の痛みで30分以上は運転できない' }, { value: 5, label: '全く運転できない' }] },
    { id: 's9', question: 'Section 9：睡眠', type: 'radio', options: [
      { value: 0, label: '睡眠に全く問題ない' }, { value: 1, label: '若干睡眠が妨げられる（1時間未満）' },
      { value: 2, label: '睡眠が妨げられる（1〜2時間）' }, { value: 3, label: '睡眠が妨げられる（2〜3時間）' },
      { value: 4, label: '睡眠が妨げられる（3〜5時間）' }, { value: 5, label: '睡眠が妨げられる（5〜7時間）' }] },
    { id: 's10', question: 'Section 10：レクリエーション', type: 'radio', options: [
      { value: 0, label: '全てのレクリエーション活動ができる（痛みなし）' },
      { value: 1, label: '全てのレクリエーション活動ができるが痛みを伴う' },
      { value: 2, label: 'ほとんどのレクリエーション活動ができるが少し制限あり' },
      { value: 3, label: '首の痛みで少数のレクリエーション活動しかできない' },
      { value: 4, label: '首の痛みでほとんどのレクリエーション活動ができない' },
      { value: 5, label: '全くレクリエーション活動ができない' }] },
  ],
  thresholds: [
    { label: '障害なし（0-8%）', min: 0, max: 8, color: 'green' },
    { label: '軽度の障害（10-28%）', min: 9, max: 28, color: 'yellow' },
    { label: '中等度の障害（30-48%）', min: 29, max: 48, color: 'orange' },
    { label: '高度の障害（50-64%）', min: 49, max: 64, color: 'red' },
    { label: '完全な障害（65%以上）', min: 65, max: 100, color: 'red' },
  ],
  calculate(a) {
    const keys = ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10']
    const answered = keys.filter(k => a[k] !== undefined)
    if (answered.length === 0) return { total: 0, interp: '未回答', color: 'red' }
    const sum = answered.reduce((s, k) => s + (a[k] ?? 0), 0)
    const total = Math.round((sum / (answered.length * 5)) * 100)
    const t = this.thresholds.find(th => total >= th.min && total <= th.max) ?? this.thresholds[this.thresholds.length-1]
    return { total, interp: t.label, color: t.color }
  },
}

// ────────── JOA腰椎スコア ──────────
const joaL: ScoreDef = {
  id: 'joa_l', shortName: 'JOA腰椎', fullName: 'JOA腰椎疾患治療成績判定基準（日本整形外科学会）',
  regions: ['lumbar'], maxScore: 29, higherIsBetter: true, unit: '点',
  reference: '日本整形外科学会腰痛疾患治療成績判定基準（2013改訂）',
  items: [
    { id: 'lbp', question: '①主観的症状：腰痛', type: 'radio', options: [
      { value: 3, label: '痛みなし' }, { value: 2, label: '時々軽度の痛みがある' },
      { value: 1, label: '頻繁に軽度または時々強度の痛みがある' }, { value: 0, label: '頻繁に中〜強度の痛みがある' }] },
    { id: 'leg', question: '②主観的症状：下肢痛およびしびれ', type: 'radio', options: [
      { value: 3, label: 'なし' }, { value: 2, label: '時々軽度の症状' },
      { value: 1, label: '頻繁に軽度または時々強度の症状' }, { value: 0, label: '頻繁に中〜強度の症状' }] },
    { id: 'gait', question: '③主観的症状：歩行能力', type: 'radio', options: [
      { value: 3, label: '正常（500m以上）' }, { value: 2, label: '100〜500m未満で症状出現' },
      { value: 1, label: '100m未満で症状出現（or 手すりが必要）' }, { value: 0, label: '10m以下の歩行も困難' }] },
    { id: 'slr', question: '④臨床所見：SLRテスト', type: 'radio', options: [
      { value: 2, label: '陰性（70°以上で陰性）' }, { value: 1, label: '30〜70°で陽性' }, { value: 0, label: '30°以下で陽性' }] },
    { id: 'sensory', question: '⑤臨床所見：感覚障害', type: 'radio', options: [
      { value: 2, label: 'なし' }, { value: 1, label: '軽度障害（触れるが鈍い）' }, { value: 0, label: '著明な感覚障害' }] },
    { id: 'motor', question: '⑥臨床所見：運動障害（MMT）', type: 'radio', options: [
      { value: 2, label: 'なし（MMT 5）' }, { value: 1, label: '軽度（MMT 4）' }, { value: 0, label: '著明（MMT 3以下）' }] },
    { id: 'adl1', question: '⑦ADL：寝返り（就寝・起床）', type: 'radio', options: [
      { value: 2, label: '容易にできる' }, { value: 1, label: 'できるが困難' }, { value: 0, label: '著しく困難または不可' }] },
    { id: 'adl2', question: '⑧ADL：立位・長時間の立ち仕事', type: 'radio', options: [
      { value: 2, label: '容易にできる' }, { value: 1, label: 'できるが困難' }, { value: 0, label: '著しく困難または不可' }] },
    { id: 'adl3', question: '⑨ADL：洗顔（前傾姿勢）', type: 'radio', options: [
      { value: 2, label: '容易にできる' }, { value: 1, label: 'できるが困難' }, { value: 0, label: '著しく困難または不可' }] },
    { id: 'adl4', question: '⑩ADL：前傾（物を持ち上げる）', type: 'radio', options: [
      { value: 2, label: '容易にできる' }, { value: 1, label: 'できるが困難' }, { value: 0, label: '著しく困難または不可' }] },
    { id: 'adl5', question: '⑪ADL：座位（長時間の着座）', type: 'radio', options: [
      { value: 2, label: '容易にできる' }, { value: 1, label: 'できるが困難' }, { value: 0, label: '著しく困難または不可' }] },
    { id: 'adl6', question: '⑫ADL：走る・速歩', type: 'radio', options: [
      { value: 2, label: '容易にできる' }, { value: 1, label: 'できるが困難' }, { value: 0, label: '著しく困難または不可' }] },
    { id: 'adl7', question: '⑬ADL：重い物を持ち運ぶ', type: 'radio', options: [
      { value: 2, label: '容易にできる' }, { value: 1, label: 'できるが困難' }, { value: 0, label: '著しく困難または不可' }] },
  ],
  thresholds: [
    { label: '優（25〜29点）', min: 25, max: 29, color: 'green' },
    { label: '良（20〜24点）', min: 20, max: 24, color: 'yellow' },
    { label: '可（15〜19点）', min: 15, max: 19, color: 'orange' },
    { label: '不良（14点以下）', min: 0, max: 14, color: 'red' },
  ],
  calculate(a) {
    const keys = ['lbp','leg','gait','slr','sensory','motor','adl1','adl2','adl3','adl4','adl5','adl6','adl7']
    const total = keys.reduce((s, k) => s + (a[k] ?? 0), 0)
    const subscores = {
      主観的症状: (a['lbp']??0) + (a['leg']??0) + (a['gait']??0),
      臨床所見: (a['slr']??0) + (a['sensory']??0) + (a['motor']??0),
      ADL: ['adl1','adl2','adl3','adl4','adl5','adl6','adl7'].reduce((s,k)=>s+(a[k]??0),0),
    }
    const t = this.thresholds.find(th => total >= th.min && total <= th.max) ?? this.thresholds[this.thresholds.length-1]
    return { total, subscores, interp: `${t.label}（${total}/29点）`, color: t.color }
  },
}

// ────────── DASH ──────────
const dash: ScoreDef = {
  id: 'dash', shortName: 'DASH', fullName: 'DASH上肢機能質問票（Disabilities of the Arm, Shoulder and Hand）',
  regions: ['shoulder', 'elbow', 'wrist'], maxScore: 100, higherIsBetter: false, unit: '点',
  reference: 'Hudak et al. (1996) Am J Ind Med',
  items: [
    { id: 'a1',  question: '蓋を開ける（ジャム・ペットボトルなど）', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a2',  question: '書く', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a3',  question: '鍵を回す', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a4',  question: '食事の準備（材料の下処理など）', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a5',  question: '重い扉を押し開ける', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a6',  question: '棚の上に物を置く', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a7',  question: '重い家事（床掃除・壁の掃除など）', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a8',  question: '庭仕事・作物の栽培', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a9',  question: 'ベッドメイキング', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a10', question: '買い物袋やカバンを運ぶ', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a11', question: '重い物を持ち運ぶ（4.5kg以上）', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a12', question: '頭上にある物に手を伸ばして取る', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a13', question: '投げる・投球（ボールなど）', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a14', question: '仕事（職業）での肩・腕・手の使用', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a15', question: 'スポーツや趣味（ラケット・楽器など）', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a16', question: '社交的な活動（外食・パーティーなど）', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '不可' }] },
    { id: 'a17', question: '仕事または日常生活に制限はあるか（肩・腕・手の問題で）', type: 'radio', options: [{ value: 1, label: '全く制限されていない' },{ value: 2, label: 'わずかに制限されている' },{ value: 3, label: '中程度に制限されている' },{ value: 4, label: '非常に制限されている' },{ value: 5, label: '仕事・趣味が全くできない' }] },
    { id: 'a18', question: '腕・肩・手の痛み（活動中）', type: 'radio', options: [{ value: 1, label: 'なし' },{ value: 2, label: '軽度' },{ value: 3, label: '中程度' },{ value: 4, label: '高度' },{ value: 5, label: '非常に高度' }] },
    { id: 'a19', question: '腕・肩・手の痛み（安静時）', type: 'radio', options: [{ value: 1, label: 'なし' },{ value: 2, label: '軽度' },{ value: 3, label: '中程度' },{ value: 4, label: '高度' },{ value: 5, label: '非常に高度' }] },
    { id: 'a20', question: '腕・肩・手のしびれ感', type: 'radio', options: [{ value: 1, label: 'なし' },{ value: 2, label: '軽度' },{ value: 3, label: '中程度' },{ value: 4, label: '高度' },{ value: 5, label: '非常に高度' }] },
    { id: 'a21', question: '腕・肩・手の脱力感（力が入らない）', type: 'radio', options: [{ value: 1, label: 'なし' },{ value: 2, label: '軽度' },{ value: 3, label: '中程度' },{ value: 4, label: '高度' },{ value: 5, label: '非常に高度' }] },
    { id: 'a22', question: '腕・肩・手のこわばり感', type: 'radio', options: [{ value: 1, label: 'なし' },{ value: 2, label: '軽度' },{ value: 3, label: '中程度' },{ value: 4, label: '高度' },{ value: 5, label: '非常に高度' }] },
    { id: 'a23', question: '睡眠の問題（肩・腕・手の症状が原因）', type: 'radio', options: [{ value: 1, label: '全くない' },{ value: 2, label: 'わずかにある' },{ value: 3, label: '中程度にある' },{ value: 4, label: '非常にある' },{ value: 5, label: '極めて高度にある' }] },
    { id: 'a24', question: '自分の有能さや自信の低下（肩・腕・手の問題で）', type: 'radio', options: [{ value: 1, label: '全くない' },{ value: 2, label: 'わずかにある' },{ value: 3, label: '中程度にある' },{ value: 4, label: '非常にある' },{ value: 5, label: '極めて高度にある' }] },
    { id: 'a25', question: '仕事の負担増加（症状のために仕事に時間がかかる）', type: 'radio', options: [{ value: 1, label: '全くない' },{ value: 2, label: 'わずかにある' },{ value: 3, label: '中程度にある' },{ value: 4, label: '非常にある' },{ value: 5, label: '極めて高度にある' }] },
    { id: 'a26', question: '趣味・スポーツへの参加の困難（肩・腕・手の症状で）', type: 'radio', options: [{ value: 1, label: '全くない' },{ value: 2, label: 'わずかにある' },{ value: 3, label: '中程度にある' },{ value: 4, label: '非常にある' },{ value: 5, label: '極めて高度にある' }] },
    { id: 'a27', question: '余暇活動・社交・家族との交流の困難', type: 'radio', options: [{ value: 1, label: '全くない' },{ value: 2, label: 'わずかにある' },{ value: 3, label: '中程度にある' },{ value: 4, label: '非常にある' },{ value: 5, label: '極めて高度にある' }] },
    { id: 'a28', question: '将来への懸念・心配（肩・腕・手の問題で）', type: 'radio', options: [{ value: 1, label: '全くない' },{ value: 2, label: 'わずかにある' },{ value: 3, label: '中程度にある' },{ value: 4, label: '非常にある' },{ value: 5, label: '極めて高度にある' }] },
    { id: 'a29', question: '肩・腕・手のチクチク感（ピリピリ感）', type: 'radio', options: [{ value: 1, label: 'なし' },{ value: 2, label: '軽度' },{ value: 3, label: '中程度' },{ value: 4, label: '高度' },{ value: 5, label: '非常に高度' }] },
    { id: 'a30', question: '全体的な機能評価（腕・肩・手の全般的な困難度）', type: 'radio', options: [{ value: 1, label: '困難なし' },{ value: 2, label: 'わずかに困難' },{ value: 3, label: '中程度に困難' },{ value: 4, label: '非常に困難' },{ value: 5, label: '極めて困難（ほぼ不可）' }] },
  ],
  thresholds: [
    { label: '最小限の障害（0-20）', min: 0, max: 20, color: 'green' },
    { label: '軽度の障害（21-40）', min: 21, max: 40, color: 'yellow' },
    { label: '中程度の障害（41-60）', min: 41, max: 60, color: 'orange' },
    { label: '高度の障害（61-100）', min: 61, max: 100, color: 'red' },
  ],
  calculate(a) {
    const keys = Array.from({length: 30}, (_, i) => `a${i+1}`)
    const answered = keys.filter(k => a[k] !== undefined)
    if (answered.length < 27) return { total: 0, interp: `未回答（${answered.length}/30）`, color: 'red' }
    const sum = answered.reduce((s, k) => s + (a[k] ?? 0), 0)
    const total = Math.round(((sum / answered.length) - 1) / 4 * 100)
    const t = this.thresholds.find(th => total >= th.min && total <= th.max) ?? this.thresholds[this.thresholds.length-1]
    return { total, interp: t.label, color: t.color }
  },
}

// ── エクスポート ──
export const SCORE_DEFS: Record<ScoreId, ScoreDef> = {
  lysholm, ikdc, tegner,
  ases, constant,
  cait, atrs, faam_adl: faamAdl,
  hhs, hoos_jr: hoosJr,
  odi, ndi, joa_l: joaL,
  dash,
}

export const REGION_SCORES: Record<string, ScoreId[]> = {
  knee:     ['lysholm', 'ikdc', 'tegner'],
  shoulder: ['ases', 'constant', 'dash'],
  ankle:    ['cait', 'atrs', 'faam_adl'],
  hip:      ['hhs', 'hoos_jr'],
  lumbar:   ['odi', 'joa_l'],
  cervical: ['ndi'],
  elbow:    ['dash'],
  wrist:    ['dash'],
  thoracic: [],
  other:    ['lysholm', 'ases', 'odi', 'ndi', 'dash'],
  functional: ['lysholm', 'ikdc', 'tegner', 'ases', 'cait', 'atrs', 'hhs'],
}
