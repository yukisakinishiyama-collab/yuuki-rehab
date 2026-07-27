// 疾患ページ: 脊椎カテゴリ 1/2（下書き・医師監修前）
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

export const SPINE_PAGES_1: DiseasePage[] = [
  // ───────────────────────────── 非特異的腰痛
  {
    id: 'nonspecific-lbp',
    category: 'spine',
    names: {
      ja: '非特異的腰痛',
      en: 'Non-specific Low Back Pain',
      abbreviations: ['NSLBP'],
      synonyms: ['腰痛症', 'ぎっくり腰（急性）', '慢性腰痛'],
      note: '腰痛の大多数を占める。「原因不明」ではなく「重篤疾患・特異的病態が除外された腰痛」を意味する。',
    },
    keywords: ['腰痛', 'ぎっくり腰', 'デスクワーク', '慢性', '恐怖回避', '心理社会的'],
    overview: [
      { text: '重篤な疾患（骨折・腫瘍・感染）や明確な神経障害を除外した後に残る腰痛の総称で、腰痛の大部分を占める。急性の多くは数週間で軽快する自然経過をもつ。', certainty: 'high', status: 'needs_literature', refs: [0] },
      { text: '国際的なガイドラインは、安静ではなく活動維持・運動療法・教育を中核とし、画像のルーチン使用と過度な医療化を避けることを推奨している。', certainty: 'high', status: 'needs_literature', refs: [0] },
      { text: '慢性化には心理社会的要因（恐怖回避・破局的思考・職場要因等: yellow flags）が関与し、身体面と並行した評価・対応が必要。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '椎間板・椎間関節・筋筋膜・仙腸関節など複数の組織が痛みに関与しうるが、多くの症例で単一の痛み源の特定は困難かつ管理上必須でない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    epidemiology: [
      { text: '生涯有病率は極めて高く、労働損失の主要因。再発が多いのも特徴。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '負荷要因（急な重量物・不慣れな作業）・身体要因（体力・筋機能）・心理社会的要因・睡眠等の複合。組織損傷の程度と疼痛強度は一致しないことが多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '腰部〜殿部の疼痛。動作時痛が主体で、姿勢・動作により変動する。下肢の神経症状（強いしびれ・筋力低下）を伴う場合は別評価。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      'レッドフラッグの確認（後述の各項目）', '発症状況・増悪/軽快因子・日内変動',
      '下肢症状（しびれ・筋力・膀胱直腸）の有無', '仕事・生活への影響と本人の懸念',
      '恐怖回避・破局的思考の兆候（「動くと壊れる」等の信念）', '睡眠・ストレス状況',
      '過去の腰痛歴と経過', '本人の目標',
    ],
    physicalExam: [
      { text: '可動性（方向別の症状反応）・神経学的スクリーニング（筋力・感覚・反射・SLR）・疼痛誘発/軽減動作の同定・機能テスト（立ち座り・歩行耐容）。', status: 'needs_pro_review' },
      { text: '所見は「重篤疾患の除外」と「管理方針の手がかり」のために取り、細かな構造診断に固執しない。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'SLR（下肢伸展挙上テスト）',
        target: '神経根性疼痛のスクリーニング',
        method: '背臥位で伸展位の下肢を他動挙上。',
        positive: '下肢放散痛の再現（腰部限局痛のみは陰性扱い）',
        caution: '陽性なら神経根症の評価へ（ヘルニアページ参照）。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '椎体骨折（高齢・骨粗鬆症・外傷）', distinguishing: '急性発症・叩打痛・危険因子。X線評価。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '悪性腫瘍・感染（脊椎炎）', distinguishing: '安静時/夜間痛・発熱・体重減少・癌既往。', urgency: 'same_day' },
      { group: 'must_not_miss', name: '馬尾症候群', distinguishing: '膀胱直腸障害・サドル麻痺・両側下肢症状。緊急。', urgency: 'emergency' },
      { group: 'likely', name: '腰椎椎間板ヘルニア・狭窄症', distinguishing: '下肢優位の症状。各ページ参照。' },
      { group: 'similar', name: '股関節疾患・仙腸関節痛', distinguishing: '股関節所見・限局部位で鑑別。' },
    ],
    redFlags: [
      { finding: '膀胱直腸障害・会陰部のしびれ・進行する両下肢麻痺', action: '馬尾症候群疑い。直ちに救急受診。', urgency: 'emergency' },
      { finding: '発熱を伴う腰痛・注射/手術後・免疫低下', action: '脊椎感染の除外。当日中に医療相談。', urgency: 'same_day' },
      { finding: '癌の既往＋新規腰痛・夜間増悪・体重減少', action: '転移の除外。早期受診。', urgency: 'early_visit' },
      { finding: '高齢者・骨粗鬆症・外傷後の急性腰痛', action: '椎体骨折の除外。早期受診。', urgency: 'early_visit' },
      { finding: '進行する下肢筋力低下', action: '神経障害の評価。早期受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'レッドフラッグのない急性腰痛にルーチンの画像は推奨されない。無症候者にも椎間板変性・膨隆は高頻度で、画像所見の伝え方が症状を悪化させうる点に留意。', certainty: 'high', status: 'needs_literature', refs: [0] },
    ],
    classification: [
      { text: '経過（急性/亜急性/慢性）と、治療反応・心理社会的リスク（STarT Back等の層別）による分類が実用的。', certainty: 'moderate', status: 'needs_literature' },
    ],
    conservative: [
      { text: '急性: 教育（良性の経過・活動維持の推奨）＋耐えられる範囲の活動継続。安静臥床は推奨されない。', certainty: 'high', status: 'needs_literature', refs: [0] },
      { text: '亜急性〜慢性: 運動療法（種類は本人の嗜好・継続性を重視: 筋力・有酸素・モーターコントロール等）＋心理社会的要因への対応＋段階的な活動目標設定。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '徒手療法・物理療法は運動療法の補助として位置づける。受動的治療への依存を作らない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '非特異的腰痛そのものへの手術適応は原則ない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    rehabPhases: [
      {
        name: '急性期',
        period: '0〜2週',
        goals: ['疼痛の管理と活動維持', '不安の軽減（教育）'],
        allowed: ['耐えられる範囲の日常活動・歩行', '楽な方向への運動'],
        avoid: ['長期の安静臥床', '恐怖を強める説明・表現'],
        criteria: ['日常活動の再開'],
      },
      {
        name: '回復期',
        period: '2〜6週',
        goals: ['機能の全面回復', '再発予防の運動習慣'],
        allowed: ['漸増的な筋力・有酸素運動', '職場/競技動作の段階再開'],
        avoid: ['痛みゼロを復帰条件にすること'],
        criteria: ['仕事・生活の通常化'],
      },
      {
        name: '慢性期（該当例）',
        period: '3ヶ月以降',
        goals: ['活動性・QOLの向上', 'セルフマネジメントの確立'],
        allowed: ['目標指向の段階的運動', '認知面へのアプローチ併用'],
        avoid: ['原因探しの検査反復・受動的治療への依存'],
        criteria: ['本人目標の達成度'],
      },
    ],
    returnCriteria: [
      { text: '疼痛の完全消失ではなく、仕事・生活・競技の目標活動を許容範囲の症状で遂行できることを基準とする。', certainty: 'moderate', status: 'needs_literature' },
    ],
    prognosis: [
      { text: '急性例の多くは数週で改善するが再発は多い。恐怖回避・仕事不満足等は遷延の予測因子。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'RDQ / ODI', target: '腰痛による機能障害', range: '尺度による' },
      { name: 'PSFS', target: '患者特異的な機能目標', range: '0-10' },
      { name: 'STarT Back', target: '予後リスク層別', range: '層別ツール' },
    ],
    patientExplanation: {
      whatIs: '検査で危険な病気が否定された、最も一般的なタイプの腰痛です。腰痛の約9割がこのタイプで、多くは数週間で良くなっていきます。',
      dos: ['痛みが強くても、できる範囲で日常の活動や歩行を続けることが一番の薬です', '楽に動ける方向の運動から始めましょう'],
      donts: ['ずっと寝て安静にすること（回復を遅らせます）', '「腰が壊れている」と考えて動作を全部避けること'],
      seekCare: ['おしっこ・便が出にくい/漏れる、お尻まわりのしびれ（すぐ救急へ）', '発熱を伴う', '夜どんどん痛くなる・体重が減る', '脚の力がどんどん入らなくなる'],
      goal: '痛みと上手に付き合いながら活動を取り戻し、運動習慣で再発しにくい腰を作ることが目標です。',
    },
    motionCapture: [
      { movement: '立ち座り・持ち上げ動作', purpose: '恐怖回避的な動作パターンの評価', setup: '側面。', watchFor: ['過度に慎重な動作', '腰部の過剰な固定', '回避行動'] },
    ],
    references: [
      {
        authors: '日本整形外科学会・日本腰痛学会（監修）',
        title: '腰痛診療ガイドライン',
        source: '南江堂', year: 2019,
        note: '国内ガイドライン。版は原本確認待ち。',
        verified: false,
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 腰椎椎間板ヘルニア
  {
    id: 'lumbar-disc-herniation',
    category: 'spine',
    names: {
      ja: '腰椎椎間板ヘルニア',
      en: 'Lumbar Disc Herniation',
      abbreviations: ['LDH'],
      synonyms: ['椎間板ヘルニア', '坐骨神経痛（症状名）'],
      note: '多くは保存療法で軽快し、ヘルニア自体の自然退縮も知られる。馬尾症候群のみが絶対的緊急。',
    },
    keywords: ['坐骨神経痛', '下肢のしびれ', '前かがみで悪化', 'SLR', '20-40代', '自然退縮'],
    overview: [
      { text: '椎間板の髄核が線維輪を破って突出し、神経根を圧迫・刺激して下肢痛（radicular pain）を生じる疾患。L4/5・L5/S1が好発。', certainty: 'high', status: 'needs_md_review' },
      { text: '多くは保存療法で数週〜数ヶ月で軽快し、ヘルニア塊の自然退縮も高頻度に報告される。馬尾症候群・進行麻痺を除き、まず保存が原則。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '後外側突出が多く、通過神経根（例: L4/5ヘルニアでL5根）を障害するのが典型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '20〜40代に多い。無症候者のMRIでもヘルニア所見は珍しくない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '椎間板変性を背景に、屈曲・回旋・持ち上げ負荷などを契機として発症することが多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '片側下肢の放散痛（腰痛より下肢痛が主体のことが多い）・しびれ・筋力低下。咳嗽・前屈・座位で増悪する例が多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '下肢痛の分布（デルマトーム）', '増悪因子（座位・前屈・咳）', '筋力低下の自覚（つまずき・爪先/踵立ち）',
      '膀胱直腸症状（緊急評価）', '経過（改善傾向か）', '仕事・競技の要求',
    ],
    physicalExam: [
      { text: '神経学的評価（L4/L5/S1の筋力・感覚・反射）、SLR/交叉SLR、疼痛の方向特異性（反復動作での症状の集約=centralizationの確認）。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'SLR / 交叉SLR',
        target: '神経根性疼痛',
        method: '背臥位で他動挙上。対側挙上での患側痛（交叉SLR）も確認。',
        positive: '下肢放散痛の再現',
        sensitivity: 'SLRは高め・交叉SLRは低め', specificity: 'SLRは低め・交叉SLRは高めと報告',
        caution: '数値は対象で変動。神経所見と統合して評価。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '馬尾症候群', distinguishing: '膀胱直腸障害・サドル麻痺。緊急手術対象。', urgency: 'emergency' },
      { group: 'likely', name: '腰部脊柱管狭窄症', distinguishing: '高齢・間欠跛行・伸展で悪化。' },
      { group: 'likely', name: '殿部深部の絞扼（梨状筋症候群等）', distinguishing: '殿部限局圧痛・脊柱所見に乏しい。' },
      { group: 'similar', name: '股関節疾患', distinguishing: '股関節ROM・鼠径部痛。' },
    ],
    redFlags: [
      { finding: '膀胱直腸障害・サドル麻痺', action: '馬尾症候群。直ちに救急受診。', urgency: 'emergency' },
      { finding: '進行する明確な筋力低下（下垂足等）', action: '早期の外科評価。受診。', urgency: 'early_visit' },
      { finding: '耐え難い疼痛の持続・悪化', action: '疼痛管理・方針の再評価（医師）。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'MRIが標準（適応・時期は医師判断）。所見は症状・神経所見と一致して初めて意義をもつ（無症候ヘルニアが多い）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '突出形態（protrusion/extrusion/sequestration）・部位。retreat（退縮）はextrusion型で起こりやすいとされる。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    conservative: [
      { text: '第一選択: 教育（良好な自然経過・退縮の可能性）＋疼痛管理（医師の薬物療法等）＋症状の方向特異性に基づく運動（centralizationを指標）＋段階的な活動回復。', certainty: 'moderate', status: 'needs_literature' },
      { text: '神経根症状に対する牽引・受動的治療単独の効果は限定的とされ、能動的アプローチを軸にする。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    surgical: [
      { text: '絶対適応は馬尾症候群。相対適応（保存無効の激しい下肢痛・進行麻痺）ではヘルニア摘出術が検討され、短期成績は良好とされる（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '急性期',
        period: '0〜4週',
        goals: ['下肢痛の管理', '耐容範囲の活動維持'],
        allowed: ['症状を悪化させない姿勢・動作での活動', '方向特異的運動（評価に基づく）'],
        avoid: ['長時間座位・前屈反復（増悪例）', '完全安静'],
        criteria: ['下肢痛の軽減・centralization傾向'],
      },
      {
        name: '回復期',
        period: '4〜12週',
        goals: ['神経症状の消退', '体幹・下肢機能の回復'],
        allowed: ['漸増的な体幹・下肢トレーニング', '職場動作の段階再開'],
        avoid: ['急な高負荷の持ち上げ'],
        criteria: ['神経学的所見の改善・ADL通常化'],
      },
      {
        name: '復帰・予防期',
        period: '3ヶ月以降',
        goals: ['完全復帰と再発予防'],
        allowed: ['競技/重労働への段階復帰', '継続的運動習慣'],
        avoid: ['再発を恐れた過度の活動制限'],
        criteria: ['目標活動の達成'],
      },
    ],
    returnCriteria: [
      { text: '下肢痛・神経所見の改善と、職務/競技動作（持ち上げ・回旋含む)の段階的耐容で判断。しびれの残存のみでは制限しない（医師と共有）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法で大多数が改善。手術例も含め1年時点の成績は保存と大差ないとの報告がある（激痛例の短期改善は手術が速い）。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    outcomes: [
      { name: 'ODI / RDQ', target: '機能障害', range: '尺度による' },
      { name: '下肢痛NRS', target: '神経根性疼痛', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '背骨のクッション（椎間板）の中身が飛び出して神経を刺激し、脚に痛みやしびれが出る状態です。飛び出した部分は自然に小さくなることが多く、大半の方は手術なしで良くなります。',
      dos: ['痛みと相談しながら動ける範囲で活動を続けましょう', '症状が脚から腰へ「引いていく」動き方を一緒に見つけます'],
      donts: ['長時間の座りっぱなし・痛みが強くなる前かがみの反復（急性期）', '「一生治らない」と思い込むこと'],
      seekCare: ['おしっこ・便の異常、お尻まわりのしびれ（今すぐ救急へ）', 'つま先や踵で立てなくなってきた', '痛みが耐えられず眠れない'],
      goal: '神経の炎症が落ち着くのを支えながら、体を強くして仕事・スポーツへ完全復帰することが目標です。',
    },
    motionCapture: [
      { movement: '持ち上げ動作・座位姿勢', purpose: '増悪要因動作の評価', setup: '側面。', watchFor: ['腰椎屈曲での持ち上げ', '座位時間・姿勢'] },
    ],
    references: [
      {
        authors: 'Weinstein JN, Tosteson TD, Lurie JD, et al.',
        title: 'Surgical vs nonoperative treatment for lumbar disk herniation: SPORT trial',
        source: 'JAMA', year: 2006, verified: false,
        note: '手術vs保存の大規模研究。',
      },
    ],
    protocolTemplateKey: 'lumbar_disc_conservative',
    protocolJoint: 'spine',
    meta: draftMeta(),
  },

  // ───────────────────────────── 腰部脊柱管狭窄症
  {
    id: 'lumbar-spinal-stenosis',
    category: 'spine',
    names: {
      ja: '腰部脊柱管狭窄症',
      en: 'Lumbar Spinal Stenosis',
      abbreviations: ['LSS'],
      synonyms: ['脊柱管狭窄症', '馬尾性/神経根性間欠跛行'],
      note: '高齢者の間欠跛行の代表。血管性跛行との鑑別が必須。',
    },
    keywords: ['間欠跛行', '高齢者', '前かがみで楽', '自転車は大丈夫', 'しびれ', '休むと歩ける'],
    overview: [
      { text: '加齢性変化により脊柱管が狭窄し、馬尾・神経根の血流障害から間欠跛行（歩行で下肢症状が出現し前屈・休息で軽快）を呈する疾患。高齢者に多い。', certainty: 'high', status: 'needs_md_review' },
      { text: '症状は姿勢依存性（伸展で悪化・屈曲で軽快）が特徴。保存療法（運動・薬物）で管理できる例が多いが、進行例は手術で改善が期待できる。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '椎間板膨隆・黄色靱帯肥厚・椎間関節肥大による中心管/外側陥凹/椎間孔の狭窄。伸展で狭窄が増強する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中高年以降に多く、高齢化に伴い増加。無症候の画像的狭窄も多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '立位・歩行（伸展位）での神経血流低下が症状を生むと考えられる。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '歩行での下肢のしびれ・痛み・脱力感（間欠跛行）、前屈位（カート押し・自転車）では楽。立位持続でも誘発。馬尾型では両側性・会陰部症状に注意。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '連続歩行可能距離・休息での回復時間', '前屈/カートでの軽快の有無', '自転車での症状の有無（血管性との鑑別）',
      '両側性か・会陰部症状/膀胱症状の有無', '足背動脈触知・下肢冷感（血管性の手がかり）',
      '転倒歴・生活範囲の縮小',
    ],
    physicalExam: [
      { text: '伸展負荷試験（立位伸展保持）での症状誘発、歩行負荷試験（出現距離）、神経学的所見、足背動脈の触知、バランス・下肢筋力。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '歩行負荷試験・自転車試験',
        target: '神経性跛行の確認・血管性との鑑別',
        method: 'トレッドミル/歩行で症状出現距離を記録。自転車（屈曲位）で症状が出にくければ神経性を支持。',
        positive: '歩行で誘発・前屈/座位で軽快',
        caution: '血管性跛行（下肢動脈疾患）の併存もある。脈拍・ABIは医師評価。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '末梢動脈疾患（血管性跛行）', distinguishing: '姿勢非依存・自転車でも出現・脈拍減弱。医師評価（ABI）。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '馬尾症候群（急性増悪）', distinguishing: '膀胱直腸障害の出現。緊急。', urgency: 'emergency' },
      { group: 'likely', name: '腰椎変性すべり症', distinguishing: '併存が多い（画像・医師）。' },
      { group: 'similar', name: '変形性股関節・膝関節症', distinguishing: '関節所見・荷重時痛の性状。' },
    ],
    redFlags: [
      { finding: '膀胱直腸障害の出現・急速な筋力低下', action: '緊急評価。', urgency: 'emergency' },
      { finding: '安静時も持続する下肢冷感・色調変化', action: '血管疾患評価。医師へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'MRIで狭窄評価（医師）。画像的狭窄と症状は一致しないことが多く、症状・歩行能力で管理を判断。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '神経根型/馬尾型/混合型。馬尾型は手術検討の閾値が低い（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '運動療法（屈曲位での有酸素: 自転車・水中歩行、体幹・下肢筋力、姿勢戦略の指導）＋薬物療法（医師）＋活動の工夫（休息の取り方・カート活用）。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    surgical: [
      { text: '保存無効・生活制限が大きい例・馬尾型で除圧術（±固定）が検討され、歩行能力の改善が期待できる（医師判断）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    rehabPhases: [
      {
        name: '症状管理・運動導入期',
        period: '0〜6週',
        goals: ['歩行距離の維持・生活範囲の確保', '運動習慣の確立'],
        allowed: ['自転車エルゴメーター・水中歩行', '体幹/下肢の筋力運動', 'インターバル歩行（休息を計画的に）'],
        avoid: ['伸展位の長時間持続', '症状を無視した歩行の強行'],
        criteria: ['運動の定着・症状出現距離の把握'],
      },
      {
        name: '機能拡大期',
        period: '6週以降（継続）',
        goals: ['歩行耐容距離の漸増', '転倒予防・活動範囲の拡大'],
        allowed: ['歩行距離の漸増プログラム', 'バランス訓練'],
        avoid: ['生活範囲の縮小容認'],
        criteria: ['目標（買い物・外出）の達成'],
        mdCheck: '進行時・馬尾症状出現時の手術相談',
      },
    ],
    returnCriteria: [
      { text: '目標とする生活活動（外出・買い物・趣味）が休息戦略込みで達成できること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '症状は変動しつつ緩徐に経過する例が多く、保存で長期管理できる例も手術で改善する例もある。急速増悪はまれだが馬尾症状に注意。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'ZCQ（チューリッヒ跛行質問票）', target: '狭窄症特異的な症状・機能', range: '尺度による' },
      { name: '連続歩行距離', target: '機能指標', range: 'm・分' },
    ],
    patientExplanation: {
      whatIs: '加齢により背骨の神経の通り道が狭くなり、歩くと脚がしびれて休むと回復する（間欠跛行）状態です。前かがみやカート・自転車だと楽なのが特徴です。',
      dos: ['自転車こぎ・水中歩行など「楽な姿勢の運動」で体力と筋力を保ちましょう', '休みを計画的に入れる歩き方で外出を続けましょう'],
      donts: ['症状が出るからと外出をやめてしまうこと（体力低下で悪循環になります）'],
      seekCare: ['おしっこの出にくさ・お尻まわりのしびれが出た（すぐ受診）', '歩ける距離が急に短くなった', '脚の冷たさ・色の悪さ（血管の検査が必要なことがあります）'],
      goal: '「歩ける距離と生活範囲を守る」ことが目標です。改善が難しい場合は手術も歩行を取り戻す有効な選択肢です。',
    },
    motionCapture: [
      { movement: '歩行（距離負荷）', purpose: '姿勢変化・症状出現の評価', setup: '側面。', watchFor: ['歩行に伴う前傾の増強', '歩幅低下', '出現距離の記録'] },
    ],
    references: [
      {
        authors: '日本整形外科学会（監修）',
        title: '腰部脊柱管狭窄症診療ガイドライン',
        source: '南江堂', year: 2021,
        note: '国内ガイドライン。版は原本確認待ち。',
        verified: false,
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 腰椎分離症
  {
    id: 'lumbar-spondylolysis',
    category: 'spine',
    names: {
      ja: '腰椎分離症',
      en: 'Lumbar Spondylolysis',
      abbreviations: [],
      synonyms: ['疲労骨折（腰椎椎弓）', '成長期腰椎分離症'],
      note: '成長期アスリートの腰痛で最重要の鑑別。早期（骨癒合が期待できる時期）の発見が予後を分ける。',
    },
    keywords: ['成長期', '伸展時痛', '野球', 'サッカー', 'バレー', '疲労骨折', 'コルセット'],
    overview: [
      { text: '椎弓関節突起間部の疲労骨折。伸展・回旋の反復負荷で生じ、成長期スポーツ選手の腰痛の主要原因。L5が最多。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '早期例は硬性コルセット＋運動休止で骨癒合が期待できるため、「成長期の伸展時腰痛は分離症を疑って画像評価へ」が原則。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '関節突起間部（pars）は伸展回旋負荷の集中部。両側分離が進むとすべり症へ移行しうる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '成長期スポーツ選手に多く、一般人口でも一定の保有率がある（無症候の陳旧例含む）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '伸展＋回旋の反復（投球・アタック・シュート・剣道等）。成長期の骨脆弱性・柔軟性低下・練習量が背景。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '運動時の腰痛（伸展・回旋で増悪）。下肢症状は通常伴わない。安静時痛は乏しい。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '年齢・競技・練習量', '伸展動作での疼痛', '経過（数週間続く運動時腰痛か）',
      '画像評価の有無（MRI/CTの病期）', '家族歴・既往',
    ],
    physicalExam: [
      { text: '伸展・伸展回旋での疼痛再現（片脚伸展テスト等）、棘突起叩打痛、ハムストリングスタイトネス。確定は画像（医師）。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: '片脚立位伸展テスト',
        target: '分離症のスクリーニング',
        method: '片脚立位で腰椎を伸展。',
        positive: '患側の腰痛再現',
        caution: '診断精度は高くないとの報告があり、陰性でも除外できない。疑えば画像へ。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '筋筋膜性腰痛・椎間関節性疼痛', distinguishing: '画像で分離を除外した後の判断。' },
      { group: 'must_not_miss', name: '椎体終板障害・椎間板ヘルニア（成長期）', distinguishing: '屈曲痛・下肢症状。画像評価。', urgency: 'confirm_md' },
      { group: 'similar', name: '仙腸関節障害', distinguishing: '限局部位・誘発テスト。' },
    ],
    redFlags: [
      { finding: '成長期選手の2週間以上続く伸展時腰痛', action: '分離症を疑いMRI等の画像評価（医師）へ。早期発見が癒合の鍵。', urgency: 'early_visit' },
      { finding: '下肢症状・膀胱直腸症状の合併', action: '別病態の評価。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '早期診断はMRI（骨髄浮腫）が有用で、CTで骨折線・病期を評価（医師）。X線斜位のみでは早期例を見逃す。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '病期（超早期/早期/進行期/終末期）により癒合の期待度が異なり、治療方針を規定する（医師判定）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '癒合を目指す例: 硬性装具＋伸展回旋負荷の休止（数ヶ月・医師管理）＋この間の体幹深部筋・股関節/胸椎可動性・ハムストリングス柔軟性の改善→段階的競技復帰。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '終末期（偽関節）: 癒合は望めないため、疼痛管理と機能改善（体幹・可動性・動作）で競技継続を支援。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '難治性疼痛・進行すべり例で修復/固定術が検討される（まれ・医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '骨癒合期（装具）',
        period: '医師の指示（数ヶ月単位）',
        goals: ['骨癒合環境の確保', '体幹・柔軟性の課題改善'],
        allowed: ['装具下の日常生活', '伸展回旋を避けた体幹/股関節トレーニング', 'ハム柔軟性改善'],
        avoid: ['競技練習・伸展回旋動作', '装具の自己判断除去'],
        criteria: ['画像での癒合傾向（医師判定）'],
        mdCheck: '装具期間・復帰判断の全て',
      },
      {
        name: '段階的復帰期',
        period: '医師許可後（数週〜）',
        goals: ['基礎動作→競技動作の段階再開'],
        allowed: ['ラン→競技基礎→伸展回旋動作の段階導入'],
        avoid: ['段階飛ばし・練習量の急増'],
        criteria: ['各段階で疼痛なし'],
      },
    ],
    returnCriteria: [
      { text: '画像上の癒合（または医師の許可）＋伸展回旋動作の無痛化＋体幹/柔軟性課題の改善を確認して段階復帰。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '早期例の癒合率は高いと報告される。診断遅延例は偽関節化しやすいが、機能面の管理で競技継続例も多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS（伸展時）/ 競技復帰度', target: '症状・復帰', range: '0-10・記述' },
    ],
    patientExplanation: {
      whatIs: '成長期に、腰の骨の後ろ側の細い部分に繰り返しの反り・ひねりで起こる疲労骨折です。早く見つけてコルセットで守れば、骨がくっつく可能性が高い時期があります。',
      dos: ['装具の装着と運動休止の期間を守りましょう（骨がつくチャンスは今だけです）', 'その間に体幹と股関節・もも裏の柔軟性という「再発しない体」を作りましょう'],
      donts: ['「痛みが引いたから」と勝手に練習へ戻ること（癒合前の再開は骨折を完成させます）'],
      seekCare: ['反ると痛い腰痛が2週間以上続く（MRIでの早期チェックを）'],
      goal: '骨をつなげて、より強い体で競技へ戻ること。焦らないことが結局一番早い道です。',
    },
    motionCapture: [
      { movement: '競技動作（復帰期）', purpose: '伸展回旋負荷の質評価', setup: '側面＋後方。', watchFor: ['腰椎過伸展への依存', '股関節・胸椎の使えていなさ'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 腰椎すべり症
  {
    id: 'spondylolisthesis',
    category: 'spine',
    names: {
      ja: '腰椎すべり症',
      en: 'Lumbar Spondylolisthesis',
      abbreviations: [],
      synonyms: ['分離すべり症', '変性すべり症'],
      note: '分離性（若年〜）と変性（中高年・L4に多い）で背景が異なる。すべりの程度と症状は必ずしも一致しない。',
    },
    keywords: ['すべり症', '腰痛', '下肢しびれ', '不安定性', '変性', '分離'],
    overview: [
      { text: '上位椎体が下位椎体に対して前方へ転位した状態。分離性（分離症由来）と変性（椎間板・関節の変性由来）が代表で、腰痛・狭窄症状（変性例）を呈しうる。', certainty: 'moderate', status: 'needs_md_review' },
      { text: 'すべりの存在自体は無症候のことも多い。症状（腰痛・神経症状）との対応づけと、進行・不安定性の評価（医師）が管理の軸。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '変性すべりはL4/5に多く、狭窄を合併しやすい。分離すべりはL5/S1に多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '変性すべりは中高年女性に多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '分離部の欠損または椎間支持組織の変性による前方剪断への抵抗低下。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '立位・歩行での腰痛、（変性例）狭窄による間欠跛行・下肢症状。前屈で楽になる傾向。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '腰痛の姿勢依存性', '下肢症状・歩行距離', '若年期の分離症既往', '画像でのすべり度の説明歴',
    ],
    physicalExam: [
      { text: '棘突起の段差触知（step-off）、伸展時痛、神経学的所見、体幹筋機能・股関節可動性。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '腰部脊柱管狭窄症', distinguishing: '変性すべりに高率に合併。狭窄ページ参照。' },
      { group: 'likely', name: '非特異的腰痛', distinguishing: 'すべりが症状源とは限らない。' },
      { group: 'must_not_miss', name: '馬尾症候群（高度すべり・急性増悪）', distinguishing: '膀胱直腸障害。緊急。', urgency: 'emergency' },
    ],
    redFlags: [
      { finding: '膀胱直腸障害・進行する神経脱落', action: '緊急〜早期の外科評価。', urgency: 'emergency' },
      { finding: '（若年）成長期のすべり進行', action: '定期的な医師フォローが必要。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '立位X線（すべり度・不安定性の動態撮影）・MRI（狭窄評価）。判定は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Meyerding分類（すべり度I〜IV）。分離性/変性の別。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '体幹深部筋・殿筋の強化、股関節/胸椎可動性の改善（腰椎への剪断集中を減らす）、姿勢・動作戦略、（狭窄合併例は）狭窄症に準じた屈曲位運動。多くは保存で管理可能。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '神経症状が強い例・進行例で除圧±固定術（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '安定化トレーニング期',
        period: '0〜12週',
        goals: ['体幹深部筋の機能改善', '症状の管理'],
        allowed: ['モーターコントロール訓練→漸増的体幹/下肢強化', '有酸素運動（楽な姿勢）'],
        avoid: ['急激な伸展・高負荷回旋の反復（症状誘発時）'],
        criteria: ['症状の安定・機能改善'],
      },
      {
        name: '活動拡大期',
        period: '12週以降',
        goals: ['目標活動への復帰'],
        allowed: ['段階的な職務/競技動作'],
        avoid: ['症状再燃の無視'],
        criteria: ['目標活動の達成'],
        mdCheck: '神経症状進行時の手術相談',
      },
    ],
    returnCriteria: [
      { text: '症状管理下で目標活動が達成できること。すべり度のみで活動を制限しない（医師と方針共有）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '変性すべりの多くは保存で経過良好。高度すべり・神経症状例は手術で改善が期待できる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'ODI / ZCQ（狭窄合併）', target: '機能障害', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '背骨の一つが前にずれた状態です。ずれ＝痛みではなく、ずれがあっても元気に生活している方はたくさんいます。症状に応じた体幹の強化が治療の柱です。',
      dos: ['お腹の深部とお尻の筋トレ、股関節の柔軟性づくりを続けましょう'],
      donts: ['「ずれているから動けない」と考えて活動を止めること'],
      seekCare: ['脚のしびれ・歩ける距離の悪化', 'おしっこの異常（すぐ受診）'],
      goal: '背骨を支える力をつけ、ずれと上手に付き合いながらやりたい活動を続けることが目標です。',
    },
    motionCapture: [
      { movement: '体幹伸展・持ち上げ動作', purpose: '腰椎剪断負荷動作の評価', setup: '側面。', watchFor: ['腰椎過伸展・過屈曲への依存', '股関節の使えていなさ'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 椎体圧迫骨折
  {
    id: 'vertebral-compression-fracture',
    category: 'spine',
    names: {
      ja: '椎体圧迫骨折',
      en: 'Vertebral Compression Fracture',
      abbreviations: ['VCF'],
      synonyms: ['脊椎圧迫骨折', '骨粗鬆症性椎体骨折', 'いつのまにか骨折'],
      note: '高齢者では軽微な外力（尻もち・くしゃみ）や誘因なく生じる。新規骨折の連鎖予防（骨粗鬆症治療）が本質的課題。',
    },
    keywords: ['高齢者', '骨粗鬆症', '尻もち', '円背', '寝返り時痛', 'いつのまにか骨折'],
    overview: [
      { text: '骨粗鬆症を背景に胸腰椎移行部に好発する椎体骨折。急性期の疼痛管理・変形/遅発性麻痺の監視と、続発骨折予防（骨粗鬆症治療・転倒予防）が管理の両輪。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '胸腰椎移行部（T12-L2）に好発。椎体後壁損傷型は神経障害リスクがあり管理が異なる（医師評価）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    epidemiology: [
      { text: '閉経後女性・高齢者に多く、既存骨折は次の骨折の強い危険因子。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '軽微な外力（尻もち・持ち上げ・くしゃみ）または明らかな誘因なし。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '急性の腰背部痛（体動時・寝返り・起き上がりで激痛、臥床で軽減）。慢性期は円背進行・身長低下。無症候例もある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転（軽微でも）・発症日', '体動時痛の性状（寝返り・起居）', '骨粗鬆症の診断/治療状況',
      '既往骨折・ステロイド使用', '身長低下・円背の進行', '下肢症状の有無',
    ],
    physicalExam: [
      { text: '棘突起叩打痛・体動時痛の観察。下肢神経所見（遅発性麻痺の監視）。急性期の過度な体幹前屈テストは避ける。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '転移性脊椎腫瘍・多発性骨髄腫', distinguishing: '癌既往・夜間痛・複数椎体/非典型部位。医師評価。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '化膿性脊椎炎', distinguishing: '発熱・炎症所見。', urgency: 'same_day' },
      { group: 'likely', name: '非特異的急性腰痛', distinguishing: '高齢者では骨折をまず除外。' },
    ],
    redFlags: [
      { finding: '高齢者の急性腰背部痛（軽微な外力・誘因なし含む）', action: '骨折として扱いX線/MRI評価（医師）へ。', urgency: 'early_visit' },
      { finding: '下肢麻痺・膀胱直腸障害の出現', action: '遅発性神経障害。緊急評価。', urgency: 'emergency' },
      { finding: '発熱・癌既往・夜間痛', action: '感染・腫瘍の除外。', urgency: 'same_day' },
    ],
    imaging: [
      { text: 'X線＋（新旧鑑別・後壁評価に）MRIが用いられる（医師）。経過中の圧潰進行もX線で追跡される。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '形態（楔状/魚椎/扁平）・新規/陳旧・後壁損傷の有無（医師判定）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '急性期: 疼痛に応じた安静と装具（医師方針）＋早期離床のバランス。過度の臥床は廃用を招くため、疼痛管理下で立位・歩行を早期に再開する方針が多い。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '回復期: 背筋群（伸展筋）の等尺性強化・バランス/転倒予防・生活動作指導（前屈回旋の急激な負荷を避ける）。骨粗鬆症治療（医師）への確実な接続。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '疼痛遷延例に椎体形成術（BKP等）、神経障害例に固定術が検討される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '急性期',
        period: '0〜4週',
        goals: ['疼痛管理', '廃用予防（早期離床）', '骨折部保護'],
        allowed: ['装具下の起居・歩行（疼痛に応じ漸増）', '臥位での四肢運動・等尺性背筋運動'],
        avoid: ['体幹の急な前屈・回旋', '重量物', '長期臥床'],
        criteria: ['体動時痛の軽減・歩行の安定'],
        mdCheck: '装具期間・圧潰進行の確認',
      },
      {
        name: '回復期',
        period: '1〜3ヶ月',
        goals: ['背筋・下肢筋力の回復', '転倒予防能力'],
        allowed: ['伸展筋の漸増強化', 'バランス訓練', '歩行距離延長'],
        avoid: ['前屈位での反復作業'],
        criteria: ['ADL自立・屋外歩行の安定'],
      },
      {
        name: '予防・維持期',
        period: '3ヶ月以降（継続）',
        goals: ['続発骨折の予防', '活動性の維持'],
        allowed: ['継続的な運動（背筋・バランス・荷重運動）'],
        avoid: ['骨粗鬆症治療の自己中断'],
        criteria: ['転倒なし・活動範囲の維持'],
        mdCheck: '骨粗鬆症治療の継続確認',
      },
    ],
    returnCriteria: [
      { text: '疼痛管理下でのADL/活動の再獲得と、転倒予防・骨粗鬆症治療体制が整っていること。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '多くは数週〜数ヶ月で疼痛軽快するが、遷延例・続発骨折例もある。既存骨折は次の骨折リスクを大きく上げるため予防が本質。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS（体動時）/ ADL評価', target: '疼痛・生活機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '骨がもろくなったところに、尻もちや時には気づかないうちに背骨がつぶれるように折れた状態です。痛みの治療と同じくらい、「次の骨折を防ぐこと」が大切です。',
      dos: ['コルセットを着けて、痛みに応じて早めに立つ・歩くを再開しましょう（寝たきりが一番の敵）', '骨粗鬆症の薬・検査は必ず続けましょう'],
      donts: ['深い前かがみ・急なひねり・重い物（治りかけの時期）', '「年だから」と骨の治療を後回しにすること'],
      seekCare: ['脚のしびれ・力の入りにくさが出た（すぐ受診）', '痛みが数週間たっても強いまま'],
      goal: '痛みを乗り越えて活動を取り戻し、骨と転倒の対策で「次の骨折をゼロにする」ことが本当のゴールです。',
    },
    motionCapture: [
      { movement: '起居動作・歩行', purpose: '安全な動作パターンの習得評価', setup: '側面。', watchFor: ['体幹前屈での起き上がり', 'バランス不安定', '円背姿勢'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
