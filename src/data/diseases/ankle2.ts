// 疾患ページ: 足関節・足部カテゴリ 2/4（下書き・医師監修前）
// 全記載に確認状態タグ付き。文献は verified:false（原文未確認）。

import type { DiseasePage } from '@/types/disease'

const draftMeta = (created = '2026-07-17') => ({
  createdAt: created,
  updatedAt: created,
  nextReviewDue: '2027-01-17',
  author: 'AI下書き（Claude）',
  supervisor: undefined,
  guidelineVersions: [],
  searchDate: undefined,
  changeLog: [`${created} AIによる初版下書き作成（全文献未確認・医師監修前）`],
})

export const ANKLE_PAGES_2: DiseasePage[] = [
  // ───────────────────────────── アキレス腱断裂
  {
    id: 'achilles-rupture',
    category: 'ankle_foot',
    names: {
      ja: 'アキレス腱断裂',
      en: 'Achilles Tendon Rupture',
      abbreviations: [],
      synonyms: ['アキレス腱完全断裂'],
      note: '保存療法（機能的装具）と手術療法があり、いずれも段階的底屈位管理が中心。選択は医師と患者の共同意思決定。',
    },
    keywords: ['断裂', 'ふくらはぎ', '蹴られた感じ', '30-50代', 'つま先立ち不能', 'Thompson'],
    overview: [
      { text: '踏み込み・ダッシュ動作でのアキレス腱の完全断裂。「後ろから蹴られた」感覚と断裂音が典型。30〜50代のレクリエーション競技者に多い。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '保存（早期機能的装具療法）と手術で再断裂率・機能成績に大きな差はないとするRCT・メタ解析があり、方針は医師・患者の共同意思決定による。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '踵骨付着部の2〜6cm近位（乏血行部）での断裂が多い。腓腹筋・ヒラメ筋の合流腱で、底屈の主動力。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中年男性のスポーツ（バドミントン・テニス・サッカー等）で多い。ステロイド・一部抗菌薬使用との関連が指摘される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '遠心性負荷（踏み込み・急な蹴り出し）での破断。背景に腱変性があることが多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '受傷時の断裂音・衝撃感、歩行可能でも蹴り出し不能、つま先立ち不能、断裂部の陥凹。疼痛は軽いこともあり「捻挫」と誤認されうる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    interviewItems: [
      '受傷機転（踏み込み・「蹴られた」感覚）', 'つま先立ちの可否', '既往（腱症状・ステロイド/キノロン使用）',
      '治療方針（保存/手術）と医師の指示（装具角度・荷重）', '職業・競技目標',
    ],
    physicalExam: [
      { text: '腹臥位での断裂部陥凹触知、Thompson test、底屈筋力。受傷直後の疑い例は底屈位固定し医師へ。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: 'Thompson test（Simmonds）',
        target: 'アキレス腱の連続性',
        method: '腹臥位・膝軽度屈曲で腓腹部を把握圧迫。',
        positive: '底屈が起こらない（断裂示唆）',
        sensitivity: '高いと報告', specificity: '高いと報告',
        caution: '部分断裂では底屈が保たれることがある。疑えば医師評価。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '腓腹筋内側頭損傷（テニスレッグ）', distinguishing: 'ふくらはぎ内側の疼痛・Thompson陰性。' },
      { group: 'must_not_miss', name: '見逃された断裂（陳旧例）', distinguishing: '「捻挫」として経過し蹴り出し不能が残存。医師へ。', urgency: 'early_visit' },
      { group: 'similar', name: 'アキレス腱部分断裂・腱症急性増悪', distinguishing: '連続性は保持。画像は医師判断。' },
    ],
    redFlags: [
      { finding: '断裂が疑われる（陥凹・Thompson陽性・つま先立ち不能）', action: '底屈位で保護し早期に整形外科へ。', urgency: 'early_visit' },
      { finding: '固定・装具期間中の下腿腫脹・把握痛', action: 'DVT疑い（本疾患で頻度が高い）。当日中に医療相談。', urgency: 'same_day' },
    ],
    imaging: [
      { text: '診断は臨床所見が中心。超音波・MRIは断端の状態評価等に用いられる（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '急性/陳旧性（受傷後期間）、完全/部分。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '早期機能的治療: 底屈位装具（ヒールウェッジ付き）での早期荷重＋段階的背屈許容が標準的。プロトコル（角度変更・荷重時期）は医師の設定に従う。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '腱の過伸張（早期の背屈ストレッチ）は再断裂・腱延長のリスクとなるため厳禁。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '縫合術（直視下/経皮）後も機能的装具での早期リハが主流。活動要求・断端条件等で選択（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期（装具）',
        period: '目安: 0〜8週（プロトコルによる）',
        goals: ['腱の保護（底屈位管理）', '装具下荷重の獲得', 'DVT予防'],
        allowed: ['装具下の荷重歩行（指示に従う）', '足趾運動・膝/股の運動'],
        avoid: ['背屈ストレッチ', '装具なし歩行', 'ウェッジの自己調整'],
        criteria: ['プロトコルに沿った角度移行（医師）'],
        mdCheck: '装具角度・荷重の全変更',
      },
      {
        name: '移行・筋力再獲得期',
        period: '目安: 8〜16週',
        goals: ['装具離脱・正常歩行', 'カーフ筋力の再構築'],
        allowed: ['両脚→片脚カーフレイズの漸増', 'エルゴメーター・バランス訓練'],
        avoid: ['急な伸張負荷・ジャンプ', '過度な背屈可動域の追求'],
        criteria: ['疼痛なく歩行', '片脚カーフレイズ回数の漸増'],
      },
      {
        name: 'ラン・復帰期',
        period: '目安: 4〜9ヶ月（個人差大）',
        goals: ['ジョグ→ラン→ジャンプの再獲得'],
        allowed: ['段階的ラン・プライオ導入（基準達成後）'],
        avoid: ['カーフ筋力不十分でのスポーツ復帰'],
        criteria: ['片脚カーフレイズの回数/高さ左右差改善', '医師の許可'],
        mdCheck: 'スポーツ復帰許可',
      },
    ],
    returnCriteria: [
      { text: '片脚カーフレイズ能力（回数・高さ）の回復を中核に、ホップ・ラン耐容・腱延長徴候がないことを確認。復帰は数ヶ月〜1年の時間軸。', certainty: 'moderate', status: 'needs_literature' },
    ],
    prognosis: [
      { text: '多くは復帰可能だが、カーフ筋力低下・腱延長による蹴り出し低下が残存しうる。DVTと再断裂が主要な合併症。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'ATRS', target: 'アキレス腱断裂後の症状・機能', range: '0-100（高いほど良好）' },
      { name: '片脚カーフレイズ回数・高さ', target: '筋腱機能', range: '回・cm（左右比）' },
    ],
    patientExplanation: {
      whatIs: 'かかとに付く体で最も太い腱（アキレス腱）が切れた状態です。手術でも装具での保存治療でも、しっかり治せることが分かっています。',
      dos: ['装具の角度・体重のかけ方の指示を正確に守りましょう（治療の生命線です）', '装具の中でできる運動・他の部位の運動は続けましょう'],
      donts: ['アキレス腱を伸ばすストレッチ（再断裂・伸びて治る原因）', '装具を外して歩くこと'],
      seekCare: ['ふくらはぎの腫れ・痛み（血栓の可能性。すぐ連絡）', '装具内での急な痛み・「また切れた」感覚'],
      goal: '腱を「正しい長さで」治すことが最重要です。その後ふくらはぎの力を数ヶ月かけて取り戻し、スポーツ復帰まで段階的に進みます。',
    },
    motionCapture: [
      { movement: '片脚カーフレイズ', purpose: '挙上高・回数の左右差評価', setup: '側面から。', watchFor: ['挙上高の左右差', '膝屈曲による代償'] },
      { movement: 'ランニング（復帰期）', purpose: '蹴り出しの評価', setup: '側面。', watchFor: ['蹴り出し弱化', 'ストライド左右差'] },
    ],
    references: [
      {
        authors: 'Ochen Y, Beks RB, van Heijl M, et al.',
        title: 'Operative treatment versus nonoperative treatment of Achilles tendon ruptures: systematic review and meta-analysis',
        source: 'BMJ', year: 2019, verified: false,
        note: '手術vs保存のメタ解析。',
      },
    ],
    protocolTemplateKey: 'achilles_conservative',
    protocolJoint: 'ankle',
    meta: draftMeta(),
  },

  // ───────────────────────────── アキレス腱障害
  {
    id: 'achilles-tendinopathy',
    category: 'ankle_foot',
    names: {
      ja: 'アキレス腱障害',
      en: 'Achilles Tendinopathy',
      abbreviations: [],
      synonyms: ['アキレス腱症', 'アキレス腱炎', 'アキレス腱周囲炎'],
      note: '実質部（付着部より2-6cm近位）と付着部で管理が異なる。病態は変性主体の「腱症」。',
    },
    keywords: ['ランナー', 'アキレス腱', '朝のこわばり', '走り始めの痛み', '腱の腫れ', 'カーフレイズ'],
    overview: [
      { text: 'アキレス腱の変性を主体とする慢性障害。ランナーに多く、朝のこわばり・走り始めの疼痛・腱の限局性肥厚が特徴。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '管理の柱は負荷管理＋漸増的な腱負荷トレーニング（遠心性/HSR）。実質部と付着部（背屈位圧縮を避ける）で処方が異なる。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '実質部型は乏血行部の変性、付着部型は踵骨付着部での圧縮・牽引複合負荷（踵骨後滑液包・Haglund変形の併存も）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中年ランナー・ジャンプ競技者に多い。負荷急増・カーフ機能低下・体重増加等が危険因子。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: 'エネルギー蓄積負荷の反復と回復不足による腱基質の変性。炎症細胞は主体でない。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '起床時・走り始めの疼痛とこわばり（動くと軽減し、負荷後に増悪）。腱の限局圧痛・紡錘状肥厚。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（実質部か踵付着部か）', '走行距離・スピード練習・坂道の変化', '朝のこわばりの程度',
      'シューズの変更', '体重変化', 'キノロン系抗菌薬・ステロイド使用歴',
    ],
    physicalExam: [
      { text: '圧痛部位の同定（実質/付着部）、腱の肥厚、片脚カーフレイズ・ホップでの疼痛再現と能力、背屈可動域、Royal London Hospital test等。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '片脚カーフレイズ/ホップ誘発',
        target: '腱への負荷再現・重症度の機能評価',
        method: '片脚カーフレイズ反復・その場ホップで疼痛と能力をみる。',
        positive: '腱部痛の再現・回数低下',
        caution: '経過指標としても使用。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '踵骨後滑液包炎・Haglund症候群', distinguishing: '付着部外側の腫脹・靴での圧痛。' },
      { group: 'must_not_miss', name: '部分断裂', distinguishing: '急な増悪・限局性陥凹。医師評価。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '（付着部痛で）脊椎関節炎', distinguishing: '両側性・炎症性背部痛・若年。医師評価。', urgency: 'confirm_md' },
      { group: 'similar', name: '足底腱膜障害', distinguishing: '踵底部の痛み。' },
    ],
    redFlags: [
      { finding: '「切れた」感覚を伴う急な増悪・蹴り出し不能', action: '断裂疑い。受診。', urgency: 'early_visit' },
      { finding: 'キノロン系抗菌薬使用中の腱痛', action: '断裂リスク。医師に相談し負荷を控える。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '超音波・MRIで肥厚・変性像が見られるが、所見と症状は乖離しうる。診断は臨床ベース（医師確定）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '実質部型/付着部型。腱症の連続病期モデルが参考。', certainty: 'moderate', status: 'needs_literature' },
    ],
    conservative: [
      { text: '第一選択: 教育＋負荷管理＋漸増負荷運動（遠心性プログラムまたはHSR）。実質部は遠心性（Alfredson等）、付着部は初期に底屈位範囲で（圧縮回避）行う。改善に3ヶ月以上を要することを共有。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '補助: ヒールリフト（付着部型）・徐々に伸張負荷へ再導入。注射・体外衝撃波は医師判断で併用されることがある。', certainty: 'low', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '長期の保存療法抵抗例でデブリドマン等が検討される（医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・等尺/導入期',
        period: '目安: 0〜4週',
        goals: ['疼痛の安定化', '負荷管理の確立'],
        allowed: ['等尺性カーフ負荷', '疼痛許容範囲の歩行/自転車'],
        avoid: ['スピード練習・坂道・ジャンプの継続', '付着部型での背屈ストレッチ'],
        criteria: ['朝のこわばり・疼痛の軽減傾向'],
      },
      {
        name: '漸増負荷期（遠心性/HSR）',
        period: '目安: 4〜12週以降',
        goals: ['腱の負荷耐容性向上', 'カーフ筋力回復'],
        allowed: ['遠心性カーフプログラム/HSR（重錘漸増）'],
        avoid: ['急なプライオ導入'],
        criteria: ['負荷中〜翌朝の疼痛が許容範囲で漸増'],
      },
      {
        name: 'エネルギー蓄積・ラン復帰期',
        period: '基準達成後',
        goals: ['ラン・ジャンプ負荷の再獲得'],
        allowed: ['段階的ラン再開→スピード/坂の再導入'],
        avoid: ['距離・強度の同時増加'],
        criteria: ['ラン後24時間の症状が許容範囲'],
      },
    ],
    returnCriteria: [
      { text: '目標走行負荷を疼痛許容範囲（翌朝含む）で達成、カーフ機能の左右差改善。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '運動療法で多くが改善するが数ヶ月を要し、再燃も多い。負荷管理の習慣化が長期予後の鍵。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'VISA-A', target: 'アキレス腱障害の重症度', range: '0-100（高いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '走る量や強度の変化でアキレス腱が変性し、痛みやこわばりが出ている状態です。「休むだけ」でも「我慢して走る」でも治りにくく、「正しい負荷で鍛える」ことが治療になります。',
      dos: ['かかと上げの筋トレ（処方どおり）を数ヶ月続けましょう', '朝のこわばり具合を毎日メモすると負荷調整に役立ちます'],
      donts: ['痛みを無視した坂道・スピード練習', '（付着部が痛い方は）アキレス腱を強く伸ばすストレッチ'],
      seekCare: ['急に「ブチッ」と来て力が入らない', '数ヶ月の運動療法でも改善しない'],
      goal: '腱の耐久性を取り戻し、目標の走行距離・競技に痛みなく戻ることです。時間はかかりますが確実な道を進みます。',
    },
    motionCapture: [
      { movement: 'ランニング', purpose: '負荷集中要因の評価', setup: '側面＋後方。', watchFor: ['オーバーストライド', '過度な背屈での接地', 'カーフの沈み込み'] },
      { movement: '片脚カーフレイズ', purpose: '機能の定量', setup: '側面。', watchFor: ['挙上高左右差', '疲労での代償'] },
    ],
    references: [
      {
        authors: 'Martin RL, Chimenti R, Cuddeford T, et al.',
        title: 'Achilles Pain, Stiffness, and Muscle Power Deficits: Midportion Achilles Tendinopathy Revision - Clinical Practice Guidelines (JOSPT)',
        source: 'J Orthop Sports Phys Ther', year: 2018, verified: false,
        note: 'JOSPT臨床実践ガイドライン。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 腓骨筋腱障害
  {
    id: 'peroneal-tendinopathy',
    category: 'ankle_foot',
    names: {
      ja: '腓骨筋腱障害',
      en: 'Peroneal Tendon Disorders',
      abbreviations: [],
      synonyms: ['腓骨筋腱炎', '腓骨筋腱脱臼・亜脱臼', '腓骨筋腱断裂'],
      note: '腱症・腱鞘炎・（亜）脱臼・断裂を含む概念。捻挫と誤認されやすい外果後方痛の鑑別。',
    },
    keywords: ['外果後方', '外くるぶしの後ろ', '弾発', '捻挫後', '腓骨筋', '外反筋力'],
    overview: [
      { text: '外果後方を走行する長・短腓骨筋腱の障害。捻挫の合併/続発として多く、「治らない外側の痛み」の重要な原因。脱臼例は弾発を伴う。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '両腱は外果後方の腓骨筋腱溝を上腓骨筋支帯に押さえられて走行。支帯損傷で（亜）脱臼が生じる。短腓骨筋腱は縦断裂の好発部位。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '足関節捻挫後・CAI例・回外足の反復負荷（ランナー・ダンサー）で見られる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '内反捻挫時の急性損傷、反復する外反筋活動による過負荷、支帯損傷後の不安定滑走。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '外果後方〜遠位の疼痛・腫脹、抵抗下外反での疼痛、脱臼例では背屈外反時の弾発・「ずれる」感覚。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（外果後方か前下方か）', '捻挫歴', '弾発・ずれ感の有無', '誘発動作',
      '練習環境（傾斜路・シューズ）',
    ],
    physicalExam: [
      { text: '腱走行の圧痛・腫脹、抵抗下外反/第1列底屈での疼痛、背屈外反の自動運動での脱臼再現（愛護的に）、カーフ/バランス機能。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '抵抗下外反テスト・脱臼誘発テスト',
        target: '腓骨筋腱の障害・不安定性',
        method: '抵抗下外反で疼痛、背屈外反の反復で腱の乗り上げを触知。',
        positive: '疼痛再現・腱の前方偏位の触知',
        caution: '脱臼誘発は愛護的に。確定・分類は画像を含め医師。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '外側靱帯損傷・CAI', distinguishing: '前下方の圧痛・不安定感主体。併存も多い。' },
      { group: 'must_not_miss', name: '腓骨筋腱断裂（縦断裂）', distinguishing: '症状遷延・筋力低下。画像評価は医師。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '外果剥離骨折・腓骨疲労骨折', distinguishing: '骨圧痛。X線評価。', urgency: 'early_visit' },
      { group: 'similar', name: '足根洞症候群', distinguishing: 'より前方深部の疼痛。' },
    ],
    redFlags: [
      { finding: '明らかな腱脱臼の反復・支帯損傷疑い', action: '手術適応評価のため医師へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '超音波（動的評価が有用・検者依存）・MRIで腱の状態・脱臼を評価（医師判断）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '腱症/腱鞘炎/断裂/（亜）脱臼（支帯損傷のgrade）。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '腱症・腱鞘炎: 負荷管理＋漸増的な外反筋強化（等尺→等張→機能）＋バランス訓練＋履物/路面の調整。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '急性脱臼の保存療法（固定）は再発率が課題とされ、活動性の高い例は手術が選択されることが多い（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '反復性脱臼・縦断裂で支帯修復・溝形成・腱縫合等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷管理・鎮静期',
        period: '目安: 0〜3週',
        goals: ['腱周囲の鎮静化'],
        allowed: ['等尺性外反・疼痛のない範囲の活動'],
        avoid: ['傾斜路ラン・不安定面での高負荷（初期）'],
        criteria: ['圧痛・腫脹の軽減'],
      },
      {
        name: '筋力・機能期',
        period: '3週以降',
        goals: ['外反筋の漸増強化', 'バランス・切り返し再獲得'],
        allowed: ['チューブ→荷重下トレーニング', 'ホップ・アジリティ段階導入'],
        avoid: ['急な負荷増'],
        criteria: ['抵抗下外反で疼痛なし', '競技動作で症状なし'],
      },
    ],
    returnCriteria: [
      { text: '抵抗下外反・切り返し・傾斜路で疼痛/弾発がないこと。脱臼例は（術後含め）医師許可を前提。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '腱症は保存で改善が期待できる。脱臼・断裂例は治療選択により経過が異なる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM', target: '機能', range: '各0-100%' },
    ],
    patientExplanation: {
      whatIs: '外くるぶしの後ろを通る「腓骨筋」の腱に負担がかかり、痛みや、時には腱が「ずれる」感覚が出る状態です。捻挫のあとに続くことがよくあります。',
      dos: ['足首を外に返す筋肉のトレーニングを段階的に行いましょう'],
      donts: ['痛み・ずれ感を我慢しての傾斜路ランニングや切り返し'],
      seekCare: ['腱がずれる感覚が繰り返す（手術相談の対象です）', '痛みが数ヶ月続く'],
      goal: '腱の通り道の安定と筋力を取り戻し、外側の痛みなくプレーできる状態を目指します。',
    },
    motionCapture: [
      { movement: 'カッティング・傾斜路歩行', purpose: '外側負荷動作の評価', setup: '後方＋正面。', watchFor: ['過回外', '接地の外側偏位'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 後脛骨筋腱機能不全
  {
    id: 'pttd',
    category: 'ankle_foot',
    names: {
      ja: '後脛骨筋腱機能不全',
      en: 'Posterior Tibial Tendon Dysfunction / PCFD',
      abbreviations: ['PTTD', 'AAFD', 'PCFD'],
      synonyms: ['成人期扁平足', '進行性扁平足変形', 'progressive collapsing foot deformity'],
      note: '近年は変形全体を指す PCFD（進行性扁平足変形）の概念で整理される。早期発見・早期介入が変形進行予防の鍵。',
    },
    keywords: ['扁平足', '内くるぶし下の痛み', '中年女性', 'アーチ低下', 'too many toes', '片脚カーフレイズ不能'],
    overview: [
      { text: '後脛骨筋腱の変性・機能不全を中心に内側縦アーチが進行性に低下する疾患。中年以降の女性に多く、内果後下方の疼痛・腫脹で始まる。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '柔軟性のある早期（変形が矯正可能な時期）に装具＋運動療法で進行を抑えることが重要。進行例は手術対象となる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '後脛骨筋は内側縦アーチの動的支持の中心。スプリング靱帯等の静的支持の破綻が加わると変形が進行する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中年以降の女性・肥満・糖尿病・高血圧等が危険因子と報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '腱の変性（乏血行部）＋反復負荷。腱機能低下→アーチ低下→さらに腱・靱帯への負荷増大という悪循環。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '内果後下方の疼痛・腫脹（初期）→アーチ低下・後足部外反の進行、進行期は外側（腓骨下）の衝突痛。片脚カーフレイズ困難。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位の変化（内側→外側は進行のサイン）', 'アーチ低下・靴の内側摩耗の自覚', '立ち仕事・体重',
      '糖尿病等の併存症', '装具使用歴',
    ],
    physicalExam: [
      { text: '後方からのアライメント（踵骨外反・too many toes sign）、片脚カーフレイズ（踵の内反出現の有無）、腱走行の圧痛・腫脹、変形の柔軟性（矯正可能か）。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '片脚ヒールレイズテスト',
        target: '後脛骨筋腱機能',
        method: '片脚でつま先立ち。踵の内反への切り替わりを観察。',
        positive: '挙上不能・踵内反の消失・内側部痛',
        caution: '早期発見に有用。疼痛でできない場合も陽性的に扱い医師評価へ。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '足根管症候群', distinguishing: '内果後方のしびれ・Tinel。' },
      { group: 'likely', name: '三角靱帯・スプリング靱帯損傷', distinguishing: '外傷歴・靱帯部の圧痛。PCFDの構成要素として併存。' },
      { group: 'must_not_miss', name: 'シャルコー関節（糖尿病）', distinguishing: '糖尿病＋急な腫脹・熱感・変形。早期に医師へ。', urgency: 'early_visit' },
      { group: 'similar', name: '変形性距舟・足根関節症', distinguishing: 'X線評価（医師）。' },
    ],
    redFlags: [
      { finding: '糖尿病患者の急な足部腫脹・熱感・変形', action: 'シャルコー関節疑い。荷重を控え早期受診。', urgency: 'early_visit' },
      { finding: '急速に進行する変形・疼痛', action: '腱断裂・靱帯破綻の評価。医師へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '荷重位X線でアライメント評価、MRI/超音波で腱の状態（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '従来のJohnson-Strom分類、近年のPCFD分類（柔軟/固定・変形要素別）。判定は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '早期（柔軟）: アーチサポート装具/インソール＋後脛骨筋の漸増強化（遠心性含む）＋カーフ柔軟性＋負荷管理・減量。装具＋運動の併用が機能改善と関連するとの報告がある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '保存抵抗例・進行例で腱移行・骨切り・関節固定等が病期に応じ選択される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・保護期',
        period: '目安: 0〜6週',
        goals: ['腱の鎮静化', '装具による支持'],
        allowed: ['装具装着下の活動', '等尺性内反運動・足趾機能訓練'],
        avoid: ['裸足での長時間活動', '疼痛を伴うカーフレイズ反復'],
        criteria: ['歩行時痛の軽減'],
      },
      {
        name: '筋力再構築期',
        period: '6週〜数ヶ月',
        goals: ['後脛骨筋・足部内在筋の強化', '片脚ヒールレイズの再獲得'],
        allowed: ['チューブ内反→荷重下訓練→ヒールレイズ漸増'],
        avoid: ['急な負荷増'],
        criteria: ['片脚ヒールレイズ可（踵内反あり）'],
        mdCheck: '進行時の手術相談',
      },
    ],
    returnCriteria: [
      { text: '疼痛なく目標活動（歩行距離・立ち仕事）を維持でき、片脚ヒールレイズ能力が改善していること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '早期介入で症状・機能の改善が期待できるが、腱変性の進行例では変形が進みうる。定期的な再評価を推奨。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM / FFI', target: '足部機能', range: '尺度による' },
      { name: '片脚ヒールレイズ回数', target: '腱機能', range: '回' },
    ],
    patientExplanation: {
      whatIs: '土踏まずを支える「後脛骨筋」のスジが弱り、内くるぶしの下が痛み、放っておくと扁平足が進むことがある状態です。早い時期のケアが将来の変形を防ぎます。',
      dos: ['インソール・装具で土踏まずを支えながら、支える筋肉を鍛えましょう', '体重管理も足への大きな助けになります'],
      donts: ['痛いのに裸足・薄い靴で長時間立ち続けること'],
      seekCare: ['痛む場所が内側から外側に移ってきた（進行のサイン）', '（糖尿病の方）急な腫れ・熱感（すぐ受診）'],
      goal: '痛みを抑え、アーチを支える力を取り戻して、変形の進行を防ぐことが目標です。',
    },
    motionCapture: [
      { movement: '後方からの歩行・片脚ヒールレイズ', purpose: '踵骨外反・アーチ動態の評価', setup: '後方から。', watchFor: ['too many toes', '踵内反の消失', 'アーチ低下'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 足底腱膜障害
  {
    id: 'plantar-fasciopathy',
    category: 'ankle_foot',
    names: {
      ja: '足底腱膜障害',
      en: 'Plantar Fasciopathy (Plantar Heel Pain)',
      abbreviations: [],
      synonyms: ['足底筋膜炎', '足底腱膜炎', 'plantar fasciitis', '踵部痛'],
      note: '病態は変性主体で「炎」は正確でないとされるが、慣用名として広く使われる。',
    },
    keywords: ['かかとの痛み', '朝の一歩目', '足の裏', 'ランナー', '立ち仕事', '踵骨棘'],
    overview: [
      { text: '踵骨内側突起部の足底腱膜付着部症。朝の一歩目・休憩後の歩き始めの踵底部痛が特徴的で、ランナー・立ち仕事・肥満者に多い。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '多くは時間経過とともに軽快するが年単位に及ぶこともあり、負荷管理＋ストレッチ＋漸増負荷で経過短縮を図る。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '足底腱膜は踵骨内側突起から足趾へ広がりアーチを支持。windlass機構により荷重・蹴り出しで張力が高まる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中年・立ち仕事・肥満・ランナーに多い。踵骨棘は無症候者にも多く原因とは限らない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '付着部への反復牽引/圧縮負荷。背屈可動域低下・カーフタイトネス・急な負荷増・BMIが危険因子と報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '起床後・休憩後の一歩目の鋭い踵底部痛（動くと軽減）、長時間立位後の増悪。踵骨内側突起の限局圧痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '朝の一歩目の痛みの有無', '立位時間・走行距離の変化', '履物', '体重変化',
      'しびれの有無（あれば神経性を考慮）', '両側性か（両側なら全身性要因も考慮）',
    ],
    physicalExam: [
      { text: '踵骨内側突起の限局圧痛、windlassテスト、背屈・カーフ柔軟性、足部アライメント、Tinel（Baxter神経鑑別）。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Windlass test',
        target: '足底腱膜',
        method: '荷重/非荷重で母趾を背屈し疼痛再現をみる。',
        positive: '踵底部痛の再現',
        caution: '感度は高くない。圧痛部位と病歴で総合判断。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: 'Baxter神経（外側足底神経第1枝）絞扼', distinguishing: '灼熱感・内側のTinel・圧痛部位がやや深部。' },
      { group: 'likely', name: '脂肪褥萎縮・踵部脂肪パッド症候群', distinguishing: '踵中央の荷重痛・高齢者。' },
      { group: 'must_not_miss', name: '踵骨疲労骨折', distinguishing: 'squeeze test陽性・活動量急増。荷重制限し医師へ。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '脊椎関節炎に伴う付着部炎', distinguishing: '若年・両側・炎症性背部痛。医師評価。', urgency: 'confirm_md' },
      { group: 'similar', name: 'S1神経根症', distinguishing: '放散痛・神経学的所見。' },
    ],
    redFlags: [
      { finding: '踵骨squeeze痛＋負荷急増歴', action: '疲労骨折除外。受診。', urgency: 'early_visit' },
      { finding: '夜間痛・安静時痛・全身症状', action: '腫瘍・感染・炎症性疾患の除外は医師判断。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '診断は臨床ベース。X線の踵骨棘は原因とは限らない。超音波で腱膜肥厚の確認が参考になる（医師判断）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '確立した分類はない。急性/慢性・機能制限で管理を段階づける。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '第一選択: 教育＋負荷管理＋足底腱膜/カーフの特異的ストレッチ＋テーピング/ヒールカップ・インソール。漸増的な高負荷筋力訓練（踵上げ＋母趾背屈位）が有効とする報告がある。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '難治例への体外衝撃波・注射は医師判断。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '手術適応は極めて限定的（長期難治例・医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理期',
        period: '目安: 0〜6週',
        goals: ['朝の一歩目痛の軽減', '負荷の適正化'],
        allowed: ['腱膜・カーフストレッチ', 'テーピング/インソール', '疼痛許容範囲の活動'],
        avoid: ['裸足・薄底での長時間活動', '急な走行距離増'],
        criteria: ['一歩目痛の軽減傾向'],
      },
      {
        name: '漸増負荷期',
        period: '6週以降',
        goals: ['腱膜の負荷耐容性向上', '活動量の回復'],
        allowed: ['高負荷カーフ/足部トレーニング', '段階的ラン再開'],
        avoid: ['負荷の急増'],
        criteria: ['目標活動で疼痛許容範囲'],
      },
    ],
    returnCriteria: [
      { text: '朝の症状消失傾向＋目標活動（立ち仕事・走行）を疼痛許容範囲で維持できること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '大半は保存療法で軽快するが、months〜年単位の経過もまれでない。体重・負荷要因の管理が再発予防に重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FFI / FAAM', target: '足部機能', range: '尺度による' },
      { name: 'NRS（朝の一歩目）', target: '特徴的症状の推移', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: 'かかとの骨に付く足裏の膜（足底腱膜）に負担がたまり、特に「朝の一歩目」が痛む状態です。多くの方が時間とともに良くなりますが、正しいケアで期間を短くできます。',
      dos: ['足裏とふくらはぎのストレッチを毎日', 'クッションの良い靴・インソールを活用', '体重管理も有効です'],
      donts: ['裸足や薄い靴での長時間立位・歩行', '走る量をいきなり増やすこと'],
      seekCare: ['かかとの骨自体を挟むと痛い（骨のけがの可能性）', '夜も痛む・しびれる'],
      goal: '朝の一歩目の痛みをなくし、立ち仕事やランニングを痛みなく続けられることが目標です。',
    },
    motionCapture: [
      { movement: '歩行・ランニング', purpose: '接地・蹴り出し負荷の評価', setup: '側面＋後方。', watchFor: ['過回内', '蹴り出しの回避', 'ストライド異常'] },
    ],
    references: [
      {
        authors: 'Koc TA, Bise CG, Neville C, et al.',
        title: 'Heel Pain - Plantar Fasciitis: Revision - Clinical Practice Guidelines (JOSPT)',
        source: 'J Orthop Sports Phys Ther', year: 2023, verified: false,
        note: 'JOSPT臨床実践ガイドライン改訂版。',
      },
    ],
    meta: draftMeta(),
  },
]
