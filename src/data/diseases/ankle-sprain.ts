// 疾患ページ: 足関節外側靱帯損傷（下書き・医師監修前）
// 全記載に確認状態タグ付き。文献は verified:false（原文未確認）。

import type { DiseasePage } from '@/types/disease'

export const ANKLE_LATERAL_SPRAIN: DiseasePage = {
  id: 'ankle-lateral-sprain',
  category: 'ankle_foot',
  names: {
    ja: '足関節外側靱帯損傷',
    en: 'Lateral Ankle Sprain',
    abbreviations: ['LAS', 'ATFL損傷'],
    synonyms: ['足関節捻挫', '足首捻挫', '内反捻挫', '足関節外側靭帯損傷', 'ankle sprain'],
    note: '一般には「足関節捻挫」と呼ばれるが、多くは前距腓靱帯（ATFL）を中心とする外側靱帯の損傷を指す。',
  },
  keywords: [
    '足首', '捻挫', '内反', '着地', 'バスケットボール', 'バレーボール', 'サッカー',
    '前距腓靱帯', '踵腓靱帯', 'CFL', '不安定感', '再捻挫', 'ぐらつき',
  ],

  overview: [
    { text: '内反強制により足関節外側の靱帯（前距腓靱帯ATFLが最多、次いで踵腓靱帯CFL）が損傷する外傷。スポーツ外傷の中で最も頻度が高い部類に入る。', certainty: 'high', status: 'needs_md_review' },
    { text: '「よくある軽症」と扱われやすいが、適切な初期対応とリハビリが行われない場合、慢性足関節不安定症（CAI）へ移行する例が少なくないと報告されている。', certainty: 'moderate', status: 'needs_literature', refs: [2] },
    { text: '受傷直後は骨折の除外（Ottawa ankle rules等）が最優先。重症度評価は腫脹が落ち着く受傷数日後の方が信頼できるとする報告がある。', certainty: 'moderate', status: 'needs_literature', refs: [1], level: 'pro' },
  ],

  anatomy: [
    { text: '外側靱帯は前距腓靱帯（ATFL）・踵腓靱帯（CFL）・後距腓靱帯（PTFL）の3本。底屈内反ではATFLが最初に緊張するため損傷頻度が最も高い。', certainty: 'high', status: 'needs_pro_review' },
    { text: '関連組織: 遠位脛腓靱帯（高位捻挫との鑑別）、二分靱帯・第5中足骨基部（裂離骨折）、腓骨筋腱（腱脱臼・損傷の合併）、距骨軟骨（骨軟骨損傷の合併）。', certainty: 'moderate', status: 'needs_pro_review' },
  ],

  epidemiology: [
    { text: '好発: ジャンプ着地・切り返しを伴う競技（バスケットボール・バレーボール・サッカー等）。着地時に他者の足に乗る受傷が典型。', certainty: 'moderate', status: 'needs_literature' },
    { text: '再受傷率が高いことが本疾患の最大の問題とされ、初回受傷後の残存症状・不安定感の頻度も高いと報告されている。数値は文献確認後に対象集団付きで追記する。', certainty: 'moderate', status: 'needs_literature', refs: [2] },
  ],

  mechanism: [
    { text: '典型: 底屈位での内反強制（着地・踏み外し・切り返し）。', certainty: 'high', status: 'needs_pro_review' },
    { text: '背屈位での外旋強制は遠位脛腓靱帯損傷（高位捻挫）を疑う機序であり、外側靱帯損傷とは区別する。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    { text: '再発要因は多因子: 固有感覚・神経筋制御の低下、腓骨筋反応時間遅延、可動域（特に背屈）制限、構造的緩み、復帰の早さなど。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
  ],

  symptoms: [
    { text: '外果前下方の疼痛・腫脹・皮下出血。荷重時痛。受傷時の断裂音を伴うことがある。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: '慢性期: 不安定感（giving way）、反復捻挫、活動後の腫脹。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: '注意: 腫脹の程度と靱帯損傷の重症度は必ずしも一致しない。内果側の圧痛・高位の圧痛は他病変の合併を示唆する。', certainty: 'expert', status: 'needs_pro_review' },
  ],

  interviewItems: [
    '受傷日時・受傷機転（内反/外旋・着地/接触の別）',
    '受傷時の音・断裂感',
    '直後の荷重可否（4歩以上歩けたか: Ottawa基準）',
    '腫脹・皮下出血の出現時期と範囲',
    '疼痛部位（外果前下方/内果側/高位/第5中足骨基部/踵骨前方突起）',
    '過去の同側・対側捻挫歴と回数・治療歴',
    '不安定感・giving wayの有無',
    'しびれ・冷感など神経血管症状',
    '既往歴・投薬（抗凝固薬）',
    '競技種目・レベル・復帰希望時期',
    '医療機関受診・X線撮影の有無と結果・医師の指示',
  ],

  physicalExam: [
    { text: '視診: 腫脹の範囲・皮下出血の位置（時間とともに遠位へ移動する）。', status: 'needs_pro_review' },
    { text: '圧痛の系統的確認: ATFL/CFL走行部、外果・内果後縁（Ottawa）、第5中足骨基部、舟状骨、二分靱帯部、遠位脛腓靱帯部。圧痛部位の記録が鑑別の中心になる。', status: 'needs_pro_review' },
    { text: 'ROM: 背屈制限は機能予後・再発と関連するとされ、荷重位背屈（knee-to-wall等）で経過を追う。測定方法を統一して記録する。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    { text: '荷重・歩行: 荷重可否は骨折除外（Ottawa）と重症度評価の両方に用いる。', status: 'needs_pro_review' },
  ],

  specialTests: [
    {
      name: '前方引き出しテスト（足関節）',
      target: 'ATFL（前方不安定性）',
      method: '軽度底屈位で踵を把持し距骨を前方へ引き出す。健側と比較。',
      positive: '前方移動量の増大・エンドポイント軟化・sulcus形成',
      sensitivity: '受傷直後は低く、数日後の遅延評価で向上すると報告',
      specificity: '比較的高いと報告',
      caution: '急性期は疼痛・腫脹で偽陰性になりやすい。数日後の再評価を推奨する報告がある。',
      status: 'needs_literature',
      refs: [1],
    },
    {
      name: '内反ストレステスト（talar tilt）',
      target: 'CFL（内反不安定性）',
      method: '中間位〜軽度背屈位で踵骨を内反方向へストレスをかける。',
      positive: '内反動揺の増大・疼痛',
      caution: '角度の定量は徒手では困難。左右比較を基本とする。',
      status: 'needs_pro_review',
    },
    {
      name: '外旋テスト・squeeze test',
      target: '遠位脛腓靱帯（高位捻挫のスクリーニング)',
      method: '外旋テスト: 膝90°で足部を外旋。squeeze: 下腿中央で脛腓骨を圧迫。',
      positive: '遠位脛腓部への疼痛再現',
      caution: '陽性なら高位捻挫を疑い、荷重管理・受診判断を優先する。',
      status: 'needs_literature',
    },
  ],

  differentials: [
    { group: 'likely', name: '遠位脛腓靱帯損傷（高位捻挫）', distinguishing: '外旋機序・脛腓間の圧痛・squeeze陽性。回復が遷延しやすく管理が異なる。', urgency: 'early_visit' },
    { group: 'likely', name: '二分靱帯損傷・踵骨前方突起骨折', distinguishing: '外果よりやや前方遠位（踵骨前方突起部）の圧痛。' },
    { group: 'must_not_miss', name: '外果骨折・第5中足骨基部骨折', distinguishing: 'Ottawa ankle rules陽性（骨圧痛・4歩荷重不能）。X線で除外。', urgency: 'early_visit' },
    { group: 'must_not_miss', name: '距骨骨軟骨損傷', distinguishing: '症状遷延・関節深部痛・引っかかり感。画像評価は医師判断。', urgency: 'confirm_md' },
    { group: 'must_not_miss', name: '腓骨筋腱脱臼', distinguishing: '外果後方の圧痛・背屈外反での弾発。捻挫として見逃されやすい。', urgency: 'early_visit' },
    { group: 'similar', name: '足根洞症候群', distinguishing: '足根洞部の疼痛・不安定感。慢性期の鑑別。' },
  ],

  redFlags: [
    { finding: '外果・内果後縁の骨圧痛、または受傷直後から4歩の荷重歩行が不能（Ottawa陽性）', action: '骨折疑い。X線評価のため医療機関受診。', urgency: 'early_visit' },
    { finding: '明らかな変形・整復を要する脱臼疑い', action: '直ちに救急受診。', urgency: 'emergency' },
    { finding: '足趾の血流障害・感覚障害', action: '神経血管損傷疑い。直ちに医師へ。', urgency: 'emergency' },
    { finding: '下腿後面の把握痛・腫脹の増悪（特に固定後・長期安静後）', action: 'DVT疑い。運動中止し当日中に医療相談。', urgency: 'same_day' },
    { finding: '発熱・熱感・拍動痛を伴う腫脹', action: '感染の除外が必要。当日中に医療相談。', urgency: 'same_day' },
  ],

  imaging: [
    { text: '単純X線: Ottawa ankle rulesに基づく骨折除外が第一目的。靱帯は描出されない。撮影・読影の判断は医師が行う。', certainty: 'high', status: 'needs_md_review', refs: [3] },
    { text: '超音波: 靱帯の連続性・腫脹の評価に用いられるが、検者依存性が高い。動的評価が可能という利点がある。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    { text: 'MRI: 症状遷延例で骨軟骨損傷・腱損傷・高位捻挫の評価に有用。急性期の全例には通常不要とされる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    { text: '画像上の靱帯損傷所見と機能・症状は一致しないことがある。無症候側にも陳旧性変化が見られることがある。', certainty: 'expert', status: 'verified' },
  ],

  classification: [
    { text: 'Grade I（伸張・微細損傷）/ II（部分断裂）/ III（完全断裂）の3段階分類が汎用される。ただし急性期の徒手評価による分類の信頼性には限界がある。', certainty: 'moderate', status: 'needs_literature' },
  ],

  conservative: [
    { text: '第一選択は機能的治療（早期からの保護下運動）が支持されており、長期のギプス固定より機能的装具・早期運動が推奨される傾向にある（重症度により異なる）。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    { text: '急性期: PRICE/POLICE（保護・適正負荷・冷却・圧迫・挙上）。完全免荷の長期化は避け、疼痛許容範囲での荷重を段階的に進める。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: '運動療法: 背屈可動域の回復、腓骨筋群強化、バランス・固有感覚トレーニング。バランストレーニングは再受傷予防に有効とする報告が複数ある。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    { text: 'テーピング・装具: 再発予防目的の使用を支持する報告がある（特に再受傷ハイリスク期）。長期依存については見解が分かれる。', certainty: 'divided', status: 'needs_literature', level: 'pro' },
  ],

  surgical: [
    { text: '急性期の手術適応は限定的で、多くは保存療法が第一選択とされる。慢性不安定症で保存療法に抵抗する例に靱帯修復術・再建術が検討される（判断は医師）。', certainty: 'moderate', status: 'needs_md_review' },
    { text: '術後リハビリは術式（解剖学的修復/再建・鏡視下/直視下）と医師の指示により異なる。一般プロトコルの一律適用は不可。', certainty: 'expert', status: 'verified' },
  ],

  rehabPhases: [
    {
      name: '急性期（保護期）',
      period: '目安: 受傷後0〜1週',
      goals: ['腫脹・疼痛の管理', '骨折等の除外確認', '許容範囲の荷重開始'],
      allowed: ['アイシング・圧迫・挙上', '足趾・足関節の疼痛許容範囲での自動運動', '装具・テーピング下の部分〜全荷重'],
      avoid: ['内反ストレスのかかる動作', '疼痛を無視した競技継続'],
      criteria: ['腫脹の減少傾向', '疼痛なく全荷重歩行が可能'],
      mdCheck: 'Ottawa陽性所見・高位捻挫疑いがある場合の画像評価',
    },
    {
      name: '可動域・筋機能回復期',
      period: '目安: 1〜3週',
      goals: ['背屈ROMの回復', '腓骨筋群の筋力回復', '正常歩行'],
      allowed: ['チューブでの外反・底屈強化', 'カーフレイズ', '荷重位背屈ストレッチ', '両脚→片脚バランス'],
      avoid: ['急激な切り返し・ジャンプ', '不整地でのランニング'],
      criteria: ['背屈ROM左右差の解消傾向', '片脚立位が安定', '歩行で疼痛なし'],
    },
    {
      name: '動的安定性・復帰準備期',
      period: '目安: 3週以降（基準ベースで判断）',
      goals: ['動的バランスの獲得', 'ジャンプ着地・切り返しの再獲得', '競技特異的動作'],
      allowed: ['不安定面バランス', 'ホップ・ラダー・カッティングの段階的導入', '競技練習への部分参加'],
      avoid: ['基準未達での全体練習・試合復帰'],
      criteria: ['片脚ホップ・バランステストの左右差改善', '競技動作で不安感なし', '再発予防プログラムの習得'],
      mdCheck: '症状遷延時（6週以上）の合併損傷評価',
    },
  ],

  returnCriteria: [
    { text: '疼痛・腫脹の消失、背屈ROMの回復、片脚バランス・ホップ性能、競技特異的動作の質、不安感の有無を組み合わせて判断する。時間経過のみで復帰させない。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    { text: '復帰後も一定期間の外的サポート（テーピング・装具）とバランストレーニング継続が再受傷予防として推奨されることが多い。', certainty: 'moderate', status: 'needs_literature' },
  ],

  prognosis: [
    { text: '多くは数週間で競技復帰に至るが、残存症状（疼痛・不安定感）が長期化する例も相当数報告されている。「捻挫だから軽い」という前提での早期復帰は再発リスクを高める。', certainty: 'moderate', status: 'needs_literature', refs: [2] },
    { text: '反復捻挫はCAI・関節症性変化との関連が指摘されている。初回受傷時の適切な管理が長期予後の鍵とされる。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
  ],

  outcomes: [
    { name: 'FAAM', target: '足部・足関節の機能（ADL/スポーツ）', range: '各0-100%（高いほど良好）', note: '日本語版の使用条件は配布元を確認。' },
    { name: 'CAIT', target: '足関節不安定感', range: '0-30（低いほど不安定）', note: 'CAIのスクリーニングに使用。' },
    { name: 'NRS', target: '疼痛強度', range: '0-10', note: '場面を指定して記録。' },
  ],

  patientExplanation: {
    whatIs: '足首の外側にある、関節を支えるスジ（靱帯）を伸ばしたり切ったりしたけがです。「捻挫」と呼ばれますが、程度によってはしっかりした期間のケアが必要です。',
    dos: [
      '腫れている時期は冷やして・圧迫して・高くして休ませましょう',
      '痛みのない範囲での足首の運動と歩行は、許可に応じて早めに始めます',
      'ぐらつき予防のバランス練習は再発を防ぐ大切なトレーニングです',
    ],
    donts: [
      '「軽い捻挫だから」と痛いまま競技を続けること',
      '腫れが引く前のジャンプ・ダッシュ・切り返し',
      '自己判断でのテーピング・サポーターの早期中止',
    ],
    seekCare: [
      'くるぶしを押すと強く痛む・4歩歩けない（骨折の可能性）',
      '足の指の色が悪い・しびれる',
      '数週間たっても腫れや痛みが引かない',
      'ふくらはぎの強い腫れ・痛み',
    ],
    goal: '靱帯の回復に合わせて「歩く→走る→跳ぶ→切り返す」と段階的に進めます。再発しやすいけがなので、復帰後もバランス練習を続けることが目標です。',
  },

  motionCapture: [
    {
      movement: '片脚立位（開眼・閉眼）',
      purpose: '静的バランス・足部戦略の評価',
      setup: '正面から全身。支持脚の足部・膝が映る高さ。',
      watchFor: ['足部の過剰な揺れ', '股関節戦略への依存', '体幹側方傾斜'],
    },
    {
      movement: '片脚ホップ（前方・側方）',
      purpose: '動的安定性と着地制御の評価',
      setup: '正面＋側面。着地の静止まで撮影。',
      watchFor: ['着地時の足部内反', '着地の硬さ', '左右差', '不安感による躊躇'],
    },
    {
      movement: 'カッティング動作',
      purpose: '競技復帰前の切り返し動作評価',
      setup: '正面からやや広角で。速度は段階的に上げる。',
      watchFor: ['減速時の足部位置', '体幹の遅れ', '接地時間の左右差'],
    },
  ],

  references: [
    {
      authors: 'Vuurberg G, Hoorntje A, Wink LM, et al.',
      title: 'Diagnosis, treatment and prevention of ankle sprains: update of an evidence-based clinical guideline',
      source: 'Br J Sports Med', year: 2018,
      note: '診断・治療・予防のエビデンスに基づくガイドライン更新。',
      verified: false,
    },
    {
      authors: 'van Dijk CN, Lim LS, Bossuyt PM, Marti RK',
      title: 'Physical examination is sufficient for the diagnosis of sprained ankles',
      source: 'J Bone Joint Surg Br', year: 1996,
      note: '受傷数日後の遅延身体診察の有用性に関する報告。',
      verified: false,
    },
    {
      authors: 'Gribble PA, Bleakley CM, Caulfield BM, et al.',
      title: 'Evidence review for the 2016 International Ankle Consortium consensus statement on the prevalence, impact and long-term consequences of lateral ankle sprains',
      source: 'Br J Sports Med', year: 2016,
      note: '外側足関節捻挫の頻度・影響・長期転帰に関するコンセンサス。',
      verified: false,
    },
    {
      authors: 'Stiell IG, McKnight RD, Greenberg GH, et al.',
      title: 'Implementation of the Ottawa ankle rules',
      source: 'JAMA', year: 1994,
      note: 'Ottawa ankle rules（X線適応基準）の実装研究。',
      verified: false,
    },
  ],

  protocolTemplateKey: 'ankle_sprain',
  protocolJoint: 'ankle',

  meta: {
    createdAt: '2026-07-17',
    updatedAt: '2026-07-17',
    nextReviewDue: '2027-01-17',
    author: 'AI下書き（Claude）',
    supervisor: undefined,
    guidelineVersions: ['Vuurberg 2018 BJSM ガイドライン更新（版・内容は原本確認待ち）'],
    searchDate: undefined,
    changeLog: ['2026-07-17 AIによる初版下書き作成（全文献未確認・医師監修前）'],
  },
}
