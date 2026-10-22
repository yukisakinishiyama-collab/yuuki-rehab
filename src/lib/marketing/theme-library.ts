/**
 * 自動下書きのテーマ集（ゆうき整骨院・下関市彦島）
 *
 * 毎週「症状・ケガの解説」「予防・セルフケア」「院のご案内」を組み合わせて投稿案を作る。
 * - 症状系は公開サイトの症状ページ／ブログと対応させ、検索とSNSの両方から同じページへ導く
 * - 季節のテーマは months（1〜12月）に当てはまる時期だけ候補になる
 * - 患者さんの実例・症例は使わない（テーマは一般的な情報提供に限る）
 * - 「治療」ではなく「施術」、効果の保証はしない（compliance.ts と同じ方針）
 */
import type { ThemeCategory } from './autopilot-types'
import type { Objective } from './types'

export interface ThemeSeed {
  id: string
  category: Exclude<ThemeCategory, 'availability' | 'owner'>
  objective: Objective
  theme: string
  keyMessage: string
  audience: string
  /** 季節性（空なら通年） */
  months?: number[]
  /** 公開サイトの関連ページ */
  sitePath?: string
}

export const THEME_LIBRARY: ThemeSeed[] = [
  // ── 症状・ケガの解説（公開サイトの症状ページと対応） ──
  {
    id: 'acl-rehab',
    category: 'expertise',
    objective: '症例・リハビリ解説',
    theme: 'ACL（前十字靱帯）再建術のあとのリハビリの流れ',
    keyMessage: '手術のあとは段階を追ったリハビリと、競技に戻る前の確認が大切',
    audience: 'ACLのケガ・手術を経験した中高生〜社会人のスポーツ選手とご家族',
    sitePath: '/symptoms/acl',
  },
  {
    id: 'meniscus',
    category: 'expertise',
    objective: '症例・リハビリ解説',
    theme: '半月板のケガ：ひざが引っかかる・曲げると痛いとき',
    keyMessage: 'ひざの引っかかり感や腫れは早めに医療機関で確認し、状態に合わせてリハビリを進める',
    audience: 'ひざをひねった・曲げると痛いスポーツ選手、中高年の方',
    sitePath: '/symptoms/meniscus',
  },
  {
    id: 'ankle-sprain',
    category: 'expertise',
    objective: '専門性の説明',
    theme: '足首の捻挫は「くせになる」？初期対応とリハビリ',
    keyMessage: '捻挫は初期対応と、痛みが引いたあとのバランス・筋力の回復が再発予防のカギ',
    audience: '部活で足首をひねりやすい学生、保護者',
    sitePath: '/symptoms/ankle-sprain',
  },
  {
    id: 'muscle-strain',
    category: 'expertise',
    objective: '専門性の説明',
    theme: '肉離れ：復帰を急ぎすぎないために',
    keyMessage: '痛みが軽くなっても筋肉の回復は途中のことがある。段階的に負荷を戻す',
    audience: '太もも・ふくらはぎの肉離れを経験したスポーツ選手',
    sitePath: '/symptoms/muscle-strain',
  },
  {
    id: 'baseball-elbow',
    category: 'expertise',
    objective: 'スポーツ障害予防',
    theme: '野球ひじ：投げすぎのサインを見逃さない',
    keyMessage: '投げたあとのひじの痛み・伸びにくさは早めの相談を。投球数と休養も大切',
    audience: '少年野球〜高校野球の選手、保護者、指導者',
    sitePath: '/symptoms/baseball-elbow',
  },
  {
    id: 'baseball-shoulder',
    category: 'expertise',
    objective: 'スポーツ障害予防',
    theme: '野球肩：肩だけでなく体全体の使い方を見直す',
    keyMessage: '肩の痛みは股関節・体幹を含めた投球フォーム全体の評価が大切',
    audience: '野球・ソフトボール・バレーボールなど腕を振る競技の選手',
    sitePath: '/symptoms/baseball-shoulder',
  },
  {
    id: 'shin-splints',
    category: 'expertise',
    objective: 'スポーツ障害予防',
    theme: 'すねの内側が痛い（シンスプリント）と疲労骨折の違い',
    keyMessage: '同じ場所の強い痛みが続くときは疲労骨折の可能性もあるため医療機関で確認を',
    audience: '陸上・サッカー・バスケットボールなど走る競技の学生',
    sitePath: '/symptoms/shin-splints',
  },
  {
    id: 'knee-pain',
    category: 'expertise',
    objective: '新規来院',
    theme: '階段の上り下りでひざが痛いとき',
    keyMessage: 'ひざの痛みは筋力・股関節・足首の動きも含めて評価し、運動療法で負担の少ない動きを目指す',
    audience: 'ひざの痛みが気になる中高年の方、スポーツ愛好家',
    sitePath: '/symptoms/knee-pain',
  },
  {
    id: 'hip-pain',
    category: 'expertise',
    objective: '専門性の説明',
    theme: '股関節の痛み・つまり感とスポーツ',
    keyMessage: '股関節の痛みは動きのくせや筋力のバランスが関わることがある。状態に合わせて評価する',
    audience: 'サッカー・陸上などで股関節に違和感がある選手',
    sitePath: '/symptoms/hip-pain',
  },
  {
    id: 'osgood',
    category: 'expertise',
    objective: 'スポーツ障害予防',
    theme: '成長期のひざ下の痛み（オスグッド）と上手な付き合い方',
    keyMessage: '成長期の痛みは練習量の調整とストレッチ・体の使い方の見直しで、続けながら付き合える場合もある',
    audience: '小学校高学年〜中学生の選手と保護者',
    sitePath: '/symptoms/osgood',
  },
  {
    id: 'severs',
    category: 'expertise',
    objective: 'スポーツ障害予防',
    theme: '成長期のかかとの痛み（シーバー病）',
    keyMessage: '走る・跳ぶ競技をする小学生のかかとの痛みは、成長期特有のことがある。早めに相談を',
    audience: 'サッカー・バスケなどをしている小学生の保護者',
    sitePath: '/symptoms/severs',
  },
  {
    id: 'spondylolysis',
    category: 'expertise',
    objective: '専門性の説明',
    theme: '成長期の腰痛：腰をそらすと痛いときは要注意',
    keyMessage: '中高生の腰痛で、そらすと痛む・長引く場合は腰椎分離症の可能性もあるため医療機関で確認を',
    audience: '中高生のスポーツ選手と保護者',
    sitePath: '/symptoms/spondylolysis',
  },
  {
    id: 'lower-back',
    category: 'expertise',
    objective: '新規来院',
    theme: 'ぎっくり腰になったときの過ごし方',
    keyMessage: '強い痛み・しびれ・発熱などがあるときは医療機関へ。動ける範囲で少しずつ動くことが回復の助けになることも',
    audience: '急な腰の痛みに困っている働く世代',
    sitePath: '/symptoms/lower-back',
  },
  {
    id: 'wrist',
    category: 'expertise',
    objective: '専門性の説明',
    theme: '転んで手をついたあとの手首の痛み',
    keyMessage: '腫れや押したときの強い痛みが続くときは骨折の可能性もあるため、医療機関で確認を',
    audience: '転倒した学生・高齢の方とご家族',
    sitePath: '/symptoms/wrist',
  },
  {
    id: 'return-criteria',
    category: 'expertise',
    objective: '専門性の説明',
    theme: '「痛みが取れた＝復帰OK」ではない理由',
    keyMessage: '競技に戻る前に、筋力・動きの確認をしてから段階的に戻すことが再発予防につながる',
    audience: 'ケガからの競技復帰を目指す選手・指導者',
    sitePath: '/blog/return-to-sport-criteria',
  },
  {
    id: 'exercise-therapy',
    category: 'expertise',
    objective: '専門性の説明',
    theme: '安静だけでは回復しにくいことがある：運動療法の考え方',
    keyMessage: '状態に合わせて適切に動かすことが、回復と再発予防の助けになる',
    audience: 'ケガや痛みで運動を控えている方',
    sitePath: '/blog/why-exercise-therapy',
  },

  // ── 予防・セルフケア（季節に合わせる） ──
  {
    id: 'warmup-autumn',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '秋の大会シーズン：ケガを防ぐウォーミングアップ',
    keyMessage: '気温が下がる時期は体が温まるまで時間がかかる。動きながら温める準備運動を',
    audience: '部活・クラブチームの選手と指導者',
    months: [9, 10, 11],
  },
  {
    id: 'winter-cold',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '寒い朝の運動前に：冷えた体でのケガに注意',
    keyMessage: '寒い時期は準備運動を長めに。急なダッシュやジャンプは体が温まってから',
    audience: '朝練・ジョギングをする方',
    months: [12, 1, 2],
  },
  {
    id: 'year-end-cleaning',
    category: 'prevention',
    objective: '認知拡大',
    theme: '大掃除で腰を痛めないための体の使い方',
    keyMessage: '重い物はひざを曲げて体に近づけて持つ。こまめに休憩をとる',
    audience: '年末の大掃除をする方',
    months: [12],
  },
  {
    id: 'new-season',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '新学期・新しい部活が始まる前に：ケガを防ぐ準備',
    keyMessage: '練習量が急に増える時期はケガが増えやすい。少しずつ体を慣らす',
    audience: '新入部員・保護者',
    months: [3, 4, 5],
  },
  {
    id: 'summer-training',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '暑い時期の練習で気をつけたいこと',
    keyMessage: 'こまめな水分補給と休憩、疲れがたまったときの練習量の調整がケガ予防にもつながる',
    audience: '夏の部活・クラブの選手と指導者',
    months: [6, 7, 8],
  },
  {
    id: 'sports-day',
    category: 'prevention',
    objective: '認知拡大',
    theme: '運動会・体育祭の前に：大人の肉離れに注意',
    keyMessage: '久しぶりの全力疾走は肉離れの原因になりやすい。前もって軽く体を動かしておく',
    audience: '運動会に参加する保護者・社会人',
    months: [5, 9, 10],
  },
  {
    id: 'running-start',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: 'ランニングを始めた方へ：すね・ひざを痛めないコツ',
    keyMessage: '距離やペースは少しずつ増やす。痛みが続くときは無理をしない',
    audience: 'ランニング・ウォーキングを始めた方',
    months: [3, 4, 10, 11],
  },
  {
    id: 'desk-posture',
    category: 'prevention',
    objective: '認知拡大',
    theme: 'デスクワークの腰・首の負担を減らす小さな習慣',
    keyMessage: '同じ姿勢を続けないこと。30〜60分に一度立ち上がって体を動かす',
    audience: '座り仕事の多い働く世代',
  },
  {
    id: 'stretch-basics',
    category: 'prevention',
    objective: '認知拡大',
    theme: 'ストレッチは「いつ・どれくらい」がよい？',
    keyMessage: '運動前は動きながらのストレッチ、運動後や入浴後はゆっくり伸ばすストレッチを',
    audience: '運動する方・体のかたさが気になる方',
  },
  {
    id: 'rest-day',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '休むのも練習のうち：成長期の休養日の大切さ',
    keyMessage: '成長期は休養も体づくりの一部。痛みを我慢して続けない',
    audience: '成長期の選手・保護者・指導者',
  },
  {
    id: 'drills',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '競技復帰に向けたドリルの考え方',
    keyMessage: '痛みや動きを確認しながら、段階的に競技の動きへ近づけていく',
    audience: 'ケガからの復帰を目指す選手',
    sitePath: '/drills',
  },

  // 保存して見返してもらう「保存版」（フォロワーを増やす中心のテーマ）
  {
    id: 'save-ankle-balance',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '【保存版】足首の捻挫をくり返さないためのバランス練習',
    keyMessage: '片脚立ちなど自宅でできる練習を、痛みのない範囲で少しずつ。痛みや腫れがあるときは無理をしない',
    audience: '足首の捻挫をくり返している学生・スポーツ愛好家',
    sitePath: '/symptoms/ankle-sprain',
  },
  {
    id: 'save-hamstring',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '【保存版】太もも裏の肉離れを防ぐための準備運動',
    keyMessage: '練習前は動きながら体を温め、ダッシュは体が温まってから。違和感があるときは早めに相談を',
    audience: 'サッカー・陸上・野球など走る競技の選手',
    sitePath: '/symptoms/muscle-strain',
  },
  {
    id: 'save-knee-check',
    category: 'prevention',
    objective: 'スポーツ障害予防',
    theme: '【保存版】成長期のひざの痛み、家でできるセルフチェック',
    keyMessage: '押すと痛い場所・痛みが出る動きを確認し、続く痛みは早めに医療機関や専門家へ',
    audience: '小中学生の選手の保護者',
    sitePath: '/symptoms/osgood',
  },
  {
    id: 'save-desk-stretch',
    category: 'prevention',
    objective: '認知拡大',
    theme: '【保存版】座りっぱなしの腰と首をほぐす1分ストレッチ',
    keyMessage: '仕事の合間に立ち上がって体を動かす。痛みやしびれがあるときは無理をしない',
    audience: 'デスクワーク中心の働く世代',
  },

  // ── 院のご案内 ──
  {
    id: 'first-visit',
    category: 'clinic',
    objective: '新規来院',
    theme: '初めての方へ：来院の流れ',
    keyMessage: '受付・問診 → 状態の確認 → ご説明と施術のご提案 → 施術の順で進む。不安なことは何でも質問を',
    audience: '初めて整骨院に行く方',
    sitePath: '/first-visit',
  },
  {
    id: 'web-booking',
    category: 'clinic',
    objective: '予約枠案内',
    theme: 'ネット予約は24時間・その場で確定',
    keyMessage: 'スマホから空き時間を見てそのまま予約が確定する。急な強い痛みやケガはお電話のほうが早い',
    audience: '日中は電話しにくい方',
  },
  {
    id: 'price',
    category: 'clinic',
    objective: '料金案内',
    theme: '料金の目安（健康保険・自費）',
    keyMessage: '急なケガは健康保険が使える場合がある。自費の施術・リハビリの目安も事前に確認できる',
    audience: '料金が気になって来院をためらっている方',
    sitePath: '/price',
  },
  {
    id: 'access',
    category: 'clinic',
    objective: '新規来院',
    theme: 'アクセスと駐車場のご案内（彦島江の浦町）',
    keyMessage: '院の前に駐車場あり。場所はGoogleマップで確認できる',
    audience: '下関市・彦島周辺にお住まいの方',
    sitePath: '/access',
  },
  {
    id: 'faq',
    category: 'clinic',
    objective: '専門性の説明',
    theme: 'よくあるご質問にお答えします',
    keyMessage: '服装・所要時間・保険のことなど、来院前の疑問を解消する',
    audience: '来院を検討している方',
    sitePath: '/faq',
  },
  {
    id: 'medical-coop',
    category: 'clinic',
    objective: '専門性の説明',
    theme: '整形外科・医療機関との連携について',
    keyMessage: '骨折の疑いや検査が必要な場合は医療機関をご案内し、連携しながらリハビリを進める',
    audience: '病院と整骨院の違いが気になる方',
  },
  {
    id: 'line-consult',
    category: 'clinic',
    objective: '認知拡大',
    theme: '公式LINEでできること（相談の入口・ご予約）',
    keyMessage: '友だち追加すると、相談の入口から状況を伝えたり、予約へ進んだりできる',
    audience: 'まずは気軽に相談したい方',
  },
  {
    id: 'assessment',
    category: 'clinic',
    objective: '専門性の説明',
    theme: '施術の前に「動き」と「痛み」を確認する理由',
    keyMessage: '同じ痛みでも原因は人によって違う。評価に基づいて施術とセルフケアを提案する',
    audience: 'どこに行っても良くならないと感じている方',
  },
]

/** 1週間の本数ごとの系統の並び（内容が偏らないよう固定パターンで回す） */
export const CATEGORY_PATTERN: Record<number, Array<ThemeSeed['category']>> = {
  1: ['expertise'],
  2: ['expertise', 'clinic'],
  3: ['expertise', 'prevention', 'clinic'],
  4: ['expertise', 'prevention', 'expertise', 'clinic'],
  5: ['expertise', 'prevention', 'expertise', 'clinic', 'prevention'],
}
