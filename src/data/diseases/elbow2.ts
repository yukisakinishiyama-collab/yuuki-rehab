// 疾患ページ: 肘・前腕・手関節カテゴリ 2/2（下書き・医師監修前）
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

export const ELBOW_PAGES_2: DiseasePage[] = [
  // ───────────────────────────── TFCC損傷
  {
    id: 'tfcc-injury',
    category: 'elbow_hand',
    names: {
      ja: 'TFCC損傷',
      en: 'Triangular Fibrocartilage Complex Injury',
      abbreviations: ['TFCC'],
      synonyms: ['三角線維軟骨複合体損傷', '手関節尺側部痛'],
      note: '手関節尺側部痛の代表。外傷性と変性（尺骨突き上げ関連）で管理が異なる。',
    },
    keywords: ['手首の小指側', 'ドアノブ', '雑巾絞り', '転倒', 'ラケット', '尺側部痛'],
    overview: [
      { text: '手関節尺側の軟骨・靱帯複合体（TFCC）の損傷。転倒・回旋外傷や、尺骨が相対的に長い形態（ulnar plus）を背景とした変性で生じる。回旋・尺屈での尺側部痛が特徴。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: 'TFCCは関節円板・掌背側橈尺靱帯等からなり、DRUJ安定化と尺側荷重の分散を担う。深層線維（小窩付着部）の損傷はDRUJ不安定と関連。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '転倒・ラケット/バット競技・体操で外傷性が、中高年で変性が見られる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '伸展回内位での手つき・強い回旋（バット・ラケット）・牽引。変性は尺側荷重の蓄積。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '尺側部痛（ドアノブ・雑巾絞り・体重支持で誘発）、クリック、回旋時の違和感、（不安定例）尺骨頭の浮き上がり感。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転（外傷か蓄積か）', '誘発動作（回旋・尺屈・荷重）', 'クリック・不安定感',
      '競技・仕事での手関節負荷', '画像検査の有無',
    ],
    physicalExam: [
      { text: 'TFCC部（尺骨茎状突起遠位）の圧痛、尺屈回旋ストレステスト、DRUJ安定性（ballottement）、把持・回旋の疼痛出現負荷。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '尺屈回旋ストレステスト（TFCC compression）',
        target: 'TFCC',
        method: '尺屈位で軸圧＋回旋を加える。',
        positive: '尺側部痛・クリックの再現',
        caution: '単独で確定しない。DRUJ評価と併施。',
        status: 'needs_pro_review',
      },
      {
        name: 'DRUJ ballottement test',
        target: 'DRUJ不安定性',
        method: '橈骨を固定し尺骨頭を掌背側へ動かし左右比較。',
        positive: '動揺増大・疼痛',
        caution: '肢位（回内外）で安定性が変わる。判定は医師と共有。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '尺側手根伸筋（ECU）腱鞘炎・脱臼', distinguishing: 'ECU走行の圧痛・回外時の弾発。' },
      { group: 'likely', name: '尺骨突き上げ症候群', distinguishing: 'ulnar plus・月状骨尺側の圧痛。画像（医師）。' },
      { group: 'must_not_miss', name: '尺骨茎状突起骨折・月状骨周囲損傷', distinguishing: '外傷後はX線評価。', urgency: 'early_visit' },
      { group: 'similar', name: '豆状三角骨関節障害', distinguishing: '豆状骨部の圧痛。' },
    ],
    redFlags: [
      { finding: '外傷後の著明な腫脹・変形・可動不能', action: '骨折・脱臼除外。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（尺骨バリアンス・骨性評価）・MRI/MR造影（TFCC評価）。確定は医師（±鏡視）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Palmer分類（外傷性1A-D/変性2A-E）。治療選択と関連（医師判定）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '第一選択となることが多い: 装具（手関節尺側支持/ワイドバンド）による負荷軽減＋誘発動作の調整→段階的な把持/回旋負荷再獲得＋前腕・肩甲帯の強化。数週〜3ヶ月を目安に評価。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '不安定例・保存無効例で鏡視下修復・尺骨短縮術等（型による・医師判断）。術後は固定＋段階的回旋再開（執刀医プロトコル）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護・負荷調整期',
        period: '目安: 0〜6週',
        goals: ['尺側部の鎮静化', '誘発負荷の管理'],
        allowed: ['装具下のADL', '疼痛のない範囲の可動域・把持運動'],
        avoid: ['強い回旋・尺屈荷重（絞り・体重支持）'],
        criteria: ['日常動作の疼痛軽減'],
      },
      {
        name: '漸増負荷期',
        period: '6週以降',
        goals: ['把持・回旋負荷の耐容回復'],
        allowed: ['漸増的な握力・回旋トレーニング', '段階的な競技動作'],
        avoid: ['急な高負荷回旋'],
        criteria: ['目標動作で疼痛なし'],
        mdCheck: '3ヶ月抵抗例の画像・手術相談',
      },
    ],
    returnCriteria: [
      { text: '把持・回旋・（必要なら）体重支持動作を疼痛なく反復でき、握力が回復していること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法で改善する例が多いが、不安定型・変性型は遷延しうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'PRWE / DASH', target: '手関節機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '手首の小指側にある軟骨と靱帯のクッション複合体（TFCC）を傷めた状態です。ドアノブや雑巾絞りで手首の小指側が痛むのが典型です。',
      dos: ['サポーターで負担を減らしながら、痛みのない範囲で使い続けましょう'],
      donts: ['痛みをおしての絞り動作・手をつく動作の反復'],
      seekCare: ['手首がグラグラする感じ・骨の出っ張りが動く感じ', '3ヶ月続けても改善しない'],
      goal: '手首の小指側の痛みなく、握る・捻る・支える動作を取り戻すことが目標です。',
    },
    motionCapture: [
      { movement: '回旋動作（ドアノブ・ラケット）', purpose: '誘発動作の負荷評価', setup: '上方＋側面。', watchFor: ['過度な尺屈位での使用', '代償的な肩肘の動き'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── DRUJ不安定症
  {
    id: 'druj-instability',
    category: 'elbow_hand',
    names: {
      ja: 'DRUJ不安定症',
      en: 'Distal Radioulnar Joint Instability',
      abbreviations: ['DRUJ'],
      synonyms: ['遠位橈尺関節不安定症'],
      note: 'TFCC深層損傷・橈骨遠位端骨折後に生じる。回内外の安定性評価が中心（確定は医師）。',
    },
    keywords: ['手首', '尺骨頭', '回内外', '不安定', 'ピアノキー', '骨折後'],
    overview: [
      { text: '遠位橈尺関節の安定機構（TFCC深層等）の破綻による不安定症。回旋時の疼痛・脱力・クリックを呈し、橈骨遠位端骨折後の残存症状としても重要。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: 'DRUJの安定はTFCC（特に小窩付着部）・関節包・ECU腱鞘・骨形状の複合による。前腕回内外で接触面が変化する。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '外傷後（TFCC損傷・橈骨遠位端骨折・両前腕骨骨折後）に見られる。', certainty: 'low', status: 'needs_literature' },
    ],
    mechanism: [
      { text: 'TFCC小窩部の破綻・骨折変形（橈骨短縮・背屈転位）によるDRUJ適合不全。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    symptoms: [
      { text: '回内外での疼痛・引っかかり・脱力（重い物で手首が「抜ける」感じ）、尺骨頭の目立ち（ピアノキー様）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '外傷・骨折歴（治療内容含む）', '誘発動作（回旋・荷重）', '不安定感の性状',
      '職業要求（回旋・重量物）',
    ],
    physicalExam: [
      { text: 'ballottement test（回内外各肢位）・ピアノキーサイン・回旋筋力と疼痛。骨折後は変形の影響も考慮（画像は医師）。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: 'DRUJ ballottement / ピアノキーサイン',
        target: 'DRUJ安定性',
        method: '尺骨頭の掌背側動揺・押し込みでの戻りをみる。',
        positive: '動揺増大・疼痛・ピアノキー様の戻り',
        caution: '左右差・肢位差で判断。確定・原因評価は医師。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: 'TFCC損傷（安定型）', distinguishing: '不安定所見の有無で区別。連続体。' },
      { group: 'likely', name: 'ECU腱脱臼', distinguishing: '回外時の腱の乗り上げ。' },
      { group: 'must_not_miss', name: '骨折変形治癒による不適合', distinguishing: 'X線評価（医師）。矯正手術の適応判断に関わる。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '急性外傷後の明らかな脱臼感・変形', action: '整復・評価のため受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（両側比較・変形評価）・CT（回内外肢位での適合評価）・MRI（TFCC）。判定は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '急性/慢性、方向（背側/掌側）、原因（軟部性/骨性）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '軽症・急性例: サポーター/装具（回旋制限）での保護＋回旋負荷の管理→安定化に寄与する筋（ECU・回内方形筋）の等尺〜漸増強化。', certainty: 'low', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '症候性不安定の持続でTFCC小窩修復・靱帯再建・骨性矯正等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜6週',
        goals: ['DRUJの保護', '疼痛軽減'],
        allowed: ['装具下ADL', '等尺性の回内外・握り運動'],
        avoid: ['端域回旋・回旋下の荷重'],
        criteria: ['日常回旋動作の疼痛軽減'],
      },
      {
        name: '安定化・復帰期',
        period: '6週以降',
        goals: ['筋性安定化・負荷耐容の回復'],
        allowed: ['漸増的な回旋・把持トレーニング'],
        avoid: ['急な重量物・端域の強制'],
        criteria: ['目標動作で不安定感なし'],
        mdCheck: '持続例の手術評価',
      },
    ],
    returnCriteria: [
      { text: '回旋・荷重動作で疼痛と不安定感がなく、握力・回旋筋力が回復していること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '軽症例は保存で管理可能な例がある。骨性要因例は矯正なしでは残存しやすい。', certainty: 'low', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'PRWE / DASH', target: '手関節機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '手首の2本の骨（橈骨と尺骨）の連結部分がゆるみ、手のひら返しや荷物で痛み・不安定感が出る状態です。骨折のあとに起こることもあります。',
      dos: ['サポーターで支えながら、支える筋肉を鍛えましょう'],
      donts: ['重い物を捻りながら持つ動作の反復'],
      seekCare: ['不安定感が続く・骨の出っ張りが動く（専門評価を勧めます）'],
      goal: '手首の連結を筋肉で支え、必要なら手術も含めて「頼れる手首」を取り戻します。',
    },
    motionCapture: [
      { movement: '回内外・荷重動作', purpose: '不安定誘発動作の評価', setup: '上方＋側面。', watchFor: ['尺骨頭の浮き上がり', '回旋の回避'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 手根管症候群
  {
    id: 'carpal-tunnel-syndrome',
    category: 'elbow_hand',
    names: {
      ja: '手根管症候群',
      en: 'Carpal Tunnel Syndrome',
      abbreviations: ['CTS'],
      synonyms: ['正中神経麻痺（手根管部）'],
      note: '最多の絞扼性神経障害。母指球萎縮まで進行させないことが管理目標。',
    },
    keywords: ['朝のしびれ', '親指〜中指', '夜間しびれ', '妊娠', '更年期', '母指球', 'つまみにくい'],
    overview: [
      { text: '手根管での正中神経の絞扼障害。母指〜環指橈側のしびれ（夜間・明け方に増悪、手を振ると軽快）が典型で、進行すると母指球萎縮・つまみ動作障害を来す。', certainty: 'high', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '手根管は手根骨と横手根靱帯で囲まれ、屈筋腱9本と正中神経が通る。内圧は手関節の掌背屈で上昇する。', certainty: 'high', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中年女性・妊娠/産後・更年期・手をよく使う作業者・糖尿病/透析患者に多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '滑膜増生・浮腫・反復負荷による管内圧上昇。ホルモン要因・全身疾患の関与。', certainty: 'moderate', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '母指〜中指（環指橈側）のしびれ・疼痛。夜間〜明け方に増悪し、手を振る（flick sign）と軽快。進行でつまみ動作の脱力・母指球のやせ。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      'しびれの指の分布（小指は保たれるか）', '夜間増悪・flick signの有無', '妊娠・出産・基礎疾患',
      '手作業の内容', 'ボタン・小銭のつまみにくさ',
    ],
    physicalExam: [
      { text: '感覚（正中領域・手掌枝領域は保たれる点に留意）、Phalen/Tinel/手根管圧迫テスト、母指球筋力（対立・外転）・萎縮の有無。頚椎の鑑別評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Phalenテスト・手根管圧迫テスト',
        target: '手根管での正中神経',
        method: '手関節最大掌屈保持（約60秒）／手根管部の圧迫（約30秒）。',
        positive: '正中領域のしびれ誘発',
        sensitivity: '中等度と報告', specificity: '中等度と報告',
        caution: '単独で確定せず、症状分布・夜間性と統合。確定は伝導検査（医師）。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '頚椎症性神経根症（C6-7）', distinguishing: '頚部所見・前腕近位のしびれ・夜間性が乏しい。' },
      { group: 'likely', name: '回内筋症候群（近位正中神経）', distinguishing: '手掌枝領域も障害・夜間性が乏しい。' },
      { group: 'must_not_miss', name: '多発神経障害（糖尿病等）・胸郭出口', distinguishing: '両側・広範な分布。医師評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '母指球萎縮・つまみ脱力の進行', action: '不可逆化のリスク。早期に医師（伝導検査・手術評価）へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '神経伝導検査が標準（医師）。超音波での神経腫大評価が補助になる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '軽症（感覚のみ）/中等症/重症（萎縮）。手術適応判断に関わる（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '軽〜中等症: 夜間スプリント（中間位）＋誘発動作の調整＋腱・神経滑走運動。ステロイド注射は医師判断。妊娠関連は産後軽快が多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '重症・保存無効例で手根管開放術（成績良好とされる・医師判断）。術後は瘢痕管理・握力回復のリハ。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保存管理期',
        period: '目安: 6〜12週',
        goals: ['夜間しびれの軽減', '機能維持'],
        allowed: ['夜間スプリント', '滑走運動', '作業姿勢の調整'],
        avoid: ['手関節掌背屈位での長時間作業・振動工具の連続使用'],
        criteria: ['夜間覚醒の減少'],
        mdCheck: '改善不良・進行時の伝導検査/手術',
      },
      {
        name: '術後回復期（該当例）',
        period: '術後数週〜3ヶ月',
        goals: ['瘢痕・ピラーペインの管理', '握力回復'],
        allowed: ['早期の指運動・瘢痕マッサージ（指示後）', '漸増把持訓練'],
        avoid: ['早期の強把持・体重支持'],
        criteria: ['握力・つまみ力の回復'],
      },
    ],
    returnCriteria: [
      { text: 'しびれの管理と、作業・家事の遂行（つまみ・把持）が支障なく行えること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '軽症は保存で改善が多い。萎縮例は術後も回復が不完全になりうるため、進行前の対応が重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'CTSI（Boston）/ DASH', target: '症状重症度・機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '手首の手のひら側にあるトンネルの中で神経が圧迫され、親指〜中指がしびれる状態です。明け方にしびれて、手を振ると楽になるのが典型です。',
      dos: ['夜は手首を固定する装具（シーネ）を着けると明け方のしびれが軽くなります', '手首を反らせ続ける作業の合間に休憩を'],
      donts: ['しびれを放置して親指の付け根がやせるまで待つこと'],
      seekCare: ['親指の付け根の膨らみがやせてきた・ボタンがけが下手になった（手術を含む相談を早めに）'],
      goal: '夜ぐっすり眠れて、つまむ・握るが不自由なくできる手を守ることが目標です。',
    },
    motionCapture: [
      { movement: '作業動作（キーボード・工具）', purpose: '手関節肢位の評価', setup: '上方＋側面。', watchFor: ['掌背屈位の持続', '休憩の欠如'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── de Quervain病
  {
    id: 'de-quervain',
    category: 'elbow_hand',
    names: {
      ja: 'de Quervain病',
      en: 'de Quervain Tenosynovitis',
      abbreviations: [],
      synonyms: ['ドケルバン病', '狭窄性腱鞘炎（第1区画）', '母指側手首の腱鞘炎'],
      note: '産後・育児中（抱っこ）・スマホ使用で急増する代表的腱鞘炎。',
    },
    keywords: ['親指側の手首', '抱っこ', '産後', 'スマホ', 'Finkelstein', '腱鞘炎'],
    overview: [
      { text: '手関節背側第1区画（APL・EPB腱）の狭窄性腱鞘炎。母指の使用＋尺屈の反復（抱っこ・スマホ・手作業）で生じ、産後女性に特に多い。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '第1区画内のAPL/EPB腱と腱鞘。区画内の隔壁（EPB亜区画）の存在が難治例と関連するとされる。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '産後・授乳期・更年期の女性、反復手作業者に多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '母指外転伸展＋手関節尺屈の反復による腱鞘の肥厚・狭窄。ホルモン・浮腫要因の関与。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '橈骨茎状突起部の疼痛・腫脹。母指を握り込んで手首を小指側に倒すと激痛。抱き上げ・ペットボトル開栓で誘発。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '育児状況（抱っこの頻度・方法）', 'スマホ・手作業の量', '産後/授乳・更年期',
      '疼痛部位の限局性', '母指CM関節症状との区別',
    ],
    physicalExam: [
      { text: '第1区画の限局圧痛・腫脹、Finkelstein/Eichhoffテスト、母指CM関節（軸圧grind）との鑑別、浮腫の評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Eichhoffテスト（通称Finkelstein）',
        target: '第1区画の腱鞘炎',
        method: '母指を掌内に握り込み他動的に尺屈。',
        positive: '橈骨茎状突起部の激痛',
        caution: '健常でも不快感が出るため左右差で判断。CM関節症でも疼痛が出うる。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '母指CM関節症', distinguishing: 'CM関節部の圧痛・grind test陽性・中高年。' },
      { group: 'likely', name: '交叉症候群（intersection）', distinguishing: 'より近位背側（第2区画交叉部）の圧痛・轢音。' },
      { group: 'similar', name: '橈骨神経浅枝の神経炎（Wartenberg）', distinguishing: 'しびれ主体・Tinel。' },
    ],
    redFlags: [
      { finding: '発赤・熱感・発熱を伴う急性腫脹', action: '感染性腱鞘炎の除外。当日中に医療相談。', urgency: 'same_day' },
    ],
    imaging: [
      { text: '診断は臨床ベース。超音波で腱鞘肥厚・隔壁の評価が可能（医師判断）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '確立した分類はない。', certainty: 'low', status: 'insufficient' },
    ],
    conservative: [
      { text: '第一選択: 母指スパイカ装具＋誘発動作の修正（抱っこ方法: 手首中間位・前腕で支える等）＋浮腫管理→症状軽減後に腱滑走・漸増負荷。ステロイド腱鞘内注射は有効性が高いとされる（医師判断）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '難治例で腱鞘切開（隔壁確認含む・医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '安静・保護期',
        period: '目安: 2〜6週',
        goals: ['腱鞘部の鎮静化'],
        allowed: ['装具下のADL', '誘発を避けた育児動作の工夫'],
        avoid: ['母指握り込み＋尺屈の反復（従来の抱き方）'],
        criteria: ['安静時痛・圧痛の軽減'],
      },
      {
        name: '機能回復期',
        period: '症状軽減後',
        goals: ['腱滑走・筋力の回復', '再発予防動作の定着'],
        allowed: ['腱滑走運動・漸増把持訓練'],
        avoid: ['急な負荷再開'],
        criteria: ['誘発動作で疼痛なし'],
        mdCheck: '難治時の注射・手術相談',
      },
    ],
    returnCriteria: [
      { text: '抱っこ・家事・作業を疼痛なく行え、Eichhoff陽性所見が軽快していること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法（特に注射併用）で多くが改善。授乳期は再燃しやすく動作指導が重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'PRWE / NRS', target: '手関節機能・疼痛', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '親指を動かすスジが通る手首のトンネル（腱鞘）が厚くなり、親指側の手首が痛む腱鞘炎です。赤ちゃんの抱っこやスマホ操作で起こりやすい症状です。',
      dos: ['親指を固定する装具で患部を休ませましょう', '抱っこは手首を反らせず、前腕全体で支える方法に変えましょう'],
      donts: ['親指と手首に頼った従来の抱き上げの継続'],
      seekCare: ['赤く腫れて熱をもつ・発熱', '装具や注射でも改善しない'],
      goal: '育児や家事を続けながら症状を鎮めることが目標です。動作の工夫が再発予防の鍵になります。',
    },
    motionCapture: [
      { movement: '抱き上げ動作', purpose: '手関節肢位・負荷の評価', setup: '正面＋側面。', watchFor: ['手関節尺屈位での支持', '母指握り込み'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 舟状骨骨折
  {
    id: 'scaphoid-fracture',
    category: 'elbow_hand',
    names: {
      ja: '舟状骨骨折',
      en: 'Scaphoid Fracture',
      abbreviations: [],
      synonyms: ['手舟状骨骨折'],
      note: '「捻挫」と誤認されやすく、見逃しは偽関節・壊死につながる。snuffbox圧痛では骨折として扱うのが原則。',
    },
    keywords: ['転倒手つき', 'スナッフボックス', '若年男性', '偽関節', 'ギプス', '見逃し'],
    overview: [
      { text: '転倒手つきで生じる手根骨骨折の最多。血行が遠位から供給されるため近位部骨折は壊死・偽関節リスクが高く、初期X線で写らないことがある点が臨床上最重要。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '受傷機転＋snuffbox圧痛があれば、X線陰性でも骨折として固定し再評価（またはMRI）につなぐのが原則。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '血行は遠位極から逆行性で、近位1/3は乏血行。腰部（waist）骨折が最多。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '若年男性のスポーツ・転倒で多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '手関節背屈位での手つき（軸圧）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '手関節橈側の疼痛・snuffbox圧痛・母指軸圧痛。腫脹は軽度のことがあり「捻挫」と自己判断されやすい。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    interviewItems: [
      '受傷機転・受傷からの期間', 'snuffbox部の疼痛', '「捻挫」として放置していないか',
      '医師の診断・固定/手術方針', '職業・競技（固定期間の調整要求）',
    ],
    physicalExam: [
      { text: 'snuffbox圧痛・舟状骨結節圧痛・母指telescoping（軸圧）痛。疑い例は固定して医師へ。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '橈骨遠位端骨折', distinguishing: 'より近位の圧痛・変形。X線。' },
      { group: 'must_not_miss', name: '月状骨周囲脱臼・SL靱帯損傷', distinguishing: '高エネルギー・広い腫脹。画像評価（医師）。', urgency: 'early_visit' },
      { group: 'similar', name: '手関節捻挫', distinguishing: 'snuffbox圧痛があれば捻挫と断定しない。' },
    ],
    redFlags: [
      { finding: '手つき受傷＋snuffbox圧痛', action: 'X線陰性でも骨折として固定し医師管理（再X線/MRI）へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '舟状骨撮影を含むX線。初期陰性例は固定下で1-2週後再撮影またはMRI（医師判断）。CTで転位・癒合評価。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '部位（遠位/腰部/近位）・転位の有無。近位・転位例は手術検討（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '非転位例: ギプス固定（期間は部位により週単位で異なる・医師設定）。固定中の手指・肘・肩の運動と、固定解除後の段階的な可動域・握力回復。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '転位・近位・偽関節例でスクリュー固定・骨移植等（医師判断）。早期復帰要求例で急性期固定術が選択されることもある。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '固定期',
        period: '医師の設定（週単位）',
        goals: ['骨癒合環境の維持', '隣接関節の拘縮予防'],
        allowed: ['手指・肘・肩の自動運動', '固定内での等尺性握り'],
        avoid: ['固定の自己解除', '患手での荷重・接触プレー'],
        criteria: ['画像での癒合（医師判定）'],
        mdCheck: '固定期間・癒合判定',
      },
      {
        name: '可動域・筋力回復期',
        period: '固定解除後4〜8週',
        goals: ['手関節ROM・握力の回復'],
        allowed: ['段階的ROM・握力訓練', '軽負荷ADL'],
        avoid: ['早期の手つき・体重支持'],
        criteria: ['ROM/握力の左右差改善'],
      },
      {
        name: '復帰期',
        period: '癒合確認後',
        goals: ['職業・スポーツ復帰'],
        allowed: ['段階的な荷重/接触動作（装具併用の検討）'],
        avoid: ['癒合不十分での接触競技'],
        criteria: ['荷重動作で疼痛なし・医師許可'],
      },
    ],
    returnCriteria: [
      { text: '画像上の癒合（医師）を前提に、手つき・把持動作の疼痛がなく握力が回復していること。接触競技は装具保護下の早期復帰が許可される場合もある（医師と協議）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '適切に治療されれば癒合率は高いが、見逃し・近位例は偽関節・壊死から手関節症（SNAC）へ進展しうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'PRWE / 握力', target: '手関節機能', range: '尺度・kg' },
    ],
    patientExplanation: {
      whatIs: '転んで手をついたときに折れやすい、手首の小さな骨（舟状骨）の骨折です。血流が乏しくくっつきにくい骨のため、「ただの捻挫」と放置しないことが何より大切です。',
      dos: ['決められた固定期間を守りましょう（この骨は近道がありません）', '固定中も指・肘・肩はよく動かしましょう'],
      donts: ['「腫れてないから」と固定を外すこと', '癒合前の手つき・接触プレー'],
      seekCare: ['親指の付け根のくぼみを押すと痛い（未受診ならすぐX線を）', '固定後も痛みが続く'],
      goal: '確実に骨をつなげて、将来の手首の変形（偽関節→関節症）を防ぐことが最大の目標です。',
    },
    motionCapture: [
      { movement: '手つき動作（復帰期）', purpose: '荷重耐容の評価', setup: '側面。', watchFor: ['荷重回避', '手関節背屈の制限'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 橈骨遠位端骨折後
  {
    id: 'post-distal-radius-fracture',
    category: 'elbow_hand',
    names: {
      ja: '橈骨遠位端骨折後',
      en: 'Post Distal Radius Fracture',
      abbreviations: [],
      synonyms: ['コーレス骨折後', 'スミス骨折後', '手首の骨折後'],
      note: '最多の上肢骨折。固定/術後の浮腫・拘縮管理と、高齢者では骨粗鬆症の二次予防が重要。',
    },
    keywords: ['手首の骨折', '転倒', '高齢者', 'プレート', '浮腫', 'CRPS予防', '骨粗鬆症'],
    overview: [
      { text: '転倒手つきによる最多の上肢骨折後のリハビリ。保存（ギプス）とプレート固定（早期運動可）で経過が異なる。浮腫・指の拘縮・CRPSの予防が初期の要点。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '高齢者では脆弱性骨折として骨粗鬆症評価・転倒予防につなぐことが再骨折予防に重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '関節内骨折・尺骨茎状突起骨折合併・DRUJの状態が機能予後に関わる。変形治癒は回旋・尺側部症状の原因となりうる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '閉経後女性の転倒骨折として最多クラス。若年は高エネルギー外傷。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '背屈位手つき（Colles型）が典型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '（経過中の注意）指の高度腫脹・皮膚色調変化・不釣り合いな疼痛はCRPS/循環障害の評価が必要。しびれ（正中神経）も報告対象。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    interviewItems: [
      '治療法（保存/プレート）・医師の運動開始指示', '受傷/術後週数', '指のこわばり・浮腫',
      'しびれの有無', '骨粗鬆症の評価/治療状況', '転倒の状況（再転倒予防の手がかり）',
    ],
    physicalExam: [
      { text: '浮腫（周径）・手指ROM（初期から全力で追跡）・手関節ROM（許可後）・握力・感覚（正中領域）。肩肘の二次拘縮も確認。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: 'CRPS（複合性局所疼痛症候群）', distinguishing: '不釣り合いな疼痛・浮腫・色調変化・アロディニア。早期に医師と共有。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '急性手根管症候群', distinguishing: '受傷後の進行するしびれ。緊急減圧の対象になりうる。', urgency: 'same_day' },
      { group: 'likely', name: 'EPL腱断裂（遅発性）', distinguishing: '母指IP伸展不能。医師へ。', urgency: 'early_visit' },
    ],
    redFlags: [
      { finding: '進行する正中神経領域のしびれ', action: '急性手根管の可能性。当日中に医師へ。', urgency: 'same_day' },
      { finding: '不釣り合いな疼痛・腫脹・色調変化', action: 'CRPS疑い。早期に医師と対応協議。', urgency: 'confirm_md' },
      { finding: '母指が反らせなくなった', action: 'EPL断裂疑い。医師へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '整復位・癒合の評価は医師のX線による。', status: 'verified' },
    ],
    classification: [
      { text: 'AO分類等（医師）。関節内・転位・粉砕の程度が方針に関わる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '固定期: 指・肩肘の積極運動＋挙上/浮腫管理が最重要（「固定中こそリハビリ」）。解除後: 手関節ROM→握力→荷重の段階回復。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: 'プレート固定後は早期（数日〜）から手関節可動域が許可されることが多い（執刀医の指示に従う）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '転位・関節内骨折等でプレート固定が標準的（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '固定・保護期',
        period: '保存: 4〜6週／術後: 指示による',
        goals: ['浮腫管理', '指・肩肘の完全可動', '（術後）早期手関節ROM'],
        allowed: ['挙上・指の全可動域運動（グーパー・対立）', '肩肘運動', '（術後・許可後）手関節自動ROM'],
        avoid: ['手の下垂位放置', '指を動かさない過保護'],
        criteria: ['指ROMの維持・浮腫の管理'],
        mdCheck: '固定期間・手関節運動開始',
      },
      {
        name: '可動域・筋力回復期',
        period: '解除後〜3ヶ月',
        goals: ['手関節ROM・握力の回復', 'ADLの通常化'],
        allowed: ['段階的ROM・握力訓練・ADL練習'],
        avoid: ['他動での強制矯正', '早期の強い荷重'],
        criteria: ['ADL自立・握力の漸増'],
      },
      {
        name: '機能完成期',
        period: '3ヶ月以降',
        goals: ['荷重動作（手つき）・趣味/仕事の完全復帰', '再骨折予防'],
        allowed: ['段階的な荷重訓練', '骨粗鬆症対策・転倒予防運動'],
        avoid: ['転倒リスクの放置'],
        criteria: ['目標動作の達成・（高齢者）転倒予防策の実行'],
        mdCheck: '骨粗鬆症の評価・治療',
      },
    ],
    returnCriteria: [
      { text: 'ROM・握力の回復（目安: 健側比の大幅改善）と目標動作（家事・仕事・趣味・手つき）の遂行。高齢者は転倒予防までを完了条件に含める。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '多くは良好に回復するが、可動域・握力の完全回復には数ヶ月を要する。変形治癒・CRPS例は機能障害が残りうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'PRWE / DASH', target: '手関節・上肢機能', range: '尺度による' },
      { name: '握力・ROM', target: '機能指標', range: 'kg・度' },
    ],
    patientExplanation: {
      whatIs: '転んで手をついて手首を骨折したあとの回復期間です。骨を治すことと同じくらい、「指を固まらせない・むくませない」ことが大切です。',
      dos: ['固定中から指のグーパー・腕の挙上をこまめに（1日に何度も）', '肩や肘も毎日大きく動かしましょう'],
      donts: ['手を下げたままにする・指をかばって動かさないこと（むくみ・こわばりの原因）'],
      seekCare: ['指のしびれが強くなる', '痛み・腫れ・色の変化が不釣り合いに強い', '親指が反らせなくなった'],
      goal: '手首の動きと握る力を取り戻し、家事・仕事・趣味に完全復帰すること。（ご高齢の方は）骨と転倒の対策で次の骨折を防ぐことも大切な目標です。',
    },
    motionCapture: [
      { movement: '手関節ROM・把持動作', purpose: '回復の経時評価', setup: '上方＋側面。', watchFor: ['背屈/掌屈の左右差', '代償（肩肘）'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
