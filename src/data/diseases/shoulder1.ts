// 疾患ページ: 肩関節カテゴリ 1/3（下書き・医師監修前）
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

export const SHOULDER_PAGES_1: DiseasePage[] = [
  // ───────────────────────────── 腱板断裂
  {
    id: 'rotator-cuff-tear',
    category: 'shoulder',
    names: {
      ja: '腱板断裂',
      en: 'Rotator Cuff Tear',
      abbreviations: ['RCT'],
      synonyms: ['回旋筋腱板断裂', '棘上筋腱断裂', 'rotator cuff tear'],
      note: '変性断裂は中高年の無症候者にも高頻度。断裂＝手術ではなく、症状・機能・活動要求で方針が決まる。',
    },
    keywords: ['肩', '夜間痛', '挙上困難', '中高年', '棘上筋', '外傷性', '変性'],
    overview: [
      { text: '腱板（棘上筋・棘下筋・肩甲下筋・小円筋）の部分または完全断裂。中高年の変性断裂と、外傷性断裂に大別される。', certainty: 'high', status: 'needs_md_review' },
      { text: '無症候性断裂が中高年に多いことが知られ、画像の断裂と症状の因果は慎重に判断する。変性断裂の多くはまず保存療法が選択される。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '棘上筋腱の関節側・付着部が好発。断裂サイズ（部分/完全・小〜広範囲）と筋の脂肪変性が治療選択・修復可能性に関わる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '年齢とともに有病率が上昇し、無症候例も増える。利き手側・重量作業・喫煙等が危険因子と報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '変性（加齢・血行・負荷の複合）を背景に、軽微な外傷で顕在化することが多い。若年の完全断裂は高エネルギー外傷。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '肩外側〜上腕の疼痛（夜間痛が特徴的）、挙上時痛・挙上困難、結帯動作の制限、脱力感。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '完全断裂でも挙上可能な例は多く、挙上可否で断裂の有無は判断できない。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '発症様式（外傷性か緩徐か）', '夜間痛の有無・睡眠障害', '挙上・結帯・結髪の可否',
      '職業・スポーツ（オーバーヘッド動作）', '利き手', '注射・治療歴', '外傷性なら受傷機転',
    ],
    physicalExam: [
      { text: 'ROM（自動/他動の乖離＝他動が保たれ自動が制限なら腱板を疑う）、疼痛弧、棘上筋・棘下筋・肩甲下筋の各筋力テスト、肩甲骨の運動観察。', status: 'needs_pro_review' },
      { text: '頚椎由来の除外（頚部ROM・神経学的所見）を必ず併施。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '棘上筋テスト（empty can/full can）',
        target: '棘上筋',
        method: '肩甲骨面挙上位で下方抵抗。',
        positive: '疼痛・脱力',
        sensitivity: '中等度と報告', specificity: '中等度と報告',
        caution: '疼痛と脱力を区別して記録。単独で断裂は確定できない。',
        status: 'needs_literature',
      },
      {
        name: '外旋筋力テスト・external rotation lag sign',
        target: '棘下筋・小円筋',
        method: '肘90°で外旋抵抗／他動外旋位からの保持。',
        positive: '脱力・保持不能（lag）',
        caution: 'lag signは大断裂の示唆とされる。',
        status: 'needs_literature',
      },
      {
        name: 'Lift-off / belly press',
        target: '肩甲下筋',
        method: '結帯位で手を背中から離す／腹部圧迫で肘を前方保持。',
        positive: '保持不能・代償',
        status: 'needs_literature',
      },
      {
        name: 'Drop arm test',
        target: '大〜広範囲断裂',
        method: '他動挙上位からゆっくり下ろさせる。',
        positive: '制御不能な落下',
        sensitivity: '低い', specificity: '高いと報告',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '肩峰下疼痛症候群（腱板関連肩痛）', distinguishing: '断裂のない腱板由来疼痛。管理は共通部分が多い。' },
      { group: 'likely', name: '凍結肩', distinguishing: '他動ROMも制限される（腱板断裂は他動が保たれやすい）。' },
      { group: 'must_not_miss', name: '頚椎神経根症', distinguishing: '頚部症状・しびれ・筋萎縮の分布。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '腫瘍・感染（まれ）', distinguishing: '進行性夜間痛・全身症状。', urgency: 'confirm_md' },
      { group: 'similar', name: '石灰沈着性腱板炎', distinguishing: '急性の激痛発作。X線で確認（医師）。' },
    ],
    redFlags: [
      { finding: '外傷後の急な挙上不能＋著明な脱力', action: '外傷性断裂（若年含む）。早期の医師評価（修復時期を逸しない）。', urgency: 'early_visit' },
      { finding: '発熱・安静時激痛', action: '化膿性関節炎等の除外。当日中に医療相談。', urgency: 'same_day' },
      { finding: '原因不明の進行性疼痛・体重減少', action: '腫瘍等の除外は医師判断。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'X線（骨性評価・上方化）、超音波・MRIで断裂の評価（医師）。無症候断裂の頻度を踏まえ、所見と症状の対応づけを行う。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '部分（関節側/滑液包側）/完全、サイズ分類、筋変性（Goutallier等）。判定は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '変性断裂の第一選択となることが多い: 疼痛管理＋肩甲骨機能・残存腱板/三角筋の漸増強化＋可動域維持＋動作/負荷の修正。数ヶ月単位で改善する例が多いと報告される。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '夜間痛への対応（ポジショニング指導）とオーバーヘッド負荷の一時調整。注射は医師判断。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '若年の外傷性断裂・保存無効例・進行性の機能低下例で鏡視下修復が検討される（医師判断）。広範囲断裂では他術式（リバース型人工関節等）も選択肢。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理期（保存）',
        period: '目安: 0〜6週',
        goals: ['夜間痛・動作時痛の軽減', '可動域の維持'],
        allowed: ['振り子・他動/自動介助ROM', '肩甲骨セッティング', '疼痛のない範囲の等尺性'],
        avoid: ['疼痛を悪化させる反復挙上・重量物'],
        criteria: ['夜間痛の軽減', '日常動作痛の軽減'],
      },
      {
        name: '筋力再建期',
        period: '目安: 6週〜3ヶ月',
        goals: ['腱板・肩甲骨周囲筋の強化', '挙上動作の質改善'],
        allowed: ['チューブでの内外旋・挙上訓練の漸増', '肩甲骨安定化訓練'],
        avoid: ['急な重量負荷'],
        criteria: ['疼痛なく日常挙上動作が可能'],
        mdCheck: '3ヶ月改善不良時の手術相談',
      },
      {
        name: '機能・復帰期',
        period: '3ヶ月以降',
        goals: ['職業・スポーツ動作の再獲得'],
        allowed: ['段階的なオーバーヘッド負荷'],
        avoid: ['基準未達での重量作業復帰'],
        criteria: ['目標動作で疼痛なし・筋力改善'],
      },
    ],
    returnCriteria: [
      { text: '夜間痛消失・目標動作（職業/競技）の疼痛なき遂行・筋力の回復傾向で判断。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '変性断裂の保存療法は多くで症状改善が得られるが、断裂サイズは進行しうるため症状再燃時は再評価。修復術後の再断裂率はサイズ・組織条件による。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'Shoulder36 / DASH / SPADI', target: '肩機能・障害', range: '尺度による' },
      { name: 'NRS（夜間・動作時）', target: '疼痛', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '肩の奥で腕の骨を支える「腱板」というスジの一部が切れた状態です。年齢とともに誰にでも起こりうる変化で、切れていても痛みなく生活している人も多くいます。',
      dos: ['肩甲骨まわりと残っている腱板を鍛える運動が治療の中心です', '夜の痛みには枕の工夫（腕の下にクッション等）が役立ちます'],
      donts: ['痛みを我慢しての重い物の持ち上げ・繰り返しの高い位置の作業'],
      seekCare: ['けがの直後から腕が上がらない（早めの受診が大切）', '夜の痛みがどんどん悪化する・発熱を伴う'],
      goal: '断裂を「治す」ことより「痛みなく使える肩」を取り戻すことが目標です。数ヶ月の運動療法で多くの方が改善し、必要な場合は手術も有効な選択肢です。',
    },
    motionCapture: [
      { movement: '挙上動作（前方・側方）', purpose: '代償パターン（すくめ・体幹側屈）の評価', setup: '正面＋後方。', watchFor: ['肩甲骨の過剰挙上', '体幹側屈', '疼痛弧での引っかかり'] },
    ],
    references: [
      {
        authors: 'Kukkonen J, Joukainen A, Lehtinen J, et al.',
        title: 'Treatment of nontraumatic rotator cuff tears: randomized controlled trial with 2-year follow-up',
        source: 'J Bone Joint Surg Am', year: 2015, verified: false,
        note: '非外傷性断裂への保存vs手術RCT。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 腱板関連肩痛
  {
    id: 'rcrsp',
    category: 'shoulder',
    names: {
      ja: '腱板関連肩痛',
      en: 'Rotator Cuff Related Shoulder Pain',
      abbreviations: ['RCRSP'],
      synonyms: ['肩インピンジメント症候群（旧称）', '腱板炎', '肩峰下滑液包炎'],
      note: '「インピンジメント症候群」「腱板炎」等を包括する現代的な呼称。構造名指しを避け、負荷応答性の肩痛として管理する。',
    },
    keywords: ['肩', '挙上時痛', '疼痛弧', 'オーバーヘッド', '使いすぎ', 'デスクワーク'],
    overview: [
      { text: '腱板・肩峰下組織に関連する非外傷性の肩痛の包括概念。挙上時痛・疼痛弧・抵抗テストでの疼痛を特徴とし、画像で特定構造を断定できないことが多い。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '第一選択は段階的な運動療法。肩峰形態など構造要因を過度に強調しない（除圧術と運動療法の比較で差がないとする報告）。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '腱板・肩峰下滑液包・上腕二頭筋長頭腱が近接し、単一組織の責任判定は困難なことが多い。肩甲骨・胸椎の運動も負荷に影響。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '肩痛の最多カテゴリ。オーバーヘッド作業/競技・急な負荷変化と関連。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '負荷急増や不慣れな負荷への腱の適応不全（腱症モデル）＋筋機能・肩甲骨運動・生活要因（睡眠・ストレス）の複合。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '挙上60〜120°付近の疼痛弧、結髪・高所リーチでの疼痛、夜間の寝返り時痛。安静時痛は軽いことが多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '誘発動作・負荷の変化（仕事・トレーニング）', '夜間痛の程度', '頚部症状の有無',
      '生活要因（睡眠・ストレス）', '過去の肩エピソード',
    ],
    physicalExam: [
      { text: '疼痛弧・抵抗テスト（外転/外旋）での疼痛再現、症状修正テスト（肩甲骨介助等で症状が変わるか）、頚椎除外。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Hawkins-Kennedy / Neer（参考）',
        target: '肩峰下部の疼痛誘発',
        method: '標準手技。',
        positive: '疼痛再現',
        caution: '特定構造の診断精度は低く、「誘発陽性」の記録として扱う。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '腱板断裂', distinguishing: '著明な脱力・lag sign。高齢・外傷性で考慮。' },
      { group: 'likely', name: '凍結肩（初期）', distinguishing: '他動ROM制限の進行。' },
      { group: 'must_not_miss', name: '頚椎由来・胸郭出口症候群', distinguishing: '神経症状・頚部所見。', urgency: 'confirm_md' },
      { group: 'similar', name: '石灰沈着性腱板炎', distinguishing: '急性激痛発作。' },
    ],
    redFlags: [
      { finding: '発熱・安静時激痛・急速な腫脹', action: '感染等の除外。当日中に医療相談。', urgency: 'same_day' },
      { finding: '進行する脱力・筋萎縮', action: '大断裂・神経障害の評価。医師へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '初期診療でルーチンの画像は不要なことが多い（レッドフラッグ・難治例で医師判断）。画像所見（棘・肥厚等）は無症候者にも多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '確立した分類はない。疼痛強度・機能・負荷耐容で段階づける。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '第一選択: 教育＋負荷管理＋漸増的運動療法（腱板・肩甲骨周囲・挙上動作の段階負荷）。12週程度のプログラムで多くが改善と報告。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    surgical: [
      { text: '肩峰下除圧術は運動療法に対する優越性が示されず、適応は慎重（医師判断）。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・導入期',
        period: '0〜4週',
        goals: ['症状の鎮静化', '負荷の適正化'],
        allowed: ['疼痛許容範囲の等尺性・低負荷運動'],
        avoid: ['誘発負荷の反復継続'],
        criteria: ['夜間・日常痛の軽減'],
      },
      {
        name: '漸増負荷期',
        period: '4〜12週',
        goals: ['腱板・肩甲骨機能の向上', '挙上負荷の再獲得'],
        allowed: ['チューブ→重錘の漸増', '挙上角度の段階拡大'],
        avoid: ['急な負荷増'],
        criteria: ['目標動作の疼痛消失傾向'],
      },
    ],
    returnCriteria: [
      { text: '職業/競技のオーバーヘッド負荷を疼痛許容範囲で遂行でき、翌日再燃がないこと。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '運動療法で多くが改善するが数週〜数ヶ月を要する。再燃予防には負荷管理の継続が重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'SPADI', target: '肩の疼痛・障害', range: '0-100（低いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '肩のスジ（腱板）とその周囲が、負荷の変化に適応しきれず痛みを出している状態です。多くはレントゲンやMRIで「どこが悪い」と断定できず、それ自体は悪いことではありません。',
      dos: ['段階的な肩の運動プログラムが最も効果の裏付けがある治療です', '痛みが軽い範囲での日常使用は続けましょう'],
      donts: ['完全に使わないこと／痛みを無視して使い続けること（両極端は×）'],
      seekCare: ['夜間痛の悪化・発熱', '力がどんどん入らなくなる'],
      goal: '肩の「負荷への強さ」を取り戻し、仕事・競技の動きを痛みなく行えるようにします。',
    },
    motionCapture: [
      { movement: '挙上・リーチ動作', purpose: '肩甲骨運動・代償の評価', setup: '後方＋正面。', watchFor: ['肩甲骨リズム異常', 'すくめ代償'] },
    ],
    references: [
      {
        authors: 'Beard DJ, Rees JL, Cook JA, et al.',
        title: 'Arthroscopic subacromial decompression for subacromial shoulder pain (CSAW): a multicentre, placebo-controlled trial',
        source: 'Lancet', year: 2018, verified: false,
        note: '除圧術のプラセボ対照試験。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 肩峰下疼痛症候群
  {
    id: 'saps',
    category: 'shoulder',
    names: {
      ja: '肩峰下疼痛症候群',
      en: 'Subacromial Pain Syndrome',
      abbreviations: ['SAPS'],
      synonyms: ['肩峰下インピンジメント症候群', 'subacromial impingement'],
      note: 'RCRSPとほぼ同義に用いられる。本ページは概念整理用で、評価・管理はRCRSPページ参照。',
    },
    keywords: ['肩峰下', 'インピンジメント', '挙上時痛', '疼痛弧'],
    overview: [
      { text: '肩峰下腔由来と考えられる肩痛の総称。「衝突（インピンジメント）」という力学的説明は単純化しすぎであるとされ、RCRSPの概念に統合されつつある。', certainty: 'moderate', status: 'needs_literature' },
      { text: '評価・リハビリテーションの実際は「腱板関連肩痛（RCRSP）」ページを参照。', certainty: 'expert', status: 'verified' },
    ],
    anatomy: [
      { text: '肩峰下腔（腱板・滑液包）の負荷応答が中心。肩峰形態と症状の関連は弱いとする報告が増えている。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    epidemiology: [
      { text: 'RCRSPページ参照。', status: 'verified' },
    ],
    mechanism: [
      { text: 'RCRSPページ参照。', status: 'verified' },
    ],
    symptoms: [
      { text: '挙上時痛・疼痛弧・夜間の寝返り時痛（RCRSPと共通）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      'RCRSPページの問診項目に準ずる',
    ],
    physicalExam: [
      { text: 'RCRSPページ参照（誘発テスト＋症状修正テスト＋頚椎除外）。', status: 'verified' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: 'RCRSP（同義概念）', distinguishing: '用語の違いであり管理は共通。' },
      { group: 'must_not_miss', name: '腱板大断裂・頚椎由来', distinguishing: 'RCRSPページ参照。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: 'RCRSPページのレッドフラッグに準ずる', action: '該当時は医師へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'ルーチン画像は不要なことが多い（医師判断）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: '確立した分類はない。', certainty: 'low', status: 'insufficient' },
    ],
    conservative: [
      { text: '段階的運動療法が第一選択（RCRSPページの段階を使用）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '除圧術の優越性は示されていない（医師判断）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    rehabPhases: [
      {
        name: 'RCRSPプログラムに統合',
        period: '—',
        goals: ['RCRSPページの各期を適用'],
        allowed: ['同ページ参照'],
        avoid: ['同ページ参照'],
        criteria: ['同ページ参照'],
      },
    ],
    returnCriteria: [
      { text: 'RCRSPページ参照。', status: 'verified' },
    ],
    prognosis: [
      { text: 'RCRSPページ参照。', status: 'verified' },
    ],
    outcomes: [
      { name: 'SPADI', target: '肩の疼痛・障害', range: '0-100（低いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '肩の屋根（肩峰）の下で腕を上げるときに痛みが出る状態の呼び名です。以前は「骨がぶつかって削れる」と説明されましたが、現在は「肩のスジの使われ過ぎ・適応不足」として運動で治すのが標準です。',
      dos: ['段階的な肩のトレーニングを続けましょう'],
      donts: ['「骨を削らないと治らない」と思い込むこと（多くは運動療法で改善します）'],
      seekCare: ['夜間痛の悪化・発熱・急な脱力'],
      goal: '痛みなく腕を上げられる肩を運動で取り戻すことが目標です。',
    },
    motionCapture: [
      { movement: '挙上動作', purpose: '疼痛弧・代償の評価', setup: '正面＋後方。', watchFor: ['疼痛弧', '肩甲骨代償'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 上腕二頭筋長頭腱障害
  {
    id: 'lhb-tendinopathy',
    category: 'shoulder',
    names: {
      ja: '上腕二頭筋長頭腱障害',
      en: 'Long Head of Biceps Tendinopathy',
      abbreviations: ['LHB'],
      synonyms: ['上腕二頭筋長頭腱炎', 'biceps tendinopathy'],
      note: '単独病変はまれで、腱板病変・SLAPとの併存が多い。前方痛の一因として評価する。',
    },
    keywords: ['肩前面', '結節間溝', '上腕二頭筋', 'カール動作', 'オーバーヘッド'],
    overview: [
      { text: '結節間溝部の長頭腱の腱症・腱鞘炎。肩前面痛の一因だが、単独より腱板病変等との併存が多く、責任病変の断定は慎重に。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '長頭腱は関節内を走行し結節間溝を通る。滑車（pulley）損傷で不安定化しうる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: 'オーバーヘッド競技者・重量トレーニング愛好者・中高年に見られる。', certainty: 'low', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '反復する牽引・回旋負荷、腱の滑走障害。腱板前上方病変との関連。', certainty: 'low', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '肩前面（結節間溝部）の疼痛。カール・リーチ・オーバーヘッドで誘発。断裂時は「ポパイ変形」。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（前面限局か）', '誘発動作（カール・投球）', 'トレーニング内容の変化',
      '急な断裂エピソード（変形・皮下出血）の有無',
    ],
    physicalExam: [
      { text: '結節間溝の限局圧痛（左右比較）、Speed/Yergasonテスト、腱板・SLAP併存評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Speed test',
        target: '長頭腱',
        method: '肘伸展・前腕回外で前方挙上に抵抗。',
        positive: '結節間溝部の疼痛',
        caution: '診断精度は限定的。圧痛部位と組み合わせる。',
        status: 'needs_literature',
      },
      {
        name: 'Yergason test',
        target: '長頭腱・滑車',
        method: '肘90°で回外に抵抗。',
        positive: '結節間溝部の疼痛・弾発',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: 'RCRSP・腱板断裂（肩甲下筋含む）', distinguishing: '併存が多い。腱板評価を必ず実施。' },
      { group: 'likely', name: 'SLAP損傷', distinguishing: 'オーバーヘッド選手・深部痛。' },
      { group: 'similar', name: '烏口突起炎・胸筋付着部痛', distinguishing: '圧痛部位で区別。' },
    ],
    redFlags: [
      { finding: '急な断裂（変形・皮下出血）', action: '医師評価（多くは保存だが方針確認）。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '超音波で腱の腫大・液貯留・不安定性を評価可能（検者依存）。MRIは併存病変評価（医師判断）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '確立した分類はない（腱症/不安定/断裂の区分）。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '負荷管理＋肘/肩複合の漸増負荷（等尺→遠心性）＋肩甲骨・腱板機能の最適化。単独ストレッチの強行は避ける。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '難治例・不安定例で腱固定/切離が検討される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '鎮静・等尺期',
        period: '0〜3週',
        goals: ['前面痛の鎮静化'],
        allowed: ['等尺性肘屈曲/肩前方負荷', '肩甲骨訓練'],
        avoid: ['高負荷カール・急な伸張負荷'],
        criteria: ['日常動作の疼痛軽減'],
      },
      {
        name: '漸増負荷期',
        period: '3週以降',
        goals: ['牽引負荷への耐容回復'],
        allowed: ['漸増カール・プル系・オーバーヘッド段階負荷'],
        avoid: ['負荷の急増'],
        criteria: ['目標トレーニング/投球で疼痛なし'],
      },
    ],
    returnCriteria: [
      { text: '目標負荷（トレーニング重量・投球強度）で疼痛なく、翌日再燃がないこと。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存で改善する例が多い。併存病変の管理が経過を左右する。', certainty: 'low', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'DASH / QuickDASH', target: '上肢機能', range: '0-100（低いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '力こぶの筋肉の上側のスジ（長頭腱）が肩の前で擦れたり引っ張られたりして痛む状態です。肩の他のスジの不調と一緒に起こることが多い症状です。',
      dos: ['負荷を調整しながら、少しずつ強くする筋トレを行いましょう'],
      donts: ['痛む位置での高重量トレーニングの継続'],
      seekCare: ['「ブチッ」と切れて力こぶの形が変わった', '痛みが数ヶ月続く'],
      goal: '肩前面の痛みなく、トレーニングや投球を続けられる状態に戻します。',
    },
    motionCapture: [
      { movement: 'プル/カール動作・投球', purpose: '前方負荷動作の評価', setup: '側面＋正面。', watchFor: ['肩前方突出の代償', '肘主導のフォーム'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 肩関節前方不安定症
  {
    id: 'anterior-shoulder-instability',
    category: 'shoulder',
    names: {
      ja: '肩関節前方不安定症',
      en: 'Anterior Shoulder Instability',
      abbreviations: [],
      synonyms: ['前方不安定性', '外傷性肩関節不安定症'],
      note: '初回脱臼後の病態。反復性へ移行しやすい若年例の管理が焦点。反復性脱臼ページと併読。',
    },
    keywords: ['脱臼後', '不安感', 'apprehension', '外転外旋', 'コンタクトスポーツ', 'Bankart'],
    overview: [
      { text: '外傷性前方脱臼・亜脱臼後に前方への不安定感・脱臼不安が残存する病態。若年・コンタクト競技者は再脱臼率が高く、方針決定（保存/手術）が重要な分岐となる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '前下方関節唇損傷（Bankart病変）±骨性欠損（骨性Bankart・Hill-Sachs）が不安定性の構造基盤。骨欠損の程度が再発・術式選択に関わる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '10〜20代男性・コンタクト/オーバーヘッド競技で再発率が高いと報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '外転外旋強制での前方脱臼。再発は挙上外旋位の動作・接触で生じやすい。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '外転外旋位での不安感（apprehension）、脱臼/亜脱臼の反復、投球・ブロック動作の回避。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '初回脱臼の状況・整復方法・年齢', '脱臼/亜脱臼の回数', '不安感の誘発肢位',
      '競技（コンタクト/オーバーヘッド）と復帰目標', '神経症状（腋窩神経）既往',
    ],
    physicalExam: [
      { text: 'apprehension/relocation test、可動域・腱板機能、肩甲骨制御、全身弛緩性。腋窩神経領域の感覚・三角筋機能を確認。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Apprehension / Relocation test',
        target: '前方不安定性',
        method: '背臥位で外転外旋を加え（apprehension）、上腕骨頭を後方へ押して軽減をみる（relocation）。',
        positive: '不安感の出現とrelocationでの軽減',
        sensitivity: '不安感を指標とすると比較的高いと報告', specificity: '比較的高いと報告',
        caution: '疼痛のみの陽性は特異度が下がる。愛護的に。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '反復性肩関節脱臼', distinguishing: '脱臼が既に反復している状態（別ページ）。' },
      { group: 'likely', name: 'SLAP・腱板損傷の併存', distinguishing: '年齢により併存頻度が変わる（高齢は腱板断裂合併に注意）。' },
      { group: 'must_not_miss', name: '腋窩神経損傷', distinguishing: '三角筋筋力低下・外側感覚障害。', urgency: 'confirm_md' },
      { group: 'similar', name: '多方向性不安定症', distinguishing: '非外傷性・多方向・全身弛緩性。管理が異なる。' },
    ],
    redFlags: [
      { finding: '整復されない脱臼・変形', action: '整復は医療機関で。救急受診。', urgency: 'emergency' },
      { finding: '脱臼後の三角筋麻痺・感覚障害', action: '腋窩神経損傷評価。医師へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（骨性評価）・MRI/CT（唇・骨欠損の定量）は方針決定に重要（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '外傷性/非外傷性、骨欠損の程度（glenoid track概念等）。判定は医師。', certainty: 'moderate', status: 'needs_md_review', refs: [0] },
    ],
    conservative: [
      { text: '腱板・肩甲骨周囲の強化＋外転外旋域の段階的再獲得＋競技動作の修正。若年コンタクト選手では保存の再発率が高いことを共有し方針を医師と協議。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '鏡視下Bankart修復、骨欠損例では烏口突起移行（Latarjet）等（医師判断）。反復予防の観点から若年例で早期手術が選択されることも多い。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護・基礎期（初回脱臼後）',
        period: '目安: 0〜3週',
        goals: ['疼痛・炎症の鎮静', '固定方針（医師）下での管理'],
        allowed: ['指示範囲のROM・等尺性', '肩甲骨セッティング'],
        avoid: ['外転外旋の複合肢位', '早期の投球・接触'],
        criteria: ['日常動作の疼痛軽減'],
        mdCheck: '固定期間・方針',
      },
      {
        name: '筋力・安定化期',
        period: '3〜8週',
        goals: ['腱板・肩甲骨筋の強化', '可動域の段階回復'],
        allowed: ['チューブ内外旋・肩甲骨訓練', '段階的な外転外旋域の拡大'],
        avoid: ['不安感を伴う端域の強制'],
        criteria: ['中間域での筋力回復・不安感なし'],
      },
      {
        name: '競技準備・復帰期',
        period: '8週以降（競技により）',
        goals: ['競技肢位での安定', '接触/投球の段階再開'],
        allowed: ['競技特異的ドリル・接触の段階導入'],
        avoid: ['不安感残存での完全復帰'],
        criteria: ['apprehension陰性化傾向・競技動作で不安なし'],
        mdCheck: '再発リスクを踏まえた復帰/手術の判断',
      },
    ],
    returnCriteria: [
      { text: '筋力・可動域の回復＋競技肢位での不安感消失＋（必要例は）画像評価を踏まえた医師との共同判断。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '年齢が若いほど再脱臼率が高い。反復は骨欠損を進め治療を複雑にするため、再発時は早期に方針再考。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'WOSI', target: '不安定症特異的QOL', range: '尺度による' },
      { name: 'Rowe score', target: '安定性・機能', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '肩が前に外れた（外れかけた）あと、支えの組織が傷つき「また外れそう」な状態が残っています。特に若い方・コンタクトスポーツでは再発しやすいことが分かっています。',
      dos: ['肩の深部のスジ（腱板）と肩甲骨まわりの筋トレを続けましょう'],
      donts: ['不安を感じる腕の位置（横に開いて捻る）での無理な動作・接触プレー'],
      seekCare: ['また外れた・外れかけた', '腕の外側のしびれ・力の入りにくさ'],
      goal: '筋肉での安定を最大化しつつ、あなたの年齢・競技での再発リスクを踏まえて、手術を含めた最適な方針を医師と一緒に決めていきます。',
    },
    motionCapture: [
      { movement: '投球・ブロック動作（段階的）', purpose: '競技肢位での安定性評価', setup: '側面＋後方。', watchFor: ['外転外旋位の回避', '肩甲骨の遅れ'] },
    ],
    references: [
      {
        authors: 'Di Giacomo G, Itoi E, Burkhart SS',
        title: 'Evolving concept of bipolar bone loss and the Hill-Sachs lesion: from "engaging/non-engaging" lesion to "on-track/off-track" lesion',
        source: 'Arthroscopy', year: 2014, verified: false,
        note: 'glenoid track概念の基盤文献。',
      },
    ],
    protocolTemplateKey: 'shoulder_instability',
    protocolJoint: 'shoulder',
    meta: draftMeta(),
  },
]
