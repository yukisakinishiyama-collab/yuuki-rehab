// 疾患ページ: 股関節カテゴリ 3/3（下書き・医師監修前）
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

export const HIP_PAGES_3: DiseasePage[] = [
  // ───────────────────────────── 恥骨関連鼠径部痛
  {
    id: 'pubic-related-groin-pain',
    category: 'hip',
    names: {
      ja: '恥骨関連鼠径部痛',
      en: 'Pubic-related Groin Pain',
      abbreviations: [],
      synonyms: ['恥骨結合炎', 'osteitis pubis', '恥骨炎'],
      note: 'Doha合意の一区分。「osteitis pubis」の名称は炎症性疾患を示唆するため近年は避けられる傾向。',
    },
    keywords: ['恥骨', '鼠径部', 'キック', '切り返し', 'サッカー', '恥骨結合', '下腹部'],
    overview: [
      { text: '恥骨結合部およびその近傍の骨・付着部に由来する鼠径部痛。キック・切り返しの多い競技で生じ、内転筋・腹直筋付着部の負荷集中が関与する。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '他の鼠径部痛entity（内転筋・腸腰筋・鼠径管related）との併存が多く、包括的評価が必要。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '恥骨結合には内転筋群と腹直筋・腹斜筋の力が集中し、骨盤前面の力学的な要となる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: 'サッカー・ラグビー等の男性選手に多い。シーズン中の高負荷期に発症・悪化しやすい。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: 'キック・切り返しでの剪断/回旋負荷の反復。股関節可動域制限・体幹骨盤制御不良・負荷急増が背景要因とされる。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '恥骨結合部〜下腹部・内転筋近位の疼痛。キック・ダッシュ・切り返し・咳嗽での誘発。進行すると歩行・寝返りでも疼痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（恥骨正中か片側か）', '誘発動作', '負荷履歴（試合数・練習量の急増）',
      '併存症状（内転筋・下腹部・鼠径管）', '排尿症状等の泌尿器症状の有無（鑑別）',
    ],
    physicalExam: [
      { text: 'Doha合意の定義: 恥骨結合部の限局圧痛（内転筋・腹直筋付着部を含む）。単独の抵抗テストで特異的に再現されない場合も多い。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '股関節可動域（内旋制限はFAI併存の示唆）・体幹骨盤制御の評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '恥骨結合部圧痛・スクイーズテスト',
        target: '恥骨related・内転筋related疼痛',
        method: '背臥位膝屈曲位で両膝間圧迫（スクイーズ）。圧痛は恥骨結合を直接触診。',
        positive: '恥骨部・鼠径部の疼痛再現',
        caution: 'スクイーズは内転筋relatedでも陽性。部位の同定は触診による。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '内転筋関連鼠径部痛', distinguishing: '内転筋起始部の圧痛・抵抗下内転痛が主体。' },
      { group: 'likely', name: '鼠径管関連鼠径部痛', distinguishing: '鼠径管部の圧痛・咳嗽時痛・膨隆はヘルニア評価へ。' },
      { group: 'must_not_miss', name: '恥骨疲労骨折', distinguishing: '限局する骨痛の進行・夜間痛。画像評価は医師判断。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '泌尿器・婦人科疾患', distinguishing: '排尿症状・月経関連症状。該当科への受診を勧める。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '発熱を伴う恥骨部痛', action: '恥骨骨髄炎等の除外。当日中に医療相談。', urgency: 'same_day' },
      { finding: '外傷後の激痛・荷重不能', action: '骨盤骨折の除外。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線・MRIで骨髄浮腫等が見られることがあるが、無症候アスリートにも所見があり解釈は慎重に（医師判断）。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    classification: [
      { text: '確立した重症度分類はない。症状の広がり・機能制限で管理を段階づける。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '負荷管理（キック・スプリント量の調整）＋段階的な内転筋/体幹プログラム＋股関節可動性の改善。復帰は症状基準で段階的に。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    surgical: [
      { text: '手術適応はまれで限定的（難治例・医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷管理・鎮静期',
        period: '症状に応じて',
        goals: ['疼痛の鎮静化', '等尺性負荷の耐容'],
        allowed: ['疼痛のない範囲の体幹・殿筋・内転筋等尺性運動'],
        avoid: ['キック・切り返し・スプリント'],
        criteria: ['歩行・日常動作で疼痛なし', 'スクイーズ痛の軽減'],
      },
      {
        name: '漸増・復帰期',
        period: '基準達成後',
        goals: ['ランニング→切り返し→キックの段階再開'],
        allowed: ['直線ラン→曲線→加減速→キックの段階プログラム'],
        avoid: ['段階飛ばしの復帰'],
        criteria: ['各段階で疼痛・翌日再燃なし'],
      },
    ],
    returnCriteria: [
      { text: '全力キック・切り返しを疼痛なく反復でき、負荷後24時間の再燃がないこと。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '経過が数ヶ月に及ぶことがあり、負荷管理の失敗で遷延しやすい。段階基準の遵守が重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'HAGOS', target: '股関節・鼠径部機能', range: '各0-100' },
    ],
    patientExplanation: {
      whatIs: '骨盤の前で左右の骨が合わさる「恥骨」のまわりに、キックやダッシュの負担が集中して痛みが出ている状態です。',
      dos: ['体幹と内もも・お尻の筋トレを段階的に進めましょう'],
      donts: ['痛みを我慢したキック・切り返しの継続（長引く原因になります）'],
      seekCare: ['発熱を伴う痛み', '安静でも痛みが強くなる'],
      goal: '焦って戻ると長引きやすい場所です。「走る→切り返す→蹴る」を段階的にクリアして完全復帰を目指します。',
    },
    motionCapture: [
      { movement: 'キック・切り返し動作', purpose: '骨盤制御・負荷集中の評価', setup: '正面＋側面。', watchFor: ['骨盤の過剰回旋', '支持脚の崩れ', '体幹代償'] },
    ],
    references: [
      {
        authors: 'Weir A, Brukner P, Delahunt E, et al.',
        title: 'Doha agreement meeting on terminology and definitions in groin pain in athletes',
        source: 'Br J Sports Med', year: 2015, verified: false,
        note: '鼠径部痛分類の国際合意。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 鼠径部痛症候群
  {
    id: 'groin-pain-syndrome',
    category: 'hip',
    names: {
      ja: '鼠径部痛症候群',
      en: 'Groin Pain in Athletes',
      abbreviations: ['GPS'],
      synonyms: ['グロインペイン症候群', 'アスリート鼠径部痛', 'athletic groin pain'],
      note: '単一疾患ではなく、複数のentity（内転筋・腸腰筋・鼠径管・恥骨・股関節related）を含む包括概念。Doha合意の分類で整理する。',
    },
    keywords: ['鼠径部', 'サッカー', 'キック', '走る と 痛い', '内転筋', '慢性化'],
    overview: [
      { text: 'アスリートの鼠径部痛の総称。Doha合意（2015）では「内転筋関連・腸腰筋関連・鼠径管関連・恥骨関連・股関節関連」の5区分＋その他に整理された。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '複数entityの併存が多く、「どの組織か」を単一に断定するより、再現性のある所見に基づき負荷管理と段階リハビリを行うことが実務の中心。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '鼠径部は内転筋群・腸腰筋・腹壁（鼠径管）・恥骨・股関節が近接し、疼痛の局在判断が難しい領域。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: 'サッカー・ホッケー・ラグビー等のキック/切り返し競技に多い。慢性化しやすくシーズンを跨ぐ例もある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '負荷急増・股関節可動域制限（FAI形態含む）・体幹骨盤制御不良・キック動作の質などの多因子。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '運動時鼠径部痛（キック・ダッシュ・切り返し）。起床時のこわばり・練習後の増悪など負荷依存性のパターン。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位の指差し確認（内側/前面/下腹部/深部）', '誘発動作と負荷履歴',
      '各entityの症状（咳嗽時痛=鼠径管、深部クリック=股関節等）', '既往（FAI・ヘルニア）',
      '練習環境の変化（グラウンド・シューズ・ポジション）',
    ],
    physicalExam: [
      { text: 'Doha分類に基づく系統的触診＋抵抗/伸張テスト: 内転筋（圧痛＋抵抗下内転痛）・腸腰筋（圧痛＋抵抗屈曲/伸張痛）・鼠径管（圧痛±咳嗽痛）・恥骨（結合部圧痛）・股関節（FADIR等）。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    specialTests: [
      {
        name: 'スクイーズテスト（0°/45°/90°）',
        target: '内転筋related・恥骨related',
        method: '各股関節屈曲角度で両膝間の圧迫に抵抗させる。',
        positive: '鼠径部痛の再現・筋力低下',
        caution: '角度により負荷部位が変わる。疼痛部位の触診と組み合わせて解釈。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '各related entity（内転筋/腸腰筋/鼠径管/恥骨/股関節）', distinguishing: '本症候群の内訳として分類する。' },
      { group: 'must_not_miss', name: '鼠径ヘルニア（真のヘルニア）', distinguishing: '膨隆・咳嗽で増大。外科評価へ。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '大腿骨頸部疲労骨折', distinguishing: '進行性荷重時痛・夜間痛。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '泌尿器・消化器・婦人科疾患', distinguishing: '排尿症状・消化器症状・月経関連。該当科受診。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '発熱・体重減少・夜間進行痛', action: '内科的疾患・腫瘍・感染の除外は医師判断。', urgency: 'confirm_md' },
      { finding: '急な激痛・膨隆の嵌頓様症状', action: 'ヘルニア嵌頓疑い。救急受診。', urgency: 'emergency' },
    ],
    imaging: [
      { text: '画像は除外診断・併存評価（FAI形態・疲労骨折等）に用いる。所見と症状の対応づけが重要（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Doha合意の5分類＋股関節related。複数併存の記載を許容する。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    conservative: [
      { text: '能動的運動療法（内転筋・体幹を中心とした段階的プログラム）が受動的治療より優れるとする比較試験が知られる。負荷管理と並行して行う。', certainty: 'moderate', status: 'needs_literature', refs: [1] },
      { text: '段階例: 等尺性内転→Copenhagen adduction等の漸増→ラン→切り返し→キック。疼痛モニタリング（許容範囲の設定）を用いる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: 'entityにより手術選択肢が異なる（鼠径管関連の修復等）。適応は専門医判断。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '鎮静・等尺期',
        period: '症状に応じて',
        goals: ['疼痛の鎮静化', '等尺性負荷の耐容'],
        allowed: ['等尺性内転・体幹低負荷運動'],
        avoid: ['キック・スプリント・切り返し'],
        criteria: ['日常動作の疼痛消失'],
      },
      {
        name: '漸増負荷期',
        period: '基準達成後',
        goals: ['内転筋・体幹の漸増強化', '直線ランの再開'],
        allowed: ['漸増的内転筋トレーニング', '直線ラン'],
        avoid: ['負荷の急増'],
        criteria: ['スクイーズで疼痛なし・筋力回復傾向'],
      },
      {
        name: '競技復帰期',
        period: '基準達成後',
        goals: ['切り返し・キックの完全復帰'],
        allowed: ['段階的な切り返し・キックプログラム'],
        avoid: ['段階飛ばし'],
        criteria: ['全力動作で疼痛・翌日再燃なし'],
      },
    ],
    returnCriteria: [
      { text: '全力の競技特異的動作を疼痛なく反復、内転筋力の回復、負荷後再燃なしを組み合わせる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '早期の適切な管理で復帰可能だが、慢性化例は数ヶ月を要しうる。予防として内転筋プログラム（Copenhagen等）の有効性が報告されている。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    outcomes: [
      { name: 'HAGOS', target: '股関節・鼠径部機能', range: '各0-100' },
    ],
    patientExplanation: {
      whatIs: '「鼠径部痛（グロインペイン）」は一つの病名ではなく、股のつけ根のいくつかの場所（内もものスジ・股関節・腹壁など）の痛みの総称です。あなたの痛みの出どころを評価で絞り込み、それに合わせた計画を立てます。',
      dos: ['内ももと体幹の段階的な筋トレが回復の柱です'],
      donts: ['痛みを我慢してのプレー継続（慢性化の最大の原因です）'],
      seekCare: ['足のつけ根の膨らみが急に痛む', '発熱・体重減少を伴う'],
      goal: '「走る→切り返す→蹴る」を一段ずつ痛みなくクリアし、再発しにくい体づくりまで含めて完全復帰を目指します。',
    },
    motionCapture: [
      { movement: '切り返し・キック', purpose: '負荷集中要因の評価', setup: '正面＋側面。', watchFor: ['骨盤制御', '支持脚アライメント', '体幹の遅れ'] },
    ],
    references: [
      {
        authors: 'Weir A, Brukner P, Delahunt E, et al.',
        title: 'Doha agreement meeting on terminology and definitions in groin pain in athletes',
        source: 'Br J Sports Med', year: 2015, verified: false,
        note: '分類の国際合意。',
      },
      {
        authors: 'Hölmich P, Uhrskou P, Ulnits L, et al.',
        title: 'Effectiveness of active physical training as treatment for long-standing adductor-related groin pain in athletes: randomised trial',
        source: 'Lancet', year: 1999, verified: false,
        note: '能動的運動療法の有効性を示した古典的RCT。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 股関節鏡視下手術後
  {
    id: 'post-hip-arthroscopy',
    category: 'hip',
    names: {
      ja: '股関節鏡視下手術後',
      en: 'Post Hip Arthroscopy Rehabilitation',
      abbreviations: [],
      synonyms: ['股関節鏡術後', 'FAI術後', '唇縫合術後'],
      note: '術式（唇縫合/切除・骨形態矯正・関節包縫合の有無）で進行が大きく異なる。必ず術記録・医師指示を確認。',
    },
    keywords: ['術後', '股関節鏡', '唇縫合', 'cam切除', '荷重制限', 'リハビリ'],
    overview: [
      { text: 'FAI・唇損傷等に対する鏡視下手術（唇縫合・骨軟骨形成・関節包処置）後のリハビリテーション。組織治癒の保護と過度の安静回避のバランスが鍵。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '本ページは一般的な考え方の整理であり、実際の進行は執刀医のプロトコルが最優先。', certainty: 'expert', status: 'verified' },
    ],
    anatomy: [
      { text: '縫合された関節唇・処置された関節包は早期の過伸張（特に伸展・外旋端）で破綻リスクがあるとされる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '若年アスリートを中心に手術件数は増加傾向と報告される。', certainty: 'low', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '術後問題の例: 屈筋腱炎（腸腰筋刺激）、関節包由来の不安定感、癒着による可動域制限、過負荷による滑膜炎。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    symptoms: [
      { text: '（術後経過中の注意サイン）安静時痛の再燃・夜間痛・可動域の急な悪化・発熱は合併症評価が必要。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '術式の詳細（唇縫合か切除か・骨形成の有無・関節包の処置）', '執刀医の荷重/可動域制限指示',
      '装具・杖の指示期間', '術後経過週数', '現在の疼痛・不安定感・引っかかり',
    ],
    physicalExam: [
      { text: '医師の許可範囲内でROM・筋機能・荷重状態を評価。制限範囲を超える他動可動域検査は行わない。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '深部静脈血栓症', distinguishing: '下腿腫脹・把握痛。術後は常に念頭に。', urgency: 'same_day' },
      { group: 'must_not_miss', name: '術後感染', distinguishing: '発熱・創部発赤・安静時痛増悪。', urgency: 'same_day' },
      { group: 'likely', name: '腸腰筋腱炎（術後）', distinguishing: '前面の抵抗下屈曲痛。負荷調整で対応。' },
    ],
    redFlags: [
      { finding: '術後の急激な疼痛増悪・創部異常・発熱', action: 'リハ中止し執刀医へ連絡。', urgency: 'same_day' },
      { finding: '下腿腫脹・胸痛・呼吸苦', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: '術後評価・経過の画像判断は執刀医による。', certainty: 'expert', status: 'verified' },
    ],
    classification: [
      { text: '該当なし（術式・医師プロトコルに従う）。', status: 'verified' },
    ],
    conservative: [
      { text: '術後リハビリの一般原則: 指示範囲内での早期可動域（癒着予防）・段階的荷重・深部筋再教育→漸増筋力→機能訓練。屈筋過負荷（早期のSLR反復等）を避ける方針が多い。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '（本ページ自体が術後管理のページ）再手術の判断は執刀医による。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜4週（術式による）',
        goals: ['組織保護', '指示範囲のROM確保', '疼痛・腫脹管理'],
        allowed: ['指示範囲の他動/自動ROM', '等尺性殿筋・体幹運動', '指示に応じた荷重'],
        avoid: ['伸展・外旋端への伸張', '屈筋の過負荷', '指示外の荷重'],
        criteria: ['執刀医の再診による段階許可'],
        mdCheck: '荷重・ROM制限の全変更',
      },
      {
        name: '機能回復期',
        period: '目安: 4〜12週',
        goals: ['正常歩行', '筋力の回復', '基本動作の再獲得'],
        allowed: ['漸増的筋力トレーニング', '自転車・水中運動', 'バランス訓練'],
        avoid: ['衝撃負荷の早期導入', '可動域端の反復負荷'],
        criteria: ['跛行なし', '片脚立位安定', '疼痛管理良好'],
      },
      {
        name: '競技復帰期',
        period: '目安: 3ヶ月以降（医師許可後）',
        goals: ['ラン→競技動作の段階復帰'],
        allowed: ['段階的ランニング・アジリティ・競技練習'],
        avoid: ['基準未達での復帰'],
        criteria: ['筋力・片脚機能の回復', '競技動作で症状なし', '執刀医の許可'],
        mdCheck: '競技復帰の最終許可',
      },
    ],
    returnCriteria: [
      { text: '執刀医の許可を前提に、筋力・片脚動作・競技動作の質・症状再燃の有無で段階判断する。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '適応良好例では高い復帰率の報告があるが、形成不全合併例等では成績が異なる。個別性が大きい。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'iHOT-12', target: '股関節QOL', range: '0-100' },
      { name: 'HAGOS', target: '機能', range: '各0-100' },
    ],
    patientExplanation: {
      whatIs: '股関節の内視鏡手術のあと、修復した組織を守りながら、少しずつ動きと筋力を取り戻していく期間です。',
      dos: ['先生から指示された体重のかけ方・動かしてよい範囲を守りましょう', '許可された範囲での運動は癒着予防に大切です'],
      donts: ['「調子がいいから」と自己判断で制限を破ること', '脚を大きく後ろに反らす・強くひねる動き（時期による）'],
      seekCare: ['傷の腫れ・赤み・発熱', 'ふくらはぎの腫れや痛み（すぐ連絡）'],
      goal: '修復部がしっかり治る時期に合わせて、段階的にスポーツ復帰まで進めます。進むペースは手術の内容によって違うため、主治医と密に連携します。',
    },
    motionCapture: [
      { movement: '歩行→片脚スクワット（時期に応じて）', purpose: '荷重対称性・制御の回復評価', setup: '正面＋側面。', watchFor: ['跛行', '骨盤落下', '患側回避'] },
    ],
    references: [],
    protocolTemplateKey: 'fai_arthroscopy',
    protocolJoint: 'hip',
    meta: draftMeta(),
  },

  // ───────────────────────────── 寛骨臼回転骨切り術後
  {
    id: 'post-rao',
    category: 'hip',
    names: {
      ja: '寛骨臼回転骨切り術後',
      en: 'Post Rotational Acetabular Osteotomy (RAO/PAO)',
      abbreviations: ['RAO', 'PAO'],
      synonyms: ['骨盤骨切り術後', 'periacetabular osteotomy'],
      note: '骨切り部の骨癒合が進行の律速。荷重スケジュールは施設・医師により幅があるため必ず指示を確認。',
    },
    keywords: ['術後', '骨切り', '形成不全', '荷重制限', '骨癒合', '若年女性'],
    overview: [
      { text: '寛骨臼形成不全に対し寛骨臼の被覆を改善する関節温存手術後のリハビリテーション。骨癒合を待ちながらの段階的荷重と筋機能回復が中心。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '進行は骨癒合の画像評価に基づき執刀医が決定する。時間だけで荷重を進めない。', certainty: 'expert', status: 'verified' },
    ],
    anatomy: [
      { text: '骨切り部の癒合過程に加え、展開に伴う股関節周囲筋（外転筋等）の侵襲からの回復が機能上の課題となる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '若年〜中年の症候性形成不全（軟骨温存例）が主対象。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    mechanism: [
      { text: '術後課題: 免荷期間の筋萎縮・拘縮、荷重再開期の外転筋機能不全（跛行）、過負荷による骨切り部トラブル。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    symptoms: [
      { text: '（経過中の注意）骨切り部周辺の急な疼痛増悪・荷重時痛の再燃は癒合不全等の評価が必要（医師へ）。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '術式・固定材料・執刀医の荷重スケジュール', '術後週数と現在の許可荷重',
      '疼痛部位（骨切り部/筋性/関節性）', '杖の使用状況', '職業・生活環境（階段等）',
    ],
    physicalExam: [
      { text: '指示範囲内でのROM・筋力（特に外転筋）・荷重歩行の質を評価。抵抗検査は骨癒合状況を考慮し医師確認のうえで漸増。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: 'DVT/PE', distinguishing: '下腿腫脹・胸痛・呼吸苦。骨盤手術後はリスク期間が長い。', urgency: 'emergency' },
      { group: 'must_not_miss', name: '骨切り部の癒合遷延・固定トラブル', distinguishing: '荷重時痛の再燃・増悪。画像評価は医師。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '下腿腫脹・胸痛・呼吸苦', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
      { finding: '発熱・創部異常', action: '感染評価。執刀医へ連絡。', urgency: 'same_day' },
      { finding: '荷重進行後の骨切り部痛の増悪', action: '荷重を戻し執刀医へ確認。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '骨癒合の判定・荷重許可は執刀医のX線評価による。', certainty: 'expert', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '免荷期: ベッドサイドからの等尺性運動・非荷重ROM・上肢体力維持。荷重期: 許可に応じた部分荷重歩行練習と外転筋再教育。全荷重後: 跛行の残存を防ぐ筋力・歩行練習を数ヶ月単位で継続。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '抜釘等の追加処置は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '免荷・保護期',
        period: '目安: 0〜3週（施設による）',
        goals: ['疼痛管理', '拘縮・筋萎縮の最小化', 'DVT予防'],
        allowed: ['足関節ポンピング', '等尺性運動', '指示範囲の非荷重ROM'],
        avoid: ['指示外の荷重', '股関節深屈曲・過伸展'],
        criteria: ['執刀医の許可'],
        mdCheck: 'すべての段階変更',
      },
      {
        name: '部分荷重期',
        period: '目安: 3週〜（骨癒合に応じて）',
        goals: ['段階的荷重の獲得', '外転筋の再教育'],
        allowed: ['許可荷重での歩行練習', '漸増的筋力トレーニング'],
        avoid: ['許可を超える荷重・長距離歩行'],
        criteria: ['X線での癒合進行（医師評価）', '荷重時痛なし'],
      },
      {
        name: '全荷重・機能回復期',
        period: '目安: 2〜6ヶ月',
        goals: ['跛行のない歩行', '生活動作の自立', '筋力の回復'],
        allowed: ['歩行距離の漸増', '外転筋・体幹の強化継続', '自転車・水中運動'],
        avoid: ['衝撃負荷（許可前のジョグ等）'],
        criteria: ['Trendelenburg陰性化傾向', '連続歩行距離の回復'],
      },
    ],
    returnCriteria: [
      { text: 'スポーツ・重労働への復帰可否と時期は骨癒合・筋機能に基づき執刀医が判断。低衝撃活動から段階的に。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '適応良好例では長期の関節温存が期待される報告がある。術前の関節症進行度が成績に影響する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'JHEQ', target: '股関節QOL（国内開発）', range: '0-84' },
      { name: 'HOOS', target: '痛み・機能', range: '各0-100' },
    ],
    patientExplanation: {
      whatIs: '股関節の受け皿の骨を切って向きを変え、体重を受ける面を広くする手術のあとの回復期間です。切った骨がつくのを待ちながら、段階的に体重をかけていきます。',
      dos: ['「今どこまで体重をかけてよいか」を常に確認し守りましょう', '免荷中もできる筋トレ（指示範囲）が回復を早めます'],
      donts: ['骨がつく前の頑張りすぎ（歩きすぎ・制限超過）'],
      seekCare: ['ふくらはぎの腫れ・胸の痛み・息苦しさ（すぐ連絡）', '発熱・傷の異常', '体重をかけたときの痛みが強くなってきた'],
      goal: '数ヶ月かけて骨癒合と筋力を積み上げ、跛行のない歩行、その先の活動復帰を目指します。長丁場ですが、若い関節を長持ちさせるための投資期間です。',
    },
    motionCapture: [
      { movement: '歩行（荷重段階ごと）', purpose: '荷重対称性・跛行の評価', setup: '正面＋側面。', watchFor: ['Trendelenburg', '荷重回避', '歩幅左右差'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 人工股関節全置換術後
  {
    id: 'post-tha',
    category: 'hip',
    names: {
      ja: '人工股関節全置換術後',
      en: 'Post Total Hip Arthroplasty (THA)',
      abbreviations: ['THA', 'THR'],
      synonyms: ['人工股関節術後', 'total hip arthroplasty'],
      note: '脱臼リスク肢位はアプローチ（後方/前方等）で異なる。必ず術式・執刀医の指示を確認。',
    },
    keywords: ['術後', '人工関節', '脱臼予防', '高齢者', '変形性股関節症', 'アプローチ'],
    overview: [
      { text: '進行した股OA等に対する人工股関節全置換術後のリハビリテーション。疼痛改善効果の高い手術であり、術後は早期離床・歩行再獲得・脱臼予防教育が中心。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '脱臼リスク肢位は手術アプローチにより異なる（後方系: 屈曲内転内旋の複合等）。一律の「禁忌肢位」を適用せず術式を確認する。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: 'インプラント（カップ・ステム・骨頭）と軟部組織バランス。アプローチにより侵襲される筋・関節包が異なり、初期の脱臼抵抗性に影響する。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '高齢者を中心に施行件数の多い手術。患者満足度は比較的高いと報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '術後課題: 外転筋機能不全による跛行の残存、脱臼（特に初期）、脚長差の自覚、深部感染・DVT等の合併症。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    symptoms: [
      { text: '（経過中の注意）急な激痛＋下肢の変形・短縮は脱臼を疑う。発熱・創部異常・安静時痛の再燃は感染評価が必要。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    interviewItems: [
      'アプローチ・執刀医の指示（禁忌肢位・期間）', '術後経過・入院リハでの到達度',
      '住環境（和式/洋式・階段・浴室）', '術前の活動レベルと目標', '対側・膝・腰の症状',
    ],
    physicalExam: [
      { text: '指示範囲でのROM・筋力（外転筋中心）・歩行の質・脚長差の評価。禁忌肢位を評価手技でも作らない。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '脱臼', distinguishing: '急な激痛・肢位異常・短縮。動かさず救急要請。', urgency: 'emergency' },
      { group: 'must_not_miss', name: '人工関節周囲感染', distinguishing: '発熱・創部異常・疼痛再燃。', urgency: 'same_day' },
      { group: 'must_not_miss', name: 'DVT/PE', distinguishing: '下腿腫脹・胸痛・呼吸苦。', urgency: 'emergency' },
      { group: 'likely', name: '腰椎由来の残存症状', distinguishing: '術後も残る下肢症状は腰部評価を。' },
    ],
    redFlags: [
      { finding: '急な激痛と脚の変形・動かせない', action: '脱臼疑い。動かさず救急対応。', urgency: 'emergency' },
      { finding: '発熱・創部の発赤/浸出・疼痛の再燃', action: '感染疑い。執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '下腿腫脹・胸痛・呼吸苦', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: 'インプラント位置・ゆるみ等の評価は医師による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '術後リハビリ: 早期離床・基本動作＋脱臼予防教育（術式に応じた肢位管理・環境調整）→歩行の質改善（外転筋強化・補助具の漸減）→生活動作・低衝撃活動への復帰。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '再置換等の判断は医師による。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '急性期（入院）',
        period: '目安: 0〜2週',
        goals: ['早期離床', '基本動作の自立', '脱臼予防の習得'],
        allowed: ['歩行器→杖歩行', 'ベッドサイド筋力運動', '指示範囲のROM'],
        avoid: ['術式ごとの禁忌肢位', '転倒リスクの高い動作'],
        criteria: ['基本動作自立', '退院基準の達成'],
        mdCheck: '禁忌肢位の内容と期間',
      },
      {
        name: '回復期',
        period: '目安: 2週〜3ヶ月',
        goals: ['跛行のない歩行', '外転筋筋力の回復', '生活動作の拡大'],
        allowed: ['漸増的筋力トレーニング', '歩行距離延長', '階段・屋外歩行'],
        avoid: ['転倒リスク動作', '衝撃負荷'],
        criteria: ['杖なし歩行の安定', 'Trendelenburg軽減'],
      },
      {
        name: '活動復帰期',
        period: '目安: 3ヶ月以降',
        goals: ['趣味・低衝撃スポーツへの復帰'],
        allowed: ['ウォーキング・自転車・水泳・ゴルフ等（医師許可に応じて）'],
        avoid: ['高衝撃活動（ランニング・ジャンプ系は医師と相談）'],
        criteria: ['筋力・バランスの回復', '医師の活動許可'],
        mdCheck: 'スポーツ復帰の可否・範囲',
      },
    ],
    returnCriteria: [
      { text: '活動範囲はインプラントの長期成績を考慮して医師と相談。低衝撃活動が推奨されることが多い。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '疼痛・QOL改善効果は高い。インプラント寿命・脱臼率は術式・患者要因で異なる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'HOOS / JHEQ', target: '痛み・機能・QOL', range: '尺度による' },
      { name: 'TUG・歩行速度', target: '移動能力', range: '秒・m/s' },
    ],
    patientExplanation: {
      whatIs: '傷んだ股関節を人工の関節に置き換える手術のあとの回復期間です。痛みが大きく軽くなる方が多い手術です。最初の数ヶ月は「脱臼しない体の使い方」を身につけることが大切です。',
      dos: ['教わった「やってよい動き・避ける動き」を生活で実践しましょう', 'お尻の横の筋トレは、きれいな歩き方を取り戻す鍵です'],
      donts: ['術式に応じて指導された肢位（例: 深くかがんで内側にひねる等）※あなたの手術での注意点は個別に確認します', '転びやすい環境・履き物'],
      seekCare: ['急な激痛で脚が動かせない・脚の向きがおかしい（動かさず救急へ）', '発熱・傷の腫れや汁', 'ふくらはぎの腫れ・胸の苦しさ'],
      goal: '痛みのない歩行と生活動作を取り戻し、ウォーキングや趣味の活動を長く続けられることが目標です。',
    },
    motionCapture: [
      { movement: '歩行（補助具の段階ごと）', purpose: '跛行・外転筋機能の評価', setup: '正面＋側面。', watchFor: ['Trendelenburg/Duchenne', '歩幅・立脚時間の左右差'] },
      { movement: '立ち座り・段差昇降', purpose: '生活動作の安全性評価', setup: '側面。', watchFor: ['禁忌肢位の混入', '患側回避'] },
    ],
    references: [],
    protocolTemplateKey: 'tha',
    protocolJoint: 'hip',
    meta: draftMeta(),
  },
]
