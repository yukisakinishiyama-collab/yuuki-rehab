// ──────────────────────────────────────────────
// 問診フローチャート（分岐式問診ツリー）定義
// 関節別に、Yes/No形式の質問を分岐させながら
// 疑われる病態候補・推奨スペシャルテストを提示する。
// ※ 診断を行うものではなく、施術者の評価を補助する目的で使用する。
// ──────────────────────────────────────────────

export type FlowAnswerType = 'yesno' | 'choice'

export interface FlowOption {
  label: string
  next: string
}

export interface FlowQuestionNode {
  id: string
  type: 'question'
  question: string
  hint?: string
  answerType: FlowAnswerType
  options: FlowOption[]
}

export interface FlowResultNode {
  id: string
  type: 'result'
  redFlag: boolean
  diagnosis: string[]
  recommendedTests: string[]
  advice: string
}

export type FlowNode = FlowQuestionNode | FlowResultNode

export interface IntakeFlowchartDef {
  joint: string
  startNodeId: string
  nodes: Record<string, FlowNode>
}

// 全ての木で共通して使うレッドフラッグスクリーニング質問
const redFlagNode = (nextNodeId: string): FlowQuestionNode => ({
  id: 'q_redflag',
  type: 'question',
  question: '発熱・原因不明の体重減少・安静時にも強い夜間痛・進行する神経症状（急激なしびれや脱力）はありますか？',
  hint: '骨折・感染・腫瘍などの重篤な病態を除外するためのスクリーニング質問です',
  answerType: 'yesno',
  options: [
    { label: 'はい', next: 'r_redflag' },
    { label: 'いいえ', next: nextNodeId },
  ],
})

const redFlagResult: FlowResultNode = {
  id: 'r_redflag',
  type: 'result',
  redFlag: true,
  diagnosis: ['レッドフラッグ疑い（骨折・感染・腫瘍・重篤な神経障害など）'],
  recommendedTests: ['バイタルサインの確認', '神経学的スクリーニング'],
  advice: '運動療法を優先せず、医療機関（整形外科）への受診・紹介を検討してください。',
}

