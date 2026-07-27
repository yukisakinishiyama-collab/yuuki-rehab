// 疾患ページ: 膝カテゴリ 3/3（下書き・医師監修前）
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

export const KNEE_PAGES_3: DiseasePage[] = [
  // ───────────────────────────── 変形性膝関節症
  {
    id: 'knee-oa',
    category: 'knee',
    names: {
      ja: '変形性膝関節症',
      en: 'Knee Osteoarthritis',
      abbreviations: ['膝OA', 'KOA'],
      synonyms: ['変形性ひざ関節症', 'knee osteoarthritis'],
      note: '国内で極めて有病者の多い疾患。X線所見と症状の乖離が大きいことが管理の前提。',
    },
    keywords: ['中高年', '内側', '正座', '階段', 'O脚', '水がたまる', '動き始めの痛み'],
    overview: [
      { text: '関節軟骨の変性を中心に、骨・滑膜・半月板・筋を含む「関節全体の疾患」。中高年の膝痛の最多原因で、内側型が多い。', certainty: 'high', status: 'needs_md_review' },
      { text: '運動療法・体重管理・教育が全ガイドラインで中核治療とされる。X線の程度だけで活動を制限しない。', certainty: 'high', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '内側コンパートメントの負荷が大きく（内反アライメントで増大）、半月板変性断裂・軟骨変性・骨棘が併存する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '加齢・女性・肥満・既往膝外傷・重量物作業が危険因子。国内の有病者数は非常に多いと報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '力学的負荷と炎症・代謝要因の複合。筋力低下（特にquad）は疼痛・進行と関連する修正可能因子。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '動き始めの痛み（起立・歩き出し）、階段（特に下り）、正座困難、水腫の反復、進行で持続痛・可動域制限・内反変形。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛のタイミング（動き始め/荷重中/夜間）', '水腫の頻度', '歩行距離・階段の支障',
      '体重・体重変化', '職業・農作業等の膝負荷', '転倒歴・外傷歴', '治療歴（注射・薬）と医師の説明',
      '患者の目標（正座・旅行・スポーツ等）',
    ],
    physicalExam: [
      { text: 'アライメント（内反）・水腫・ROM（伸展制限の有無）・quad筋力・歩行（ラテラルスラスト）・裂隙圧痛。', status: 'needs_pro_review' },
      { text: '股関節由来の関連痛の除外（股関節ROM確認）を忘れない。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '変性半月板断裂', distinguishing: 'OAと併存が多い。キャッチング・限局痛。' },
      { group: 'likely', name: '鵞足炎', distinguishing: '内側やや遠位の圧痛。OAと併存。' },
      { group: 'must_not_miss', name: '特発性膝骨壊死（SONK）', distinguishing: '急な夜間痛を伴う内側痛。医師評価。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '化膿性関節炎・偽痛風', distinguishing: '急な熱感・発赤・激痛の水腫。', urgency: 'same_day' },
      { group: 'similar', name: '股関節疾患の関連痛', distinguishing: '股関節所見で鑑別。' },
    ],
    redFlags: [
      { finding: '急な発赤・熱感・激痛を伴う腫脹', action: '感染・結晶性関節炎の除外。当日中に医療相談。', urgency: 'same_day' },
      { finding: '急性発症の強い夜間痛（中高年内側）', action: '骨壊死の評価は医師判断。', urgency: 'confirm_md' },
      { finding: '外傷後の急な変形・荷重不能', action: '骨折除外。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '立位X線（KL分類等は医師判定）。所見と症状の乖離が大きく、画像は説明・方針の参考であって活動制限の根拠にしない。', certainty: 'high', status: 'needs_literature', refs: [0] },
      { text: 'MRIはルーチン不要。変性半月板所見の扱いは慎重に（無症候所見が多い）。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    classification: [
      { text: 'Kellgren-Lawrence分類（X線）が汎用（判定は医師）。症状・機能との対応は限定的。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '中核: 運動療法（quad・股関節筋強化、有酸素運動、可動域）＋体重管理（減量は症状改善と関連）＋教育・セルフマネジメント。', certainty: 'high', status: 'needs_literature', refs: [0] },
      { text: '補助: 装具・足底板・杖・温熱等は個別に検討。薬物・注射は医師判断。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '水腫悪化時は負荷を一時調整するが、運動中止ではなく種類変更（水中・自転車等）で継続する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '保存療法で管理困難な例で骨切り術（活動性の高い内反例）やTKA/UKAが検討される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '導入・教育期',
        period: '目安: 0〜4週',
        goals: ['疾患理解と運動習慣の確立', '疼痛の自己管理'],
        allowed: ['quadセッティング・低負荷筋トレ', '水中歩行・自転車', 'ストレッチ'],
        avoid: ['疼痛悪化を無視した負荷', '運動の完全中止'],
        criteria: ['運動の習慣化', '動き始め痛の軽減'],
      },
      {
        name: '筋力・活動拡大期',
        period: '目安: 1〜3ヶ月以降（継続）',
        goals: ['筋力向上', '歩行距離・活動範囲の拡大', '目標活動の達成'],
        allowed: ['漸増筋力トレーニング', '目標活動への段階的挑戦'],
        avoid: ['急な負荷増による水腫再燃'],
        criteria: ['目標活動（旅行・趣味等）の達成度'],
        mdCheck: '症状進行時の手術相談',
      },
    ],
    returnCriteria: [
      { text: '患者個別の目標（歩行距離・階段・趣味・軽スポーツ）の達成で評価。年齢・希望に応じ低衝撃スポーツ復帰も支援する。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '経過は多様で、運動・減量により長期に良好な管理が可能な例が多い。「軟骨がすり減ったら終わり」ではないことを伝える。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KOOS / JKOM', target: '膝機能・QOL（JKOMは国内開発）', range: '尺度による' },
      { name: 'TUG・5回立ち座り', target: '機能パフォーマンス', range: '秒' },
    ],
    patientExplanation: {
      whatIs: '膝の軟骨や周りの組織が年齢とともに変化して、痛みや動かしにくさが出る状態です。レントゲンの変化と痛みは必ずしも一致せず、筋力と体重の管理で多くの方が痛みを減らせます。',
      dos: ['太ももの筋トレと、痛みの少ない有酸素運動（自転車・水中など）を続けましょう', '体重を少し減らすだけでも膝の負担は大きく減ります'],
      donts: ['「動くと悪くなる」と思って動かなくなること（逆効果です）', '痛みが強い日に無理をすること（種類を変えて続けましょう）'],
      seekCare: ['急に赤く腫れて熱をもった', '夜も眠れない痛みが急に出た', '痛みで生活が立ち行かない（手術相談のタイミング）'],
      goal: '軟骨を「元に戻す」ことではなく、筋肉と工夫で「痛みなくやりたいことができる膝」を保つことが目標です。',
    },
    motionCapture: [
      { movement: '歩行', purpose: 'ラテラルスラスト・歩容の評価', setup: '正面＋側面。', watchFor: ['外側動揺', '伸展不足歩行', '歩幅低下'] },
      { movement: '立ち座り・階段', purpose: '機能と代償の評価', setup: '側面。', watchFor: ['手の使用', '患側回避'] },
    ],
    references: [
      {
        authors: '日本整形外科学会診療ガイドライン委員会（編）',
        title: '変形性膝関節症診療ガイドライン',
        source: '南江堂', year: 2023,
        note: '国内ガイドライン。版・年は原本確認待ち。',
        verified: false,
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 人工膝関節置換術後
  {
    id: 'post-tka',
    category: 'knee',
    names: {
      ja: '人工膝関節置換術後',
      en: 'Post Total Knee Arthroplasty (TKA)',
      abbreviations: ['TKA', 'TKR', 'UKA（部分置換）'],
      synonyms: ['人工膝関節全置換術後', 'total knee arthroplasty'],
      note: '早期のROM（特に伸展）獲得とquad機能回復が機能予後の鍵。UKAは回復が速い傾向。',
    },
    keywords: ['術後', '人工関節', '高齢者', '屈曲角度', '伸展制限', '正座'],
    overview: [
      { text: '進行膝OA等に対する人工膝関節置換術後のリハビリ。疼痛改善効果は高いが、術後のROM獲得・quad機能回復には積極的なリハビリ参加が必要。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '伸展制限の遺残は歩行効率・膝前部痛に影響するため、早期からの伸展管理を重視する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '機種（CR/PS等）・手技により膝運動特性が異なる。深屈曲（正座）の可否は機種・医師方針・軟部条件による。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '高齢者に多い手術。術後満足度は股関節より低めと報告されることがあり、期待値の調整（説明）が重要。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    mechanism: [
      { text: '術後課題: 疼痛・腫脹によるquad抑制、屈曲/伸展制限、遷延する腫脹、まれに関節線維症・感染・DVT。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '（経過中の注意）急な発熱・創部異常・疼痛増悪は感染評価。下腿腫脹はDVT評価。', certainty: 'expert', status: 'verified' },
    ],
    interviewItems: [
      '術式（TKA/UKA・機種）・執刀医の方針（深屈曲可否等）', '入院中の到達ROM・歩行レベル',
      '住環境（和式要素・階段）', '術前の活動レベルと目標（正座希望の有無）', '対側膝・股・腰の状態',
    ],
    physicalExam: [
      { text: 'ROM（伸展ラグ・屈曲角度）、腫脹・熱感の推移、quad筋力、歩行（補助具レベル）、階段動作。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '人工関節周囲感染', distinguishing: '発熱・創部異常・安静時痛。', urgency: 'same_day' },
      { group: 'must_not_miss', name: 'DVT/PE', distinguishing: '下腿腫脹・胸痛・呼吸苦。', urgency: 'emergency' },
      { group: 'likely', name: '関節線維症（拘縮遷延）', distinguishing: 'ROM改善の停滞。医師と対応協議（授動術等）。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '発熱・創部の発赤/浸出・疼痛の再燃', action: '感染疑い。執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '下腿腫脹・胸痛・呼吸苦', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
      { finding: '転倒後の急な疼痛・変形', action: '周囲骨折等の評価。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'インプラント評価は医師による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '術後リハ: 早期離床・伸展管理（パッド・自主練指導）・quad活性化→ROM漸増（屈曲は腫脹と相談）→歩行の質・階段→生活動作と低衝撃活動。自主練習の質が到達度を左右する。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '拘縮への授動術・再置換等は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '急性期（入院）',
        period: '目安: 0〜2週',
        goals: ['伸展0°の維持', '屈曲90°目安', '歩行器→杖歩行', '腫脹管理'],
        allowed: ['CPM/自動ROM（方針による）', 'quadセット・SLR', '荷重歩行（多くは早期全荷重）'],
        avoid: ['膝下枕による伸展制限の助長', '腫脹無視の過負荷'],
        criteria: ['退院基準（施設）達成'],
        mdCheck: '荷重・ROM方針の確認',
      },
      {
        name: '回復期',
        period: '目安: 2週〜3ヶ月',
        goals: ['屈曲120°前後（個人差・機種による）', '杖なし歩行', '階段交互昇降', 'quad筋力回復'],
        allowed: ['漸増筋力トレーニング', 'エルゴメーター', '屋外歩行・階段練習'],
        avoid: ['腫脹・夜間痛を悪化させる負荷急増'],
        criteria: ['伸展ラグ消失', '歩行の質改善'],
      },
      {
        name: '生活・活動復帰期',
        period: '目安: 3ヶ月以降',
        goals: ['生活動作の自立完成', '趣味・低衝撃スポーツ復帰'],
        allowed: ['ウォーキング・自転車・水泳・ゴルフ等（医師許可に応じて）'],
        avoid: ['高衝撃活動（ラン・ジャンプ系）は原則慎重（医師と相談）'],
        criteria: ['目標活動の達成', '医師の活動許可'],
        mdCheck: 'スポーツ・深屈曲動作の可否',
      },
    ],
    returnCriteria: [
      { text: '目標ADL/活動の達成・quad筋力・階段能力で評価。深屈曲（正座）は機種・医師方針によるため一律に目標化しない。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '疼痛改善は高い確率で得られる。ROM・満足度は術前状態やリハ参加度の影響を受ける。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KOOS / 新膝評価', target: '症状・機能', range: '尺度による' },
      { name: 'TUG・階段テスト', target: '機能パフォーマンス', range: '秒' },
    ],
    patientExplanation: {
      whatIs: '傷んだ膝関節を人工の関節に置き換えた手術のあとの回復期間です。痛みは大きく軽くなりますが、「曲がる・伸びる・力が入る」を取り戻すには、ご自身のリハビリ参加がとても大切です。',
      dos: ['膝をまっすぐ伸ばす練習は毎日の最優先課題です', '腫れ具合と相談しながら、曲げる練習と筋トレを続けましょう'],
      donts: ['膝の下に枕を入れて寝ること（伸びなくなります）', '腫れて熱いのに頑張りすぎること'],
      seekCare: ['発熱・傷の腫れや汁', 'ふくらはぎの腫れ・胸の苦しさ（すぐ連絡）', '転倒して痛みが強い'],
      goal: '「痛みなく歩ける・階段を上れる・やりたい活動ができる」ことが目標です。正座など深い曲げは手術の種類によるので、目標は主治医と一緒に設定します。',
    },
    motionCapture: [
      { movement: '歩行・階段', purpose: '歩容・伸展利用の評価', setup: '側面＋正面。', watchFor: ['伸展不足歩行', '患側立脚短縮', '階段の代償'] },
      { movement: '立ち座り', purpose: 'quad機能の評価', setup: '側面。', watchFor: ['手の使用', '患側回避'] },
    ],
    references: [],
    protocolTemplateKey: 'tka',
    protocolJoint: 'knee',
    meta: draftMeta(),
  },

  // ───────────────────────────── 軟骨損傷
  {
    id: 'cartilage-injury',
    category: 'knee',
    names: {
      ja: '軟骨損傷',
      en: 'Articular Cartilage Injury (Knee)',
      abbreviations: [],
      synonyms: ['関節軟骨損傷', '軟骨欠損', 'chondral injury'],
      note: '外傷性の限局性軟骨損傷を主対象とする（広範な変性はOAページ参照）。',
    },
    keywords: ['軟骨', '水腫', '外傷', '限局性', '若年', '荷重時痛'],
    overview: [
      { text: '外傷（脱臼・捻挫・直達外力）や離断性骨軟骨炎に関連して生じる限局性の関節軟骨損傷。自己修復能が乏しく、症状・活動要求に応じた管理が必要。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '無症候の軟骨所見も多く、画像所見と症状の対応づけが方針決定の前提となる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '荷重部（大腿骨顆・膝蓋大腿関節）の損傷が問題となる。深達度・面積・部位が予後と治療選択に関わる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '膝外傷（膝蓋骨脱臼・ACL損傷等）に合併して発見されることが多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '剪断・圧縮外力による軟骨のき裂・剥離。骨軟骨損傷として骨片を伴う場合もある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '荷重時痛・水腫の反復・キャッチング（遊離体化した場合）。特異的症状に乏しい。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '外傷歴（脱臼・捻挫・打撲）', '水腫の反復', '引っかかり・ロッキング', '荷重時痛の部位',
      '画像検査の有無と医師の説明（深達度・部位）',
    ],
    physicalExam: [
      { text: '水腫・限局圧痛・ROM・quad機能。特異的な徒手検査はなく、画像（医師）との統合で判断。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '半月板損傷', distinguishing: '裂隙圧痛・McMurray。合併も多い。' },
      { group: 'must_not_miss', name: '骨軟骨骨折（急性外傷後）', distinguishing: '血腫・遊離体。早期の医師評価。', urgency: 'early_visit' },
      { group: 'similar', name: '初期OA', distinguishing: '年齢・広がり。管理はOAに準じる。' },
    ],
    redFlags: [
      { finding: '外傷後の血腫・ロッキング', action: '骨軟骨骨折・遊離体評価。早期受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'MRIで深達度・面積・骨髄変化を評価（医師）。X線は骨性評価。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'ICRS分類（深達度）等が用いられる（判定は医師・鏡視）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '症状が管理可能な例: 負荷管理（水腫を指標）＋quad/股関節筋強化＋低衝撃有酸素で関節環境を整える。減量も有効。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '症候性の限局損傷では骨髄刺激・骨軟骨移植・細胞治療等が検討される（適応・選択は医師）。術後プロトコルは術式で大きく異なり、荷重制限が長期に及ぶものもある。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理期（保存）',
        period: '症状に応じて',
        goals: ['水腫・疼痛の管理', '筋機能の最適化'],
        allowed: ['低衝撃運動・漸増筋力トレーニング'],
        avoid: ['水腫を反復させる衝撃負荷'],
        criteria: ['水腫なく活動量を維持'],
        mdCheck: '症状持続時の手術適応相談',
      },
      {
        name: '術後（該当例）',
        period: '術式による',
        goals: ['執刀医プロトコルの遵守'],
        allowed: ['指示範囲の荷重・ROM・筋トレ'],
        avoid: ['指示外の荷重（移植部保護）'],
        criteria: ['執刀医の段階許可'],
        mdCheck: '全段階',
      },
    ],
    returnCriteria: [
      { text: '水腫なく段階的衝撃負荷に耐えること、筋力・動作の質、（術後は）医師許可。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '部位・深達度・年齢により幅が大きい。長期的なOA進行リスクを踏まえ、筋力・体重管理の継続を推奨。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KOOS / IKDC-SKF', target: '膝機能', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '膝の表面を覆う軟骨に、けが等で限られた範囲の傷がついた状態です。軟骨は自然には治りにくい組織ですが、筋力と負荷の工夫で症状を抑えられる場合が多くあります。',
      dos: ['太ももの筋トレと、腫れを目安にした負荷調整を続けましょう'],
      donts: ['腫れを繰り返すようなジャンプ・ランの強行'],
      seekCare: ['膝に何か挟まる・伸びない', '腫れが引かない'],
      goal: '症状をコントロールして活動を続けること。必要に応じて軟骨の手術も選択肢として医師と相談します。',
    },
    motionCapture: [
      { movement: 'スクワット・着地', purpose: '荷重分布・回避動作の評価', setup: '正面＋側面。', watchFor: ['患側回避', 'アライメント不良'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 脛骨高原骨折後
  {
    id: 'post-tibial-plateau-fracture',
    category: 'knee',
    names: {
      ja: '脛骨高原骨折後',
      en: 'Post Tibial Plateau Fracture',
      abbreviations: [],
      synonyms: ['脛骨プラトー骨折後', '脛骨近位端骨折後'],
      note: '関節内骨折であり、荷重時期は骨折型・固定法により大きく異なる。医師の荷重スケジュールが絶対条件。',
    },
    keywords: ['骨折後', '関節内骨折', '荷重制限', '拘縮', '転倒', '交通外傷'],
    overview: [
      { text: '脛骨近位関節面の骨折後のリハビリ。関節面の整復性・軟部損傷合併の程度が機能予後を左右し、免荷期間の拘縮・筋萎縮対策と段階的荷重が中心課題。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '外側プラトー骨折が多い。半月板・靱帯（MCL/ACL）損傷の合併が少なくなく、関節面の陥凹は外傷後OAのリスク。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '若年は高エネルギー（交通外傷・スポーツ）、高齢は低エネルギー（転倒）で生じる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '外反＋軸圧が典型。術後課題: 拘縮（特に屈曲）、quad萎縮、荷重再開時の疼痛管理。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '（経過中の注意）固定中〜免荷中の下腿腫脹増悪はDVT、しびれ・激痛はコンパートメント（急性期）評価。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '骨折型・固定法（プレート等）・合併軟部損傷', '執刀医の荷重スケジュール・ROM方針',
      '受傷/術後週数', '疼痛・腫脹の推移', '職業（復職要求）',
    ],
    physicalExam: [
      { text: '指示範囲でROM（屈曲拘縮の進行に注意）・周径・quad機能・（許可後）荷重歩行の質。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: 'DVT', distinguishing: '免荷・固定期間が長くリスク高。', urgency: 'same_day' },
      { group: 'must_not_miss', name: '急性コンパートメント症候群（急性期）', distinguishing: '受傷直後の激痛・緊満・伸張痛。緊急。', urgency: 'emergency' },
      { group: 'likely', name: '合併靱帯・半月板損傷の症状顕在化', distinguishing: '荷重再開後の不安定感・裂隙痛。医師評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '下腿の緊満・増悪する激痛・他動伸張痛（急性期）', action: 'コンパートメント症候群疑い。緊急受診。', urgency: 'emergency' },
      { finding: '下腿腫脹・把握痛', action: 'DVT疑い。当日中に医療相談。', urgency: 'same_day' },
      { finding: '荷重再開後の急な疼痛増悪', action: '整復位喪失等の評価。執刀医へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '骨癒合・関節面の評価は執刀医のX線/CTによる。荷重許可は画像に基づく。', status: 'verified' },
    ],
    classification: [
      { text: 'Schatzker分類等（医師）。型により予後・荷重時期が異なる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '免荷期: 指示範囲のROM（拘縮予防が最重要課題の一つ）・quadセット・患肢挙上による腫脹管理・DVT予防。荷重期: 許可に応じた部分→全荷重と歩行再教育。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '固定法・追加処置は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '免荷・ROM確保期',
        period: '目安: 0〜6週（型による）',
        goals: ['指示範囲のROM獲得（拘縮予防）', '腫脹管理', 'quad活性化'],
        allowed: ['指示範囲の自動/他動ROM', 'quadセット・SLR', '足関節ポンピング'],
        avoid: ['指示外の荷重', '強引な他動屈曲'],
        criteria: ['執刀医の荷重許可'],
        mdCheck: '荷重開始・増加の全段階',
      },
      {
        name: '荷重再獲得期',
        period: '目安: 6〜12週',
        goals: ['段階的荷重→全荷重歩行', '筋力回復'],
        allowed: ['許可荷重での歩行練習', '漸増筋力トレーニング', 'エルゴメーター'],
        avoid: ['許可超過の荷重・衝撃'],
        criteria: ['全荷重で疼痛管理良好', '跛行の改善'],
      },
      {
        name: '機能回復・復帰期',
        period: '目安: 3〜6ヶ月以降',
        goals: ['階段・しゃがみ等の生活動作', '復職・スポーツ（医師許可）'],
        allowed: ['機能的トレーニング', '段階的な衝撃負荷（許可後）'],
        avoid: ['基準未達の衝撃活動'],
        criteria: ['筋力・動作の回復', '医師の活動許可'],
      },
    ],
    returnCriteria: [
      { text: '骨癒合（医師判定）を前提に、筋力・ROM・動作能力と職業/競技要求の照合で段階復帰。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '関節面の整復性・合併損傷により幅がある。外傷後OAのリスクがあり長期の筋力維持を推奨。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KOOS', target: '膝機能', range: '各0-100' },
      { name: 'ROM・周径', target: '機能指標', range: '度・cm' },
    ],
    patientExplanation: {
      whatIs: 'すねの骨の膝側（体重を受ける面）の骨折のあとの回復期間です。骨がつくまでは体重制限があり、その間に膝が硬くならないようにすることが大切です。',
      dos: ['許された範囲で膝を動かす練習を毎日（硬さの予防が最優先）', '体重のかけ方の指示を守りましょう'],
      donts: ['「もう大丈夫そう」と自己判断で体重をかけること'],
      seekCare: ['ふくらはぎの腫れ・痛み', '（受傷直後）我慢できない強い痛み・パンパンな腫れ（緊急）'],
      goal: '骨の治りに合わせて、曲がる膝・支えられる脚を取り戻し、仕事やスポーツへの復帰を目指します。',
    },
    motionCapture: [
      { movement: '歩行（荷重段階ごと）', purpose: '荷重対称性の回復評価', setup: '正面＋側面。', watchFor: ['荷重回避', '伸展不足'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 膝周囲骨切り術後
  {
    id: 'post-knee-osteotomy',
    category: 'knee',
    names: {
      ja: '膝周囲骨切り術後',
      en: 'Post Knee Osteotomy (HTO/DFO)',
      abbreviations: ['HTO', 'DFO', 'AKO'],
      synonyms: ['高位脛骨骨切り術後', '大腿骨遠位骨切り術後'],
      note: '関節温存手術。骨切り部の癒合に応じた荷重管理が中心で、スケジュールは術式・施設で異なる。',
    },
    keywords: ['術後', '骨切り', 'HTO', 'O脚矯正', '内側OA', '活動性温存'],
    overview: [
      { text: '内反変形を伴う内側型膝OA等に対し、荷重軸を矯正して関節を温存する骨切り術後のリハビリ。活動性の高い中年層が主対象で、スポーツ・労働復帰も視野に入る。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: 'open wedge HTOではプレート固定下で骨切り部の癒合を待つ。矯正により荷重分布が外側へ移動する。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '活動要求の高い中年の内側型OA・軟骨手術併用例等が対象。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    mechanism: [
      { text: '術後課題: 骨癒合までの荷重管理、quad萎縮、鵞足部/プレート部の刺激症状、DVT。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '（経過中の注意）骨切り部痛の増悪・矯正感の変化は医師評価。発熱・下腿腫脹はレッドフラッグ。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '術式（open/closed・矯正角）・固定材料', '執刀医の荷重スケジュール', '併用処置（軟骨手術等）',
      '術後週数', '職業・目標スポーツ',
    ],
    physicalExam: [
      { text: '指示範囲でROM・腫脹・quad機能・荷重歩行の質。プレート部の刺激症状の有無。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: 'DVT/PE', distinguishing: '下腿腫脹・胸痛。', urgency: 'emergency' },
      { group: 'must_not_miss', name: '感染・癒合遷延', distinguishing: '発熱・骨切り部痛の増悪。執刀医へ。', urgency: 'same_day' },
    ],
    redFlags: [
      { finding: '発熱・創部異常', action: '執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '下腿腫脹・胸痛・呼吸苦', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
      { finding: '荷重進行後の骨切り部痛増悪', action: '荷重を戻し執刀医へ確認。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '骨癒合・矯正位の評価は執刀医による。荷重許可は画像に基づく。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '免荷〜部分荷重期: ROM・quad活性化・腫脹管理。荷重期: 段階的荷重と歩行再教育・筋力強化。後期: 有酸素・筋力を高め、医師許可のもと低〜中衝撃スポーツへ段階復帰。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '抜釘・追加処置は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護・部分荷重期',
        period: '目安: 0〜6週（施設による）',
        goals: ['骨切り部保護', 'ROM・quad維持', '腫脹管理'],
        allowed: ['指示範囲の荷重・ROM', 'quadセット・SLR'],
        avoid: ['指示外の荷重', '捻り動作'],
        criteria: ['執刀医の荷重許可'],
        mdCheck: '荷重の全段階',
      },
      {
        name: '全荷重・筋力期',
        period: '目安: 6週〜3ヶ月',
        goals: ['全荷重歩行の正常化', '筋力回復'],
        allowed: ['漸増筋力トレーニング', 'エルゴメーター・水中運動'],
        avoid: ['衝撃負荷の早期導入'],
        criteria: ['跛行なし', '筋力回復傾向'],
      },
      {
        name: '活動復帰期',
        period: '目安: 3〜6ヶ月以降（癒合確認後）',
        goals: ['労働・スポーツへの段階復帰'],
        allowed: ['段階的なジョグ→スポーツ（医師許可）'],
        avoid: ['癒合前の衝撃・許可前の競技'],
        criteria: ['骨癒合（医師）', '筋力・動作基準', '医師許可'],
        mdCheck: 'スポーツ復帰の許可',
      },
    ],
    returnCriteria: [
      { text: '骨癒合と医師許可を前提に、筋力・動作・症状で段階判断。中衝撃までのスポーツ復帰報告は比較的良好。', certainty: 'moderate', status: 'needs_literature' },
    ],
    prognosis: [
      { text: '適応良好例で疼痛改善・活動維持が長期に期待される。将来的なTKA移行の可能性は残る。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KOOS / JKOM', target: '膝機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: 'O脚などで膝の内側に集中していた体重の通り道を、骨の角度を矯正して外側に移し、自分の関節を温存する手術のあとの回復期間です。',
      dos: ['骨がつくまでの体重制限を守りつつ、膝の曲げ伸ばしと筋トレを続けましょう'],
      donts: ['癒合前のジャンプ・ランニング・ひねり'],
      seekCare: ['発熱・傷の異常・骨切り部の痛みが強くなる', 'ふくらはぎの腫れ（すぐ連絡）'],
      goal: '自分の膝でスポーツや仕事を続けるための手術です。骨癒合→筋力→段階的復帰の順で、あなたの活動目標まで戻します。',
    },
    motionCapture: [
      { movement: '歩行（荷重段階ごと）', purpose: 'アライメント変化への適応評価', setup: '正面＋側面。', watchFor: ['スラスト消失の確認', '荷重対称性'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
