// 疾患ページ: 足関節・足部カテゴリ 1/4（下書き・医師監修前）
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

export const ANKLE_PAGES_1: DiseasePage[] = [
  // ───────────────────────────── 慢性足関節不安定症
  {
    id: 'cai',
    category: 'ankle_foot',
    names: {
      ja: '慢性足関節不安定症',
      en: 'Chronic Ankle Instability',
      abbreviations: ['CAI'],
      synonyms: ['足関節慢性不安定症', '反復性足関節捻挫'],
      note: '構造的不安定性（靱帯弛緩）と機能的不安定性（感覚運動系の障害）の両面から捉える。',
    },
    keywords: ['捻挫の繰り返し', 'ぐらつき', 'giving way', '不安定感', '足首', 'バランス'],
    overview: [
      { text: '足関節捻挫後に不安定感・giving way・再捻挫が1年以上反復する状態。構造的弛緩と感覚運動機能低下（バランス・筋反応・可動域）の複合病態。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '初回捻挫の管理不良が主要な背景。将来の関節症性変化との関連も指摘され、系統的なリハビリの適応。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: 'ATFL/CFLの弛緩・瘢痕治癒に加え、距骨下関節・近位（股関節）を含む感覚運動系全体の機能変化が報告される。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    epidemiology: [
      { text: '初回捻挫経験者のかなりの割合が慢性症状へ移行すると報告される（数値は定義により幅）。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    mechanism: [
      { text: '靱帯性支持の低下・固有感覚/腓骨筋反応の遅延・背屈制限・近位筋機能低下・恐怖回避などの複合。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '不整地・切り返しでの不安感、giving way、反復捻挫、活動後の腫脹・疼痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '捻挫の回数・最終受傷時期', 'giving wayの頻度・場面', '装具/テーピング依存の程度',
      '初回捻挫時の治療内容', '競技・サーフェス', 'CAIT等の質問紙スコア',
    ],
    physicalExam: [
      { text: '前方引き出し・内反ストレス（弛緩性）、荷重位背屈（knee-to-wall）、片脚バランス（開眼/閉眼）、ホップ系テスト、腓骨筋筋力。', status: 'needs_pro_review' },
      { text: 'SEBT/Yバランス等の動的バランス評価は経過指標として有用。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    specialTests: [
      {
        name: '前方引き出し・内反ストレステスト',
        target: '構造的弛緩の評価',
        method: '急性期ページに準ずる。慢性期は疼痛が少なく評価しやすい。',
        positive: '健側比での弛緩増大',
        caution: '弛緩の程度と機能的不安定性は一致しないことがある。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '距骨骨軟骨損傷', distinguishing: '深部痛・引っかかり。症状遷延例で医師評価。', urgency: 'confirm_md' },
      { group: 'likely', name: '腓骨筋腱障害・脱臼', distinguishing: '外果後方の疼痛・弾発。' },
      { group: 'likely', name: '足関節インピンジメント', distinguishing: '背屈/底屈端の詰まり感。' },
      { group: 'similar', name: '距骨下関節不安定性', distinguishing: '評価が難しく併存しうる。' },
    ],
    redFlags: [
      { finding: '急性再受傷時の骨圧痛・荷重不能', action: 'Ottawa準拠でX線評価。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'ストレスX線・MRIは構造評価の参考（医師判断）。機能的不安定性は画像に写らないため機能評価が中心。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '構造的/機能的不安定性の区分（重複あり）。CAIT・IdFAI等の質問紙で症状定義。', certainty: 'moderate', status: 'needs_literature' },
    ],
    conservative: [
      { text: '第一選択: 感覚運動トレーニング（バランス・ホップ）＋腓骨筋/近位筋の強化＋背屈可動域の改善。バランストレーニングは再捻挫予防エビデンスが比較的良好。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '競技時の外的サポート（テープ/装具）併用は再受傷予防に有用とされる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '十分な保存療法（目安3〜6ヶ月）に抵抗する構造的不安定例で靱帯修復/再建が検討される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '基礎機能改善期',
        period: '目安: 0〜6週',
        goals: ['背屈ROM改善', '腓骨筋・近位筋の強化', '静的バランス'],
        allowed: ['チューブトレーニング', 'knee-to-wallモビリティ', '片脚立位（漸増）'],
        avoid: ['不安感の強い環境での無防備な練習'],
        criteria: ['片脚立位の安定', '背屈左右差の改善'],
      },
      {
        name: '動的安定性期',
        period: '目安: 6〜12週',
        goals: ['動的バランス・ホップ能力', '着地戦略の改善'],
        allowed: ['不安定面・ホップ系トレーニング', 'アジリティ導入'],
        avoid: ['疲労時の高リスク練習'],
        criteria: ['SEBT/ホップの左右差改善', 'giving way消失傾向'],
      },
      {
        name: '競技復帰・維持期',
        period: '12週以降',
        goals: ['競技環境での安定', '予防プログラムの習慣化'],
        allowed: ['競技特異的練習＋外的サポート'],
        avoid: ['予防トレーニングの中断'],
        criteria: ['競技で不安感なし', '再捻挫なしの期間延長'],
      },
    ],
    returnCriteria: [
      { text: 'giving wayなく競技動作が可能、バランス・ホップ左右差の改善、質問紙スコアの改善を組み合わせる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '系統的リハビリで機能改善が期待できるが、放置例は再捻挫を繰り返し関節症リスクが指摘される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'CAIT', target: '不安定感', range: '0-30（低いほど不安定）' },
      { name: 'FAAM', target: '機能（ADL/スポーツ）', range: '各0-100%' },
    ],
    patientExplanation: {
      whatIs: '捻挫を繰り返すうちに、足首の「支え」と「センサー（バランス感覚）」の両方が弱ってしまった状態です。トレーニングで多くの場合改善が見込めます。',
      dos: ['バランス練習と足首まわりの筋トレを週数回、数ヶ月続けましょう', '競技のときはテーピングやサポーターを味方に'],
      donts: ['「捻挫癖だから仕方ない」と諦めて放置すること'],
      seekCare: ['数ヶ月トレーニングしても頻繁にぐらつく（手術含む相談）', '深いところの痛み・引っかかりが続く'],
      goal: 'ぐらつかない足首を取り戻し、再捻挫の連鎖を断ち切ることが目標です。',
    },
    motionCapture: [
      { movement: '片脚バランス・ホップ着地', purpose: '動的安定性の評価', setup: '正面から。', watchFor: ['足部の過剰な揺れ', '着地時内反', '近位代償'] },
    ],
    references: [
      {
        authors: 'Gribble PA, Bleakley CM, Caulfield BM, et al.',
        title: 'Evidence review for the 2016 International Ankle Consortium consensus statement on the prevalence, impact and long-term consequences of lateral ankle sprains',
        source: 'Br J Sports Med', year: 2016, verified: false,
        note: 'CAIの概念・疫学の基盤文献。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 内側靱帯損傷
  {
    id: 'deltoid-ligament-injury',
    category: 'ankle_foot',
    names: {
      ja: '内側靱帯損傷',
      en: 'Deltoid (Medial) Ligament Injury',
      abbreviations: [],
      synonyms: ['三角靱帯損傷', 'deltoid ligament injury'],
      note: '単独損傷はまれで、外果骨折・遠位脛腓損傷との合併を常に念頭に置く。',
    },
    keywords: ['内果', '外反', '回内', '三角靱帯', '合併損傷'],
    overview: [
      { text: '足関節内側の三角靱帯の損傷。外反・回内強制で生じ、単独はまれで骨折・脛腓靱帯損傷との合併が多い。内側の腫脹・圧痛では合併損傷の除外が優先。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '三角靱帯は浅層・深層からなる強靱な靱帯で、距骨の外反・外旋を制動する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '外側捻挫に比べ頻度は低い。骨折合併例・スポーツの回内受傷で見られる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '外反・回内・外旋の強制。高エネルギーでは果部骨折・脛腓損傷を伴う。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '内果下方の疼痛・腫脹・皮下出血、荷重時痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転（外反/回内・高エネルギーか）', '内側の疼痛部位', '荷重可否（Ottawa）',
      '外側・脛腓部の症状の有無', '既往の捻挫・扁平足傾向',
    ],
    physicalExam: [
      { text: '内果・三角靱帯部の圧痛、外反ストレス痛、Ottawa項目（両果・第5中足骨・舟状骨）、脛腓部の圧痛/squeeze、後脛骨筋腱の評価。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: '外反ストレステスト',
        target: '三角靱帯',
        method: '中間位で踵骨に外反ストレス。',
        positive: '内側の疼痛・開大感',
        caution: '骨折除外前の強いストレスは避ける。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '内果骨折・外果骨折合併', distinguishing: '骨圧痛・荷重不能。X線評価。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '遠位脛腓靱帯損傷', distinguishing: '脛腓部圧痛・外旋痛。管理が異なる。', urgency: 'early_visit' },
      { group: 'likely', name: '後脛骨筋腱損傷', distinguishing: '腱走行の圧痛・片脚カーフレイズでの内側縦アーチ低下。' },
    ],
    redFlags: [
      { finding: 'Ottawa陽性・荷重不能', action: 'X線評価のため受診。', urgency: 'early_visit' },
      { finding: '高エネルギー外傷・変形', action: '骨折脱臼疑い。救急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: 'X線（骨折・脛腓開大の評価）。ストレス撮影・MRIは医師判断。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Grade I〜III（外側靱帯と同様の概念）。合併損傷の有無で管理が規定される。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '単独部分損傷: 保護（装具）＋段階的荷重＋外側捻挫に準じた機能リハビリ（内側支持のため後脛骨筋・アーチ機能も強化）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '骨折・脛腓損傷合併例の靱帯処置は手術方針に含めて医師が判断。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜2週（重症度による）',
        goals: ['腫脹管理', '保護下荷重'],
        allowed: ['装具下荷重', '足趾・足関節自動運動'],
        avoid: ['外反・回内ストレス'],
        criteria: ['荷重時痛の軽減'],
      },
      {
        name: '機能回復期',
        period: '目安: 2〜6週',
        goals: ['ROM・筋力回復（後脛骨筋含む）', 'アーチ機能'],
        allowed: ['チューブ・カーフレイズ・バランス訓練'],
        avoid: ['急な切り返し'],
        criteria: ['片脚カーフレイズ可', 'バランス改善'],
      },
      {
        name: '復帰期',
        period: '基準達成後',
        goals: ['競技動作再獲得'],
        allowed: ['段階的ラン・アジリティ'],
        avoid: ['基準未達での復帰'],
        criteria: ['ホップ・切り返しで疼痛/不安なし'],
      },
    ],
    returnCriteria: [
      { text: '外側捻挫に準じ、疼痛・バランス・ホップ・競技動作の段階基準で判断。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '単独例は良好。合併例は主損傷に依存。回復は外側捻挫よりやや長引くことがある。', certainty: 'low', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM', target: '足関節機能', range: '各0-100%' },
    ],
    patientExplanation: {
      whatIs: '足首の内側にある強い靱帯（三角靱帯）を、足が外側にひねられる力で傷めた状態です。内側のけがは骨折などを伴いやすいため、最初の評価が大切です。',
      dos: ['保護具の指示を守り、段階的に荷重・運動を進めましょう', '土踏まずを支える筋肉の強化も行います'],
      donts: ['痛みが残るうちのジャンプ・切り返し'],
      seekCare: ['くるぶしの骨を押すと強く痛む・歩けない', '腫れが強く引かない'],
      goal: '内側の支えをしっかり回復させ、再発しにくい足首で復帰することが目標です。',
    },
    motionCapture: [
      { movement: '片脚カーフレイズ・着地', purpose: 'アーチ・内側支持の評価', setup: '後方＋正面。', watchFor: ['過回内', '踵の外反残存'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 遠位脛腓靱帯損傷
  {
    id: 'syndesmosis-injury',
    category: 'ankle_foot',
    names: {
      ja: '遠位脛腓靱帯損傷',
      en: 'Syndesmosis Injury (High Ankle Sprain)',
      abbreviations: [],
      synonyms: ['ハイアンクルスプレイン', '脛腓靱帯結合損傷', 'syndesmosis sprain'],
      note: '通常の外側捻挫より回復が遷延しやすく、不安定型は手術適応となるため見逃さないことが重要。',
    },
    keywords: ['高位捻挫', '脛腓間', '外旋', 'squeeze', 'コンタクトスポーツ', '長引く捻挫'],
    overview: [
      { text: '脛骨と腓骨を遠位で連結する靱帯群（前下脛腓靱帯等）の損傷。背屈・外旋強制で生じ、「長引く捻挫」の重要な原因。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '安定型は保存療法で良好だが荷重管理が外側捻挫より保守的になりやすく、不安定型は手術（スクリュー/suture button）適応（判断は医師）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '前下脛腓靱帯（AITFL）・骨間靱帯・後下脛腓靱帯（PITFL）が脛腓間の安定性を担い、荷重ごとに腓骨は微細に動く。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: 'コンタクトスポーツ（ラグビー・アメフト・スキー等）で多い。足関節捻挫全体の一部を占め、見逃しが問題となる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '背屈位での外旋強制（相手が乗る・固定された足での回旋）が典型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '脛腓間（果間より近位前方）の疼痛、荷重・蹴り出しでの疼痛、外側捻挫より腫脹が軽いのに歩けない、というミスマッチ。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転（外旋・背屈か）', '疼痛部位（果間より上か）', '蹴り出し・つま先立ちでの疼痛',
      '荷重可否', '通常捻挫として治療して長引いていないか',
    ],
    physicalExam: [
      { text: '脛腓間の圧痛（圧痛の近位への広がりは重症度と関連するとされる）、squeeze test、外旋テスト、荷重時痛。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: '外旋テスト',
        target: '遠位脛腓靱帯',
        method: '膝90°・足関節中間位で足部を外旋。',
        positive: '脛腓間の疼痛再現',
        caution: '感度・特異度は限定的。圧痛部位と合わせて判断。',
        status: 'needs_literature',
      },
      {
        name: 'Squeeze test',
        target: '遠位脛腓靱帯',
        method: '下腿中央で脛腓骨を圧迫。',
        positive: '遠位脛腓部への疼痛',
        caution: '陽性なら本損傷を疑い医師評価へ。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '腓骨近位骨折（Maisonneuve）', distinguishing: '外旋損傷＋腓骨近位圧痛。下腿近位も必ず触診。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '果部骨折・脛腓開大', distinguishing: 'X線評価（医師）。', urgency: 'early_visit' },
      { group: 'likely', name: '外側靱帯損傷', distinguishing: '外果前下方の圧痛。合併もある。' },
    ],
    redFlags: [
      { finding: '脛腓部圧痛＋荷重不能', action: '不安定型・骨折の評価が必要。早期受診。', urgency: 'early_visit' },
      { finding: '腓骨近位の圧痛', action: 'Maisonneuve骨折の除外。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（脛腓間開大・果部骨折）・荷重位撮影・CT/MRIは医師判断。安定/不安定の判定が方針を決める。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '安定型/不安定型（±明らかな開大）。West Point分類等。判定は画像を含め医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '安定型: 短期の保護（装具/ブーツ・荷重調整）→段階的荷重→蹴り出し・回旋負荷は後半に。外側捻挫より時間軸を長めに設定する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '不安定型はスクリュー/suture button固定が標準的（医師判断）。術後は固定方法により荷重時期が異なる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜3週（安定型）',
        goals: ['脛腓部の保護', '腫脹管理'],
        allowed: ['装具下の許可荷重', '足趾運動・非回旋のROM'],
        avoid: ['外旋・強い背屈', '蹴り出しの強い歩行'],
        criteria: ['荷重時痛の軽減'],
        mdCheck: '不安定型の除外確認',
      },
      {
        name: '荷重・筋力期',
        period: '目安: 3〜6週',
        goals: ['全荷重歩行', 'カーフ・腓骨筋強化'],
        allowed: ['両脚→片脚カーフレイズ', 'バランス訓練'],
        avoid: ['回旋負荷・ジャンプ'],
        criteria: ['つま先立ちで疼痛なし'],
      },
      {
        name: '復帰期',
        period: '目安: 6週以降（個人差大）',
        goals: ['ラン→切り返し・ジャンプ'],
        allowed: ['段階的ラン・ホップ・アジリティ'],
        avoid: ['基準未達での復帰'],
        criteria: ['ホップ・外旋負荷で疼痛なし'],
      },
    ],
    returnCriteria: [
      { text: '片脚ホップ・蹴り出し・切り返しで疼痛がないこと。外側捻挫より復帰まで長くかかることを共有。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '外側捻挫より復帰遅延・残存症状が多いと報告される。適切な初期分類が予後を左右する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM', target: '機能', range: '各0-100%' },
    ],
    patientExplanation: {
      whatIs: 'すねの2本の骨（脛骨と腓骨）を足首の上でつなぐ靱帯を傷めた、いわゆる「高位捻挫」です。普通の捻挫より治るのに時間がかかるタイプです。',
      dos: ['指示された保護具と荷重ペースを守りましょう（焦りは禁物）'],
      donts: ['痛みが残るうちのつま先立ち・ダッシュ・ひねり'],
      seekCare: ['体重をかけられない', 'すねの上の方も押すと痛い（早めに受診）'],
      goal: '時間はかかりますが、段階を守れば元のプレーに戻れます。「普通の捻挫より長くかかる」前提で計画を立てるのが成功の鍵です。',
    },
    motionCapture: [
      { movement: '蹴り出し歩行・ホップ', purpose: '回旋負荷耐容の評価', setup: '側面＋正面。', watchFor: ['蹴り出し回避', '外旋回避'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 足関節インピンジメント
  {
    id: 'ankle-impingement',
    category: 'ankle_foot',
    names: {
      ja: '足関節インピンジメント',
      en: 'Ankle Impingement (Anterior/Posterior)',
      abbreviations: [],
      synonyms: ['フットボーラーズアンクル', '前方インピンジメント', '後方インピンジメント'],
      note: '前方（背屈端）と後方（底屈端）で病態・誘発動作が異なる。後方は三角骨障害と重複。',
    },
    keywords: ['詰まり感', '背屈端', '底屈端', 'しゃがみ込み', 'サッカー', 'バレエ', '骨棘'],
    overview: [
      { text: '足関節の背屈端（前方）または底屈端（後方）で骨・軟部組織が挟み込まれ疼痛を生じる病態。反復負荷による骨棘・滑膜肥厚・瘢痕が背景。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '前方: 脛骨前縁・距骨頸部の骨棘、前方関節包・滑膜。後方: 距骨後突起/三角骨・FHL腱・後方軟部組織。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '前方はサッカー等のキック競技、後方はバレエ・サッカー・跳躍系に多い。捻挫後の続発もある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '可動域端への反復負荷（キック・しゃがみ・ポワント等）と外傷後の瘢痕・不安定性。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '前方: しゃがみ込み・階段・背屈での前方の詰まり痛。後方: ポワント・キックフォロー・底屈端での後方痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛の部位（前/後）と誘発肢位（背屈端/底屈端）', '競技（キック・バレエ）', '捻挫歴',
      '引っかかり・可動域制限感', '練習量の変化',
    ],
    physicalExam: [
      { text: '前方: 前方関節裂隙の圧痛＋強制背屈での疼痛再現。後方: 後方の圧痛＋強制底屈テスト。FHL評価（母趾屈曲抵抗）を併施。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '強制背屈/底屈テスト',
        target: '前方/後方インピンジメント',
        method: '他動で可動域端まで背屈または底屈し疼痛再現をみる。',
        positive: '該当端での疼痛・詰まり感の再現',
        caution: '骨折・急性外傷除外後に実施。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '三角骨障害', distinguishing: '後方型と重複。画像で三角骨確認（医師）。' },
      { group: 'likely', name: 'FHL腱障害', distinguishing: '母趾屈曲抵抗での後内側痛。バレエで併存。' },
      { group: 'must_not_miss', name: '距骨骨軟骨損傷', distinguishing: '深部痛・捻挫歴。画像評価は医師。', urgency: 'confirm_md' },
      { group: 'similar', name: '前脛骨筋腱・伸筋腱の腱鞘炎', distinguishing: '腱走行の圧痛・抵抗痛。' },
    ],
    redFlags: [
      { finding: '安静時痛・夜間痛の進行', action: '腫瘍性病変等の除外は医師判断。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'X線側面（骨棘・三角骨）・MRI（軟部・骨髄変化）。無症候の骨棘も多く、症状との対応づけが必要（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '前方型/後方型、骨性/軟部性。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '誘発負荷の管理（可動域端の反復回避）＋距骨の後方滑り等のモビリティ改善＋カーフ/近位機能の改善＋動作修正（しゃがみ・着地の質）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '保存抵抗例に鏡視下デブリドマン・骨棘切除・三角骨摘出等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷管理期',
        period: '目安: 0〜4週',
        goals: ['誘発負荷の削減', '疼痛の鎮静化'],
        allowed: ['疼痛のない範囲の運動', '関節モビライゼーション'],
        avoid: ['可動域端への反復負荷（深いしゃがみ・ポワント等）'],
        criteria: ['日常動作の疼痛消失'],
      },
      {
        name: '機能改善・復帰期',
        period: '4週以降',
        goals: ['可動域端の耐容性回復', '競技動作の再獲得'],
        allowed: ['段階的な端域負荷・競技動作'],
        avoid: ['症状再燃の無視'],
        criteria: ['誘発動作で疼痛なし'],
        mdCheck: '改善不良時の画像・手術相談',
      },
    ],
    returnCriteria: [
      { text: '競技特異的な可動域端動作（キック・ポワント・深いしゃがみ）を疼痛なく反復できること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法で改善する例が多いが、骨性因子が大きい場合は手術で良好な報告がある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM', target: '機能', range: '各0-100%' },
      { name: 'NRS', target: '疼痛（誘発動作）', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '足首を深く曲げた（または伸ばした）ときに、骨や軟部組織が挟まって痛む状態です。使いすぎや捻挫のあとに起こりやすい症状です。',
      dos: ['痛みが出る角度の使いすぎを一時的に減らし、足首の動きの質を整えましょう'],
      donts: ['詰まる角度への無理なストレッチの反復'],
      seekCare: ['じっとしていても痛む', '数ヶ月改善しない（手術含む相談）'],
      goal: '挟み込みを起こしにくい動き方と組織の状態を作り、競技の深い角度を痛みなく使えるようにします。',
    },
    motionCapture: [
      { movement: 'しゃがみ込み／ポワント・キック', purpose: '誘発角度と代償の評価', setup: '側面から。', watchFor: ['疼痛出現角度', '代償（踵挙上・回内等）'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 距骨骨軟骨損傷
  {
    id: 'olt',
    category: 'ankle_foot',
    names: {
      ja: '距骨骨軟骨損傷',
      en: 'Osteochondral Lesion of the Talus',
      abbreviations: ['OLT', 'OCL'],
      synonyms: ['距骨骨軟骨障害', '距骨離断性骨軟骨炎'],
      note: '捻挫後の遷延する深部痛で疑う。診断・病期判定は画像を含め医師による。',
    },
    keywords: ['捻挫後の長引く痛み', '深部痛', '距骨', '軟骨', '引っかかり'],
    overview: [
      { text: '距骨滑車の軟骨・軟骨下骨の限局性損傷。捻挫等の外傷に続発することが多く、「治らない捻挫」の重要な鑑別。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '内側病変（後内側）と外側病変（前外側）で成因・形態が異なるとされる。軟骨下骨の状態が予後に関わる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '足関節捻挫・骨折後に一定割合で合併すると報告される。若年活動者に多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '外傷（捻挫時の距骨の衝突・剪断）と反復負荷。特発性もある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '足関節深部の荷重時痛・運動後の鈍痛・腫脹の反復。進行で引っかかり・可動域制限。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '捻挫・外傷歴と現在までの期間', '深部痛の性状・荷重との関係', '腫脹の反復',
      '引っかかり感', '画像検査の有無と説明内容',
    ],
    physicalExam: [
      { text: '特異的所見に乏しい。関節裂隙の深部圧痛・可動域端の疼痛・腫脹。捻挫リハビリで改善しない例で本症を疑う。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: 'CAI・遺残性の靱帯性疼痛', distinguishing: '不安定感主体。深部痛・腫脹反復ならOLT評価。' },
      { group: 'likely', name: '足関節インピンジメント', distinguishing: '可動域端の詰まり感。' },
      { group: 'must_not_miss', name: '距骨壊死・腫瘍', distinguishing: '夜間痛・進行性。医師評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '捻挫後2〜3ヶ月以上続く深部痛・腫脹', action: '本症を疑い画像評価（医師）へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'X線では検出困難なことがあり、MRI/CTで病変の大きさ・軟骨下骨の状態を評価（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '画像・鏡視に基づく病期分類（医師）。安定性・大きさが方針に影響。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '若年・小病変・安定例: 負荷管理（衝撃負荷の調整）＋機能リハビリで症状管理を試みる（方針は医師と共有）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '症候性・不安定例で骨髄刺激・固定・骨軟骨移植等（医師判断）。術後は術式別プロトコル（荷重制限が長いものもある）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷管理期（保存）',
        period: '医師方針による',
        goals: ['症状の鎮静化', '足関節機能の最適化'],
        allowed: ['低衝撃運動・筋力/バランス訓練'],
        avoid: ['ジャンプ・ランの無管理な継続'],
        criteria: ['荷重時痛・腫脹の消失'],
        mdCheck: '改善不良時の手術相談',
      },
      {
        name: '術後（該当例）',
        period: '術式による',
        goals: ['執刀医プロトコルの遵守'],
        allowed: ['指示範囲の荷重・ROM'],
        avoid: ['指示外の荷重'],
        criteria: ['執刀医の段階許可'],
        mdCheck: '全段階',
      },
    ],
    returnCriteria: [
      { text: '深部痛・腫脹なく段階的衝撃負荷に耐えること。（術後は）医師許可を前提。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '病変の大きさ・部位・治療法により幅がある。放置例では症状遷延・関節症化のリスク。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'FAAM / FAOS', target: '機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '足首の中心の骨（距骨）の表面の軟骨とその下の骨に、捻挫などをきっかけに傷がついた状態です。「捻挫がいつまでも治らない」ときに隠れていることがあります。',
      dos: ['衝撃の強い運動を一時調整し、足首の機能を整えましょう'],
      donts: ['痛み・腫れを繰り返しながらのジャンプ・ラン継続'],
      seekCare: ['捻挫後2〜3ヶ月しても奥の痛みと腫れが続く（画像の相談を）'],
      goal: '傷の状態に合わせて、保存療法または手術で「痛みなく運動できる足首」を取り戻すことが目標です。',
    },
    motionCapture: [
      { movement: '着地・ホップ', purpose: '衝撃負荷耐容の評価（復帰期）', setup: '側面＋正面。', watchFor: ['患側回避', '着地の硬さ'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