export const INTAKE_FLOWCHARTS: Record<string, IntakeFlowchartDef> = {
  // ── 膝関節 ──
  '膝関節': {
    joint: '膝関節',
    startNodeId: 'q_redflag',
    nodes: {
      q_redflag: redFlagNode('q1'),
      r_redflag: redFlagResult,
      q1: {
        id: 'q1', type: 'question',
        question: '捻り・衝突・着地など、明らかな外傷（受傷機転）はありましたか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'q2a' },
          { label: 'いいえ', next: 'q2b' },
        ],
      },
      q2a: {
        id: 'q2a', type: 'question',
        question: '受傷直後に「ポキッ」という音や、数時間以内の急激な腫脹がありましたか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_acl_meniscus' },
          { label: 'いいえ', next: 'q3a' },
        ],
      },
      q3a: {
        id: 'q3a', type: 'question',
        question: '膝の内側・外側に衝撃を受け、外反または内反方向へのストレスがかかりましたか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_mcl_lcl' },
          { label: 'いいえ', next: 'r_contusion' },
        ],
      },
      q2b: {
        id: 'q2b', type: 'question',
        question: '膝のお皿の周囲・下に、階段昇降や座位からの立ち上がりで痛みが出ますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_pfps' },
          { label: 'いいえ', next: 'q4' },
        ],
      },
      q4: {
        id: 'q4', type: 'question',
        question: '関節の隙間（内側・外側）に、しゃがみ込みや捻り動作での痛み・引っかかりがありますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_meniscus_degenerative' },
          { label: 'いいえ', next: 'r_overuse' },
        ],
      },
      r_acl_meniscus: {
        id: 'r_acl_meniscus', type: 'result', redFlag: false,
        diagnosis: ['前十字靭帯（ACL）損傷疑い', '半月板損傷疑い'],
        recommendedTests: ['Lachmanテスト', '前方引き出しテスト', 'McMurrayテスト'],
        advice: '荷重・ROM制限の程度を確認し、必要に応じて整形外科でのMRI精査を検討してください。',
      },
      r_mcl_lcl: {
        id: 'r_mcl_lcl', type: 'result', redFlag: false,
        diagnosis: ['内側側副靭帯（MCL）損傷疑い', '外側側副靭帯（LCL）損傷疑い'],
        recommendedTests: ['外反ストレステスト', '内反ストレステスト'],
        advice: '不安定性の程度（Grade）を評価し、荷重制限の必要性を判断してください。',
      },
      r_contusion: {
        id: 'r_contusion', type: 'result', redFlag: false,
        diagnosis: ['打撲・軽度捻挫の疑い'],
        recommendedTests: ['触診', 'ROM評価'],
        advice: '経過観察しつつ、腫脹・可動域制限の推移を確認してください。',
      },
      r_pfps: {
        id: 'r_pfps', type: 'result', redFlag: false,
        diagnosis: ['膝蓋大腿関節痛症候群（PFPS）疑い'],
        recommendedTests: ['グラインドテスト', 'Qアングル評価'],
        advice: '大腿四頭筋・股関節周囲筋の機能評価と動作分析を行ってください。',
      },
      r_meniscus_degenerative: {
        id: 'r_meniscus_degenerative', type: 'result', redFlag: false,
        diagnosis: ['半月板変性・損傷疑い'],
        recommendedTests: ['McMurrayテスト', 'Thessalyテスト'],
        advice: '荷重時痛・引っかかり感の頻度を確認し、必要に応じて画像精査を検討してください。',
      },
      r_overuse: {
        id: 'r_overuse', type: 'result', redFlag: false,
        diagnosis: ['腸脛靭帯炎など使い過ぎ症候群の疑い'],
        recommendedTests: ['触診', 'ROM評価', 'アライメント評価'],
        advice: '練習量・アライメント・柔軟性を確認してください。',
      },
    },
  },

  // ── 肩関節 ──
  '肩関節': {
    joint: '肩関節',
    startNodeId: 'q_redflag',
    nodes: {
      q_redflag: redFlagNode('q1'),
      r_redflag: redFlagResult,
      q1: {
        id: 'q1', type: 'question',
        question: '転倒や強い外力による受傷はありましたか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'q2a' },
          { label: 'いいえ', next: 'q2b' },
        ],
      },
      q2a: {
        id: 'q2a', type: 'question',
        question: '腕が動かせない、または肩の形が変わって見えますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_dislocation' },
          { label: 'いいえ', next: 'r_traumatic_cuff' },
        ],
      },
      q2b: {
        id: 'q2b', type: 'question',
        question: '腕を挙げる動作（90〜120度付近）で痛みが強くなりますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_impingement' },
          { label: 'いいえ', next: 'q3' },
        ],
      },
      q3: {
        id: 'q3', type: 'question',
        question: '投球動作や腕を頭上に振る動作で、引っかかり感や不安定感がありますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_labrum' },
          { label: 'いいえ', next: 'r_frozen' },
        ],
      },
      r_dislocation: {
        id: 'r_dislocation', type: 'result', redFlag: true,
        diagnosis: ['肩関節脱臼・骨折疑い'],
        recommendedTests: ['視診（変形の有無）', '神経血管学的スクリーニング'],
        advice: '無理に整復を試みず、速やかに整形外科へ紹介してください。',
      },
      r_traumatic_cuff: {
        id: 'r_traumatic_cuff', type: 'result', redFlag: false,
        diagnosis: ['外傷性腱板損傷疑い', '肩鎖関節損傷疑い'],
        recommendedTests: ['Drop armテスト', 'ペインフルアーク徴候', '肩鎖関節ストレステスト'],
        advice: '筋力低下の程度を確認し、腱板断裂が疑われる場合は画像精査を検討してください。',
      },
      r_impingement: {
        id: 'r_impingement', type: 'result', redFlag: false,
        diagnosis: ['肩峰下インピンジメント症候群疑い', '腱板炎疑い'],
        recommendedTests: ['Neerテスト', 'Hawkins-Kennedyテスト', 'ペインフルアーク徴候'],
        advice: '肩甲骨の動きと姿勢アライメントを合わせて評価してください。',
      },
      r_labrum: {
        id: 'r_labrum', type: 'result', redFlag: false,
        diagnosis: ['関節唇損傷疑い', '肩関節不安定症疑い'],
        recommendedTests: ['Apprehensionテスト', 'Relocationテスト', "O'Brienテスト"],
        advice: '競技復帰時期・不安感の有無を確認してください。',
      },
      r_frozen: {
        id: 'r_frozen', type: 'result', redFlag: false,
        diagnosis: ['拘縮性肩関節周囲炎（五十肩様）疑い'],
        recommendedTests: ['他動ROM評価（全方向の制限有無）'],
        advice: '夜間痛の有無と拘縮の進行段階（炎症期・拘縮期・回復期）を確認してください。',
      },
    },
  },

  // ── 股関節 ──
  '股関節': {
    joint: '股関節',
    startNodeId: 'q_redflag',
    nodes: {
      q_redflag: redFlagNode('q1'),
      r_redflag: redFlagResult,
      q1: {
        id: 'q1', type: 'question',
        question: '鼠径部の深いところに、股関節を深く曲げる動作（しゃがむ・車の乗降）で痛みが出ますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'q2a' },
          { label: 'いいえ', next: 'q2b' },
        ],
      },
      q2a: {
        id: 'q2a', type: 'question',
        question: '「引っかかる」「コリッと鳴る」感覚を伴いますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_fai' },
          { label: 'いいえ', next: 'r_hip_oa' },
        ],
      },
      q2b: {
        id: 'q2b', type: 'question',
        question: '股関節の外側（大転子部）を下にして横向きに寝ると痛みますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_gts' },
          { label: 'いいえ', next: 'r_generic_groin' },
        ],
      },
      r_fai: {
        id: 'r_fai', type: 'result', redFlag: false,
        diagnosis: ['大腿骨寛骨臼インピンジメント（FAI）疑い', '関節唇損傷疑い'],
        recommendedTests: ['FADIRテスト', 'FABERテスト'],
        advice: '股関節の内旋可動域と深屈曲時の痛みの程度を確認してください。',
      },
      r_hip_oa: {
        id: 'r_hip_oa', type: 'result', redFlag: false,
        diagnosis: ['変形性股関節症疑い'],
        recommendedTests: ['FABERテスト', '他動ROM評価（内旋制限の有無）'],
        advice: '荷重時痛・跛行の有無・可動域制限のパターンを確認してください。',
      },
      r_gts: {
        id: 'r_gts', type: 'result', redFlag: false,
        diagnosis: ['大転子部痛症候群疑い', '中殿筋腱障害疑い'],
        recommendedTests: ['抵抗下外転テスト', 'Trendelenburgテスト'],
        advice: '中殿筋の筋力低下・骨盤側方傾斜の有無を確認してください。',
      },
      r_generic_groin: {
        id: 'r_generic_groin', type: 'result', redFlag: false,
        diagnosis: ['鼠径部・骨盤周囲筋腱由来の疼痛の疑い'],
        recommendedTests: ['触診', '抵抗運動テスト'],
        advice: '内転筋・腸腰筋の柔軟性と筋力を確認してください。',
      },
    },
  },

  // ── 足関節 ──
  '足関節': {
    joint: '足関節',
    startNodeId: 'q_redflag',
    nodes: {
      q_redflag: redFlagNode('q1'),
      r_redflag: redFlagResult,
      q1: {
        id: 'q1', type: 'question',
        question: '足首を内側または外側に強くひねる受傷がありましたか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'q2a' },
          { label: 'いいえ', next: 'q2b' },
        ],
      },
      q2a: {
        id: 'q2a', type: 'question',
        question: '受傷直後から体重をかけて4歩以上歩くことができませんでしたか？',
        hint: 'Ottawa Ankle Ruleを参考にした骨折スクリーニング',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_fracture' },
          { label: 'いいえ', next: 'r_sprain' },
        ],
      },
      q2b: {
        id: 'q2b', type: 'question',
        question: 'アキレス腱周囲に、歩行時や運動後の痛み・腫れがありますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_achilles' },
          { label: 'いいえ', next: 'r_overuse_ankle' },
        ],
      },
      r_fracture: {
        id: 'r_fracture', type: 'result', redFlag: false,
        diagnosis: ['足関節周囲骨折の疑い'],
        recommendedTests: ['触診（内果・外果・第5中足骨基部・舟状骨の圧痛）'],
        advice: 'レントゲン検査を推奨し、荷重を制限してください。',
      },
      r_sprain: {
        id: 'r_sprain', type: 'result', redFlag: false,
        diagnosis: ['足関節捻挫（靭帯損傷）疑い'],
        recommendedTests: ['前方引き出しテスト', '距骨傾斜テスト'],
        advice: '腫脹・不安定性の程度（Grade）を評価してください。',
      },
      r_achilles: {
        id: 'r_achilles', type: 'result', redFlag: false,
        diagnosis: ['アキレス腱炎・腱症疑い'],
        recommendedTests: ['Thompsonテスト', '触診（腱の肥厚・圧痛）'],
        advice: '腱断裂の可能性（Thompsonテスト陽性）がある場合は速やかに医療機関へ紹介してください。',
      },
      r_overuse_ankle: {
        id: 'r_overuse_ankle', type: 'result', redFlag: false,
        diagnosis: ['使い過ぎによる足関節周囲炎の疑い'],
        recommendedTests: ['触診', 'ROM評価'],
        advice: '練習量・シューズ・アライメントを確認してください。',
      },
    },
  },

  // ── 腰部 ──
  '腰部': {
    joint: '腰部',
    startNodeId: 'q_redflag',
    nodes: {
      q_redflag: redFlagNode('q1'),
      r_redflag: redFlagResult,
      q1: {
        id: 'q1', type: 'question',
        question: '片側の殿部から下肢にかけて広がる痛み・しびれがありますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'q2a' },
          { label: 'いいえ', next: 'q2b' },
        ],
      },
      q2a: {
        id: 'q2a', type: 'question',
        question: '咳・くしゃみ・いきみで下肢の症状が強くなりますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_disc' },
          { label: 'いいえ', next: 'r_referred_leg' },
        ],
      },
      q2b: {
        id: 'q2b', type: 'question',
        question: '体を反らす動作（伸展）で痛みが強くなりますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_facet' },
          { label: 'いいえ', next: 'r_nonspecific' },
        ],
      },
      r_disc: {
        id: 'r_disc', type: 'result', redFlag: false,
        diagnosis: ['腰椎椎間板ヘルニア・神経根症疑い'],
        recommendedTests: ['SLRテスト', '大腿神経伸展テスト', '下肢筋力・感覚検査'],
        advice: '膀胱直腸障害の有無を必ず確認し、あれば緊急対応（馬尾症候群疑い）としてください。',
      },
      r_referred_leg: {
        id: 'r_referred_leg', type: 'result', redFlag: false,
        diagnosis: ['関連痛・梨状筋症候群などの疑い'],
        recommendedTests: ['SLRテスト', '梨状筋ストレッチテスト'],
        advice: '殿部の圧痛・柔軟性を確認してください。',
      },
      r_facet: {
        id: 'r_facet', type: 'result', redFlag: false,
        diagnosis: ['椎間関節性腰痛の疑い'],
        recommendedTests: ['Kempテスト', '伸展位での疼痛誘発テスト'],
        advice: '体幹の伸展・回旋時の疼痛パターンを確認してください。',
      },
      r_nonspecific: {
        id: 'r_nonspecific', type: 'result', redFlag: false,
        diagnosis: ['非特異的腰痛の疑い'],
        recommendedTests: ['触診', 'ROM評価', '体幹筋機能評価'],
        advice: '生活習慣・姿勢・ストレス因子も含めて評価してください。',
      },
    },
  },

  // ── 頚部 ──
  '頚部': {
    joint: '頚部',
    startNodeId: 'q_redflag',
    nodes: {
      q_redflag: redFlagNode('q1'),
      r_redflag: redFlagResult,
      q1: {
        id: 'q1', type: 'question',
        question: '交通事故やスポーツでの衝突など、強い外力による受傷はありましたか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_whiplash' },
          { label: 'いいえ', next: 'q2' },
        ],
      },
      q2: {
        id: 'q2', type: 'question',
        question: '腕にかけて放散するしびれ・痛みがありますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_radiculopathy' },
          { label: 'いいえ', next: 'r_mechanical' },
        ],
      },
      r_whiplash: {
        id: 'r_whiplash', type: 'result', redFlag: false,
        diagnosis: ['頚椎捻挫（むち打ち症）疑い'],
        recommendedTests: ['頚椎ROM評価', '上肢神経学的スクリーニング'],
        advice: '神経症状（しびれ・脱力・めまい）がある場合は画像検査を検討してください。',
      },
      r_radiculopathy: {
        id: 'r_radiculopathy', type: 'result', redFlag: false,
        diagnosis: ['頚椎神経根症疑い'],
        recommendedTests: ['Spurlingテスト', '頚椎牽引テスト', '上肢神経学的検査'],
        advice: '筋力・感覚・深部腱反射の左右差を確認してください。',
      },
      r_mechanical: {
        id: 'r_mechanical', type: 'result', redFlag: false,
        diagnosis: ['筋・関節性の頚部痛の疑い'],
        recommendedTests: ['触診', 'ROM評価'],
        advice: '姿勢（前方頭位）やデスクワーク時間を確認してください。',
      },
    },
  },

  // ── 肘関節 ──
  '肘関節': {
    joint: '肘関節',
    startNodeId: 'q_redflag',
    nodes: {
      q_redflag: redFlagNode('q1'),
      r_redflag: redFlagResult,
      q1: {
        id: 'q1', type: 'question',
        question: '肘の外側に、物を持ち上げる・タオルを絞る動作で痛みが出ますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_lateral_epicondylitis' },
          { label: 'いいえ', next: 'q2' },
        ],
      },
      q2: {
        id: 'q2', type: 'question',
        question: '肘の内側に、投球動作やものを握る動作で痛みが出ますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_medial_epicondylitis' },
          { label: 'いいえ', next: 'r_generic_elbow' },
        ],
      },
      r_lateral_epicondylitis: {
        id: 'r_lateral_epicondylitis', type: 'result', redFlag: false,
        diagnosis: ['上腕骨外側上顆炎（テニス肘）疑い'],
        recommendedTests: ['Thomsenテスト', '中指伸展テスト'],
        advice: '手関節伸筋群の柔軟性・筋力を確認してください。',
      },
      r_medial_epicondylitis: {
        id: 'r_medial_epicondylitis', type: 'result', redFlag: false,
        diagnosis: ['上腕骨内側上顆炎（ゴルフ肘）疑い', '肘関節内側側副靭帯損傷疑い'],
        recommendedTests: ['外反ストレステスト', '手関節屈曲筋群の抵抗テスト'],
        advice: '投球数・投球フォームを確認してください。',
      },
      r_generic_elbow: {
        id: 'r_generic_elbow', type: 'result', redFlag: false,
        diagnosis: ['肘関節周囲の筋腱由来の疼痛の疑い'],
        recommendedTests: ['触診', 'ROM評価'],
        advice: '前腕回内外・肘関節屈伸の可動域を確認してください。',
      },
    },
  },

  // ── 手関節・手指 ──
  '手関節・手指': {
    joint: '手関節・手指',
    startNodeId: 'q_redflag',
    nodes: {
      q_redflag: redFlagNode('q1'),
      r_redflag: redFlagResult,
      q1: {
        id: 'q1', type: 'question',
        question: '転倒して手をついた受傷がありましたか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_fracture_wrist' },
          { label: 'いいえ', next: 'q2' },
        ],
      },
      q2: {
        id: 'q2', type: 'question',
        question: '手関節の親指側に、物をつまむ・ひねる動作で痛みが出ますか？',
        answerType: 'yesno',
        options: [
          { label: 'はい', next: 'r_dequervain' },
          { label: 'いいえ', next: 'r_generic_wrist' },
        ],
      },
      r_fracture_wrist: {
        id: 'r_fracture_wrist', type: 'result', redFlag: false,
        diagnosis: ['橈骨遠位端骨折疑い', '舟状骨骨折疑い'],
        recommendedTests: ['触診（解剖学的嗅ぎタバコ窩の圧痛など）'],
        advice: 'レントゲン検査を推奨してください。舟状骨骨折は初期の画像で見逃されやすい点に注意してください。',
      },
      r_dequervain: {
        id: 'r_dequervain', type: 'result', redFlag: false,
        diagnosis: ['ドケルバン病（狭窄性腱鞘炎）疑い'],
        recommendedTests: ['Finkelsteinテスト'],
        advice: '母指使用頻度（スマートフォン操作・育児動作など）を確認してください。',
      },
      r_generic_wrist: {
        id: 'r_generic_wrist', type: 'result', redFlag: false,
        diagnosis: ['手関節周囲の腱・靭帯由来の疼痛の疑い'],
        recommendedTests: ['触診', 'ROM評価'],
        advice: '反復動作の有無・しびれの合併を確認してください。',
      },
    },
  },
}

export function getFlowchartForJoint(joint: string): IntakeFlowchartDef | undefined {
  return INTAKE_FLOWCHARTS[joint]
}
