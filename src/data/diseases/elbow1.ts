// 疾患ページ: 肘・前腕・手関節カテゴリ 1/2（下書き・医師監修前）
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

export const ELBOW_PAGES_1: DiseasePage[] = [
  // ───────────────────────────── 上腕骨外側上顆症
  {
    id: 'lateral-epicondylalgia',
    category: 'elbow_hand',
    names: {
      ja: '上腕骨外側上顆症',
      en: 'Lateral Epicondylalgia (Tennis Elbow)',
      abbreviations: [],
      synonyms: ['テニス肘', '上腕骨外側上顆炎', 'lateral epicondylitis'],
      note: '病態は短橈側手根伸筋（ECRB）付着部の腱症で炎症は主体でない。「上顆症/epicondylalgia」の呼称が推奨される傾向。',
    },
    keywords: ['肘外側', 'テニス', '物を掴むと痛い', 'タオル絞り', 'パソコン作業', '中年'],
    overview: [
      { text: '肘外側上顆（主にECRB付着部）の腱症。把持・手関節伸展の反復負荷で生じ、テニスに限らずデスクワーク・手作業者に多い。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '自然経過は比較的良好（1年前後で多くが軽快）だが、負荷管理＋運動療法で経過短縮と再発予防を図る。ステロイド注射の長期成績は劣るとの報告に留意。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: 'ECRB付着部が主病変。橈骨神経（後骨間神経）が近傍を走行し、鑑別対象となる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '40〜50代に好発。利き手側に多い。反復把持作業・ラケット競技が危険因子。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '把持時の手関節伸筋の反復収縮による付着部への過負荷。負荷急増・器具/フォーム要因が背景。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '外側上顆部の疼痛（把持・タオル絞り・ドアノブで誘発）、握力低下（疼痛性）。安静時痛は軽いことが多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '誘発動作（把持・絞り・キーボード/マウス）', '作業/練習量の変化', '道具（ラケット・工具）の変更',
      'しびれの有無（あれば神経性を考慮）', '頚部症状の有無',
    ],
    physicalExam: [
      { text: '外側上顆〜ECRB付着部の限局圧痛、抵抗下手関節伸展（Cozen）・中指伸展テストでの疼痛再現、握力（疼痛出現握力）。頚椎・神経の除外評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Cozen test / 中指伸展テスト',
        target: 'ECRB付着部',
        method: '抵抗下手関節伸展／抵抗下中指伸展。',
        positive: '外側上顆部の疼痛再現',
        caution: '橈骨トンネル症候群でも類似痛。圧痛部位（上顆かやや遠位か）で鑑別。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '橈骨トンネル症候群（後骨間神経）', distinguishing: '上顆より遠位の圧痛・夜間痛・脱力。' },
      { group: 'likely', name: '頚椎由来（C6-7）の関連痛', distinguishing: '頚部所見・しびれ分布。' },
      { group: 'similar', name: '腕橈関節の関節内病変・滑膜ひだ', distinguishing: '深部のクリック・関節裂隙の圧痛。' },
      { group: 'must_not_miss', name: '（小児）上腕骨小頭OCD', distinguishing: '成長期投手の外側痛は別評価（肘OCDページ）。', urgency: 'early_visit' },
    ],
    redFlags: [
      { finding: '安静時・夜間の進行痛、しびれ・脱力の進行', action: '神経障害・他疾患の除外は医師判断。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '診断は臨床ベース。難治例で超音波・MRI（医師判断）。画像所見と症状の乖離あり。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '確立した分類はない。疼痛強度・把持機能で段階管理。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '第一選択: 教育＋負荷管理（把持方法・道具調整）＋漸増負荷運動（等尺性→遠心性/等張性の伸筋トレーニング）。エルボーバンドの短期的併用は選択肢。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: 'ステロイド注射は短期鎮痛に優れるが長期成績・再発で劣るとの報告があり、使用は医師と相談。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    surgical: [
      { text: '長期難治例で腱付着部処置が検討される（まれ・医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・等尺期',
        period: '0〜4週',
        goals: ['疼痛の安定化', '誘発負荷の調整'],
        allowed: ['等尺性手関節伸展', '把持方法・環境調整'],
        avoid: ['痛みを伴う強把持の反復'],
        criteria: ['日常把持動作の疼痛軽減'],
      },
      {
        name: '漸増負荷期',
        period: '4〜12週',
        goals: ['伸筋群の負荷耐容性回復', '握力の回復'],
        allowed: ['遠心性/等張性の漸増トレーニング', '前腕回旋・肩甲帯の併用強化'],
        avoid: ['急な負荷増'],
        criteria: ['目標動作（作業・競技）の疼痛消失傾向'],
      },
    ],
    returnCriteria: [
      { text: '疼痛なく目標の把持・作業・競技動作が反復でき、握力左右差が改善していること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '1年以内に多くが改善するが再発もある。負荷要因の是正が再発予防の鍵。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'PRTEE', target: 'テニス肘特異的な疼痛・機能', range: '0-100（低いほど良好）' },
      { name: '疼痛出現握力', target: '機能指標', range: 'kg' },
    ],
    patientExplanation: {
      whatIs: '肘の外側の、手首を起こす筋肉の付け根が傷んで痛む状態です。テニスをしない方にも多く、握る・絞る動作で痛むのが特徴です。',
      dos: ['痛みの出にくい握り方・道具の工夫と、少しずつ強くする筋トレを続けましょう'],
      donts: ['痛みを我慢した強い握り込みの反復', '注射だけに頼ること'],
      seekCare: ['しびれ・夜間痛を伴う', '半年以上改善しない'],
      goal: '「握っても痛くない肘」を筋力と使い方の両面から取り戻します。',
    },
    motionCapture: [
      { movement: '作業動作・バックハンド', purpose: '負荷集中要因の評価', setup: '側面＋上方。', watchFor: ['手関節背屈固定での把持', '肩甲帯の使えていなさ'] },
    ],
    references: [
      {
        authors: 'Coombes BK, Bisset L, Vicenzino B',
        title: 'Management of lateral elbow tendinopathy: one size does not fit all',
        source: 'J Orthop Sports Phys Ther', year: 2015, verified: false,
        note: '管理の枠組みに関するレビュー。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 上腕骨内側上顆症
  {
    id: 'medial-epicondylalgia',
    category: 'elbow_hand',
    names: {
      ja: '上腕骨内側上顆症',
      en: 'Medial Epicondylalgia (Golfer\'s Elbow)',
      abbreviations: [],
      synonyms: ['ゴルフ肘', '上腕骨内側上顆炎'],
      note: '外側より頻度は低い。尺骨神経障害・UCL損傷（投球選手）との鑑別・併存に注意。',
    },
    keywords: ['肘内側', 'ゴルフ', '投球', '手首を曲げると痛い', '回内'],
    overview: [
      { text: '内側上顆（回内屈筋群付着部）の腱症。ゴルフ・投球・手作業の反復負荷で生じる。外側上顆症と同様の腱症管理を行う。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '円回内筋・橈側手根屈筋等の共同腱付着部。後方には尺骨神経（肘部管）、深部にはUCLが近接し鑑別が重要。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中年の反復作業者・ゴルフ/投球競技者。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '把持＋回内・手関節屈曲の反復負荷。投球ではバルガス負荷との複合。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '内側上顆部の疼痛（把持・回内・手関節屈曲で誘発）。しびれを伴う場合は尺骨神経の評価へ。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '誘発動作・練習/作業量の変化', '小指側のしびれの有無', '投球選手なら投球時痛の相',
      '道具・グリップの変更',
    ],
    physicalExam: [
      { text: '内側上顆の限局圧痛、抵抗下手関節屈曲・回内での疼痛。尺骨神経（Tinel・肘屈曲テスト）とUCL（バルガスストレス）の鑑別評価を併施。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '抵抗下手関節屈曲・回内テスト',
        target: '回内屈筋群付着部',
        method: '肘軽度屈曲位で屈曲/回内に抵抗。',
        positive: '内側上顆部の疼痛再現',
        caution: 'UCL損傷・尺骨神経障害の除外を並行して行う。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '肘部管症候群', distinguishing: '小指側しびれ・Tinel陽性。併存もある。' },
      { group: 'must_not_miss', name: 'UCL損傷（投球選手）', distinguishing: 'バルガス負荷時痛・不安定感。別管理。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '（成長期）内側上顆骨端障害・裂離', distinguishing: 'リトルリーグエルボー。X線評価。', urgency: 'early_visit' },
    ],
    redFlags: [
      { finding: '成長期投手の内側肘痛', action: '骨端障害の除外（X線・医師）。投球中止し受診。', urgency: 'early_visit' },
      { finding: '進行するしびれ・巧緻性低下', action: '尺骨神経障害評価。医師へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '臨床診断が基本。投球選手・難治例は超音波/MRI（医師判断）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '確立した分類はない。', certainty: 'low', status: 'insufficient' },
    ],
    conservative: [
      { text: '負荷管理＋漸増負荷運動（等尺→遠心性の屈筋/回内筋トレーニング）＋グリップ/フォーム調整。外側上顆症の枠組みに準ずる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '難治例でまれに手術（医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・等尺期',
        period: '0〜4週',
        goals: ['疼痛の安定化'],
        allowed: ['等尺性屈曲/回内', '環境・道具調整'],
        avoid: ['痛む把持・スイングの反復'],
        criteria: ['日常動作の疼痛軽減'],
      },
      {
        name: '漸増負荷・復帰期',
        period: '4週以降',
        goals: ['負荷耐容性の回復', 'スイング/投球の段階再開'],
        allowed: ['漸増抵抗運動', '段階的スイング/スロープログラム'],
        avoid: ['急な全力スイング・投球'],
        criteria: ['目標動作で疼痛なし'],
      },
    ],
    returnCriteria: [
      { text: '全力の把持・スイング/投球で疼痛なく、翌日再燃がないこと。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法で多くが改善。投球選手はUCL併存の見極めが経過を左右する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'PRTEE（準用）/ DASH', target: '肘・上肢機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '肘の内側の、手首を曲げる筋肉の付け根が傷んで痛む状態です。ゴルフや投球、手をよく使う仕事で起こります。',
      dos: ['負荷を調整しながら、少しずつ強くする筋トレを続けましょう'],
      donts: ['痛みをおしてのスイング・投球の継続'],
      seekCare: ['小指側のしびれを伴う', '（成長期）投げると肘の内側が痛い（骨の確認が必要）'],
      goal: '内側の痛みなくスイング・投球・作業ができる状態へ戻します。',
    },
    motionCapture: [
      { movement: 'スイング・投球動作', purpose: '内側負荷要因の評価', setup: '後方＋側面。', watchFor: ['手打ちフォーム', '体幹回旋の不足'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 肘内側側副靱帯損傷
  {
    id: 'elbow-ucl-injury',
    category: 'elbow_hand',
    names: {
      ja: '肘内側側副靱帯損傷',
      en: 'Elbow UCL Injury',
      abbreviations: ['UCL損傷', 'MCL損傷（肘）'],
      synonyms: ['内側側副靱帯損傷（肘）', '投球肘内側部障害'],
      note: '投球選手のバルガス負荷による損傷が代表。成長期は骨端・裂離が主でありX線評価が前提。',
    },
    keywords: ['野球肘', '投球', 'バルガス', 'トミージョン', '内側不安定', 'ピッチャー'],
    overview: [
      { text: '投球のバルガス負荷の反復によるUCL（前斜走線維が主）の変性・断裂。球速低下・投球時内側痛を呈し、ハイレベル投手では再建術（Tommy John手術）が知られる。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '部分損傷はリハビリ（運動連鎖の是正＋段階的投球）で復帰する例が多く、まず保存療法が試みられることが多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: 'UCL前斜走線維がバルガス制動の主体。後内側では肘頭とのインピンジ（バルガス過伸展オーバーロード）が併存しうる。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '投手に多く、球数・球速・疲労下投球が危険因子として報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: 'レイトコッキング〜加速期のバルガストルクの反復。前腕屈筋群の疲労で靱帯負荷が増すとされる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '投球時（特に加速期）の内側痛、球速・制球の低下、（進行時）明確なポップ感を伴う受傷。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛の投球相・経過', 'ポップ感の有無', '球数・登板履歴', 'しびれ（尺骨神経）',
      '成長期か（骨端評価が先）', '復帰目標（競技レベル・時期）',
    ],
    physicalExam: [
      { text: 'UCL走行部の圧痛、バルガスストレステスト（30°位）、moving valgus stress test、屈筋群・尺骨神経の評価、肩・体幹連鎖の評価。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: 'Moving valgus stress test',
        target: 'UCL',
        method: 'バルガスを維持しながら肘を屈伸し、特定角度域（シアー域）での疼痛をみる。',
        positive: '70-120°付近での内側痛再現',
        sensitivity: '高いと報告（原著）', specificity: '報告により幅',
        caution: '検者の熟練を要する。確定は画像を含め医師。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '（成長期）内側上顆骨端障害・裂離骨折', distinguishing: '骨端線閉鎖前は靱帯より骨が破綻する。X線必須。', urgency: 'early_visit' },
      { group: 'likely', name: '内側上顆症・屈筋群損傷', distinguishing: '付着部圧痛・抵抗テスト。併存も多い。' },
      { group: 'likely', name: '尺骨神経障害', distinguishing: 'しびれ・Tinel。UCL損傷に併存しうる。' },
    ],
    redFlags: [
      { finding: '成長期の内側肘痛', action: '骨端評価（X線）まで投球中止。', urgency: 'early_visit' },
      { finding: 'ポップ感を伴う急性受傷', action: '断裂評価（医師・画像）。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（骨端・骨棘）、MRI/MR造影（靱帯評価）、超音波ストレス評価（動的・検者依存）。判定は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '部分/完全、部位（近位/遠位）。復帰予測との関連が研究される（医師評価）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '第一段階: ノースロー＋屈筋群/前腕の強化＋肩甲帯・下肢体幹連鎖の是正＋フォーム/球数の見直し→段階的投球プログラム。部分損傷の復帰報告は比較的良好。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '完全断裂・保存無効のハイレベル投手でUCL再建/修復＋補強が検討される（医師判断）。術後復帰は年単位。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: 'ノースロー・基礎期',
        period: '目安: 4〜6週（重症度による）',
        goals: ['内側痛の消失', '前腕・肩甲帯・連鎖機能の強化'],
        allowed: ['投球以外の全身/前腕トレーニング'],
        avoid: ['投球・強いバルガス負荷'],
        criteria: ['圧痛・バルガス痛の消失'],
        mdCheck: '（成長期・急性例）画像評価',
      },
      {
        name: '段階的投球期',
        period: '基準達成後（数週〜数ヶ月）',
        goals: ['距離・強度の段階回復'],
        allowed: ['インターバルスローイング', 'フォーム修正'],
        avoid: ['段階飛ばし・疲労下投球'],
        criteria: ['各段階で疼痛なし'],
      },
      {
        name: '実戦復帰期',
        period: 'プログラム完遂後',
        goals: ['実戦強度・球数への復帰'],
        allowed: ['ブルペン→実戦'],
        avoid: ['連投・急な球数増'],
        criteria: ['実戦で疼痛なし・パフォーマンス回復'],
        mdCheck: '保存無効時の手術相談',
      },
    ],
    returnCriteria: [
      { text: '段階的投球プログラムの無症状完遂＋球速/制球の回復。再建術後は執刀医のプロトコル（年単位）に従う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '部分損傷の保存復帰は多いが、完全断裂のハイレベル投手は手術選択が多い。再建後の復帰率は高い報告があるが期間を要する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KJOC score', target: '投球肩肘機能', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '投球で肘の内側を支える靱帯に負担が蓄積し、傷んだ状態です。程度によって、リハビリで戻れる場合と手術（いわゆるトミージョン手術）を検討する場合があります。',
      dos: ['投球を一旦止めて、前腕・肩甲骨・下半身を含む「肘に優しい投げ方」の土台を作りましょう'],
      donts: ['痛みをおしての投球継続（損傷を進めます）'],
      seekCare: ['「ブチッ」という感覚があった', '（成長期）内側が痛い（骨のチェックが先です）'],
      goal: '段階的投球プログラムで復帰を目指し、難しい場合は手術も含めて専門医と最適な道を選びます。',
    },
    motionCapture: [
      { movement: '投球動作', purpose: 'バルガス負荷要因の評価', setup: '後方＋側面（高速推奨）。', watchFor: ['肘下がり', '体幹の早期開き', 'リリース時の肘位置'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 離断性骨軟骨炎（肘）
  {
    id: 'elbow-ocd',
    category: 'elbow_hand',
    names: {
      ja: '離断性骨軟骨炎（肘）',
      en: 'Osteochondritis Dissecans of the Capitellum',
      abbreviations: ['肘OCD'],
      synonyms: ['上腕骨小頭離断性骨軟骨炎', '野球肘（外側型）'],
      note: '成長期投手・体操選手の外側肘痛で必ず除外すべき疾患。早期発見で保存治癒が期待でき、進行例は障害を残しうる。',
    },
    keywords: ['野球肘', '外側型', '上腕骨小頭', '成長期', '体操', '検診'],
    overview: [
      { text: '上腕骨小頭の軟骨下骨の血流障害により骨軟骨片が分離しうる疾患。成長期の投球・体操の圧迫負荷で生じ、外側型野球肘の中核。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '初期は無症状〜軽微な症状で進行しうるため、野球肘検診（超音波）での早期発見が推奨される。疑い時点で投球中止・医師紹介。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '投球加速期の橈骨頭-小頭間の圧迫・剪断負荷が病変部に集中する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '10代前半の投手・捕手・体操選手に多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '反復圧迫負荷＋成長期の血行脆弱性が想定される。', certainty: 'low', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '投球時の外側肘痛・伸展制限・引っかかり。初期は投球後の違和感のみのことも。進行でロッキング（遊離体）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '年齢・競技・ポジション', '疼痛/違和感の経過', '伸展制限の自覚', '検診受診歴',
      '画像評価の有無と病期の説明',
    ],
    physicalExam: [
      { text: '小頭部（外側やや前方・屈曲位で触知）の圧痛、伸展制限、回内外での疼痛。疑えば負荷テストは避け画像へ。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: 'パンナー病（より低年齢）', distinguishing: '10歳未満の小頭骨端症。予後良好とされる（医師評価）。' },
      { group: 'likely', name: '滑膜ひだ障害・橈骨頭病変', distinguishing: '画像・鏡視で区別（医師）。' },
      { group: 'similar', name: '外側上顆症', distinguishing: '成人・付着部圧痛。成長期の外側痛はまずOCD除外。' },
    ],
    redFlags: [
      { finding: '成長期投手・体操選手の外側肘痛/伸展制限', action: '投球・荷重系練習を中止し、X線/超音波評価（医師）へ。', urgency: 'early_visit' },
      { finding: 'ロッキング', action: '遊離体の可能性。早期受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（45°屈曲位撮影等）・超音波（検診）・MRI/CTで病期・安定性を評価（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '病期（透亮期/分離期/遊離体期）と安定性で保存/手術が分かれる（医師判定）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '初期・安定病変: 投球等の負荷中止（数ヶ月単位・医師管理）で修復が期待できる。中止期間の全身・下肢体幹トレーニングとフォーム課題の是正を並行。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '進行例・不安定病変・遊離体でドリリング・固定・骨軟骨移植等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷中止期（保存）',
        period: '医師の指示（数ヶ月単位）',
        goals: ['病変部の修復環境確保', '体力・連鎖機能の維持向上'],
        allowed: ['投球/荷重系以外の全身トレーニング', '下肢・体幹・肩甲帯強化'],
        avoid: ['投球・腕立て/倒立系の荷重', '「痛くないから」の自主再開'],
        criteria: ['画像上の修復（医師判定）'],
        mdCheck: '再開判断の全て',
      },
      {
        name: '段階的復帰期',
        period: '医師許可後',
        goals: ['投球/荷重動作の段階再開'],
        allowed: ['インターバルスローイング／段階的荷重練習'],
        avoid: ['段階飛ばし'],
        criteria: ['各段階で症状なし'],
      },
    ],
    returnCriteria: [
      { text: '画像上の修復（医師）を前提に、段階的プログラムを無症状で完遂すること。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '早期発見・保存例の予後は良好。進行例は可動域制限・関節症変化を残すことがあり、競技継続に影響しうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KJOC / 可動域', target: '投球機能・肘機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '成長期に、肘の外側の骨の表面（軟骨の下）の血流が悪くなり、骨と軟骨が剥がれかけてしまう病気です。早く見つけて投球を休めば、多くはきれいに治ります。',
      dos: ['医師が決めた休止期間を守り、その間に下半身や体幹を鍛えましょう'],
      donts: ['「痛くないから」と自己判断で投球や腕立てを再開すること（剥がれの原因）'],
      seekCare: ['肘が伸びない・引っかかる', '検診で「外側の異常」を指摘された'],
      goal: '将来も投げ続けられる肘を守るための治療です。焦らず、骨の修復を待ってから段階的に戻ります。',
    },
    motionCapture: [
      { movement: '投球動作（復帰期）', purpose: '外側圧迫負荷要因の評価', setup: '後方＋側面。', watchFor: ['肘下がり', '体の開き', '手投げ'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 肘部管症候群
  {
    id: 'cubital-tunnel-syndrome',
    category: 'elbow_hand',
    names: {
      ja: '肘部管症候群',
      en: 'Cubital Tunnel Syndrome',
      abbreviations: [],
      synonyms: ['尺骨神経障害（肘部）', 'ulnar neuropathy at the elbow'],
      note: '手のしびれの原因として手根管に次いで多い絞扼性神経障害。進行例は手内筋萎縮を残すため早期評価が重要。',
    },
    keywords: ['小指のしびれ', '薬指', '肘の内側', '朝のしびれ', '握力低下', '手内筋'],
    overview: [
      { text: '肘内側の肘部管での尺骨神経絞扼・牽引障害。小指・環指尺側のしびれで始まり、進行すると手内筋萎縮・巧緻運動障害を来す。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '肘部管は内側上顆後方の骨線維性トンネル。肘屈曲で内圧が上昇し神経が伸張される。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中高年男性・肘を曲げた姿勢の持続（スマホ・睡眠時肢位）・肘の変形（外反肘）・投球選手で見られる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '長時間の肘屈曲位・圧迫（肘つき）・反復牽引（投球）・骨変化による絞扼。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '小指・環指尺側のしびれ（夜間・肘屈曲で増悪）、進行で握力低下・箸/ボタンの困難・手内筋萎縮（骨間筋のやせ）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      'しびれの分布（小指側か）・出現状況（夜間・肘屈曲）', '肘つき・スマホ姿勢の習慣',
      '巧緻運動の支障', '肘外傷・変形の既往', '頚部症状の有無',
    ],
    physicalExam: [
      { text: '感覚（小指・環指尺側/手背尺側）、Tinel（肘部管）、肘屈曲テスト、Froment徴候・手内筋の萎縮/筋力、頚椎・胸郭出口の鑑別評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '肘屈曲テスト',
        target: '肘部管での尺骨神経',
        method: '肘最大屈曲（±手関節背屈）を保持ししびれ誘発をみる（時間は流儀あり）。',
        positive: '尺側しびれの誘発/増悪',
        caution: '偽陽性あり。感覚・筋所見と組み合わせる。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '頚椎症性神経根症（C8）', distinguishing: '頚部所見・前腕内側のしびれ・神経根徴候。' },
      { group: 'likely', name: 'ギヨン管症候群', distinguishing: '手背尺側の感覚は保たれる（分枝の違い）。' },
      { group: 'must_not_miss', name: '胸郭出口症候群・パンコースト腫瘍等', distinguishing: '非典型分布・全身症状。医師評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '手内筋萎縮・進行する脱力', action: '不可逆変化のリスク。早期に医師（伝導検査等）へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '神経伝導検査が診断・重症度評価の中心（医師）。X線で骨性要因、超音波で神経腫大・（亜）脱臼評価。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '重症度分類（感覚のみ〜萎縮あり）。手術適応判断に関わる（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '軽症例: 生活指導（長時間の肘屈曲回避・夜間伸展位の工夫・肘つき回避）＋神経滑走運動＋必要に応じ夜間スプリント。数ヶ月で改善しない/進行する例は医師へ。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '中等症以上・進行例で除圧術（±前方移行）が検討される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保存管理期',
        period: '目安: 6〜12週',
        goals: ['神経刺激の軽減', 'しびれの改善'],
        allowed: ['姿勢・生活指導の徹底', '神経滑走運動（症状を悪化させない範囲）'],
        avoid: ['長時間の肘深屈曲・肘への圧迫'],
        criteria: ['しびれ頻度の減少'],
        mdCheck: '改善不良・進行時の伝導検査/手術評価',
      },
    ],
    returnCriteria: [
      { text: 'しびれの消失/管理と巧緻機能の維持。投球選手は段階的投球で症状再燃がないこと。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '軽症例は保存で改善が多い。萎縮まで進行した例は回復が不完全になりうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'DASH / QuickDASH', target: '上肢機能', range: '0-100（低いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '肘の内側で、小指側に向かう神経（尺骨神経）が圧迫・引き伸ばされて、小指側のしびれや使いにくさが出る状態です。',
      dos: ['肘を深く曲げたままの姿勢（スマホ・寝るときの腕枕）を減らしましょう', '肘をつく癖をやめ、机にはクッションを'],
      donts: ['しびれを我慢して同じ姿勢を続けること'],
      seekCare: ['手の甲の筋肉がやせてきた・箸が使いにくい（早めの受診が大切）'],
      goal: '神経への負担を減らしてしびれを鎮め、手の力・器用さを守ることが目標です。',
    },
    motionCapture: [
      { movement: '作業・投球動作', purpose: '肘屈曲位保持の頻度評価', setup: '側面。', watchFor: ['長時間の深屈曲位', '肘への圧迫姿勢'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 橈骨頭骨折
  {
    id: 'radial-head-fracture',
    category: 'elbow_hand',
    names: {
      ja: '橈骨頭骨折',
      en: 'Radial Head Fracture',
      abbreviations: [],
      synonyms: ['橈骨頸部骨折', 'radial head fracture'],
      note: '転倒手つきで多い肘骨折。軽症（Mason I）は早期可動域訓練が拘縮予防の鍵。',
    },
    keywords: ['転倒', '手をついた', '肘外側', '回内外制限', '拘縮予防', 'Mason'],
    overview: [
      { text: '転倒時の手つきで軸圧が橈骨頭に伝わり生じる骨折。非転位例は早期運動療法で良好な予後が期待でき、固定しすぎによる拘縮が最大の敵。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '橈骨頭は回内外の軸で、腕橈関節の安定にも関与。合併損傷（UCL・骨間膜=Essex-Lopresti）で管理が変わる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '成人の肘骨折で頻度が高い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '肘伸展位での手つき（軸圧＋外反）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '肘外側の疼痛・腫脹、回内外/伸展の制限・疼痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転', '医師の分類・方針（保存/手術）と運動開始許可', '手関節部痛の有無（Essex-Lopresti）',
      '職業・利き手',
    ],
    physicalExam: [
      { text: '（方針決定後）指示範囲のROM（伸展・回外の回復を重点追跡）・腫脹・遠位の神経血管。手関節痛の随伴を確認。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: 'Essex-Lopresti損傷（骨間膜＋DRUJ）', distinguishing: '手関節部痛の合併。前腕全体の評価。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '肘関節脱臼・terrible triad', distinguishing: '高エネルギー・不安定。医師管理。', urgency: 'emergency' },
      { group: 'similar', name: '外側上顆症・腕橈関節挫傷', distinguishing: 'X線で骨折除外（医師）。' },
    ],
    redFlags: [
      { finding: '受傷時の手関節痛合併・前腕の広い疼痛', action: '骨間膜損傷評価。医師へ。', urgency: 'early_visit' },
      { finding: '循環・神経障害・高度腫脹', action: '緊急評価。', urgency: 'emergency' },
    ],
    imaging: [
      { text: 'X線（見えにくい場合は脂肪褥サイン）・CT（粉砕評価）。判定は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Mason分類（I〜III/IV）。Iは早期運動、II以上は方針が分かれる（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: 'Mason I（非転位）: 数日の安静後、早期から自動ROM（屈伸・回内外）を開始する方針が一般的。長期固定を避け拘縮を予防。疼痛に応じ漸増。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '転位・粉砕例で固定/人工橈骨頭等（医師判断）。術後は執刀医プロトコル。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '早期運動期',
        period: '目安: 数日〜3週',
        goals: ['拘縮予防（伸展・回外）', '疼痛・腫脹管理'],
        allowed: ['自動ROM（屈伸・回内外）を1日数回', '手指・肩の運動'],
        avoid: ['他動での強制矯正', '重量負荷'],
        criteria: ['ROMの漸進的改善'],
        mdCheck: '運動開始・進行の許可',
      },
      {
        name: '機能回復期',
        period: '3〜8週',
        goals: ['ROMの正常化', '筋力回復'],
        allowed: ['漸増抵抗運動', 'ADLの通常化'],
        avoid: ['骨癒合前の高負荷・軸圧衝撃'],
        criteria: ['ROM左右差の解消傾向・癒合（医師）'],
      },
      {
        name: '復帰期',
        period: '8週以降',
        goals: ['職業・スポーツ復帰'],
        allowed: ['段階的な荷重/衝撃動作（許可後）'],
        avoid: ['基準未達での転倒リスク競技復帰'],
        criteria: ['筋力・ROMの回復・医師許可'],
      },
    ],
    returnCriteria: [
      { text: '骨癒合（医師）とROM・筋力の回復を前提に、職種/競技の要求動作（手つき・荷重）への段階耐容を確認。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '軽症例の予後は良好だが、軽度の伸展制限が残ることがある。早期運動が予後を左右する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'ROM（伸展・回外）/ DASH', target: '肘機能', range: '度・0-100' },
    ],
    patientExplanation: {
      whatIs: '転んで手をついたときに、肘の外側の骨（橈骨頭）が折れたものです。ずれが小さければ、固定は最小限にして早くから動かすのが標準治療です。',
      dos: ['許可が出たら、痛みの範囲で肘の曲げ伸ばし・手のひら返しを毎日こまめに（固まり予防が最優先）'],
      donts: ['「骨折だから」と長く固定し続けること（肘は固まりやすい関節です）', '無理やり伸ばしてもらう強いストレッチ'],
      seekCare: ['手首も痛い（前腕全体のけがの可能性）', 'しびれ・色の悪さ'],
      goal: '完全に伸びて回る肘を取り戻すこと。早期の自主運動がその最大の鍵です。',
    },
    motionCapture: [
      { movement: '肘屈伸・回内外', purpose: 'ROM回復の経時評価', setup: '側面＋正面。', watchFor: ['伸展・回外の左右差', '代償（肩外転）'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
