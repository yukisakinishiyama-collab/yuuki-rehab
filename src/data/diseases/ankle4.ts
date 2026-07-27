// 疾患ページ: 足関節・足部カテゴリ 4/4（下書き・医師監修前）
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

export const ANKLE_PAGES_4: DiseasePage[] = [
  // ───────────────────────────── 距骨下関節障害
  {
    id: 'subtalar-disorder',
    category: 'ankle_foot',
    names: {
      ja: '距骨下関節障害',
      en: 'Subtalar Joint Disorders',
      abbreviations: [],
      synonyms: ['距骨下関節不安定症', '足根洞症候群', 'sinus tarsi syndrome'],
      note: '足根洞症候群を含む後足部外側深部痛の総称的概念。捻挫後遺症として重要。',
    },
    keywords: ['足根洞', '外果前下方の奥', '不整地', '捻挫後', '後足部', '回内外'],
    overview: [
      { text: '距骨下関節（距骨-踵骨間）とその周囲（足根洞）に由来する疼痛・不安定感。足関節捻挫の後遺症として生じることが多く、不整地での不安定感が特徴。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '距骨下関節は後足部の回内外を担い、足根洞には骨間距踵靱帯・脂肪組織・神経終末が存在する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '捻挫後の残存症状として一定数存在するとされるが、疫学データは限られる。', certainty: 'low', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '内反捻挫時の距骨下関節への損傷・足根洞内組織の瘢痕/滑膜炎・固有感覚障害。', certainty: 'low', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '足根洞部（外果前下方の深部）の疼痛、不整地・回内外での不安定感、朝のこわばり感。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '捻挫歴と現在までの経過', '疼痛部位（足根洞の深部か）', '不整地での不安定感',
      '距腿関節の不安定症状との区別（両方の可能性）',
    ],
    physicalExam: [
      { text: '足根洞の限局圧痛、後足部の回内外での疼痛/不安定感、距骨下関節の他動評価（内外がえし）、バランス機能。距腿関節不安定との鑑別評価を併施。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: 'CAI（距腿関節）', distinguishing: '前方引き出し等の距腿所見。併存も多い。' },
      { group: 'likely', name: '腓骨筋腱障害', distinguishing: '外果後方の腱走行圧痛。' },
      { group: 'must_not_miss', name: '足根骨癒合症（若年）', distinguishing: '若年・反復捻挫・後足部可動性低下。画像評価。', urgency: 'confirm_md' },
      { group: 'similar', name: '距骨骨軟骨損傷', distinguishing: 'より中央深部の荷重時痛。' },
    ],
    redFlags: [
      { finding: '若年の反復捻挫＋後足部可動性の著明な低下', action: '癒合症の評価（医師）へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'X線・MRIは他疾患除外と足根洞内変化の評価（医師判断）。診断は臨床所見が中心。', certainty: 'low', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '確立した分類はない。', certainty: 'insufficient', status: 'insufficient' },
    ],
    conservative: [
      { text: 'CAIに準じた感覚運動トレーニング（後足部の回内外制御を含む）＋腓骨筋/後脛骨筋の強化＋必要に応じたインソール。局所注射は医師判断。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '難治例で足根洞のデブリドマン等が検討されることがある（医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '機能改善期',
        period: '目安: 0〜8週',
        goals: ['後足部制御・バランスの改善', '疼痛の軽減'],
        allowed: ['バランス・回内外制御訓練', '足部周囲筋の強化'],
        avoid: ['不整地での無防備な高負荷（初期）'],
        criteria: ['不整地歩行の不安感軽減'],
      },
      {
        name: '復帰期',
        period: '8週以降',
        goals: ['競技環境での安定'],
        allowed: ['段階的な競技動作・不整地トレーニング'],
        avoid: ['症状再燃の無視'],
        criteria: ['競技動作で疼痛/不安感なし'],
        mdCheck: '難治時の画像・注射・手術相談',
      },
    ],
    returnCriteria: [
      { text: '不整地・切り返しでの疼痛と不安定感の消失、バランス指標の改善。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法で改善する例が多いとされるが、質の高いデータは限られる。', certainty: 'low', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM / CAIT', target: '機能・不安定感', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '足首の下にある「距骨下関節」という、足を内外に傾ける関節とその周辺の痛みです。捻挫のあとに、でこぼこ道で不安定に感じるのが典型です。',
      dos: ['バランス練習と足首まわりの筋トレで「傾きへの対応力」を鍛えましょう'],
      donts: ['不安なままの不整地トレーニング強行'],
      seekCare: ['数ヶ月改善しない深部の痛み', '若い方で捻挫を何度も繰り返す'],
      goal: 'でこぼこ道でも不安なく動ける後足部を取り戻すことが目標です。',
    },
    motionCapture: [
      { movement: '不整地様バランス課題', purpose: '後足部制御の評価', setup: '後方＋正面。', watchFor: ['過度な回内外の揺れ', '近位代償'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 足根骨癒合症
  {
    id: 'tarsal-coalition',
    category: 'ankle_foot',
    names: {
      ja: '足根骨癒合症',
      en: 'Tarsal Coalition',
      abbreviations: [],
      synonyms: ['距踵骨癒合', '踵舟状骨癒合', 'tarsal coalition'],
      note: '若年の反復捻挫・強直性扁平足の背景として重要。診断は画像（医師）による。',
    },
    keywords: ['若年', '反復捻挫', '扁平足', '後足部が硬い', '距踵', '踵舟'],
    overview: [
      { text: '足根骨間の先天的な癒合（骨性・軟骨性・線維性）。思春期に骨化が進み症候化することが多く、若年の反復捻挫・強直性扁平足の原因として重要。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '距踵癒合（中距踵関節部）と踵舟癒合が大半。後足部可動性の喪失により周囲関節・靱帯へ負荷が転嫁される。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '有病率は数%程度と報告され、両側例もある。症候化は10歳代に多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '先天的癒合の骨化進行→可動性喪失→捻挫様エピソード・周囲組織のストレスで症候化。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '後足部の疼痛（活動後）、反復する「捻挫」、硬い扁平足（アーチがつま先立ちでも復元しない）、腓骨筋スパズム。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '年齢・症状出現時期', '捻挫の回数', '扁平足の家族歴', '硬さの自覚',
      '画像検査の有無', '活動量',
    ],
    physicalExam: [
      { text: '後足部（距骨下）可動性の著明な低下、つま先立ちでの踵内反消失・アーチ非復元、腓骨筋スパズム様の防御。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: 'CAI', distinguishing: '可動性は保たれる。癒合症は「硬い」のが特徴。' },
      { group: 'likely', name: '柔軟性扁平足', distinguishing: 'つま先立ちでアーチ復元・踵内反あり。' },
      { group: 'similar', name: '距骨下関節炎', distinguishing: '画像で鑑別（医師）。' },
    ],
    redFlags: [
      { finding: '若年の反復捻挫＋後足部の硬さ', action: '本症を疑い画像評価（X線/CT・医師）へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'X線（斜位・特殊撮影）で疑い、CTで確定・範囲評価が標準的（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '部位（距踵/踵舟）・性状（骨性/軟骨性/線維性）・範囲（CT・医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '症状軽度: 活動調整・インソール（後足部支持）・短期固定による鎮静化＋周囲筋機能の最適化。可動化を目的とした強い徒手操作は行わない。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '保存抵抗例で癒合部切除や矯正・固定術（範囲・変形による・医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理期',
        period: '症状に応じて',
        goals: ['疼痛の鎮静化', '負荷の適正化'],
        allowed: ['インソール下の活動調整', '周囲筋（腓骨筋・後脛骨筋・カーフ）の等尺〜低負荷訓練'],
        avoid: ['硬い後足部を無理に動かす操作', '不整地の高負荷'],
        criteria: ['活動時痛の軽減'],
        mdCheck: '確定診断・手術適応の評価',
      },
      {
        name: '機能最適化期',
        period: '継続',
        goals: ['可動性喪失を代償する下肢機能の獲得'],
        allowed: ['股関節・膝を含む下肢全体のトレーニング', '低〜中衝撃活動'],
        avoid: ['症状を再燃させる衝撃負荷の急増'],
        criteria: ['目標活動の維持'],
      },
    ],
    returnCriteria: [
      { text: '疼痛管理下で目標活動が維持できること。競技レベルは病態・術後経過に応じ医師と設定。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '軽症例は保存で管理可能。手術例の成績は部位・範囲による。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM', target: '機能', range: '各0-100%' },
    ],
    patientExplanation: {
      whatIs: '足の後ろ側の骨同士が生まれつき部分的にくっついていて、成長とともに硬さや痛み・捻挫のくり返しとして現れてくる状態です。',
      dos: ['中敷きで足を支え、痛みと相談しながら活動を調整しましょう'],
      donts: ['硬い部分を無理にぐりぐり動かすようなストレッチ・矯正'],
      seekCare: ['捻挫を何度も繰り返す・足が硬い感じが強い（画像での確認を勧めます）'],
      goal: 'くっつき自体は個性として、痛みなく活動できる状態を保つことが目標です。必要なら手術も選択肢として医師と相談します。',
    },
    motionCapture: [
      { movement: 'つま先立ち・歩行', purpose: '後足部可動性・代償の評価', setup: '後方から。', watchFor: ['踵内反の欠如', 'アーチ非復元', '近位代償'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 三角骨障害
  {
    id: 'os-trigonum',
    category: 'ankle_foot',
    names: {
      ja: '三角骨障害',
      en: 'Os Trigonum Syndrome',
      abbreviations: [],
      synonyms: ['有痛性三角骨', '後方インピンジメント（三角骨性）'],
      note: '三角骨は正常変異（無症候が多い）。バレエ・サッカーで症候化する。後方インピンジメントページと併読。',
    },
    keywords: ['バレエ', 'ポワント', '底屈', '足首後方', 'キックのフォロー', '三角骨'],
    overview: [
      { text: '距骨後突起の過剰骨（三角骨）が、強い底屈の反復で後方に挟み込まれ症候化した状態。バレエダンサー・サッカー選手に典型的。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '三角骨は距骨後外側結節の分離骨。底屈端で脛骨後縁と踵骨間に挟まれ、FHL腱鞘と近接する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '三角骨の保有は一般集団の一部にみられ、症候化は底屈要求の高い競技者に集中する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: 'ポワント・キックフォロー等の最大底屈の反復による後方組織の挟み込み・軟骨結合部の損傷。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '足関節後方（アキレス腱深部）の疼痛。最大底屈で誘発。FHL併発では母趾屈曲での後内側痛・轢音。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '競技（バレエ・サッカー）と誘発動作', '疼痛部位（後方深部か）', '練習量の変化',
      'FHL症状（母趾の引っかかり）', '画像検査の有無',
    ],
    physicalExam: [
      { text: '後方深部の圧痛、強制底屈テストでの疼痛再現、FHL評価（母趾屈曲抵抗・轢音）。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '強制底屈テスト',
        target: '後方インピンジメント・三角骨',
        method: '他動で急速に最大底屈し後方痛の再現をみる。',
        positive: '後方深部痛の再現',
        caution: '愛護的に実施。確定は画像＋臨床（医師）。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: 'FHL腱障害', distinguishing: '母趾屈曲抵抗での後内側痛。併発が多い。' },
      { group: 'likely', name: 'アキレス腱障害（深部型との混同）', distinguishing: '腱自体の圧痛。' },
      { group: 'must_not_miss', name: '距骨後突起骨折（Shepherd骨折）', distinguishing: '急性外傷後。画像評価。', urgency: 'early_visit' },
    ],
    redFlags: [
      { finding: '急性外傷後の後方痛', action: '骨折除外（医師）。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線側面（底屈位）で三角骨確認、MRIで骨髄浮腫・FHL評価（医師判断）。保有＝症候ではない。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '確立した分類はない。', certainty: 'insufficient', status: 'insufficient' },
    ],
    conservative: [
      { text: '底屈端負荷の一時調整（ポワント量等）＋後方組織の減圧を意識したモビリティ/カーフ・FHLの機能改善＋段階的な底屈負荷再導入。注射は医師判断。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '保存抵抗の競技者では三角骨摘出（鏡視下）が良好とされ、比較的早期復帰の報告がある（医師判断）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    rehabPhases: [
      {
        name: '負荷調整期',
        period: '目安: 2〜6週',
        goals: ['後方部の鎮静化'],
        allowed: ['底屈端を避けた練習継続', 'カーフ・足部機能訓練'],
        avoid: ['最大底屈の反復（ポワント・強いキックフォロー）'],
        criteria: ['日常・基本練習で疼痛なし'],
      },
      {
        name: '段階的底屈再導入期',
        period: '基準達成後',
        goals: ['競技の底屈要求への再適応'],
        allowed: ['段階的なルルベ→ポワント／キック強度の漸増'],
        avoid: ['一気の全量復帰'],
        criteria: ['最大底屈動作で疼痛なし'],
        mdCheck: '改善不良時の摘出術相談',
      },
    ],
    returnCriteria: [
      { text: '競技要求の最大底屈（ポワント・フルキック）を疼痛なく反復できること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存で改善する例も多いが、高い底屈要求の競技者では手術移行も珍しくない。術後復帰は比較的良好と報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS（底屈端）/ FAAM Sports', target: '症状・競技機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: 'かかとの上・足首の後ろ側にある「余分な小さい骨（三角骨）」が、つま先を強く伸ばす動きで挟まって痛む状態です。バレエやキックの多い競技で起こります。',
      dos: ['つま先を伸ばし切る動きを一時的に減らして、後ろ側を休ませましょう'],
      donts: ['痛みをおしてのポワント・フルパワーのキック'],
      seekCare: ['保存的なケアを数ヶ月続けても踊り/キックで痛む（摘出手術の相談も選択肢）'],
      goal: '後方の炎症を鎮め、必要なら手術も含めて「つま先を伸ばし切れる足首」を取り戻します。',
    },
    motionCapture: [
      { movement: 'ルルベ→ポワント／キックフォロー', purpose: '底屈端の疼痛角度・代償評価', setup: '側面。', watchFor: ['底屈可動域の左右差', '疼痛出現角度', '代償（膝・体幹）'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 足関節鏡手術後
  {
    id: 'post-ankle-arthroscopy',
    category: 'ankle_foot',
    names: {
      ja: '足関節鏡手術後',
      en: 'Post Ankle Arthroscopy',
      abbreviations: [],
      synonyms: ['足関節鏡視下手術後', 'デブリドマン後'],
      note: '処置内容（デブリドマン/骨棘切除/微小骨折法等）で進行が大きく異なる。骨軟骨処置例は荷重制限が長い。',
    },
    keywords: ['術後', '関節鏡', 'デブリドマン', '骨棘切除', '微小骨折法'],
    overview: [
      { text: 'インピンジメント・骨軟骨損傷・滑膜炎等に対する鏡視下手術後のリハビリ。処置内容により荷重・進行速度が大きく異なるため術式確認が第一。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '軟部デブリドマン/骨棘切除のみなら早期荷重が多い。骨軟骨修復（骨髄刺激等）では修復組織保護のため免荷期間が設定される。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '適応の広がりとともに実施は増加傾向とされる。', certainty: 'low', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '術後課題: 腫脹遷延・ROM回復遅延・ポータル部の癒着/神経刺激症状。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '（経過中の注意）発熱・創部異常・急な腫脹増悪はレッドフラッグ。ポータル部のしびれは執刀医へ報告。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '処置内容（デブリドマンか骨軟骨処置か）', '執刀医の荷重・ROM指示', '術後週数',
      '腫脹・疼痛の推移', '目標競技・時期',
    ],
    physicalExam: [
      { text: '指示範囲でROM・腫脹・荷重歩行の質・カーフ/腓骨筋機能を評価。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '感染・DVT', distinguishing: '術後共通レッドフラッグ。', urgency: 'same_day' },
    ],
    redFlags: [
      { finding: '発熱・創部異常・急な腫脹', action: '執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '下腿腫脹・胸痛', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: '術後評価は執刀医による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし（術式による）。', status: 'verified' },
    ],
    conservative: [
      { text: '一般原則: 腫脹管理（挙上・圧迫）＋早期の指示範囲ROM＋段階的荷重→筋力/バランス→ラン・競技動作。骨軟骨処置例は免荷・CPM等の指示に厳密に従う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '再手術等は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護・回復期',
        period: '処置による（0〜2週/骨軟骨例は長期）',
        goals: ['腫脹管理', '指示範囲のROM・荷重'],
        allowed: ['指示範囲のROM運動・荷重', '足趾・近位の運動'],
        avoid: ['指示外の荷重', '腫脹を増やす長時間立位'],
        criteria: ['執刀医の段階許可'],
        mdCheck: '荷重・ROMの全段階',
      },
      {
        name: '機能回復期',
        period: '許可後',
        goals: ['筋力・バランスの回復', '正常歩行'],
        allowed: ['カーフ/腓骨筋強化・バランス訓練', 'エルゴメーター'],
        avoid: ['衝撃負荷の早期導入'],
        criteria: ['跛行なし・腫脹管理良好'],
      },
      {
        name: '復帰期',
        period: '基準達成後',
        goals: ['ラン→競技動作'],
        allowed: ['段階的ラン・アジリティ'],
        avoid: ['基準未達での復帰'],
        criteria: ['ホップ等で疼痛なし', '執刀医許可'],
      },
    ],
    returnCriteria: [
      { text: '腫脹なく段階的衝撃負荷に耐えること＋執刀医の許可。処置内容により時間軸が大きく異なることを共有。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '適応・処置により幅がある。インピンジメント系は比較的早期復帰の報告が多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM', target: '機能', range: '各0-100%' },
    ],
    patientExplanation: {
      whatIs: '足首の内視鏡手術のあとの回復期間です。手術の内容（掃除だけか、軟骨の処置をしたか）で進むスピードが大きく違うため、担当医の計画に沿って進めます。',
      dos: ['腫れを抑える工夫（挙上・アイシング）と、許可範囲の運動を続けましょう'],
      donts: ['腫れているのに長く立ち歩く・負荷を増やすこと'],
      seekCare: ['発熱・傷の異常', 'ふくらはぎの腫れ（すぐ連絡）'],
      goal: '手術で整えた関節を、腫れを管理しながら段階的に競技レベルまで戻していきます。',
    },
    motionCapture: [
      { movement: '歩行→ホップ（時期に応じて）', purpose: '荷重回復の評価', setup: '側面＋正面。', watchFor: ['荷重回避', '背屈利用の回復'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 靱帯修復・再建術後
  {
    id: 'post-ankle-ligament-surgery',
    category: 'ankle_foot',
    names: {
      ja: '靱帯修復・再建術後',
      en: 'Post Lateral Ligament Repair/Reconstruction (Ankle)',
      abbreviations: ['Broström後'],
      synonyms: ['足関節外側靱帯修復術後', 'Broström-Gould術後', '靱帯再建術後'],
      note: '修復（Broström系）と再建（移植腱）で保護期間が異なる。執刀医プロトコル優先。',
    },
    keywords: ['術後', 'Broström', '外側靱帯', 'CAI術後', '内反制限'],
    overview: [
      { text: '慢性足関節不安定症等に対する外側靱帯修復/再建術後のリハビリ。修復組織の保護（内反制限）と機能的安定性（バランス・筋機能）の再建を両立させる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '修復されたATFL/CFL（±補強）は早期の内反・底屈内反ストレスで破綻リスクがある。再建例は移植腱の生着過程を考慮。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: 'CAIの手術例として一般的。スポーツ選手の復帰率は比較的高い報告が多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '術後課題: 内反方向の再受傷、背屈ROMの回復遅延、腓骨筋機能・バランスの再建不足。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '（経過中の注意）明確な内反受傷エピソード後の不安定感再燃は修復部評価（執刀医）。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '術式（修復か再建か・補強の有無）', '執刀医の固定/装具・荷重指示', '術後週数',
      '術前の不安定期間・競技', '現在の不安感',
    ],
    physicalExam: [
      { text: '指示範囲でROM（背屈中心・内反は制限期間を遵守）・腫脹・腓骨筋機能・バランス。内反ストレステストは執刀医の許可時期まで行わない。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '感染・DVT', distinguishing: '術後共通レッドフラッグ。', urgency: 'same_day' },
      { group: 'likely', name: '腓腹神経・浅腓骨神経の刺激症状', distinguishing: '外側のしびれ。執刀医へ報告。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '発熱・創部異常', action: '執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '下腿腫脹・胸痛', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
      { finding: '内反受傷後の不安定感再燃', action: '修復部評価。執刀医受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '術後評価は執刀医による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '一般的な流れ: 固定/装具期（内反保護・指示荷重）→背屈中心のROM・腓骨筋等尺→荷重下筋力・バランス→ホップ/アジリティ→装具/テープ併用での競技復帰。内反可動域の追求は行わない。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '再手術は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜4〜6週（術式による）',
        goals: ['修復部保護（内反回避）', '指示範囲の荷重・ROM'],
        allowed: ['装具下荷重（指示）', '背屈方向のROM', '足趾・近位運動'],
        avoid: ['内反・底屈内反方向のストレス', '指示外の装具離脱'],
        criteria: ['執刀医の段階許可'],
        mdCheck: '装具・可動域制限の解除時期',
      },
      {
        name: '機能再建期',
        period: '目安: 6〜12週',
        goals: ['腓骨筋筋力・バランスの再建', '正常歩行・ジョグ準備'],
        allowed: ['チューブ外反・カーフレイズ', 'バランス訓練（漸増）'],
        avoid: ['急な切り返し・不整地'],
        criteria: ['片脚バランス安定', '背屈左右差改善'],
      },
      {
        name: '競技復帰期',
        period: '目安: 3〜6ヶ月（医師許可後）',
        goals: ['ホップ・カッティングの再獲得', '再受傷予防戦略'],
        allowed: ['段階的アジリティ→競技練習（テーピング/装具併用）'],
        avoid: ['基準未達での復帰'],
        criteria: ['ホップ左右差改善', '不安感なし', '執刀医許可'],
        mdCheck: '競技復帰の許可',
      },
    ],
    returnCriteria: [
      { text: '執刀医許可を前提に、バランス・ホップ・切り返しでの安定と不安感消失を確認。復帰初期は外的サポート併用が一般的。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '修復術の成績・復帰率は良好な報告が多い。全身弛緩例・再手術例は再建が選択されることがある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'CAIT / FAAM', target: '不安定感・機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: 'ゆるんだ足首の靱帯を縫い縮めた（または作り直した）手術のあとの回復期間です。修復した靱帯を内側にひねる力から守りながら、支える筋肉とバランスを鍛え直します。',
      dos: ['装具の期間・可動域の指示を守りましょう', 'バランス練習は再発予防の要です。地道に続けましょう'],
      donts: ['早期の内側へのひねり・不整地トレーニング', '装具の自己判断での省略'],
      seekCare: ['ひねった後にゆるい感じが戻った', '発熱・傷の異常・ふくらはぎの腫れ'],
      goal: '「ぐらつかない足首」を手術＋リハビリの両輪で完成させ、テーピング等も活用しながら競技へ復帰します。',
    },
    motionCapture: [
      { movement: 'ホップ着地・カッティング（復帰期）', purpose: '内反制御・安定性の評価', setup: '正面＋後方。', watchFor: ['着地時内反', '不安感による躊躇', '左右差'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
