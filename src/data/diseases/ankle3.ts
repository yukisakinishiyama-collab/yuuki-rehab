// 疾患ページ: 足関節・足部カテゴリ 3/4（下書き・医師監修前）
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

export const ANKLE_PAGES_3: DiseasePage[] = [
  // ───────────────────────────── 舟状骨疲労骨折
  {
    id: 'navicular-stress-fracture',
    category: 'ankle_foot',
    names: {
      ja: '舟状骨疲労骨折',
      en: 'Navicular Stress Fracture',
      abbreviations: [],
      synonyms: ['足舟状骨疲労骨折'],
      note: '高リスク疲労骨折（偽関節・遷延癒合を来しやすい）の代表。疑い時点で荷重中止・医師紹介。',
    },
    keywords: ['足背中央の痛み', 'スプリンター', 'ジャンプ', 'ハイリスク疲労骨折', 'N spot'],
    overview: [
      { text: '足舟状骨中央1/3（乏血行部）に生じる疲労骨折。スプリント・跳躍系選手に多く、診断遅延・偽関節化しやすい「高リスク疲労骨折」。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '足背中央の漠然とした疼痛が特徴で「捻挫」「使いすぎ」と誤認されやすい。疑い時点での荷重管理と医師紹介が予後を左右する。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '舟状骨中央1/3は血行が乏しく、内側縦アーチ頂点として圧縮・剪断負荷が集中する。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '陸上短距離・跳躍・バスケットボール等で報告が多い。診断まで数ヶ月を要する例が少なくない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '反復する蹴り出し・着地負荷。REDs・骨密度・足部形態の関与も想定される。', certainty: 'low', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '運動時の足背中央〜内側の鈍痛（休むと軽快し再開で再燃）。進行で日常歩行でも疼痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（足背中央か）', '負荷歴（スプリント・ジャンプ量）', '経過（軽快と再燃の反復）',
      '月経・栄養状態（REDs）', '疲労骨折の既往',
    ],
    physicalExam: [
      { text: '「N spot」（舟状骨背側部）の限局圧痛が特徴的所見。片脚ホップでの疼痛（疑い強ければ実施しない）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '前脛骨筋・長母趾伸筋の腱障害', distinguishing: '腱走行の圧痛・抵抗痛。' },
      { group: 'likely', name: '中足部の関節性疼痛・有痛性外脛骨', distinguishing: '部位の触診で区別。' },
      { group: 'must_not_miss', name: 'Lisfranc損傷', distinguishing: '外傷歴・足底の皮下出血。', urgency: 'early_visit' },
    ],
    redFlags: [
      { finding: 'N spotの限局圧痛＋運動時痛の反復', action: '本症を強く疑い、荷重活動を中止して医師へ（X線陰性が多くMRI/CTの判断は医師）。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線は偽陰性が多い。MRI/CTでの評価が必要（適応判断は医師）。骨折線の位置・完全性が治療方針を規定。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '不全/完全、転位の有無（CT評価・医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '非転位例では免荷ギプス等の厳格な免荷期間（施設方針による）→段階的荷重が選択されることが多い。免荷の質が予後を左右するとされる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '完全骨折・転位・遷延例でスクリュー固定等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '免荷期',
        period: '医師の指示（週単位）',
        goals: ['骨癒合環境の確保', '非荷重体力の維持'],
        allowed: ['非荷重の上肢・体幹・対側運動', '許可があれば水中（免荷）運動'],
        avoid: ['指示外の荷重・「痛くないから」の歩行'],
        criteria: ['圧痛消失＋画像評価（医師）'],
        mdCheck: '荷重再開の全判断',
      },
      {
        name: '段階的荷重・復帰期',
        period: '医師許可後（数週〜数ヶ月）',
        goals: ['荷重耐容の再獲得', '走行・跳躍の段階再開'],
        allowed: ['歩行→ジョグ→ラン→ジャンプの段階プログラム', 'カーフ・足部筋力訓練'],
        avoid: ['段階飛ばし・疼痛の無視'],
        criteria: ['各段階でN spot痛なし', '負荷後の再燃なし'],
      },
    ],
    returnCriteria: [
      { text: '画像上の癒合（医師）＋N spot圧痛消失＋段階的スプリント/ジャンプ負荷で疼痛がないこと。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '適切な免荷で癒合が期待できるが、診断遅延・不十分な免荷では偽関節・再発が多い。復帰まで数ヶ月を要する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS（N spot・活動時）', target: '症状推移', range: '0-10' },
      { name: 'FAAM Sports', target: '競技機能', range: '0-100%' },
    ],
    patientExplanation: {
      whatIs: '足の甲の中央にある「舟状骨」という骨に、走り込み・ジャンプの繰り返しでひびが入った状態です。この骨は血流が少なく治りにくいため、慎重な治療が必要なタイプの疲労骨折です。',
      dos: ['決められた免荷（体重をかけない）期間を厳密に守りましょう', 'その間も上半身や反対脚のトレーニングで体力を保てます'],
      donts: ['「痛みが引いたから」と自己判断で歩く・走ること（治りかけのひびが悪化します）'],
      seekCare: ['免荷解除後に同じ場所の痛みが戻った（すぐ相談）'],
      goal: '骨を確実にくっつけてから段階的に競技へ戻ることが、結果的に一番早い復帰につながります。',
    },
    motionCapture: [
      { movement: '復帰期ランニング・ジャンプ', purpose: '負荷集中要因の評価（許可後）', setup: '側面＋後方。', watchFor: ['過度な前足部負荷', '接地パターン'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 中足骨疲労骨折
  {
    id: 'metatarsal-stress-fracture',
    category: 'ankle_foot',
    names: {
      ja: '中足骨疲労骨折',
      en: 'Metatarsal Stress Fracture',
      abbreviations: [],
      synonyms: ['行軍骨折', 'march fracture'],
      note: '第2・3中足骨骨幹部は低リスク（保存で治りやすい）。第5中足骨近位（Jones）は高リスクで別ページ参照。',
    },
    keywords: ['足の甲の痛み', 'ランナー', '行軍骨折', '第2中足骨', '腫脹', '負荷急増'],
    overview: [
      { text: '中足骨骨幹部（第2・3が多い）の疲労骨折。ランニング・行軍等の負荷急増で生じ、比較的治癒しやすい「低リスク疲労骨折」。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '第2・3中足骨は前足部荷重の中心軸で反復負荷が集中しやすい。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: 'ランナー・新兵・ダンサー（第2中足骨基部は別途注意）に多い。REDs・骨密度低下が背景となりうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '負荷量の急増（距離・硬い路面・薄底シューズへの急な変更）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '足背前方の限局痛（運動時→進行で歩行時・安静時へ）。局所の腫脹・圧痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位・発症経過', '負荷変化（距離・路面・靴）', '月経・栄養（REDs）', '疲労骨折既往',
    ],
    physicalExam: [
      { text: '該当中足骨骨幹部の限局圧痛・軽度腫脹。前足部への軸圧・ホップで疼痛。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '中足骨頭部痛（メタタルザルジア）・Morton神経腫', distinguishing: '趾間・骨頭部の症状としびれ。' },
      { group: 'must_not_miss', name: '第2中足骨基部疲労骨折（ダンサー）', distinguishing: 'Lisfranc近傍。管理が保守的になる。医師評価。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: 'Jones骨折', distinguishing: '第5中足骨近位。高リスクで別管理。', urgency: 'early_visit' },
      { group: 'similar', name: '伸筋腱腱鞘炎', distinguishing: '腱走行の圧痛・抵抗痛。' },
    ],
    redFlags: [
      { finding: '荷重不能・夜間痛', action: '完全骨折・他疾患評価。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '初期X線は陰性が多く、2〜3週後の仮骨で判明することも。早期確定にはMRI（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '低リスク部位（骨幹部）/高リスク部位（第5近位・第2基部）の区別が管理を規定。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '低リスク例: 疼痛に応じた活動修正（硬底靴・歩行は疼痛なければ可の方針が多い）→疼痛消失後に段階的ラン再開。背景因子（REDs・靴・フォーム）の是正を並行。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '骨幹部の通常例で手術はまれ（転位例等は医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 2〜4週（症状による）',
        goals: ['疼痛のない歩行', '骨修復環境の確保'],
        allowed: ['硬底靴等での疼痛のない歩行', '自転車・水中等の低衝撃運動'],
        avoid: ['ラン・ジャンプ', '薄底での長時間歩行'],
        criteria: ['局所圧痛の消失', '日常歩行で疼痛なし'],
        mdCheck: '疼痛遷延時の画像評価',
      },
      {
        name: '段階的復帰期',
        period: '圧痛消失後',
        goals: ['走行負荷の再獲得', '再発予防'],
        allowed: ['ウォーク→ジョグ→ランの漸増（隔日から）'],
        avoid: ['距離・頻度・強度の同時増加'],
        criteria: ['各段階で疼痛なし・翌日再燃なし'],
      },
    ],
    returnCriteria: [
      { text: '局所圧痛消失＋段階的走行プログラムを疼痛なく完遂。背景因子の是正を確認。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '低リスク部位は数週〜2ヶ月程度での復帰が多い（個人差あり）。再発予防には負荷管理・栄養が重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS（局所・活動時）', target: '症状推移', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '足の甲の細い骨（中足骨）に、走る量の急な増加などでひびが入った状態です。「行軍骨折」とも呼ばれ、多くは数週間の負荷調整でしっかり治ります。',
      dos: ['痛みのない範囲の生活・自転車などで体力を保ちましょう', '靴・練習量・食事も見直すチャンスです'],
      donts: ['痛みが残るうちのランニング再開'],
      seekCare: ['歩くのもつらい・夜も痛い', '数週間しても圧痛が消えない'],
      goal: '骨の修復を待って段階的に走行へ戻り、再発しない練習計画を身につけることが目標です。',
    },
    motionCapture: [
      { movement: 'ランニング（復帰期）', purpose: '前足部負荷の評価', setup: '側面＋後方。', watchFor: ['前足部接地の過度な依存', 'ケイデンス低下'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── Jones骨折
  {
    id: 'jones-fracture',
    category: 'ankle_foot',
    names: {
      ja: 'Jones骨折',
      en: 'Jones Fracture (Proximal 5th Metatarsal)',
      abbreviations: [],
      synonyms: ['第5中足骨近位骨幹端骨折', 'ジョーンズ骨折'],
      note: '骨幹端部（zone 2/3）の骨折で、下駄骨折（結節部裂離）とは別物。偽関節・再骨折が多い高リスク骨折。',
    },
    keywords: ['第5中足骨', '足の外側', 'サッカー', 'カッティング', '偽関節', 'スクリュー'],
    overview: [
      { text: '第5中足骨近位骨幹端部の骨折/疲労骨折。血行の乏しい部位で偽関節・再骨折率が高く、サッカー等のアスリートでは手術（髄内スクリュー）が選択されることが多い。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '前駆症状（外側の違和感）を伴う疲労性の経過が多く、早期発見が重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '近位骨幹端（zone 2-3）は血行分水嶺で治癒能が低い。結節部裂離骨折（zone 1・下駄骨折）は治癒良好で管理が全く異なる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: 'サッカー・バスケットボール等のカッティング競技に多い。人工芝・スパイク形状等の関与が議論される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '前足部外側への反復負荷（切り返し・内転負荷）による疲労性が主。急性発症もある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '足部外側縁の疼痛（前駆的な違和感→急な疼痛増悪）。荷重・切り返しで増悪。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '外側の違和感の先行期間', '受傷時の状況（切り返し）', '競技・サーフェス・スパイク',
      '既往（同部位の骨折・偽関節）', '治療方針（保存/手術）と医師の指示',
    ],
    physicalExam: [
      { text: '第5中足骨近位の限局圧痛・軽度腫脹。結節部（腓骨筋腱付着）との部位鑑別を丁寧に。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '下駄骨折（結節部裂離）', distinguishing: 'より近位端。治癒良好で管理が異なる（X線で医師が判定）。' },
      { group: 'likely', name: '腓骨筋腱付着部炎', distinguishing: '抵抗下外反痛・骨圧痛なし。' },
      { group: 'similar', name: '立方骨・外側中足部の障害', distinguishing: '触診部位で区別。' },
    ],
    redFlags: [
      { finding: '第5中足骨近位の限局圧痛', action: '本骨折疑い。荷重を控えX線評価へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線で骨折線の部位（zone分類）・硬化像（慢性化）を評価（医師）。CTで癒合評価が行われることもある。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Zone分類（1: 裂離/2: Jones/3: 骨幹端疲労骨折）や骨折線の慢性度分類（医師判定）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '保存療法は免荷ギプス等で長期を要し偽関節率が課題。非アスリート・急性例で選択されることがある（医師判断）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: 'アスリートでは髄内スクリュー固定が標準的選択肢。術後は骨癒合に応じた段階的荷重・復帰（執刀医プロトコル）。再骨折予防のためインソール・復帰時期は慎重に。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期（術後/保存）',
        period: '方針による（週単位）',
        goals: ['骨癒合環境の確保', '体力維持'],
        allowed: ['指示範囲の荷重', '非荷重トレーニング'],
        avoid: ['指示外の荷重・切り返し'],
        criteria: ['画像での癒合進行（医師）'],
        mdCheck: '荷重・活動の全段階',
      },
      {
        name: '段階的復帰期',
        period: '医師許可後',
        goals: ['走行→切り返しの再獲得', '再骨折予防策の導入'],
        allowed: ['直線ラン→曲線→カッティングの段階導入', 'インソール調整'],
        avoid: ['癒合不十分での競技復帰（再骨折リスク）'],
        criteria: ['各段階で疼痛なし', '医師の復帰許可'],
      },
    ],
    returnCriteria: [
      { text: '画像上の癒合（医師）を前提に、段階的カッティング負荷で症状がないこと。再骨折が一定数報告されるため復帰後も負荷・用具の管理を継続。', certainty: 'moderate', status: 'needs_literature' },
    ],
    prognosis: [
      { text: '手術例の復帰率は高い報告が多いが、再骨折・偽関節のリスクが残る。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM Sports', target: '競技機能', range: '0-100%' },
    ],
    patientExplanation: {
      whatIs: '足の小指側の骨の付け根近くの骨折です。血流が少なく治りにくい場所のため、スポーツ選手では手術（スクリュー固定）を選ぶことが多いけがです。',
      dos: ['骨がつくまでの荷重・活動制限を厳密に守りましょう'],
      donts: ['「痛くないから」と早く切り返し練習に戻ること（再骨折の典型パターンです）'],
      seekCare: ['復帰後に同じ場所の痛みが再発（すぐ相談）'],
      goal: '確実な骨癒合と、スパイク・インソール・練習量の見直しをセットで行い、再骨折なく復帰することが目標です。',
    },
    motionCapture: [
      { movement: 'カッティング動作（復帰期）', purpose: '外側負荷の評価', setup: '後方＋正面。', watchFor: ['過度な外側荷重', '急減速時の足部位置'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── Lisfranc損傷
  {
    id: 'lisfranc-injury',
    category: 'ankle_foot',
    names: {
      ja: 'Lisfranc損傷',
      en: 'Lisfranc Injury',
      abbreviations: [],
      synonyms: ['リスフラン関節損傷', '足根中足関節損傷'],
      note: '見逃しが多く、放置で扁平足変形・慢性疼痛を残す。中足部外傷では常に念頭に置く。',
    },
    keywords: ['足の甲', '中足部', '足底の内出血', '捻挫と思ったら', 'つま先立ちできない'],
    overview: [
      { text: '足根中足関節（Lisfranc関節）の靱帯損傷〜脱臼骨折。軽微な外傷（つま先立ち位での捻り・軸圧）でも生じ、「中足部捻挫」として見逃されやすい。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '不安定例の見逃しは変形・障害を残すため、疑い例は荷重X線を含む医師評価が必須。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '第2中足骨基部と内側楔状骨を結ぶLisfranc靱帯が要石構造の中心。ここの破綻で中足部が不安定化する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '交通外傷等の高エネルギーと、スポーツでの低エネルギー損傷（アメフト・柔道・乗馬・バレエ等）がある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '底屈位での軸圧＋回旋（つま先立ちで上に乗られる・踏み込みで捻る）が典型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '中足部背側の疼痛・腫脹、足底中央の皮下出血（特徴的）、荷重・つま先立ち不能。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    interviewItems: [
      '受傷機転（軸圧・捻り）', '足底の内出血の有無', '荷重・つま先立ちの可否',
      '「捻挫」として経過していないか（遷延例）',
    ],
    physicalExam: [
      { text: '第1-2中足骨基部間の圧痛、前足部の他動回旋（愛護的）での疼痛、片脚つま先立ち不能。強いストレスは避け医師評価へ。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '中足部捻挫（安定型軽症）', distinguishing: '荷重X線で不安定性なし（判定は医師）。' },
      { group: 'must_not_miss', name: '不安定型Lisfranc（脱臼骨折）', distinguishing: '荷重X線での離開。手術対象。', urgency: 'early_visit' },
      { group: 'similar', name: '舟状骨・楔状骨骨折', distinguishing: '圧痛部位・画像で区別（医師）。' },
    ],
    redFlags: [
      { finding: '中足部外傷＋足底の皮下出血・荷重不能', action: 'Lisfranc損傷疑い。荷重X線を含む評価へ（免荷で受診）。', urgency: 'early_visit' },
      { finding: '著明な腫脹・変形・循環障害', action: '脱臼骨折・コンパートメント評価。救急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: '非荷重X線では見逃されうるため、荷重位/ストレスX線・CTが用いられる（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '安定型/不安定型、転位の程度（医師判定）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '安定型: 免荷〜保護荷重（ブーツ等）数週→段階的荷重・アーチサポート→前足部負荷（つま先立ち・蹴り出し）は後期に。方針は医師の設定に従う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '不安定型は整復固定（スクリュー/プレート）や関節固定が標準（医師判断）。術後は長期の段階的荷重管理。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '方針による（多くは6週前後の保護）',
        goals: ['関節の保護', '腫脹管理'],
        allowed: ['指示範囲の荷重（ブーツ）', '足趾・足関節の非荷重運動'],
        avoid: ['前足部への荷重・回旋', 'つま先立ち'],
        criteria: ['医師の荷重許可'],
        mdCheck: '全段階',
      },
      {
        name: '荷重・機能回復期',
        period: '許可後',
        goals: ['全荷重歩行', 'アーチ・足部筋機能の回復'],
        allowed: ['段階的荷重・インソール下の歩行練習', '足部内在筋訓練'],
        avoid: ['急な蹴り出し・ジャンプ'],
        criteria: ['歩行で疼痛なし', 'つま先立ちの段階的獲得'],
      },
      {
        name: '復帰期',
        period: '数ヶ月単位',
        goals: ['走行・競技動作の再獲得'],
        allowed: ['段階的ラン→切り返し（医師許可後）'],
        avoid: ['基準未達での復帰'],
        criteria: ['前足部負荷で疼痛なし', '医師許可'],
      },
    ],
    returnCriteria: [
      { text: '医師の安定性評価を前提に、つま先立ち・蹴り出し・切り返しの段階的負荷で疼痛がないこと。復帰は数ヶ月要することが多い。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '適切に治療された例でも中足部の違和感が残ることがあり、見逃し例は変形・慢性疼痛のリスクが高い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM / AOFAS midfoot', target: '中足部機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '足の甲の中央で、足を形作る骨同士をつなぐ大事な靱帯・関節のけがです。「ただの捻挫」に見えても放置すると足の形が崩れることがあるため、しっかりした評価と保護が必要です。',
      dos: ['決められた免荷・ブーツの期間を守りましょう', '許可後はインソールを活用しながら段階的に歩行を戻します'],
      donts: ['自己判断のつま先立ち・ジャンプ再開'],
      seekCare: ['足の裏の真ん中にあざが出ている（特徴的なサインです）', '荷重でいつまでも痛い'],
      goal: '足のアーチ構造を守りながら、蹴り出せる足を数ヶ月かけて取り戻します。',
    },
    motionCapture: [
      { movement: '蹴り出し歩行・つま先立ち（復帰期）', purpose: '前足部荷重耐容の評価', setup: '側面。', watchFor: ['蹴り出し回避', '外側荷重への逃げ'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── Freiberg病
  {
    id: 'freiberg-disease',
    category: 'ankle_foot',
    names: {
      ja: 'Freiberg病',
      en: 'Freiberg Disease (Infraction)',
      abbreviations: [],
      synonyms: ['フライバーグ病', '第2中足骨頭壊死', '第2ケーラー病'],
      note: '思春期女性の第2中足骨頭に好発する骨端症/骨壊死。早期の負荷管理が変形防止に重要。',
    },
    keywords: ['第2中足骨頭', '前足部痛', '思春期女性', 'ハイヒール', 'ダンス', '骨端症'],
    overview: [
      { text: '中足骨頭（第2が最多）の軟骨下骨の壊死・圧潰を来す骨端症。思春期の女性に好発し、前足部荷重時痛を呈する。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '第2中足骨頭は前足部荷重の集中部位で血行が脆弱。圧潰が進むと関節症性変化・変形を残す。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '10代女性に多い。ダンス・跳躍系競技・前足部荷重の多い履物と関連。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '反復する前足部荷重＋血行要因が想定される。', certainty: 'low', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '第2中足骨頭部の荷重時痛・腫脹・圧痛。つま先立ち・蹴り出しで増悪。進行で可動域制限。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '年齢・性別', '疼痛部位（第2骨頭に限局か）', '活動（ダンス・跳躍）・履物',
      '経過（進行性か）', '画像検査の有無',
    ],
    physicalExam: [
      { text: '第2中足骨頭の限局圧痛・腫脹・背側突出、MTP関節可動域制限、つま先立ちでの疼痛。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: 'Morton神経腫', distinguishing: '第3-4趾間のしびれ・絞扼痛。' },
      { group: 'likely', name: '中足骨頭部痛（メタタルザルジア）', distinguishing: 'びまん性・骨変化なし。' },
      { group: 'must_not_miss', name: '中足骨疲労骨折', distinguishing: '骨幹部の圧痛。', urgency: 'confirm_md' },
      { group: 'similar', name: 'MTP関節滑膜炎・plantar plate損傷', distinguishing: '不安定性テスト・部位で区別。' },
    ],
    redFlags: [
      { finding: '思春期の限局する骨頭部痛の持続', action: '本症を疑い早期にX線評価（医師）へ。早期の負荷管理が変形を防ぐ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線で骨頭の硬化・扁平化・圧潰を評価（初期は変化に乏しくMRIが有用なことも・医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Smillie分類等の病期分類（医師判定）。病期により保存/手術が分かれる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '早期: 前足部免荷（中足骨パッド・ロッカーソール・硬底靴）＋跳躍/つま先立ちの活動調整。症状と画像経過（医師）で段階的に復帰。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '進行例・遊離体例で骨切り・デブリドマン等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷管理期',
        period: '医師方針による（数週〜数ヶ月）',
        goals: ['骨頭部の負荷軽減', '症状の鎮静化'],
        allowed: ['インソール・靴の調整下での歩行', '前足部負荷を避けた体力維持（自転車等）'],
        avoid: ['ジャンプ・つま先立ち・ハイヒール'],
        criteria: ['荷重時痛の消失', '画像の安定（医師）'],
        mdCheck: '活動拡大の判断',
      },
      {
        name: '段階復帰期',
        period: '許可後',
        goals: ['前足部荷重の段階的再獲得'],
        allowed: ['段階的なつま先立ち→ジョグ→ジャンプ'],
        avoid: ['段階飛ばし'],
        criteria: ['各段階で疼痛なし'],
      },
    ],
    returnCriteria: [
      { text: '骨頭部の圧痛・荷重時痛消失と画像上の安定（医師）を前提に、跳躍系動作の段階復帰を確認。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '早期例は保存で良好なことが多い。圧潰進行例は関節症変化・可動域制限を残しうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS（前足部荷重時）', target: '症状推移', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '足の人差し指の付け根の骨の先端部分の血流が悪くなり、骨がつぶれかけてしまう成長期のけがです。早くから足先への負担を減らすことで、骨の形を守れます。',
      dos: ['指示された中敷き・靴を使い、足先への負担を減らしましょう'],
      donts: ['痛みをおしてのジャンプ・つま先立ち・ヒールの高い靴'],
      seekCare: ['足の付け根の痛みが数週間続く（早めの受診が将来の足を守ります）'],
      goal: '骨の形を守りながら症状を落ち着かせ、段階的にダンスやスポーツへ戻ることが目標です。',
    },
    motionCapture: [
      { movement: 'つま先立ち・ルルベ（復帰期）', purpose: '前足部荷重の質の評価', setup: '側面＋正面。', watchFor: ['第2骨頭への集中荷重', '代償的な外側荷重'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 有痛性外脛骨
  {
    id: 'accessory-navicular',
    category: 'ankle_foot',
    names: {
      ja: '有痛性外脛骨',
      en: 'Symptomatic Accessory Navicular',
      abbreviations: [],
      synonyms: ['外脛骨障害', 'os tibiale externum', 'accessory navicular syndrome'],
      note: '外脛骨自体は正常変異（無症候が多い）。症候化した場合に「有痛性」と呼ぶ。',
    },
    keywords: ['内くるぶしの下の出っ張り', '土踏まず', '成長期', '後脛骨筋', '靴が当たる'],
    overview: [
      { text: '舟状骨内側の過剰骨（外脛骨）が、後脛骨筋腱の牽引や靴の圧迫で症候化した状態。成長期のスポーツ活動者に多い。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '外脛骨の存在自体は正常変異で、多くは無症候。症状と部位の一致を確認して判断する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '外脛骨は後脛骨筋腱内・腱付着部に位置し（分類による）、腱の牽引負荷が集中しやすい。扁平足傾向と併存しやすい。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '成長期（10代前半）に症候化しやすく、捻挫を契機に発症することも多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '後脛骨筋の反復牽引・靴の圧迫・捻挫による軟骨結合部の損傷。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '舟状骨内側の骨性隆起部の圧痛・運動時痛（ラン・ジャンプ・切り返し）・靴による圧迫痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（内側隆起部に限局か）', '契機（捻挫・練習量増加）', '靴のフィット',
      '扁平足傾向・アーチの疲れやすさ', '成長期か',
    ],
    physicalExam: [
      { text: '外脛骨部の限局圧痛・隆起、抵抗下内反/カーフレイズでの疼痛、アーチ動態、後脛骨筋機能。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '後脛骨筋腱障害', distinguishing: '腱走行のびまん性圧痛。連続体として併存。' },
      { group: 'must_not_miss', name: '舟状骨疲労骨折', distinguishing: 'N spot（背側）の圧痛。見逃し重大。', urgency: 'early_visit' },
      { group: 'similar', name: '舟状骨骨折（急性）', distinguishing: '外傷歴・X線（医師）。' },
    ],
    redFlags: [
      { finding: '背側N spotの圧痛を伴う', action: '舟状骨疲労骨折の除外を優先。医師へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線で外脛骨のタイプ確認（医師）。症状との対応づけが重要（無症候の外脛骨は多い）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Veitch分類（I〜III型）。II型（軟骨結合）が症候化しやすいとされる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    conservative: [
      { text: '負荷管理＋アーチサポート（インソール）＋靴の調整（圧迫回避）＋後脛骨筋・足部内在筋の漸増強化＋カーフ柔軟性。成長期は成長に伴い軽快することも多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '難治例で摘出・Kidner法等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理期',
        period: '目安: 0〜4週',
        goals: ['局所負荷の軽減', '疼痛の鎮静化'],
        allowed: ['インソール・靴調整下の活動（疼痛許容範囲）', '等尺性の内反運動'],
        avoid: ['圧迫の強い靴・スパイク', '疼痛下のジャンプ/切り返しの反復'],
        criteria: ['局所痛の軽減'],
      },
      {
        name: '筋力・復帰期',
        period: '4週以降',
        goals: ['後脛骨筋機能の改善', '競技復帰'],
        allowed: ['漸増的な内反・カーフレイズ訓練', '段階的競技動作'],
        avoid: ['急な負荷増'],
        criteria: ['競技動作で疼痛なし'],
        mdCheck: '難治時の手術相談',
      },
    ],
    returnCriteria: [
      { text: '局所の圧痛・運動時痛なく競技動作を反復できること。インソール等の再発予防策を継続。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法で多くが管理可能。成長終了とともに軽快する例も多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS / FAAM', target: '症状・機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '土踏まずの上、内くるぶしの前下にある「余分な骨（外脛骨）」の周りが、運動や靴の圧迫で痛んでいる状態です。骨があること自体は生まれつきの個性で、悪いものではありません。',
      dos: ['中敷きで土踏まずを支え、当たらない靴を選びましょう', '土踏まずを支える筋肉のトレーニングを続けましょう'],
      donts: ['出っ張りが強く当たる靴・スパイクの我慢', '痛みをおしての跳躍・切り返し'],
      seekCare: ['足の甲の上側も押すと痛い（別の骨のけがの確認が必要）', '数ヶ月続く強い痛み'],
      goal: '成長とともに落ち着くことも多い症状です。それまで痛みをコントロールしながら競技を続けられるようにします。',
    },
    motionCapture: [
      { movement: '片脚カーフレイズ・切り返し', purpose: 'アーチ動態・内側負荷の評価', setup: '後方＋正面。', watchFor: ['過回内', 'アーチ低下', '内側への荷重集中'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
