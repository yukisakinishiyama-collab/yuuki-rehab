// 疾患ページ: 脊椎カテゴリ 2/2（下書き・医師監修前）
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

export const SPINE_PAGES_2: DiseasePage[] = [
  // ───────────────────────────── 頸椎症
  {
    id: 'cervical-spondylosis',
    category: 'spine',
    names: {
      ja: '頸椎症',
      en: 'Cervical Spondylosis',
      abbreviations: [],
      synonyms: ['変形性頸椎症', '頸部症候群（軸性痛）'],
      note: '加齢性変化に伴う頸部痛の総称的診断。脊髄症（ミエロパチー）の兆候を見逃さないことが最重要。',
    },
    keywords: ['首の痛み', '肩こり', '中高年', '変形', '可動域制限', 'ミエロパチー'],
    overview: [
      { text: '頸椎の加齢性変化（椎間板変性・骨棘・関節症）に伴う頸部痛・可動域制限。画像的変化は無症候者にも普遍的で、症状との対応づけが前提。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '最重要は脊髄症（手指巧緻運動障害・歩行障害・腱反射亢進）の検出で、疑えば医師評価を優先する。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '椎間板変性→椎間高低下→骨棘・靱帯肥厚が神経根管/脊柱管を狭小化しうる（神経根症・脊髄症ページと連続）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中高年以降ほぼ普遍的な画像変化。症候性は一部。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '加齢変化＋姿勢/作業負荷（長時間の下向き作業等）・筋機能低下の複合。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '頸部痛・こわばり・可動域制限・肩甲部への関連痛。しびれ/巧緻障害/歩行障害があれば神経根症・脊髄症の評価へ。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位・誘発姿勢（作業環境）', '上肢のしびれ・脱力の有無', 'ボタンかけ・箸の使いにくさ（脊髄症スクリーニング）',
      '歩行のふらつき', '転倒・外傷歴', '睡眠・枕',
    ],
    physicalExam: [
      { text: '頸部ROM・症状再現姿勢、神経学的スクリーニング（腱反射亢進・Hoffmann・巧緻性・歩行）を必ず含める。肩関節疾患の除外。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: '脊髄症スクリーニング（Hoffmann・10秒テスト等）',
        target: '頸髄症の検出',
        method: 'Hoffmann反射・グーパー10秒テスト・歩行/腱反射の確認。',
        positive: '病的反射・グーパー回数低下・痙性歩行',
        caution: '陽性なら医師（MRI評価）へ。リハビリ単独で経過を見ない。',
        status: 'needs_md_review',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '頸髄症', distinguishing: '巧緻運動障害・歩行障害・病的反射。医師評価必須。', urgency: 'early_visit' },
      { group: 'likely', name: '頸部神経根症', distinguishing: '上肢放散痛・デルマトーム性しびれ。' },
      { group: 'likely', name: '肩関節疾患・筋筋膜性疼痛', distinguishing: '肩関節所見・圧痛部位。' },
      { group: 'must_not_miss', name: '腫瘍・感染・骨折（高齢者外傷後）', distinguishing: '夜間痛・発熱・外傷歴。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '手指巧緻運動障害・歩行のふらつき・病的反射', action: '頸髄症疑い。早期に医師（MRI）へ。', urgency: 'early_visit' },
      { finding: '外傷後の頸部痛（高齢者・RA等）', action: '骨折/不安定性の除外。受診。', urgency: 'early_visit' },
      { finding: '発熱・夜間進行痛・癌既往', action: '感染・腫瘍の除外。', urgency: 'same_day' },
    ],
    imaging: [
      { text: 'X線・MRIの適応は医師判断。無症候変化が多く、画像所見の説明が不安を増幅しないよう配慮。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '軸性痛/神経根症/脊髄症の区分が実務的。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '運動療法（頸部深層屈筋・肩甲帯の運動、可動域運動）＋作業環境/姿勢の調整＋教育。徒手・物理療法は補助。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '軸性痛単独への手術適応は原則ない（脊髄症・神経根症は別判断・医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理・運動導入期',
        period: '0〜6週',
        goals: ['疼痛の軽減', '運動・環境調整の定着'],
        allowed: ['深層屈筋トレーニング・肩甲帯運動', '作業環境調整'],
        avoid: ['長時間の不良姿勢の放置'],
        criteria: ['症状の軽減・機能改善'],
      },
      {
        name: '維持期',
        period: '継続',
        goals: ['再燃予防・機能維持'],
        allowed: ['運動習慣の継続'],
        avoid: ['脊髄症サインの見逃し'],
        criteria: ['生活支障の消失'],
        mdCheck: '神経症状出現時の画像評価',
      },
    ],
    returnCriteria: [
      { text: '疼痛が管理され、仕事・生活動作が支障なく行えること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '軸性痛は保存で管理可能な例が多い。脊髄症は進行例で手術対象となる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NDI', target: '頸部機能障害', range: '0-50（低いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '年齢に伴う首の骨・クッションの変化により、首の痛みやこわばりが出ている状態です。レントゲンの変化は歳を重ねた誰にでもあり、それ自体は病気ではありません。',
      dos: ['首の深いところの筋肉と肩甲骨まわりの運動を続けましょう', 'デスク環境・枕の見直しも効果的です'],
      donts: ['「骨の変形だから治らない」と諦めること'],
      seekCare: ['ボタンかけ・箸が下手になった、歩行がふらつく（脊髄のチェックが必要。早めに受診）', '腕への強いしびれ・痛み'],
      goal: '首の痛み・こわばりをコントロールし、快適に仕事・生活できる状態を保つことが目標です。',
    },
    motionCapture: [
      { movement: 'デスクワーク姿勢・頸部ROM', purpose: '姿勢負荷・可動性の評価', setup: '側面。', watchFor: ['頭部前方位', '可動域の左右差'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 頸椎椎間板ヘルニア
  {
    id: 'cervical-disc-herniation',
    category: 'spine',
    names: {
      ja: '頸椎椎間板ヘルニア',
      en: 'Cervical Disc Herniation',
      abbreviations: ['CDH'],
      synonyms: ['頚椎ヘルニア'],
      note: '神経根症状が主体の例は保存療法で軽快することが多い。脊髄圧迫症状は医師評価を優先。',
    },
    keywords: ['首', '腕のしびれ', '放散痛', '30-50代', '上を向くと痛い'],
    overview: [
      { text: '頸椎椎間板の突出による神経根/脊髄の圧迫。神経根症型は上肢放散痛・しびれが主体で、多くは保存療法で数週〜数ヶ月で軽快する。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '脊髄症型（両手のしびれ・巧緻障害・歩行障害）は管理が異なり、医師評価を優先する。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: 'C5/6・C6/7が好発。神経根は同レベルよりも下位番号根が障害される（C6/7でC7根）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '30〜50代に多い。無症候のヘルニア所見も多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '変性を背景に、屈曲/伸展負荷や誘因なく発症。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '頸部痛＋片側上肢の放散痛・しびれ（デルマトーム性）。伸展・患側回旋で増悪、患側手を頭に乗せると軽減（shoulder abduction sign）することがある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '上肢症状の分布', '増悪/軽快姿勢', '筋力低下の自覚', '巧緻障害・歩行障害（脊髄症スクリーニング）',
      '経過（改善傾向か）',
    ],
    physicalExam: [
      { text: '神経学的評価（C5-8の筋力・感覚・反射）、Spurlingテスト、肩関節疾患の除外、脊髄症スクリーニング。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: 'Spurlingテスト',
        target: '頸部神経根症',
        method: '伸展・患側側屈（±軸圧）で上肢放散痛をみる。',
        positive: '上肢への放散痛再現',
        sensitivity: '低〜中等度', specificity: '高いと報告',
        caution: '脊髄症疑い・外傷後は行わない。愛護的に。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '頸髄症', distinguishing: '両側性・巧緻/歩行障害。', urgency: 'early_visit' },
      { group: 'likely', name: '頸部神経根症（骨棘性）', distinguishing: '高齢・緩徐発症。管理は類似。' },
      { group: 'likely', name: '肩関節疾患・胸郭出口症候群', distinguishing: '肩所見・非デルマトーム性分布。' },
      { group: 'similar', name: '末梢神経絞扼（手根管等）', distinguishing: '遠位分布・夜間性。' },
    ],
    redFlags: [
      { finding: '巧緻運動障害・歩行障害・膀胱症状', action: '脊髄症。早期に医師へ。', urgency: 'early_visit' },
      { finding: '進行する筋力低下', action: '外科評価。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'MRI（適応・時期は医師）。所見と症状の対応が前提。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '神経根症型/脊髄症型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '神経根症型: 教育（良好な自然経過）＋症状を悪化させない姿勢管理＋神経モビライゼーション/牽引の併用（反応をみて）＋段階的な筋力・姿勢トレーニング。薬物は医師。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '保存無効の激しい疼痛・進行麻痺・脊髄症で前方/後方手術（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '急性期',
        period: '0〜4週',
        goals: ['上肢痛の管理', '症状を悪化させない生活動作'],
        allowed: ['楽な姿勢の同定と活用', '症状範囲内の可動域運動'],
        avoid: ['伸展・患側回旋の反復（増悪例）', '重量物'],
        criteria: ['上肢痛の軽減傾向'],
      },
      {
        name: '回復期',
        period: '4〜12週',
        goals: ['神経症状の消退・機能回復'],
        allowed: ['深層屈筋・肩甲帯トレーニング', '段階的な職務動作'],
        avoid: ['急な高負荷'],
        criteria: ['神経所見の改善・ADL通常化'],
        mdCheck: '改善不良・麻痺進行時の外科評価',
      },
    ],
    returnCriteria: [
      { text: '上肢症状の改善と職務動作の耐容で判断。しびれの軽度残存のみでは制限しない。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '神経根症型の多くは保存で改善。再燃もあるため姿勢・運動の習慣化が重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NDI / 上肢NRS', target: '頸部機能・上肢痛', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '首のクッション（椎間板）が飛び出して神経を刺激し、首の痛みと腕へのしびれ・痛みが出る状態です。腕の症状が主なタイプは、多くが手術なしで軽快します。',
      dos: ['症状が楽になる姿勢（例: 腕を頭に乗せる等）を活用しましょう', '痛みが落ち着いてきたら首・肩甲骨の運動で再発しにくい首を作ります'],
      donts: ['上を向く・患側に強く振り向く動作の反復（急性期）'],
      seekCare: ['手の細かい動作が下手になる・歩きにくい（脊髄のサイン。早めに受診）', '腕の力がどんどん落ちる'],
      goal: '腕の症状を鎮め、仕事・生活へ完全復帰することが目標です。',
    },
    motionCapture: [
      { movement: '頸部運動・作業姿勢', purpose: '増悪姿勢の同定', setup: '側面。', watchFor: ['伸展系での症状誘発', '頭部前方位'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 頸部神経根症
  {
    id: 'cervical-radiculopathy',
    category: 'spine',
    names: {
      ja: '頸部神経根症',
      en: 'Cervical Radiculopathy',
      abbreviations: [],
      synonyms: ['頸椎症性神経根症'],
      note: 'ヘルニア性・骨棘性を含む神経根障害の総称。多くは保存で良好な経過。',
    },
    keywords: ['腕のしびれ', '放散痛', 'デルマトーム', 'Spurling', '肩甲骨内側の痛み'],
    overview: [
      { text: '頸神経根の圧迫・炎症による上肢放散痛・感覚障害・筋力低下。ヘルニア・骨棘いずれの原因でも、多くは保存療法で数ヶ月以内に改善する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: 'C7根が最多とされる（C6/7レベル）。肩甲骨内側縁の疼痛は神経根症の関連痛として多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中年に多い。多くは単根性。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: 'ヘルニア（若年寄り）・椎間孔狭窄（高齢寄り）による根の圧迫＋炎症。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '片側上肢の放散痛・しびれ・脱力（根レベルに対応）、肩甲部痛。頸部伸展・患側側屈で増悪。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '症状分布と経過', '増悪/軽快因子', '筋力低下の自覚', '脊髄症スクリーニング項目', '職業姿勢',
    ],
    physicalExam: [
      { text: '根レベル別の神経学的評価、Spurling・牽引/肩外転テスト・上肢神経伸張テストの組み合わせ（クラスター評価）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    specialTests: [
      {
        name: '診断クラスター（Wainner）',
        target: '頸部神経根症',
        method: 'Spurling・牽引テスト・患側回旋<60°・ULNT1の組み合わせ。',
        positive: '該当項目数が多いほど尤度上昇と報告',
        caution: '単独テストに頼らない。原著の限界も踏まえる。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '頸髄症・腫瘍・感染', distinguishing: '両側性・進行性・全身症状。', urgency: 'early_visit' },
      { group: 'likely', name: '肩関節疾患（腱板等）', distinguishing: '肩ROM/抵抗所見。併存もある。' },
      { group: 'likely', name: '胸郭出口症候群', distinguishing: '姿勢/挙上での誘発・非単根性分布。' },
      { group: 'similar', name: '肘部管・手根管症候群', distinguishing: '遠位の絞扼所見。double crushにも留意。' },
    ],
    redFlags: [
      { finding: '進行する筋力低下・両側症状・歩行障害', action: '医師評価（画像・外科）へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'MRI（医師判断）。伝導検査は鑑別に有用な場合がある。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '責任根レベル・原因（ヘルニア/骨棘）による記載。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '教育＋疼痛管理＋神経モビライゼーション・（反応が良ければ）牽引＋深層屈筋/肩甲帯の段階的トレーニング。多くが保存で改善。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '保存無効・進行麻痺で除圧術（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理期',
        period: '0〜6週',
        goals: ['上肢痛・しびれの軽減'],
        allowed: ['楽な姿勢・neural mobilization', '症状範囲の運動'],
        avoid: ['増悪姿勢の反復'],
        criteria: ['症状の遠位→近位への後退（centralization様）'],
      },
      {
        name: '機能回復期',
        period: '6〜12週',
        goals: ['筋力・姿勢機能の回復', '職務復帰'],
        allowed: ['漸増的な頸部/肩甲帯/上肢トレーニング'],
        avoid: ['急な重量負荷'],
        criteria: ['神経所見の改善・職務耐容'],
        mdCheck: '3ヶ月抵抗例の評価',
      },
    ],
    returnCriteria: [
      { text: '上肢症状・筋力の改善と職務動作の耐容。軽度のしびれ残存は経過観察としつつ復帰可（医師と共有）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '大多数は数ヶ月で改善と報告される。再燃予防に姿勢・運動の継続。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NDI / QuickDASH', target: '頸部・上肢機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '首の神経の根元が圧迫されて、腕に痛みやしびれが走る状態です。原因がヘルニアでも骨の変形でも、多くの方は数ヶ月以内に手術なしで良くなります。',
      dos: ['楽な姿勢を見つけて活用し、少しずつ首・肩甲骨の運動を進めましょう'],
      donts: ['しびれる方向への反復ストレッチ・我慢しての重労働'],
      seekCare: ['腕の力がどんどん入らなくなる', '両手のしびれ・歩きにくさ'],
      goal: '腕の症状を鎮めて、仕事・生活・スポーツへの完全復帰を目指します。',
    },
    motionCapture: [
      { movement: '作業姿勢・頸部運動', purpose: '誘発姿勢の同定と是正', setup: '側面。', watchFor: ['伸展・同側側屈での誘発', '頭部前方位'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 胸郭出口症候群
  {
    id: 'thoracic-outlet-syndrome',
    category: 'spine',
    names: {
      ja: '胸郭出口症候群',
      en: 'Thoracic Outlet Syndrome',
      abbreviations: ['TOS'],
      synonyms: ['なで肩症候群（俗）', '斜角筋症候群', '肋鎖症候群'],
      note: '大多数は神経性（下神経幹）。血管性（動脈/静脈）はまれだが緊急性があり見逃さない。診断は除外的で議論の多い領域。',
    },
    keywords: ['つり革でしびれる', 'なで肩', '腕を上げるとしびれる', '尺側しびれ', '若年女性', '野球'],
    overview: [
      { text: '胸郭出口部（斜角筋間・肋鎖間・小胸筋下）での腕神経叢・鎖骨下動静脈の圧迫/牽引による症候群。挙上動作・つり革保持での上肢尺側のしびれ・だるさが典型。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '確立した単一の診断基準がなく過剰診断・過小診断の両方が起こりうる。誘発テストは偽陽性が多く、症状パターンと除外診断を重視する。', certainty: 'divided', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '3つの狭窄部位（斜角筋三角・肋鎖間隙・小胸筋下間隙）。なで肩・頸肋・第一肋骨の形態が関与しうる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '若年〜中年女性（なで肩型）とオーバーヘッド選手（野球等）に見られる。血管性はまれ。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '姿勢（肩甲帯下制・頭部前方位）・反復挙上動作・筋タイトネス（斜角筋・小胸筋）・形態要因による神経血管束への圧迫/牽引。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '挙上・持続保持での上肢のしびれ（尺側優位が多い）・だるさ・脱力感。神経性が大多数。静脈性は腫脹/チアノーゼ、動脈性は蒼白/冷感・虚血症状。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    interviewItems: [
      '誘発動作（つり革・洗濯物干し・投球）', 'しびれの分布（尺側か）', '腕の腫脹・色調変化の有無（血管性）',
      '姿勢・体型（なで肩）・鞄の持ち方', '睡眠時の腕の位置',
    ],
    physicalExam: [
      { text: '姿勢評価（肩甲帯アライメント）、誘発テスト（Roos/挙上負荷・Wright・Adson等: 症状再現を重視し脈拍消失のみで判断しない）、神経学的評価、頸椎・末梢絞扼の除外。', certainty: 'moderate', status: 'needs_literature' },
    ],
    specialTests: [
      {
        name: 'Roosテスト（挙上外旋位開閉運動）',
        target: 'TOSの症状誘発',
        method: '90°外転外旋位で3分間手指開閉。',
        positive: '症状（しびれ・だるさ）の再現・continuación不能',
        caution: '偽陽性がある。症状再現の質を左右差で判断。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '頸部神経根症（C8/T1）', distinguishing: '頸部所見・単根性分布。' },
      { group: 'likely', name: '肘部管症候群', distinguishing: '肘部Tinel・遠位限局。double crushもある。' },
      { group: 'must_not_miss', name: '静脈血栓（Paget-Schroetter）', distinguishing: '急な腕の腫脹・青紫色。緊急評価。', urgency: 'same_day' },
      { group: 'must_not_miss', name: '動脈性TOS・塞栓', distinguishing: '蒼白・冷感・脈拍差。緊急評価。', urgency: 'emergency' },
      { group: 'must_not_miss', name: 'パンコースト腫瘍', distinguishing: '喫煙歴・進行性・ホルネル徴候。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '腕の急な腫脹・色調変化（青紫/蒼白）・冷感', action: '血管性TOS/血栓疑い。当日中〜緊急で医療機関へ。', urgency: 'emergency' },
      { finding: '手内筋萎縮の進行', action: '真の神経性TOS。専門評価へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（頸肋確認）・（血管性疑い）超音波/造影・（鑑別）MRI等は医師判断。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '神経性（真性/非特異的）・静脈性・動脈性。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '第一選択: 姿勢/肩甲帯機能の是正（肩甲帯挙上筋のリラクセーションと支持機能の再教育）・斜角筋/小胸筋の柔軟性・神経滑走・負荷/生活動作の修正（鞄・睡眠肢位）。数ヶ月単位で評価。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '血管性・真性神経性・保存無効例で第一肋骨切除等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理・姿勢是正期',
        period: '0〜6週',
        goals: ['誘発の軽減', '姿勢戦略の獲得'],
        allowed: ['肩甲帯サポート下の生活調整', '斜角筋・小胸筋のリリース/ストレッチ', '神経滑走（症状悪化させない範囲）'],
        avoid: ['重い肩掛け鞄・長時間の挙上保持'],
        criteria: ['誘発動作での症状軽減'],
      },
      {
        name: '機能再建期',
        period: '6週〜3ヶ月以降',
        goals: ['肩甲帯支持筋の強化', '挙上動作の耐容回復'],
        allowed: ['僧帽筋下部・前鋸筋等の漸増強化', '段階的な挙上/投球動作'],
        avoid: ['症状再燃の無視'],
        criteria: ['目標動作の耐容'],
        mdCheck: '改善不良・血管性疑いの専門評価',
      },
    ],
    returnCriteria: [
      { text: '誘発動作（挙上保持・投球等）を症状なく遂行できること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '非特異的神経性の多くは保存で改善が期待できる。血管性は治療後の管理を含め医師と連携。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'DASH / QuickDASH', target: '上肢機能', range: '0-100（低いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '首から腕へ向かう神経や血管が、鎖骨まわりの狭い通り道で圧迫され、腕を上げるとしびれ・だるさが出る状態です。なで肩の方や、腕をよく上げる競技の方に多い症状です。',
      dos: ['肩甲骨を支える筋肉を鍛え、首まわりの張りをゆるめる運動を続けましょう', '重い肩掛け鞄はリュックに変えるなど生活の工夫を'],
      donts: ['しびれる姿勢（つり革・上げっぱなし）の長時間維持'],
      seekCare: ['腕が急に腫れて紫色/白色になった・冷たい（すぐ受診）', '手の筋肉がやせてきた'],
      goal: '姿勢と筋肉のバランスを整えて、腕を上げても大丈夫な体を作ることが目標です。',
    },
    motionCapture: [
      { movement: '挙上保持・投球動作', purpose: '肩甲帯戦略の評価', setup: '後方＋側面。', watchFor: ['肩甲帯の下制/前傾', '頭部前方位', '症状出現までの時間'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 頸椎捻挫
  {
    id: 'whiplash',
    category: 'spine',
    names: {
      ja: '頸椎捻挫',
      en: 'Whiplash Associated Disorders',
      abbreviations: ['WAD'],
      synonyms: ['むちうち', '外傷性頸部症候群'],
      note: '交通事故等の加速減速外傷後の頸部症状。早期の活動再開と教育が遷延予防の鍵とされる。',
    },
    keywords: ['むちうち', '交通事故', '追突', '首の痛み', '頭痛', 'めまい'],
    overview: [
      { text: '追突事故等の加速減速機転による頸部の軟部組織損傷とそれに伴う症候群（WAD）。多くは数週〜数ヶ月で改善するが、一部で症状が遷延する。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '遷延には初期の疼痛強度・心理的要因・過度な安静/カラー固定が関与するとされ、早期の教育と活動再開が推奨される。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '筋・靱帯・椎間関節等の複合的な軽微損傷が想定されるが、画像で特定できないことが多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '交通事故後に高頻度。スポーツ・転倒でも生じる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '急激な加速減速による頸部の過伸展・過屈曲様の負荷。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '頸部痛・こわばり・頭痛が主体。めまい・耳鳴り・集中困難等を伴うことがある。受傷当日より翌日以降に症状が強まることも多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷状況（追突方向・速度感）', '骨折リスク評価（Canadian C-spine ruleの項目）',
      '神経症状の有無', '頭痛・めまい・視覚症状', '心理的衝撃・補償問題の状況', '仕事への影響',
    ],
    physicalExam: [
      { text: '（骨折リスク評価後）頸部ROM・圧痛・神経学的スクリーニング・深層屈筋機能。めまい訴えには前庭・頸性の鑑別視点。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: 'Canadian C-Spine Rule（画像適応の判断枠組み）',
        target: '骨折リスクのスクリーニング',
        method: '危険因子（年齢・機転・しびれ）と回旋45°可否等で層別。',
        positive: '高リスク項目あり→画像評価（医師）',
        caution: '判断は医師と共有。疑わしければ画像を優先。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '頸椎骨折・脱臼', distinguishing: '高エネルギー・高齢・神経症状。画像評価。', urgency: 'emergency' },
      { group: 'must_not_miss', name: '椎骨動脈解離', distinguishing: '激しい後頭部痛・神経症状・めまい。緊急評価。', urgency: 'emergency' },
      { group: 'likely', name: '頸部神経根症（外傷性）', distinguishing: '上肢放散痛・神経所見。' },
      { group: 'similar', name: '脳振盪の併存', distinguishing: '頭部症状・認知症状。併存評価。' },
    ],
    redFlags: [
      { finding: '高リスク受傷機転・神経症状・意識障害', action: '画像を含む救急評価。', urgency: 'emergency' },
      { finding: '激しい後頭部痛・構音/嚥下障害・複視・失調', action: '血管性病変の除外。緊急。', urgency: 'emergency' },
    ],
    imaging: [
      { text: '画像適応はルールに基づき医師が判断。軽症例へのルーチンMRIは推奨されない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: 'WAD分類（0〜IV: 症状/所見/神経症状/骨折）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    conservative: [
      { text: '教育（良性経過の説明・「動いてよい」の明確化）＋早期の活動再開＋能動的運動（ROM・深層屈筋・肩甲帯）。カラー固定の長期使用は推奨されない。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '心理的苦痛が強い例は早期に把握し、必要に応じ医師・専門職と連携。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '骨傷・不安定性例（WAD IV）は外科管理（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '急性期',
        period: '0〜2週',
        goals: ['安心の提供（教育）', '活動の維持'],
        allowed: ['痛みの範囲での日常活動・頸部運動', '短時間頻回のROM運動'],
        avoid: ['長期のカラー・安静', '不安を強める説明'],
        criteria: ['活動の維持・症状の安定'],
      },
      {
        name: '回復期',
        period: '2〜12週',
        goals: ['機能の全面回復・職務復帰'],
        allowed: ['漸増的な頸部/肩甲帯トレーニング', '有酸素運動'],
        avoid: ['症状への過度な注目・受動的治療への依存'],
        criteria: ['職務・生活の通常化'],
        mdCheck: '3ヶ月遷延例の包括評価',
      },
    ],
    returnCriteria: [
      { text: '頸部機能と職務・運転等の再開状況で判断。疼痛の完全消失を条件にしない。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '多くは3ヶ月以内に大きく改善するが、一部で遷延する。初期対応（教育・活動）が経過を左右するとされる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NDI', target: '頸部機能障害', range: '0-50（低いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '追突などの衝撃で首まわりの筋肉・靱帯を痛めた状態（むちうち）です。レントゲンで異常がなければ、組織の傷は時間とともに治っていくタイプがほとんどです。',
      dos: ['痛みの範囲で首を動かし、日常生活をできるだけ続けましょう（それが一番の治療です）', '仕事も可能な範囲で早めに再開を'],
      donts: ['カラー（首の固定具）を長く着け続けること', '「一生治らないのでは」と不安の中で安静を続けること'],
      seekCare: ['手足のしびれ・力が入らない', '激しい後頭部痛・ろれつが回らない・物が二重に見える（すぐ救急へ）'],
      goal: '首を普通に使える生活へ早期に戻ることが、長引かせない最大のポイントです。',
    },
    motionCapture: [
      { movement: '頸部ROM（経時）', purpose: '回復の見える化・安心材料', setup: '正面＋側面。', watchFor: ['可動域の推移', '防御的な動きの減少'] },
    ],
    references: [
      {
        authors: 'TRACsa / SIRA等のWADガイドライン作成グループ',
        title: 'Guidelines for the management of acute whiplash-associated disorders',
        source: '豪州ガイドライン', year: 2014,
        note: '版・発行主体は原本確認待ち。早期活動・教育の推奨。',
        verified: false,
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 仙腸関節関連疼痛
  {
    id: 'si-joint-pain',
    category: 'spine',
    names: {
      ja: '仙腸関節関連疼痛',
      en: 'Sacroiliac Joint Related Pain',
      abbreviations: ['SIJ痛'],
      synonyms: ['仙腸関節障害', '仙腸関節機能不全'],
      note: '診断は誘発テストのクラスターによる（単独テスト・触診による「ズレ」判定は信頼性が低い）。',
    },
    keywords: ['お尻の上の痛み', 'PSIS', '片側殿部痛', '産後', '立ち上がり', '誘発テスト'],
    overview: [
      { text: '仙腸関節由来と考えられる殿部〜下肢の疼痛。腰痛の一部を占め、産後・外傷後・脊椎固定術後に見られる。PSIS近傍の限局痛が特徴。', certainty: 'moderate', status: 'needs_literature' },
      { text: '触診による「関節のズレ」の判定は信頼性が低く、複数の疼痛誘発テストのクラスターで判断するのが標準的。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '仙腸関節は強靱な靱帯に支持された微小可動関節。form/force closureの概念で安定化が説明される。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '慢性腰痛の一部（報告により10-25%程度とも）を占めるとされる。産後女性・腰椎固定術後で頻度が高い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '外傷（転倒・着地）・反復非対称負荷・妊娠出産に伴う靱帯弛緩・隣接部術後の負荷集中。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: 'PSIS周囲の限局痛（患者が指1本で示せることが多い）、片側殿部痛、立ち上がり・寝返り・片脚荷重での疼痛。L5レベルより下の疼痛が特徴とされる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（指差し確認）', '誘発動作（立ち上がり・寝返り・階段）', '妊娠出産歴・産後経過',
      '外傷歴・腰椎手術歴', '炎症性背部痛の特徴（若年・朝のこわばり→脊椎関節炎の考慮）',
    ],
    physicalExam: [
      { text: '疼痛誘発テストのクラスター（distraction・compression・thigh thrust・Gaenslen・sacral thrust等）で3つ以上陽性を目安に判断。腰椎由来・股関節の除外評価を併施。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    specialTests: [
      {
        name: 'SIJ誘発テストクラスター（Laslett）',
        target: '仙腸関節由来疼痛',
        method: 'distraction・thigh thrust・compression・sacral thrust等を組み合わせる。',
        positive: '3つ以上での疼痛再現（普段の疼痛の再現）',
        sensitivity: 'クラスターで比較的良好と報告', specificity: '比較的良好と報告',
        caution: '腰椎由来の除外（反復運動での集約現象の確認）を先行させる。',
        status: 'needs_literature', refs: [0],
      },
    ],
    differentials: [
      { group: 'likely', name: '腰椎由来の関連痛', distinguishing: '反復運動検査での症状変化・腰部所見。' },
      { group: 'likely', name: '股関節疾患', distinguishing: '鼠径部痛・股関節ROM所見。' },
      { group: 'must_not_miss', name: '脊椎関節炎（強直性脊椎炎等）', distinguishing: '若年・慢性・朝のこわばり・夜間痛（炎症性背部痛）。医師評価。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '仙骨脆弱性骨折（高齢者）', distinguishing: '高齢・骨粗鬆症・荷重時痛。画像評価。', urgency: 'early_visit' },
    ],
    redFlags: [
      { finding: '若年の慢性的な朝のこわばり・夜間背部痛', action: '炎症性疾患の評価（採血・画像は医師）。', urgency: 'confirm_md' },
      { finding: '高齢者の急性殿部荷重時痛', action: '仙骨脆弱性骨折の除外。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '機能性のSIJ痛は画像で確定できない。炎症性・骨折の除外目的の画像は医師判断。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '外傷性/非外傷性・産後関連などの背景分類が実用的。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '負荷管理＋force closureを高める運動（殿筋・腹斜筋群・広背筋連鎖の強化）＋骨盤ベルトの一時的活用（特に産後）＋非対称動作の是正。徒手療法は補助。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '難治例への固定術は限定的な適応（医師判断）。ブロック注射は診断・治療目的で用いられる（医師）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理期',
        period: '0〜4週',
        goals: ['疼痛の軽減', '負荷の適正化'],
        allowed: ['骨盤ベルト活用（必要例）', '殿筋・体幹の低負荷運動', '疼痛の少ない動作パターンの学習'],
        avoid: ['片側荷重の反復・長時間の悪い座位'],
        criteria: ['誘発動作の疼痛軽減'],
      },
      {
        name: '安定化・復帰期',
        period: '4〜12週',
        goals: ['骨盤帯の動的安定性向上', '目標活動への復帰'],
        allowed: ['漸増的な殿筋/体幹/連鎖トレーニング', '段階的な競技/職務動作'],
        avoid: ['ベルト依存の長期化'],
        criteria: ['誘発テストの陰性化傾向・目標活動の達成'],
      },
    ],
    returnCriteria: [
      { text: '立ち上がり・荷重・競技動作を疼痛なく遂行でき、ベルトなしで安定していること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '運動療法ベースで多くは改善。産後例はホルモン・育児負荷の要因が落ち着くとともに軽快することが多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'ODI / PSFS', target: '機能障害・個別目標', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '骨盤の後ろにある「仙腸関節」まわりに負担がかかり、お尻の上の方（ベルトライン付近）が痛む状態です。産後や、片側に負担のかかる動作で起こりやすい症状です。',
      dos: ['お尻と体幹の筋トレで骨盤を「筋肉のコルセット」で支えましょう', '（産後の方）骨盤ベルトは痛い時期の味方です。運動と併用しましょう'],
      donts: ['脚を組む・片側だけに体重をかける癖', 'ベルトだけに頼り続けること'],
      seekCare: ['朝のこわばりが長く続く（若い方）', '（ご高齢の方）急に座れないほどお尻が痛い'],
      goal: '骨盤まわりを筋肉で安定させ、抱っこ・立ち仕事・競技を痛みなくこなせる状態が目標です。',
    },
    motionCapture: [
      { movement: '立ち上がり・片脚立位', purpose: '骨盤帯の安定性評価', setup: '正面＋側面。', watchFor: ['骨盤の非対称な動き', '患側回避', '体幹代償'] },
    ],
    references: [
      {
        authors: 'Laslett M, Aprill CN, McDonald B, Young SB',
        title: 'Diagnosis of sacroiliac joint pain: validity of individual provocation tests and composites of tests',
        source: 'Man Ther', year: 2005, verified: false,
        note: '誘発テストクラスターの妥当性研究。',
      },
    ],
    meta: draftMeta(),
  },
]
