// 疾患ページ: 股関節カテゴリ 1/3（下書き・医師監修前）
// 全記載に確認状態タグ付き。文献は verified:false（原文未確認）。

import type { DiseasePage } from '@/types/disease'

// 共通メタ（下書き）
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

export const HIP_PAGES_1: DiseasePage[] = [
  // ───────────────────────────── 股関節唇損傷
  {
    id: 'hip-labral-tear',
    category: 'hip',
    names: {
      ja: '股関節唇損傷',
      en: 'Acetabular Labral Tear',
      abbreviations: ['labral tear'],
      synonyms: ['関節唇損傷（股）', '股関節唇断裂'],
      note: 'FAI・形成不全・マイクロ不安定性など背景病態に伴って生じることが多く、単独診断名としてよりも「なぜ唇が傷んだか」の評価が重視される。',
    },
    keywords: ['鼠径部痛', '股関節前面', 'クリック', '引っかかり', '深屈曲', 'あぐら', 'FAI', '形成不全'],
    overview: [
      { text: '寛骨臼縁を取り囲む線維軟骨（関節唇）の損傷。関節の吸引効果・安定化・荷重分散に関与する組織で、損傷により鼠径部痛や引っかかり感を生じうる。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '多くはFAI・寛骨臼形成不全・不安定性などの形態的/力学的背景を伴う。背景病態の評価なしに唇損傷のみを治療対象としない。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '無症候者のMRIでも唇損傷所見は高頻度に報告されており、画像所見と症状の対応づけは慎重を要する。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    anatomy: [
      { text: '関節唇は寛骨臼縁に付着し、関節面を深め吸引（suction seal）を形成する。前上方部が損傷好発部位とされる。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '関連: 腸腰筋（前方でのインピンジ・弾発）、関節包・腸骨大腿靱帯、大腿骨頭軟骨。', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '股関節鏡手術例・鼠径部痛を訴えるアスリートで高頻度に確認される。回旋・深屈曲の多い競技（サッカー・ホッケー・ダンス・野球捕手等）と関連。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '反復する深屈曲・回旋負荷（FAIによる衝突、形成不全・不安定性による過剰な剪断）や、外傷（脱臼・亜脱臼）による急性損傷。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '鼠径部前面の深部痛（C-signで示すことが多い）、深屈曲・回旋でのつまり感・鋭痛、クリック・引っかかり感、長時間座位後の疼痛。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '症状のみで唇損傷を確定できない。腸腰筋・鼠径部の他病変との鑑別を要する。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（C-sign・鼠径部/外側/殿部）', '誘発動作（深屈曲・あぐら・車の乗降・長時間座位）',
      'クリック・引っかかり・不安定感の有無', '発症様式（外傷/緩徐）', '競技・ポジション・練習量',
      '小児期股関節疾患の既往（ペルテス・DDH等）', '腰椎・仙腸関節症状の有無', '医師の診断・画像検査の有無',
    ],
    physicalExam: [
      { text: '股関節ROM（屈曲・内旋の制限/疼痛はFAI合併の示唆）、腸腰筋・内転筋の圧痛/短縮、歩行・片脚立位の観察。', status: 'needs_pro_review' },
      { text: '腰椎・仙腸関節・鼠径部（ヘルニア等）のスクリーニングを併せて行う。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'FADIR test（前方インピンジメントテスト）',
        target: '前上方関節唇・FAI関連病変',
        method: '背臥位で股関節90°屈曲＋内転＋内旋。',
        positive: '鼠径部深部痛の再現',
        sensitivity: '高めと報告', specificity: '低いと報告',
        caution: '陽性でも特異的ではない（関節内病変全般で陽性となる）。陰性なら関節内病変の可能性は下がる。',
        status: 'needs_literature', refs: [0],
      },
      {
        name: 'FABER test',
        target: '股関節・仙腸関節のスクリーニング',
        method: '背臥位で股関節屈曲・外転・外旋（4の字）。',
        positive: '鼠径部痛（股関節性）／後方痛（仙腸関節性の示唆）',
        caution: '疼痛部位で解釈が変わる。距離の左右差は可動性の指標。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: 'FAI症候群', distinguishing: '唇損傷の背景病態として最多。画像形態＋症状＋所見の3要素で判断（Warwick合意）。' },
      { group: 'likely', name: '腸腰筋関連疼痛・弾発股', distinguishing: '腸腰筋走行部の圧痛・抵抗下屈曲での疼痛・可聴弾発。' },
      { group: 'likely', name: '内転筋関連鼠径部痛', distinguishing: '内転筋起始部圧痛・抵抗下内転痛（Doha分類）。' },
      { group: 'must_not_miss', name: '大腿骨頸部疲労骨折', distinguishing: 'ランナー・荷重時痛・夜間痛。疑えば荷重制限し医師へ。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '大腿骨頭壊死', distinguishing: 'ステロイド歴・飲酒歴・安静時痛。画像評価は医師判断。', urgency: 'confirm_md' },
      { group: 'similar', name: '腰椎由来の関連痛', distinguishing: '腰部所見・神経症状の有無で鑑別。' },
    ],
    redFlags: [
      { finding: '外傷後の荷重不能・激痛', action: '骨折・脱臼の除外。医療機関受診。', urgency: 'early_visit' },
      { finding: '夜間痛・安静時痛の持続＋危険因子（ステロイド・飲酒・悪性腫瘍歴）', action: '壊死・腫瘍・感染の除外は医師判断。担当医へ確認。', urgency: 'confirm_md' },
      { finding: '発熱を伴う股関節痛', action: '化膿性関節炎の除外。当日中に医療相談。', urgency: 'same_day' },
    ],
    imaging: [
      { text: '単純X線: 形態評価（FAI形態・形成不全・OA変化）の基本。唇自体は描出されない。', certainty: 'high', status: 'needs_md_review' },
      { text: 'MRI/MR関節造影: 唇損傷の評価に用いられるが、無症候者にも所見があるため症状との対応づけが必要。最終診断は医師。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    classification: [
      { text: '部位（前方/上方/後方）・形態（剥離/フラップ等）で記述される。背景病態（FAI/形成不全/不安定性）の併記が実務上重要。', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '第一選択として運動療法を含む保存療法が推奨されることが多い: 深部股関節安定筋・殿筋群の強化、体幹・骨盤制御、疼痛誘発肢位の一時的回避と動作修正。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '座位姿勢・車の乗降・スクワット深度などの負荷管理を並行する。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '保存療法抵抗例で股関節鏡（唇縫合・形態矯正）が検討される。適応判断は背景病態を含め医師が行う。形成不全例への鏡視下単独手術は慎重とされる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理・モーターコントロール期',
        period: '目安: 0〜6週',
        goals: ['疼痛誘発負荷の管理', '深部安定筋・殿筋の活性化'],
        allowed: ['疼痛のない範囲のROM・等尺性運動', '殿筋・体幹の低負荷トレーニング'],
        avoid: ['深屈曲＋回旋の反復', '疼痛を伴うストレッチの強行'],
        criteria: ['日常動作の疼痛軽減', '基本動作で誘発痛なし'],
      },
      {
        name: '筋力・動作再構築期',
        period: '目安: 6週以降（基準ベース）',
        goals: ['股関節周囲筋力の回復', '競技動作の再獲得'],
        allowed: ['漸増的筋力トレーニング', '段階的な競技動作'],
        avoid: ['症状再燃を無視した負荷増加'],
        criteria: ['片脚動作の質改善', '競技基本動作で症状なし'],
        mdCheck: '症状遷延時の画像評価・手術適応の相談',
      },
    ],
    returnCriteria: [
      { text: '疼痛なく競技特異的動作（方向転換・キック等）が反復できること、股関節周囲筋力・片脚動作の質、症状再燃がないことで判断する。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法で症状管理可能な例が多い一方、背景形態によっては症状が遷延し手術に移行する例もある。経過は背景病態に依存する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'iHOT-12', target: '股関節関連QOL（若年活動例）', range: '0-100（高いほど良好）' },
      { name: 'HAGOS', target: '股関節・鼠径部の症状/機能', range: '各0-100（高いほど良好）' },
      { name: 'NRS', target: '疼痛強度', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '股関節の受け皿のフチにある「関節唇」というクッション兼パッキンの組織を傷めた状態です。股関節の形や使い方の影響で負担がかかって起こることが多いです。',
      dos: ['お尻や体幹の筋肉を鍛える運動は股関節の負担を減らします', '痛みの出にくい座り方・動き方の工夫を一緒に見つけましょう'],
      donts: ['深くしゃがみ込む・あぐらで長時間過ごすなど痛みが出る姿勢の反復', '痛みを我慢したストレッチ'],
      seekCare: ['夜も痛みで眠れない状態が続く', '発熱を伴う股関節の痛み', '転倒後に体重をかけられない'],
      goal: '関節唇そのものより「股関節にかかる負担」を減らすことが目標です。筋力と動作を整え、痛みなく動ける範囲を広げていきます。',
    },
    motionCapture: [
      { movement: '片脚スクワット', purpose: '骨盤・股関節制御の評価', setup: '正面から全身。', watchFor: ['骨盤落下', '膝内側崩れ', '体幹側方傾斜'] },
      { movement: 'しゃがみ込み動作', purpose: '疼痛誘発深度と代償の評価', setup: '側面から。', watchFor: ['疼痛出現角度', '腰椎代償', '骨盤後傾のタイミング'] },
    ],
    references: [
      {
        authors: 'Griffin DR, Dickenson EJ, O\'Donnell J, et al.',
        title: 'The Warwick Agreement on femoroacetabular impingement syndrome (FAI syndrome): an international consensus statement',
        source: 'Br J Sports Med', year: 2016,
        note: 'FAI症候群の定義・診断・治療に関する国際合意。唇損傷の背景病態理解に必須。',
        verified: false,
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 大腿骨寛骨臼インピンジメント
  {
    id: 'fai-syndrome',
    category: 'hip',
    names: {
      ja: '大腿骨寛骨臼インピンジメント',
      en: 'Femoroacetabular Impingement (FAI) Syndrome',
      abbreviations: ['FAI', 'FAIS'],
      synonyms: ['股関節インピンジメント', 'femoroacetabular impingement'],
      note: 'Warwick合意（2016）では「症状＋臨床所見＋画像所見」の3要素が揃った場合にFAI症候群と定義される。画像形態のみでは診断しない。',
    },
    keywords: ['鼠径部痛', '深屈曲', 'cam', 'pincer', '内旋制限', 'FADIR', 'アスリート', '股関節'],
    overview: [
      { text: '大腿骨近位（cam形態）または寛骨臼（pincer形態）の形態的特徴により、股関節深屈曲・回旋時に骨性衝突が生じ、疼痛・唇/軟骨損傷につながりうる病態。', certainty: 'moderate', status: 'needs_md_review', refs: [0] },
      { text: '重要: cam/pincer形態は無症候者にも高頻度に存在する。形態＝疾患ではなく、症状・所見と揃って初めて「FAI症候群」となる。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: 'cam: 大腿骨頭頸部移行部の骨性隆起。pincer: 寛骨臼の過被覆。混合型も多い。衝突部位は前上方が典型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '若年〜中年の活動的な集団に多い。cam形態は成長期の高負荷スポーツ参加との関連が指摘されている。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    mechanism: [
      { text: '深屈曲・内旋での骨性衝突の反復 → 関節唇・軟骨境界部への負荷。症状発現には負荷量・可動域要求・筋機能も関与する多因子性。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '運動関連の鼠径部痛（深屈曲・回旋動作で誘発）、可動域制限感、長時間座位での違和感。C-sign。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位と誘発動作（しゃがみ・切り返し・キック）', '座位耐容時間', '競技歴（成長期からの種目・強度）',
      '発症経過（緩徐が典型）', '引っかかり・クリックの有無', '腰部症状の有無', '画像検査の有無と医師の説明',
    ],
    physicalExam: [
      { text: '屈曲・内旋可動域の制限/疼痛（健側比較）。殿筋・体幹機能、片脚スクワットの質を評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'FADIR test',
        target: 'FAI関連の関節内病変',
        method: '股関節90°屈曲＋内転＋内旋。',
        positive: '鼠径部深部痛の再現',
        sensitivity: '高い（除外に有用）と報告', specificity: '低いと報告',
        caution: '陽性のみで確定しない。Warwick合意の3要素で判断。',
        status: 'needs_literature', refs: [0],
      },
    ],
    differentials: [
      { group: 'likely', name: '股関節唇損傷', distinguishing: 'FAIの結果として併存することが多い。' },
      { group: 'likely', name: '鼠径部痛症候群（内転筋・腸腰筋・鼠径管related）', distinguishing: 'Doha分類に基づく触診・抵抗テストで区別。' },
      { group: 'must_not_miss', name: '大腿骨頸部疲労骨折', distinguishing: '荷重時痛の進行・夜間痛。疑えば荷重中止。', urgency: 'early_visit' },
      { group: 'similar', name: '寛骨臼形成不全・マイクロ不安定性', distinguishing: '過可動・不安定感が主体。治療方向が異なるため重要。' },
    ],
    redFlags: [
      { finding: '進行する夜間痛・安静時痛', action: '腫瘍・壊死・感染の除外は医師判断。担当医へ確認。', urgency: 'confirm_md' },
      { finding: '外傷後の急性激痛・荷重不能', action: '骨折除外のため受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '単純X線（正面＋側面）で形態評価。α角等の計測は医師・読影者による。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '形態所見は無症候者にも多い。画像だけで治療適応を決めない。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    classification: [
      { text: 'cam型／pincer型／混合型。症候群としての診断はWarwick 3要素による。', certainty: 'moderate', status: 'needs_md_review', refs: [0] },
    ],
    conservative: [
      { text: '運動療法（殿筋・深部安定筋・体幹の強化、動作修正、負荷管理）が第一選択として推奨される。手術との比較試験も報告されており、まず適切な保存療法を行う価値がある。', certainty: 'moderate', status: 'needs_literature', refs: [0, 1] },
      { text: '疼痛誘発域（深屈曲・内旋端）への強制ストレッチは推奨されない。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '適切な保存療法で改善しない症候性FAIに股関節鏡（形態矯正＋唇処置）が検討される。適応は医師判断。', certainty: 'moderate', status: 'needs_md_review', refs: [1] },
    ],
    rehabPhases: [
      {
        name: '負荷管理・活性化期',
        period: '目安: 0〜6週',
        goals: ['誘発負荷の管理', '殿筋・体幹の活性化'],
        allowed: ['疼痛のない範囲の筋力トレーニング', '動作修正練習'],
        avoid: ['深屈曲・内旋端への反復負荷', '疼痛を伴うストレッチ'],
        criteria: ['日常・基本動作の疼痛軽減'],
      },
      {
        name: '筋力・競技動作期',
        period: '目安: 6週〜（基準ベース）',
        goals: ['筋力の回復', '競技動作の再獲得'],
        allowed: ['漸増負荷トレーニング', '段階的競技復帰'],
        avoid: ['症状再燃の無視'],
        criteria: ['片脚動作の質', '競技動作で疼痛なし'],
        mdCheck: '改善不良時の手術適応相談',
      },
    ],
    returnCriteria: [
      { text: '誘発動作での疼痛消失、筋力・動作の質、段階的な競技負荷への耐容で判断。可動域の「正常化」を必須条件としない（形態due の制限は残りうる）。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存・手術いずれでも改善報告がある。長期的な関節症進行との関連が研究されているが結論は定まっていない。', certainty: 'divided', status: 'needs_literature', level: 'pro' },
    ],
    outcomes: [
      { name: 'iHOT-12/33', target: '股関節関連QOL', range: '0-100（高いほど良好）' },
      { name: 'HAGOS', target: '股関節・鼠径部機能', range: '各0-100' },
    ],
    patientExplanation: {
      whatIs: '股関節の骨の形の個性によって、深く曲げたときに骨どうしがぶつかりやすく、痛みが出ている状態です。形そのものは病気ではなく、痛みなく生活している人もたくさんいます。',
      dos: ['お尻・体幹の筋トレで股関節の使い方を整えましょう', '痛みの出る深さ・角度を避けた動作の工夫を続けましょう'],
      donts: ['痛みが出る深いしゃがみ込みの反復', '可動域を無理に広げようとするストレッチ'],
      seekCare: ['夜間・安静時の痛みが続く', '急に体重をかけられなくなった'],
      goal: '骨の形を変えなくても、筋力と動作の工夫で痛みなく動ける範囲を広げることを目指します。改善が乏しい場合は手術も選択肢として医師と相談します。',
    },
    motionCapture: [
      { movement: 'スクワット（深さ段階）', purpose: '疼痛誘発深度・骨盤運動の評価', setup: '側面から。', watchFor: ['骨盤後傾の早期出現', '疼痛出現角度', '腰椎代償'] },
      { movement: '片脚スクワット', purpose: '股関節制御の評価', setup: '正面から。', watchFor: ['骨盤落下', '膝内側崩れ'] },
    ],
    references: [
      {
        authors: 'Griffin DR, Dickenson EJ, O\'Donnell J, et al.',
        title: 'The Warwick Agreement on femoroacetabular impingement syndrome (FAI syndrome): an international consensus statement',
        source: 'Br J Sports Med', year: 2016, verified: false,
        note: '定義・診断・治療の国際合意。',
      },
      {
        authors: 'Griffin DR, Dickenson EJ, Wall PDH, et al.',
        title: 'Hip arthroscopy versus best conservative care for the treatment of femoroacetabular impingement syndrome (UK FASHIoN): a multicentre randomised controlled trial',
        source: 'Lancet', year: 2018, verified: false,
        note: '鏡視下手術と保存療法のRCT。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 寛骨臼形成不全
  {
    id: 'acetabular-dysplasia',
    category: 'hip',
    names: {
      ja: '寛骨臼形成不全',
      en: 'Acetabular Dysplasia / Developmental Dysplasia of the Hip (adult)',
      abbreviations: ['DDH', '臼蓋形成不全'],
      synonyms: ['臼蓋形成不全', 'hip dysplasia'],
      note: '「臼蓋形成不全」の名称も広く使われる。成人期の症候性形成不全を主対象として記載。',
    },
    keywords: ['被覆不足', '女性', '鼠径部痛', '長距離歩行', '不安定', 'CE角', '骨切り'],
    overview: [
      { text: '寛骨臼の被覆が不足し、荷重面積の減少・関節唇や軟骨への負荷集中・不安定性を生じやすい形態。若年女性の股関節痛の重要な背景病態。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '変形性股関節症の主要な前駆病態とされる（特に日本では二次性股OAの背景として頻度が高いと報告される）。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '被覆不足により関節唇が肥大し荷重を代償することがあり、唇損傷・傍唇嚢腫を伴いやすい。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '女性に多い。乳児期のDDH・家族歴と関連。日常負荷（長距離歩行・立ち仕事）で症状が顕在化することが多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '被覆不足→単位面積あたりの荷重増大・辺縁部への応力集中→唇・軟骨障害→症状・OA進行、という力学的経路が想定される。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '労作後の鼠径部〜外側部痛、易疲労感、長距離歩行での増悪、不安定感。急な激痛は唇損傷の合併を示唆することがある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '乳児期の股関節疾患・治療歴（リーメンビューゲル等）', '家族歴', '疼痛と活動量の関係（歩行距離・立ち仕事）',
      '不安定感・引っかかりの有無', '出産歴・育児動作の負荷', '医師の診断・X線計測値の説明の有無',
    ],
    physicalExam: [
      { text: '可動域はむしろ過大なことがある。外転筋筋力・Trendelenburg徴候、片脚立位の骨盤制御を評価。', status: 'needs_pro_review' },
      { text: '過度な可動域端ストレッチや強い牽引は不安定性を悪化させうるため評価時も注意。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'FADIR / FABER',
        target: '関節内病変・唇損傷合併のスクリーニング',
        method: '標準手技に準ずる。',
        positive: '鼠径部痛の再現',
        caution: '形成不全の確定は画像（X線計測）による。徒手検査は合併病変の示唆に留まる。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '股関節唇損傷（合併）', distinguishing: '形成不全に高率に合併。急性増悪時に疑う。' },
      { group: 'likely', name: '大転子部痛症候群', distinguishing: '外側の限局圧痛。外転筋への過負荷として併存も。' },
      { group: 'must_not_miss', name: '変形性股関節症（進行）', distinguishing: 'X線での関節裂隙狭小化。方針が変わるため医師評価。', urgency: 'confirm_md' },
      { group: 'similar', name: '腰椎由来の痛み', distinguishing: '腰部所見で鑑別。' },
    ],
    redFlags: [
      { finding: '急激な疼痛悪化・荷重困難', action: '唇損傷・軟骨障害の進行等の評価は医師判断。早期受診。', urgency: 'early_visit' },
      { finding: '発熱を伴う股関節痛', action: '感染除外。当日中に医療相談。', urgency: 'same_day' },
    ],
    imaging: [
      { text: '単純X線（立位正面）が基本。CE角・Sharp角・AHI等の計測により評価される（計測・判定は医師）。', certainty: 'high', status: 'needs_md_review' },
      { text: '境界域の判定・骨切り術適応の検討には追加撮影・3D評価が用いられることがある。', status: 'needs_md_review', level: 'pro' },
    ],
    classification: [
      { text: 'CE角等による重症度区分（正常/境界型/形成不全）が用いられるが、カットオフは文献により幅がある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    conservative: [
      { text: '外転筋・深部安定筋・体幹の強化、荷重負荷の管理（連続歩行距離・立位時間の調整）、体重管理、杖の活用等。若年症候例では骨切り術の適応評価と並行して行われることが多い。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '可動域端への強いストレッチ・過度な開脚練習は推奨されない。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '症候性の若年例では寛骨臼回転骨切り術（RAO/PAO）等の温存手術が検討される。進行OA例ではTHA。適応判断は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷管理・筋機能改善期',
        period: '目安: 継続的',
        goals: ['疼痛と活動量のバランス確立', '外転筋・体幹の強化'],
        allowed: ['非荷重〜低負荷の筋力トレーニング（水中運動・自転車含む）'],
        avoid: ['長距離歩行等の疼痛誘発負荷の急増', '可動域端への強制ストレッチ'],
        criteria: ['活動後疼痛の管理が可能', '片脚立位の骨盤制御改善'],
        mdCheck: '若年症候例では温存手術適応の評価を並行',
      },
    ],
    returnCriteria: [
      { text: '「完治」ではなく、疼痛をコントロールしながら活動を維持できることを目標に設定する。競技例は負荷耐容性を段階確認。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '形態の程度・年齢・活動量によりOA進行リスクが異なる。骨切り術は適応例で長期成績の報告があるが、判断は医師による。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'HOOS', target: '股関節の痛み・機能・QOL', range: '各0-100' },
      { name: 'iHOT-12', target: '若年活動例のQOL', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '股関節の受け皿（骨盤側のくぼみ）が生まれつきやや浅く、関節の一部に負担が集中しやすい状態です。',
      dos: ['お尻まわり・体幹の筋トレで関節を守りましょう', '痛みと相談しながら活動量を調整しましょう（自転車・水中運動は負担が少なめです）'],
      donts: ['痛みが出るほどの長距離歩行や立ちっぱなしの継続', '無理な開脚ストレッチ'],
      seekCare: ['急に痛みが強くなった・体重をかけにくい', '痛みで生活に支障が続く（手術を含む相談のタイミングです）'],
      goal: '受け皿の浅さ自体は変えられませんが、筋肉で支える力と生活の工夫で、痛みを抑えて活動を続けることを目指します。必要に応じて医師と手術の相談も行います。',
    },
    motionCapture: [
      { movement: '歩行', purpose: 'Trendelenburg・Duchenne歩行の評価', setup: '正面＋側面。', watchFor: ['骨盤落下', '体幹側方動揺', '歩幅の左右差'] },
      { movement: '片脚立位', purpose: '骨盤制御の評価', setup: '正面から。', watchFor: ['骨盤落下', '体幹代償'] },
    ],
    references: [
      {
        authors: '日本整形外科学会診療ガイドライン委員会（編）',
        title: '変形性股関節症診療ガイドライン',
        source: '南江堂', year: 2016,
        note: '国内ガイドライン（形成不全と二次性OAの記載を含む）。版は原本確認待ち。',
        verified: false,
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 境界型寛骨臼形成不全
  {
    id: 'borderline-dysplasia',
    category: 'hip',
    names: {
      ja: '境界型寛骨臼形成不全',
      en: 'Borderline Acetabular Dysplasia',
      abbreviations: ['BDDH'],
      synonyms: ['ボーダーライン形成不全', 'borderline dysplasia'],
      note: '「境界型」の定義（CE角の範囲）は文献間で揺れがあり、単一の合意はない。',
    },
    keywords: ['CE角', '不安定性', 'FAIとの鑑別', '若年女性', '鼠径部痛'],
    overview: [
      { text: '寛骨臼被覆が正常と形成不全の中間にある形態。症状の主因が「不安定性」か「インピンジメント」かの判断が難しく、治療方針の議論が続いている領域。', certainty: 'divided', status: 'needs_md_review' },
      { text: '同じ画像形態でも病態は個人で異なりうるため、身体所見・症状パターンを合わせた個別評価が不可欠。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '軽度の被覆不足に、関節包弛緩・唇肥大・cam形態などが複合しうる。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '若年活動例（特に女性・過可動傾向）で症候化しやすいとされる。', certainty: 'low', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '不安定性優位型（過可動・筋制御不良）とインピンジ優位型（cam合併等）が混在し、負荷様式により症状が生じると考えられている。', certainty: 'divided', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '労作時鼠径部痛・不安定感・易疲労感。伸展域での前方不安感（apprehension）は不安定性優位を示唆することがある。', certainty: 'low', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '不安定感の有無・誘発肢位（伸展/深屈曲どちらで悪化するか）', '全身の過可動傾向（他関節の緩さ）',
      'ダンス・新体操等の可動域要求競技歴', '疼痛と活動量の関係', '医師の画像評価・方針説明の有無',
    ],
    physicalExam: [
      { text: '可動域（過大/制限のパターン）、全身弛緩性（Beightonスコア等）、外転筋・深部安定筋機能、伸展外旋位での前方不安感。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '前方apprehensionテスト（伸展外旋）',
        target: '前方マイクロ不安定性',
        method: '腹臥位または背臥位で伸展・外旋を加える。',
        positive: '不安感・前方の疼痛再現',
        caution: '診断精度の確立したデータは限られる。総合判断の一材料。',
        status: 'insufficient',
      },
    ],
    differentials: [
      { group: 'likely', name: 'FAI症候群', distinguishing: '屈曲内旋での衝突痛が主体。治療方向が異なるため重要。' },
      { group: 'likely', name: '股関節マイクロ不安定性', distinguishing: '概念的に重複。過可動・伸展域での症状。' },
      { group: 'must_not_miss', name: '進行性の軟骨障害', distinguishing: '急速な症状悪化時は医師評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '急激な疼痛悪化・荷重困難', action: '構造的破綻の評価は医師判断。早期受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線計測（CE角等）で「境界域」と判定されるが、閾値は文献で揺れる。機能評価と合わせた総合判断が必要（判断は医師）。', certainty: 'divided', status: 'needs_md_review' },
    ],
    classification: [
      { text: '確立した重症度分類はない。不安定性優位/インピンジ優位の病態推定が治療方針に影響する（見解が分かれる領域）。', certainty: 'divided', status: 'needs_literature' },
    ],
    conservative: [
      { text: 'まず十分な保存療法（深部安定筋・殿筋・体幹強化、動作修正、負荷管理）を行うことに異論は少ない。不安定性優位が疑われる例では可動域端ストレッチを避ける。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '手術選択（鏡視下 vs 骨切り）は専門家間でも見解が分かれる領域であり、専門施設での評価が望ましい。', certainty: 'divided', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '安定化トレーニング期',
        period: '目安: 3〜6ヶ月単位で評価',
        goals: ['深部安定筋・殿筋の機能改善', '症状の出ない活動範囲拡大'],
        allowed: ['閉鎖的低負荷から漸増する筋力トレーニング'],
        avoid: ['可動域端への強制ストレッチ', '不安定感を伴う動作の反復'],
        criteria: ['不安定感の軽減', '片脚動作の質改善'],
        mdCheck: '3〜6ヶ月の保存療法で改善不十分な場合の専門評価',
      },
    ],
    returnCriteria: [
      { text: '不安定感なく競技動作を反復できること、筋機能・動作の質の改善で段階判断。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '適切な保存療法で症状管理できる例が報告される一方、経過や手術移行率のまとまったデータは限られる。', certainty: 'low', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'iHOT-12', target: '股関節関連QOL', range: '0-100' },
      { name: 'HAGOS', target: '股関節・鼠径部機能', range: '各0-100' },
    ],
    patientExplanation: {
      whatIs: '股関節の受け皿の深さが「浅め と 標準」の中間にあるタイプです。人によって「ゆるさ」が問題の場合と「ぶつかり」が問題の場合があり、専門的な見極めが大切な状態です。',
      dos: ['股関節を支えるインナーマッスルとお尻の筋トレを継続しましょう'],
      donts: ['無理なストレッチで可動域を広げようとすること', '不安定感が出る動きの反復'],
      seekCare: ['痛みや不安定感が数ヶ月続いて改善しない（専門医への相談を検討）'],
      goal: 'まずは筋肉で支える力をつけて症状を抑えることを目指します。改善が乏しければ、専門施設で手術を含めた相談を行います。',
    },
    motionCapture: [
      { movement: '片脚立位・片脚スクワット', purpose: '骨盤・股関節制御の評価', setup: '正面から。', watchFor: ['骨盤落下', '過剰な体幹代償', '不安定感の訴え'] },
    ],
    references: [
      {
        authors: 'Griffin DR, Dickenson EJ, O\'Donnell J, et al.',
        title: 'The Warwick Agreement on femoroacetabular impingement syndrome (FAI syndrome)',
        source: 'Br J Sports Med', year: 2016, verified: false,
        note: '境界型の議論はFAI・不安定性双方の文脈で扱われる。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 股関節マイクロ不安定性
  {
    id: 'hip-microinstability',
    category: 'hip',
    names: {
      ja: '股関節マイクロ不安定性',
      en: 'Hip Microinstability',
      abbreviations: [],
      synonyms: ['股関節不安定症', 'hip instability'],
      note: '確立した診断基準がなく、概念として発展途上の病態。過剰診断にも過小評価にも注意。',
    },
    keywords: ['過可動', 'ゆるさ', '不安定感', 'ダンス', '新体操', 'apprehension'],
    overview: [
      { text: '骨性支持・関節包靱帯・筋制御の複合的な破綻により、生理的範囲を超えた微小な関節動揺が症状を生むとされる概念的病態。診断基準は確立していない。', certainty: 'insufficient', status: 'needs_md_review' },
      { text: '可動域要求の高い競技（ダンス・新体操・フィギュア等）や全身弛緩性のある例で疑われることが多い。', certainty: 'low', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '腸骨大腿靱帯を中心とする関節包靱帯・関節唇のsuction seal・深部筋（腸腰筋・小殿筋等）が安定化に寄与する。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: 'まとまった疫学データは乏しい。若年女性・過可動例に多いとする報告が中心。', certainty: 'insufficient', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '反復する可動域端負荷（伸展・外旋等）による関節包の伸長、形態要因（境界型形成不全）、筋制御不良の複合。', certainty: 'low', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '不安定感・「外れそうな感じ」、可動域端での疼痛、クリック、長時間立位・伸展動作での増悪。', certainty: 'low', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '不安定感の具体的な場面（伸展・ターン・キック等）', '全身の関節のゆるさの自覚', '競技歴（可動域要求）',
      '脱臼・亜脱臼エピソードの有無', '医師の評価・画像所見',
    ],
    physicalExam: [
      { text: '全身弛緩性（Beightonスコア）、可動域（過大パターン）、深部筋機能、伸展外旋での不安感。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Hyperextension-external rotation (HEER) / apprehensionテスト',
        target: '前方関節包・不安定性',
        method: '伸展＋外旋ストレスで前方の症状を誘発。',
        positive: '不安感・前方痛の再現',
        caution: '診断精度データは限定的。単独で確定しない。',
        status: 'insufficient',
      },
    ],
    differentials: [
      { group: 'likely', name: '境界型形成不全', distinguishing: '画像形態評価で判断（医師）。' },
      { group: 'likely', name: '股関節唇損傷', distinguishing: '併存しうる。引っかかり感が主体なら唇病変を疑う。' },
      { group: 'similar', name: 'FAI症候群', distinguishing: '屈曲内旋の衝突痛が主体。治療方向が異なる。' },
    ],
    redFlags: [
      { finding: '明らかな脱臼・亜脱臼エピソード', action: '外傷性不安定性として医師評価を優先。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '単独で確定できる画像所見はない。形態（被覆・cam）評価と合わせて総合判断される（医師）。', certainty: 'insufficient', status: 'needs_md_review' },
    ],
    classification: [
      { text: '確立した分類はない。', certainty: 'insufficient', status: 'insufficient' },
    ],
    conservative: [
      { text: '第一選択は保存療法: 深部安定筋（腸腰筋・小殿筋）・殿筋群の強化、可動域端負荷の管理、競技動作の修正。関節包へのストレッチは避ける。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '保存療法抵抗例で関節包縫縮等が検討されることがあるが、適応・成績のエビデンスは限定的（医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '深部安定化期',
        period: '目安: 8〜12週',
        goals: ['深部筋の再教育', '可動域端負荷の削減'],
        allowed: ['低負荷・コントロール重視の筋力トレーニング'],
        avoid: ['可動域端でのスイング・キックの反復', 'ストレッチによる可動域拡大'],
        criteria: ['不安定感の軽減', '基本動作の制御改善'],
      },
      {
        name: '競技動作再構築期',
        period: '目安: 12週以降',
        goals: ['競技可動域を「制御下」で使える状態'],
        allowed: ['段階的な競技動作（制御確認しながら）'],
        avoid: ['疲労時の可動域端動作の乱用'],
        criteria: ['競技動作で不安感なし', '疲労時も制御維持'],
      },
    ],
    returnCriteria: [
      { text: '不安感なく競技特異的可動域を制御して使えること。可動域の大きさではなく制御の質で判断。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '長期経過のデータは乏しい。筋制御の改善で症状管理できる例が多いとする専門家意見が中心。', certainty: 'expert', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'iHOT-12', target: '股関節関連QOL', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '股関節が本来より少しゆるく、深いところで支えきれずに不安定感や痛みが出ている状態と考えられています。体が柔らかい方や、大きく脚を動かす競技の方に見られます。',
      dos: ['股関節の奥の筋肉を鍛えるトレーニングを地道に続けましょう'],
      donts: ['さらに柔らかくするためのストレッチ', '「外れそう」と感じる動きの繰り返し'],
      seekCare: ['実際に外れた感じがした・戻らない', '痛みが増え続ける'],
      goal: '柔らかさはあなたの武器でもあります。筋肉でコントロールする力をつけて、武器を安全に使える状態を目指します。',
    },
    motionCapture: [
      { movement: '競技特異動作（デヴェロッペ・キック等）', purpose: '可動域端の制御評価', setup: '正面＋側面。', watchFor: ['骨盤代償', '体幹の崩れ', '不安感の出る角度'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 大腿骨頭壊死
  {
    id: 'onfh',
    category: 'hip',
    names: {
      ja: '大腿骨頭壊死',
      en: 'Osteonecrosis of the Femoral Head',
      abbreviations: ['ONFH', 'AVN'],
      synonyms: ['大腿骨頭壊死症', '特発性大腿骨頭壊死症', 'avascular necrosis'],
      note: '特発性大腿骨頭壊死症は国の指定難病。診断・病型判定は医師（多くは専門医）による。',
    },
    keywords: ['ステロイド', 'アルコール', '股関節痛', '急な痛み', '圧潰', '指定難病'],
    overview: [
      { text: '大腿骨頭の血流障害により骨組織が壊死する疾患。壊死自体は無症状のことが多く、圧潰（骨頭のつぶれ）が生じた時期に疼痛が出現するのが典型。', certainty: 'moderate', status: 'needs_md_review' },
      { text: 'リハビリ職・柔整師の役割は早期疑いと医師への確実な紹介、および医師の方針（保存/手術）に沿った荷重管理・機能維持。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '大腿骨頭は血行支配が乏しく（大腿骨頭栄養血管の終末支配）、血流障害に脆弱。壊死域の位置・大きさが圧潰リスクに関わる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '危険因子: ステロイド大量投与歴・アルコール多飲。30〜50歳代に多く、両側例も少なくない。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    mechanism: [
      { text: '血流障害の機序は多因子（脂肪塞栓・血管障害等の仮説）で完全には解明されていない。', certainty: 'low', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '比較的急な股関節部痛（鼠径部・殿部・大腿部）で発症することが多い。初期はX線で異常が出ないことがある。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    interviewItems: [
      'ステロイド使用歴（量・期間・原疾患）', '飲酒歴（量・期間）', '疼痛の発症様式（急性か）',
      '夜間痛・安静時痛の有無', '対側の症状', '基礎疾患（SLE等）', '既に医師の診断・病型説明があるか',
    ],
    physicalExam: [
      { text: '可動域制限（特に内旋）・跛行・荷重時痛。所見は非特異的であり、危険因子＋急性発症の組み合わせで疑うことが重要。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '大腿骨頸部骨折・脆弱性骨折', distinguishing: '高齢・骨粗鬆症・軽微な外傷。荷重不能なら即受診。', urgency: 'emergency' },
      { group: 'likely', name: '変形性股関節症', distinguishing: '緩徐進行・X線所見。急性発症＋危険因子ならONFHを優先的に疑う。' },
      { group: 'similar', name: '一過性大腿骨頭萎縮症', distinguishing: '妊娠後期・中年男性の急性股関節痛。医師の画像評価による。' },
    ],
    redFlags: [
      { finding: 'ステロイド・飲酒歴のある急性股関節痛', action: '本疾患を疑い早期に整形外科受診（MRIの適応判断は医師）。', urgency: 'early_visit' },
      { finding: '急激な疼痛悪化・荷重不能', action: '圧潰進行・骨折の可能性。早期受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '初期はX線正常のことがあり、MRIが早期診断に有用（band像等）。撮影適応・病型判定は医師による。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '病型分類（壊死域の位置・範囲）と病期分類（圧潰の程度）が用いられ、治療選択・予後と関連する（判定は医師）。', certainty: 'moderate', status: 'needs_md_review', refs: [0] },
    ],
    conservative: [
      { text: '医師の方針に基づく荷重管理（杖・免荷）・生活指導・筋力維持が中心。リハビリ側で荷重条件を独自に変更しない。', certainty: 'expert', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '骨切り術（温存）・人工股関節置換術等が病型・病期・年齢により選択される（医師判断）。術後リハは術式に応じたプロトコルに従う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '医師方針に基づく管理期',
        period: '病期・治療方針による',
        goals: ['指示された荷重条件の遵守', '可動域・筋力の維持', '疼痛管理'],
        allowed: ['免荷・部分荷重下での筋力維持運動', '非荷重の有酸素運動（指示範囲）'],
        avoid: ['指示を超える荷重', '衝撃負荷（ジャンプ・ランニング）'],
        criteria: ['医師の再評価に基づく段階変更'],
        mdCheck: '荷重条件・活動制限の全変更',
      },
    ],
    returnCriteria: [
      { text: '活動レベルの決定は病期・圧潰リスクに基づき医師が行う。機能評価はその範囲内で実施する。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '壊死域の大きさ・位置により、圧潰せず経過する例から早期に手術を要する例まで幅広い。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    outcomes: [
      { name: 'JHEQ / HOOS', target: '股関節の症状・QOL', range: '尺度による' },
      { name: 'NRS', target: '疼痛強度', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '太ももの骨の先端（骨頭）への血流が悪くなり、骨の一部が弱くなる病気です。ステロイド治療やお酒との関連が知られています。専門医による診断と経過観察がとても大切です。',
      dos: ['医師から指示された体重のかけ方（杖・免荷）を守りましょう', '関節を守りながら筋力を保つ運動を続けましょう'],
      donts: ['自己判断で杖をやめる・運動量を増やすこと', 'ジャンプやランニングなどの衝撃'],
      seekCare: ['痛みが急に強くなった', '体重をかけられなくなった'],
      goal: '骨頭を守りながら、生活に必要な筋力・動きを維持することが目標です。治療方針は病気の型と時期によって医師が判断します。',
    },
    motionCapture: [
      { movement: '歩行（補助具使用下）', purpose: '指示荷重の遵守・歩容評価', setup: '正面＋側面。', watchFor: ['指示以上の荷重', '疼痛性跛行', '体幹代償'] },
    ],
    references: [
      {
        authors: '厚生労働省 特発性大腿骨頭壊死症研究班／日本整形外科学会',
        title: '特発性大腿骨頭壊死症の診断基準・病型分類・病期分類',
        source: '診療ガイドライン関連資料', year: 2019,
        note: '国内の診断基準・分類。版・年は原本確認待ち。',
        verified: false,
      },
    ],
    meta: draftMeta(),
  },
]
