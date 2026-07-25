// 疾患ページ: 半月板損傷（下書き・医師監修前）
// 全記載に確認状態タグ付き。文献は verified:false（原文未確認）。

import type { DiseasePage } from '@/types/disease'

export const MENISCUS_INJURY: DiseasePage = {
  id: 'meniscus-injury',
  category: 'knee',
  names: {
    ja: '半月板損傷',
    en: 'Meniscus Injury / Meniscal Tear',
    abbreviations: ['メニスカス損傷'],
    synonyms: ['半月板断裂', 'meniscus tear', 'メニスカス'],
    note: '外傷性断裂と変性断裂で病態・治療方針の考え方が大きく異なるため、区別して扱うことが重要。',
  },
  keywords: [
    '膝', 'ロッキング', '引っかかり', 'キャッチング', '関節裂隙', 'しゃがみ込み', '捻り',
    'クリック', '水腫', '正座', '階段', 'McMurray', '変性断裂',
  ],

  overview: [
    { text: '大腿骨と脛骨の間で荷重分散・衝撃吸収・関節安定化を担う線維軟骨（内側・外側半月板）の損傷。', certainty: 'high', status: 'needs_md_review' },
    { text: '若年者では捻りを伴う外傷性断裂が、中高年では明らかな外傷のない変性断裂が多い。両者は治療方針の考え方が異なる。', certainty: 'moderate', status: 'needs_md_review' },
    { text: '中高年の変性断裂は無症候者のMRIでも高頻度に認められるため、画像所見と症状の関連は慎重に判断する必要がある。', certainty: 'moderate', status: 'needs_literature', refs: [1], level: 'pro' },
    { text: '半月板温存の重要性: 半月板機能の喪失は長期的な関節症性変化と関連するとされ、可能な範囲での温存（縫合・保存療法）が重視される傾向にある。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
  ],

  anatomy: [
    { text: '内側半月板はC型で関節包・MCLとの結合が強く可動性が小さい。外側半月板はO型に近く可動性が大きい。この差が損傷様式に影響する。', certainty: 'high', status: 'needs_pro_review' },
    { text: '血行は辺縁部（red-red zone）に限られ、内縁部（white-white zone）は乏血行。損傷部位の血行が治癒能・縫合適応に関わる。', certainty: 'high', status: 'needs_pro_review', level: 'pro' },
    { text: '関連: ACL（合併損傷が多い）、関節軟骨、内側側副靱帯。後根断裂（root tear）は荷重分散機能を大きく損なう特殊型として区別される。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
  ],

  epidemiology: [
    { text: '外傷性: スポーツでの捻り動作（サッカー・バスケットボール・柔道等）。ACL損傷との合併が多い。', certainty: 'moderate', status: 'needs_literature' },
    { text: '変性断裂: 中高年に多く、明らかな受傷機転がないことも多い。無症候例が多いことが治療判断を難しくする。', certainty: 'moderate', status: 'needs_literature' },
  ],

  mechanism: [
    { text: '外傷性: 荷重下での膝屈曲＋回旋（ピボット動作・深屈曲からの立ち上がり）。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: '変性: 加齢による組織変性を背景に、日常動作レベルの負荷でも断裂が生じうる。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: '断裂形態（縦断裂・横断裂・水平断裂・弁状断裂・バケツ柄断裂・root tear）により症状・治療適応が異なる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
  ],

  symptoms: [
    { text: '関節裂隙に一致した疼痛、しゃがみ込み・捻り・階段での疼痛、引っかかり感・キャッチング、関節水腫（緩徐に出現することが多い）。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: 'ロッキング（伸展不能の持続）はバケツ柄断裂等の転位を示唆する重要症状。', certainty: 'moderate', status: 'needs_md_review' },
    { text: '注意: 症状は変動しやすく、症状のみで断裂の有無・形態は確定できない。', certainty: 'expert', status: 'needs_pro_review' },
  ],

  interviewItems: [
    '発症様式（明らかな外傷か・徐々にか）と受傷機転（捻り・深屈曲）',
    '疼痛部位（内側/外側関節裂隙・膝窩部）',
    '引っかかり・キャッチング・ロッキングの有無と頻度',
    '腫脹（水腫）の出現時期・繰り返しの有無',
    '誘発動作（しゃがみ込み・正座・捻り・階段昇降）',
    '過去の膝外傷歴（特にACL損傷）・手術歴',
    '既往歴・全身疾患・投薬',
    '職業・競技（深屈曲や捻りの頻度）',
    '医師の診断・MRI等の画像検査の有無と結果',
    '患者の目標（症状軽減か競技復帰か）',
  ],

  physicalExam: [
    { text: '関節裂隙圧痛の部位と左右差。水腫の評価（膝蓋跳動・波動）。', status: 'needs_pro_review' },
    { text: 'ROM: 伸展制限（ロッキングとの鑑別）・深屈曲時痛。', status: 'needs_pro_review' },
    { text: '大腿四頭筋萎縮（慢性例）・歩行・しゃがみ込み動作の観察。', status: 'needs_pro_review' },
    { text: 'ACL・MCL等の合併損傷評価を併せて行う。', status: 'needs_md_review' },
  ],

  specialTests: [
    {
      name: 'McMurray test',
      target: '半月板（回旋クリックの誘発）',
      method: '深屈曲位から下腿回旋を加えつつ伸展。内旋=外側、外旋=内側を評価。',
      positive: '関節裂隙のクリック・疼痛再現',
      sensitivity: '中等度以下と報告（メタ解析で幅が大きい）',
      specificity: '中等度〜比較的高いと報告',
      caution: '単独での確定・除外は不可。疼痛のみ陽性の解釈は分かれる。',
      status: 'needs_literature',
      refs: [2],
    },
    {
      name: '関節裂隙圧痛（joint line tenderness）',
      target: '半月板辺縁部',
      method: '膝軽度屈曲位で内外側関節裂隙を触診。',
      positive: '裂隙に限局した圧痛',
      sensitivity: '比較的高めと報告',
      specificity: '低め〜中等度と報告',
      caution: 'MCL損傷・OA・脂肪体炎でも陽性となり特異性は低い。',
      status: 'needs_literature',
      refs: [2],
    },
    {
      name: 'Thessaly test',
      target: '半月板（荷重回旋負荷）',
      method: '患側片脚立位・膝20°屈曲で体幹を左右に回旋。',
      positive: '関節裂隙痛・引っかかり感の再現',
      caution: '急性期・不安定膝では疼痛/転倒リスクに注意。診断精度の報告は研究間で大きく異なる。',
      status: 'needs_literature',
    },
  ],

  differentials: [
    { group: 'likely', name: '変形性膝関節症', distinguishing: '中高年の変性断裂と併存が多い。起床時のこわばり・X線変化。症状の主因がどちらかの判断は慎重に。' },
    { group: 'likely', name: 'MCL損傷', distinguishing: '外反ストレス痛・裂隙よりやや上下の圧痛。外傷性では合併も。' },
    { group: 'likely', name: '膝蓋大腿関節痛', distinguishing: '前膝部痛・階段下降時痛。裂隙圧痛は乏しい。' },
    { group: 'must_not_miss', name: '化膿性関節炎・結晶性関節炎', distinguishing: '発熱・安静時激痛・著明な熱感を伴う水腫。', urgency: 'same_day' },
    { group: 'must_not_miss', name: '特発性膝骨壊死（SONK）', distinguishing: '中高年の夜間痛を伴う急な内側部痛。画像評価は医師判断。', urgency: 'confirm_md' },
    { group: 'similar', name: '滑膜ひだ障害（タナ障害）', distinguishing: '膝蓋骨内側縁のクリック・圧痛。' },
    { group: 'similar', name: '鵞足炎', distinguishing: '裂隙より遠位内側（鵞足部）の圧痛。' },
  ],

  redFlags: [
    { finding: '伸展不能が持続するロッキング', action: '転位断裂の可能性。早期に整形外科受診。', urgency: 'early_visit' },
    { finding: '発熱・著明な熱感を伴う関節腫脹', action: '化膿性関節炎の除外が必要。当日中に医療相談。', urgency: 'same_day' },
    { finding: '夜間持続する強い疼痛（外傷歴なし・中高年）', action: '骨壊死・腫瘍性病変等の除外は医師判断。担当医へ確認。', urgency: 'confirm_md' },
    { finding: '下腿の腫脹・把握痛（安静・固定後）', action: 'DVT疑い。運動中止し当日中に医療相談。', urgency: 'same_day' },
  ],

  imaging: [
    { text: '単純X線: 半月板は描出されないが、OA変化・骨壊死・遊離体の評価に必要。', certainty: 'high', status: 'needs_md_review' },
    { text: 'MRI: 半月板評価の中心。ただし無症候者にも断裂所見が高頻度に存在するため（特に中高年）、所見と症状の対応づけは医師の総合判断による。', certainty: 'moderate', status: 'needs_literature', refs: [1] },
    { text: '画像の最終診断は医師が行う。MRI所見のみを根拠に手術適応を判断しない流れが主流となりつつある（特に変性断裂）。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
  ],

  classification: [
    { text: '断裂形態分類（縦・横・水平・弁状・バケツ柄・複合・root）と部位（前節/中節/後節、red-red〜white-white zone）で記述される。縫合適応・予後との関連から実務上重要。', certainty: 'moderate', status: 'needs_md_review' },
  ],

  conservative: [
    { text: '変性断裂: 運動療法を中心とした保存療法が第一選択とされる流れが強い。関節鏡手術と運動療法の比較研究で、多くの症例において運動療法が遜色ない転帰を示したとの報告が複数ある。', certainty: 'moderate', status: 'needs_literature', refs: [0, 3] },
    { text: '運動療法: 大腿四頭筋・股関節周囲筋の強化、可動域維持、荷重コントロール、動作指導（深屈曲・捻りの一時的回避）。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: '水腫・疼痛の管理: 負荷量調整とアイシング。症状の変動に合わせた漸増を行う。', certainty: 'expert', status: 'needs_pro_review' },
    { text: '外傷性・若年例: ロッキングがなく症状が許容範囲なら保存療法を試みる選択肢があるが、方針決定は医師との相談による。', certainty: 'moderate', status: 'needs_md_review' },
  ],

  surgical: [
    { text: '主な術式: 半月板縫合術（温存）と部分切除術。縫合適応は断裂部位の血行・形態・年齢等で判断される（判断は医師）。', certainty: 'moderate', status: 'needs_md_review' },
    { text: '縫合術後は治癒保護のため、切除後と比べ荷重・ROM・深屈曲の制限が長い。術式の確認なしにリハビリを進めない。', certainty: 'expert', status: 'verified' },
    { text: 'root tear修復・特殊修復術は別個のプロトコルが必要になることが多い。医師の指示を必ず確認。', certainty: 'expert', status: 'needs_md_review', level: 'pro' },
  ],

  rehabPhases: [
    {
      name: '症状管理・基礎機能期（保存療法）',
      period: '目安: 開始〜4週',
      goals: ['疼痛・水腫の管理', '大腿四頭筋の活性化', '疼痛のないROM確保'],
      allowed: ['クアッドセッティング・SLR', '疼痛のない範囲のROM運動', 'エルゴメーター（許容範囲）'],
      avoid: ['深いしゃがみ込み・捻りを伴う動作', '水腫を増悪させる負荷'],
      criteria: ['水腫の消退傾向', '歩行時痛の軽減', '大腿四頭筋収縮良好'],
      mdCheck: 'ロッキング出現時・症状増悪時の方針確認',
    },
    {
      name: '筋力・動作再獲得期',
      period: '目安: 4〜8週',
      goals: ['下肢筋力の回復', '階段・しゃがみ動作の再獲得'],
      allowed: ['漸増的CKCトレーニング（疼痛のない範囲の屈曲角度）', 'バランストレーニング', '水中歩行等'],
      avoid: ['疼痛・引っかかりを誘発する深屈曲＋回旋'],
      criteria: ['階段昇降で疼痛なし', '片脚スクワットの質改善', '水腫の再発なし'],
    },
    {
      name: '復帰準備期',
      period: '目安: 8週以降（基準ベース）',
      goals: ['競技・仕事動作の再獲得', '再発予防戦略の習得'],
      allowed: ['ランニング→アジリティの段階的導入', '競技特異的練習'],
      avoid: ['症状再燃を無視した負荷継続'],
      criteria: ['ホップテスト等の左右差改善', '競技動作で症状なし', '負荷後の水腫なし'],
      mdCheck: '競技復帰の許可（術後例は必須）',
    },
  ],

  returnCriteria: [
    { text: '疼痛・水腫なく競技動作が反復できること、筋力・ホップの左右差改善、負荷後24時間の症状再燃がないことを組み合わせて判断する。', certainty: 'expert', status: 'needs_pro_review' },
    { text: '縫合術後は組織治癒期間の考慮が必要で、復帰時期は切除後より長くなるのが一般的。個別の期間は術式と医師の指示による。', certainty: 'moderate', status: 'needs_md_review' },
  ],

  prognosis: [
    { text: '変性断裂の保存療法: 多くで症状改善が期待できるとの報告があるが、効果発現には数週〜数ヶ月を要する。改善不十分例では医師と方針を再協議する。', certainty: 'moderate', status: 'needs_literature', refs: [0, 3] },
    { text: '広範な切除は長期的な関節症リスク上昇と関連するとされ、温存可能例では縫合が選択される傾向にある。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
  ],

  outcomes: [
    { name: 'KOOS', target: '膝の痛み・症状・ADL・スポーツ・QOL', range: '各0-100（高いほど良好）', note: '日本語版あり。' },
    { name: 'IKDC-SKF', target: '膝の症状・機能', range: '0-100', note: '若年活動例で汎用。' },
    { name: 'Lysholm score', target: '膝の症状・機能', range: '0-100', note: 'ロッキング・引っかかり項目を含む。' },
    { name: 'NRS', target: '疼痛強度', range: '0-10', note: '動作を指定して記録。' },
  ],

  patientExplanation: {
    whatIs: '膝のクッションの役割をする「半月板」という軟骨を傷めた状態です。若い方はスポーツでのひねりで、年齢を重ねた方は特にきっかけなく傷むことがあります。',
    dos: [
      '太ももの筋肉を鍛える運動は、膝への負担を減らす基本です',
      '痛みのない範囲での歩行・自転車などは続けて構いません（指示に応じて）',
      '腫れや痛みが出たら、負荷を一段階戻して様子をみましょう',
    ],
    donts: [
      '深くしゃがみ込む・正座・膝をひねる動作（症状がある時期）',
      '痛みや腫れを我慢しての運動継続',
      '画像の結果だけで「手術しかない」と自己判断すること',
    ],
    seekCare: [
      '膝が伸びなくなって戻らない（ロッキング）',
      '発熱を伴う強い腫れ・痛み',
      '夜も眠れないほどの痛みが続く',
      'ふくらはぎの強い腫れ・痛み',
    ],
    goal: '半月板は膝の大切なクッションです。筋力と動作を整えることで、多くの場合症状の軽減を目指せます。経過に応じて医師と相談しながら、あなたの生活・競技に合わせた進め方を決めていきます。',
  },

  motionCapture: [
    {
      movement: '両脚スクワット（深さ段階的）',
      purpose: '疼痛誘発角度と動作戦略の評価',
      setup: '正面＋側面。しゃがみ込み深度が分かる画角。',
      watchFor: ['疼痛回避（体幹前傾・患側回避）', '膝内外反', '深屈曲での症状'],
    },
    {
      movement: '階段昇降',
      purpose: 'ADL上の症状動作の評価',
      setup: '側面から。昇り・降りの両方向。',
      watchFor: ['降段時の患側支持時間短縮', '体幹の代償', '手すり依存'],
    },
    {
      movement: '片脚スクワット',
      purpose: '下肢筋力・アライメント制御の評価',
      setup: '正面から。膝・足部が映る高さ。',
      watchFor: ['膝内側崩れ', '骨盤落下', '疼痛出現角度'],
    },
  ],

  references: [
    {
      authors: 'Beaufils P, Becker R, Kopf S, et al.',
      title: 'Surgical management of degenerative meniscus lesions: the 2016 ESSKA meniscus consensus',
      source: 'Knee Surg Sports Traumatol Arthrosc', year: 2017,
      note: '変性半月板損傷の管理に関する欧州コンセンサス。',
      verified: false,
    },
    {
      authors: 'Culvenor AG, Øiestad BE, Hart HF, et al.',
      title: 'Prevalence of knee osteoarthritis features on magnetic resonance imaging in asymptomatic uninjured adults: a systematic review and meta-analysis',
      source: 'Br J Sports Med', year: 2019,
      note: '無症候者のMRI所見（半月板断裂を含む）の頻度に関するメタ解析。',
      verified: false,
    },
    {
      authors: 'Hegedus EJ, Cook C, Hasselblad V, Goode A, McCrory DC',
      title: 'Physical examination tests for assessing a torn meniscus in the knee: a systematic review with meta-analysis',
      source: 'J Orthop Sports Phys Ther', year: 2007,
      note: '半月板徒手検査の診断精度メタ解析。',
      verified: false,
    },
    {
      authors: 'Thorlund JB, Juhl CB, Roos EM, Lohmander LS',
      title: 'Arthroscopic surgery for degenerative knee: systematic review and meta-analysis of benefit and harms',
      source: 'BMJ', year: 2015,
      note: '変性膝に対する関節鏡手術の利益と害の系統的レビュー。',
      verified: false,
    },
  ],

  protocolTemplateKey: 'meniscus_repair',
  protocolJoint: 'knee',

  meta: {
    createdAt: '2026-07-17',
    updatedAt: '2026-07-17',
    nextReviewDue: '2027-01-17',
    author: 'AI下書き（Claude）',
    supervisor: undefined,
    guidelineVersions: ['ESSKA 2016 半月板コンセンサス（内容は原本確認待ち）'],
    searchDate: undefined,
    changeLog: ['2026-07-17 AIによる初版下書き作成（全文献未確認・医師監修前）'],
  },
}
