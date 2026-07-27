// 疾患ページ: 股関節カテゴリ 2/3（下書き・医師監修前）
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

export const HIP_PAGES_2: DiseasePage[] = [
  // ───────────────────────────── 変形性股関節症
  {
    id: 'hip-oa',
    category: 'hip',
    names: {
      ja: '変形性股関節症',
      en: 'Hip Osteoarthritis',
      abbreviations: ['股OA', 'HOA'],
      synonyms: ['変股症', 'hip osteoarthritis'],
      note: '日本では寛骨臼形成不全を背景とする二次性が多いと報告される。',
    },
    keywords: ['鼠径部痛', '可動域制限', '跛行', '中高年', '靴下', '爪切り', '階段', '形成不全'],
    overview: [
      { text: '関節軟骨の変性・摩耗と骨反応（骨棘・軟骨下骨硬化）を主体とする進行性の関節疾患。疼痛・可動域制限・跛行によりADL/QOLを損なう。', certainty: 'high', status: 'needs_md_review' },
      { text: 'X線重症度と症状は必ずしも一致しない。症状・機能に基づく個別評価が治療の中心。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '荷重部軟骨の変性から始まり、骨棘形成・関節包肥厚・周囲筋（特に外転筋）の機能低下を伴って進行する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中高年女性に多い（国内では形成不全背景例が多いため）。危険因子: 形成不全・既往股関節疾患・重量物作業・肥満。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    mechanism: [
      { text: '力学的負荷集中（形態異常・肥満・作業負荷）と生物学的要因の複合により軟骨変性が進行する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '初期: 立ち上がり・歩き始めの鼠径部痛。進行期: 持続痛・夜間痛、可動域制限（靴下履き・爪切り・和式動作の困難）、跛行。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '殿部・大腿・膝への関連痛のため「膝痛」として受診することもある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位・タイミング（動き始め/歩行中/夜間）', '歩行距離・階段・和式動作の支障',
      '小児期股関節疾患・形成不全の指摘歴', '職業歴（重量物・立ち仕事）', '体重歴',
      '靴下履き・爪切りの可否', '杖の使用状況', '医師の診断・X線評価・手術の説明の有無',
    ],
    physicalExam: [
      { text: '可動域（屈曲・内旋・外転の制限が特徴的）、Trendelenburg徴候、脚長差、歩行観察。', status: 'needs_pro_review' },
      { text: '膝・腰椎の併存症状の評価（関連痛・代償による二次障害）。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'FABER / 屈曲内旋テスト',
        target: '股関節由来疼痛のスクリーニング',
        method: '標準手技に準ずる。',
        positive: '鼠径部痛の再現・可動域制限',
        caution: '確定はX線＋医師の診断による。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '大転子部痛症候群', distinguishing: '外側の限局圧痛。側臥位で増悪。併存も多い。' },
      { group: 'must_not_miss', name: '大腿骨頭壊死', distinguishing: '急性発症・ステロイド/飲酒歴。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '大腿骨頸部脆弱性骨折', distinguishing: '高齢者の急な荷重時痛。X線で不明瞭なことも。疑えば受診。', urgency: 'early_visit' },
      { group: 'similar', name: '腰部脊柱管狭窄症', distinguishing: '間欠跛行の性状（前屈で軽快）・下肢症状で鑑別。' },
    ],
    redFlags: [
      { finding: '急激な疼痛悪化・荷重不能（軽微な外傷後含む）', action: '骨折・急速破壊型股関節症の可能性。早期受診。', urgency: 'early_visit' },
      { finding: '発熱を伴う股関節痛', action: '感染除外。当日中に医療相談。', urgency: 'same_day' },
      { finding: '数週間で急速に進行する疼痛・破壊', action: '急速破壊型の評価は医師判断。担当医へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '立位X線が基本（裂隙狭小化・骨棘・骨硬化・嚢胞）。重症度判定は医師。X線所見と症状は乖離しうる。', certainty: 'high', status: 'needs_md_review' },
    ],
    classification: [
      { text: '前期・初期・進行期・末期（国内分類）等が用いられる。治療選択の参考となるが症状・機能と合わせて判断される。', certainty: 'moderate', status: 'needs_md_review', refs: [0] },
    ],
    conservative: [
      { text: '運動療法（外転筋・伸展筋強化、可動域維持、有酸素運動）は疼痛・機能改善のエビデンスがあり第一選択。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '体重管理・杖（患側と逆手）・生活動作の工夫（洋式化）・疼痛に応じた負荷調整。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '薬物療法・注射は医師の判断による。', certainty: 'expert', status: 'verified' },
    ],
    surgical: [
      { text: '保存療法で管理困難な進行例にTHAが標準的。若年例では骨切り術が検討されることもある（判断は医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・機能維持期',
        period: '継続的（保存療法）',
        goals: ['疼痛の自己管理', '外転筋・伸展筋の強化', '歩行能力の維持'],
        allowed: ['低衝撃の筋力トレーニング', '水中運動・自転車', '可動域維持運動'],
        avoid: ['疼痛を悪化させる長距離歩行・衝撃負荷の急増'],
        criteria: ['疼痛と活動量のバランス確立', '歩行距離・ADLの維持'],
        mdCheck: '症状進行時の手術適応相談',
      },
    ],
    returnCriteria: [
      { text: '「治癒」ではなくADL/QOL目標（買い物・旅行・趣味等）の達成度で評価する。患者目標を明確化して共有する。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '進行速度は個人差が大きい。運動療法で長期に症状管理できる例も多い一方、進行例ではTHAで良好なQOL改善が期待できる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'HOOS', target: '痛み・症状・ADL・QOL', range: '各0-100（高いほど良好）' },
      { name: 'JHEQ', target: '日本の生活様式に即した股関節QOL', range: '0-84' },
      { name: 'TUG', target: '移動能力', range: '秒（短いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '股関節の軟骨がすり減り、痛みや動かしにくさが出る状態です。進み方には個人差が大きく、運動と生活の工夫で長く付き合っていける方も多くいます。',
      dos: ['お尻まわりの筋トレ・水中運動・自転車など関節にやさしい運動を続けましょう', '杖や洋式の生活様式は関節を守る味方です'],
      donts: ['痛みを我慢しての長距離歩行', '急な運動量の増加'],
      seekCare: ['急に痛みが強くなった・脚に体重をかけられない', '夜の痛みで眠れない日が続く'],
      goal: '痛みをコントロールしながら、あなたのやりたい生活（買い物・旅行・趣味）を続けられることが目標です。必要な時期が来たら手術も有効な選択肢として医師と相談できます。',
    },
    motionCapture: [
      { movement: '歩行', purpose: '跛行パターン・代償の評価', setup: '正面＋側面。', watchFor: ['Trendelenburg/Duchenne', '立脚時間の左右差', '体幹前傾'] },
      { movement: '立ち上がり', purpose: '下肢筋力・戦略の評価', setup: '側面から。', watchFor: ['患側回避', '手の使用', '重心軌道'] },
    ],
    references: [
      {
        authors: '日本整形外科学会診療ガイドライン委員会（編）',
        title: '変形性股関節症診療ガイドライン',
        source: '南江堂', year: 2016,
        note: '国内ガイドライン。版は原本確認待ち。',
        verified: false,
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 大腿骨頸部疲労骨折
  {
    id: 'femoral-neck-stress-fracture',
    category: 'hip',
    names: {
      ja: '大腿骨頸部疲労骨折',
      en: 'Femoral Neck Stress Fracture',
      abbreviations: ['FNSF'],
      synonyms: ['股関節疲労骨折', 'femoral neck stress injury'],
      note: '見逃すと完全骨折・転位に至りうる「見逃してはいけない」疲労骨折の代表。',
    },
    keywords: ['ランナー', '長距離', '鼠径部痛', '荷重時痛', '女性アスリート', 'REDs', '無月経'],
    overview: [
      { text: '反復荷重により大腿骨頸部に生じる疲労骨折。ランナー・新兵訓練等で報告され、転位すれば骨頭壊死・偽関節のリスクがある重大疾患。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '疑った時点で荷重を中止し医師へ紹介することが最重要。リハビリ現場での「様子見」は不可。', certainty: 'expert', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '圧迫側（下内側）と張力側（上外側）で管理が異なり、張力側は転位リスクが高く手術適応となりうる（判断は医師）。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '長距離ランナー・急激な走行距離増加・低エネルギー可用性（REDs）・無月経・骨密度低下が危険因子。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '骨のリモデリング能を超える反復荷重負荷。エネルギー不足・ホルモン要因が骨脆弱性を高める。', certainty: 'moderate', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '運動時の鼠径部〜大腿前面の深部痛。進行すると歩行時痛・夜間痛。明確な外傷歴がないのが特徴。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '走行距離・強度の直近の変化', '疼痛の経過（運動時→日常へ拡大していないか)', '夜間痛の有無',
      '月経状態・体重減少・食事制限（REDs評価）', '疲労骨折の既往', '骨密度・採血の評価歴',
    ],
    physicalExam: [
      { text: '片脚ホップ・荷重時痛（疑い例ではホップテストの実施自体を慎重に）。他動可動域端の鼠径部痛。局所圧痛は得にくい。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Fulcrum/ホップによる誘発',
        target: '疲労骨折の疑い',
        method: '疑いが強い場合は誘発テスト自体を避け、画像評価を優先する。',
        positive: '荷重・ホップでの鼠径部痛',
        caution: '陽性・陰性にかかわらず、臨床的疑いがあれば荷重制限＋医師紹介。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '腸腰筋関連疼痛・鼠径部痛症候群', distinguishing: '抵抗テスト・触診で再現。ただし疲労骨折除外が先。' },
      { group: 'must_not_miss', name: '大腿骨頭壊死', distinguishing: 'ステロイド・飲酒歴。', urgency: 'confirm_md' },
      { group: 'similar', name: 'FAI症候群・唇損傷', distinguishing: '衝突性の疼痛パターン。夜間痛・進行性なら骨折を優先評価。' },
    ],
    redFlags: [
      { finding: 'ランナーの進行性鼠径部痛＋夜間痛', action: '本疾患を強く疑い、荷重を中止して早期に整形外科へ（X線陰性でもMRI適応は医師判断）。', urgency: 'early_visit' },
      { finding: '急な激痛・荷重不能', action: '完全骨折の可能性。救急受診。', urgency: 'emergency' },
    ],
    imaging: [
      { text: '初期X線は陰性が多い。MRIが早期診断に有用（適応判断は医師）。「X線で異常なし」で除外しない。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '部位（圧迫側/張力側）・骨折線の程度により保存/手術が分かれる（判断は医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '圧迫側の一部は免荷〜段階的荷重で保存的に管理される（医師の指示による）。並行してREDs・骨代謝要因の評価と是正を行う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '張力側・転位例等ではスクリュー固定等が選択される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '免荷・保護期',
        period: '医師の指示による',
        goals: ['骨癒合環境の確保', '非荷重での体力維持'],
        allowed: ['上肢・体幹・非荷重の運動（水中含む、指示範囲）'],
        avoid: ['指示を超える荷重・ランニング'],
        criteria: ['医師の画像・症状評価による段階変更'],
        mdCheck: '荷重進行の全段階',
      },
      {
        name: '段階的荷重・復帰期',
        period: '医師の許可後',
        goals: ['荷重耐容の再獲得', '走行の段階的再開', '再発予防（負荷管理・栄養）'],
        allowed: ['ウォーキング→ジョグ→ランの段階プログラム'],
        avoid: ['距離・頻度の急増', '疼痛を無視した継続'],
        criteria: ['疼痛なく各段階を2週間程度維持', '危険因子の是正'],
      },
    ],
    returnCriteria: [
      { text: '画像・症状に基づく医師の許可を前提に、疼痛なく段階的走行負荷に耐えること、REDs等の背景要因が管理されていることを確認する。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '早期発見・適切な管理で復帰可能な例が多いが、見逃し・転位例は重大な後遺障害につながりうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS', target: '疼痛強度（荷重時）', range: '0-10' },
      { name: 'HAGOS', target: '股関節・鼠径部機能', range: '各0-100' },
    ],
    patientExplanation: {
      whatIs: '走り込みなどの繰り返しの負担で、太ももの付け根の骨に「ひび」が入りかけている／入っている状態です。ここの骨折は放っておくと大きな手術が必要になることがあるため、慎重な対応が必要です。',
      dos: ['医師の指示どおりに体重のかけ方を守りましょう', '食事・月経の状態も回復の大切な要素です。気になることは相談してください'],
      donts: ['「走れそうだから」と自己判断で練習再開すること', '痛み止めでごまかして走ること'],
      seekCare: ['痛みが急に強くなった・脚に体重をかけられない（すぐに受診）'],
      goal: '骨がしっかり治ってから、段階的に走りを取り戻します。焦らないことが一番の近道です。',
    },
    motionCapture: [
      { movement: '復帰期のランニングフォーム', purpose: '負荷集中要因の評価（許可後）', setup: '側面＋後方。トレッドミル可。', watchFor: ['過度なストライド', '接地パターン', '骨盤動揺'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 弾発股
  {
    id: 'snapping-hip',
    category: 'hip',
    names: {
      ja: '弾発股',
      en: 'Snapping Hip Syndrome (Coxa Saltans)',
      abbreviations: [],
      synonyms: ['ばね股', 'snapping hip', 'coxa saltans'],
      note: '外側型（腸脛靭帯）・内側型（腸腰筋）・関節内型に分類され、対応が異なる。',
    },
    keywords: ['弾発', 'ばね', 'ポキポキ', '股関節の音', '腸脛靭帯', '腸腰筋', 'ダンサー'],
    overview: [
      { text: '股関節運動時に腱・靭帯が骨隆起を乗り越える際の弾発現象。無痛性なら治療対象としないことが多く、疼痛を伴う場合に介入を検討する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '外側型: 腸脛靭帯/大殿筋前縁が大転子を乗り越える。内側型: 腸腰筋腱が腸恥隆起等を乗り越える。関節内型: 唇損傷・遊離体等（別病態として評価）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: 'ダンサー・可動域要求の高い競技者に多い。無症候の弾発は一般にも多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '反復動作による腱の滑走部での摩擦・肥厚、筋タイトネス・骨形態・骨盤制御不良が関与。', certainty: 'low', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '特定動作での弾発音・弾発感（外側は側方、内側は鼠径部深部）。疼痛・滑液包炎を伴うと症候性。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '弾発の部位（外側/鼠径部）と誘発動作', '疼痛の有無（音だけか）', '競技・練習量',
      '自分で再現できるか', '関節内症状（引っかかり・ロッキング様）の有無',
    ],
    physicalExam: [
      { text: '弾発の再現（外側: 屈伸＋内外転、内側: 屈曲外転外旋→伸展）。触診での腱移動の確認。滑液包部圧痛。', status: 'needs_pro_review' },
      { text: '腸腰筋・腸脛靭帯周囲のタイトネス、骨盤制御・殿筋機能の評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '弾発再現テスト',
        target: '弾発の型判定',
        method: '外側型: 側臥位で屈伸に内外転を加える。内側型: FABER位から伸展内転へ。',
        positive: '弾発の再現（触知・可聴）',
        caution: '関節内症状（ロッキング等）を伴う場合は関節内病変として別途評価。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '大転子部痛症候群', distinguishing: '弾発を伴わない外側部痛・圧痛。併存もある。' },
      { group: 'likely', name: '股関節唇損傷（関節内型）', distinguishing: '深部の引っかかり・FADIR陽性。' },
      { group: 'similar', name: '恥骨・内転筋関連鼠径部痛', distinguishing: '弾発がなく抵抗テストで再現。' },
    ],
    redFlags: [
      { finding: '外傷後の弾発＋激痛・荷重困難', action: '骨傷等の除外。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '診断は基本的に臨床所見による。超音波で動的に腱の弾発を確認できることがある（検者依存）。関節内型疑いはMRI等（医師判断）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '外側型／内側型／関節内型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '負荷調整＋該当筋のタイトネス改善（腸腰筋・腸脛靭帯周囲・大殿筋）＋骨盤制御と殿筋強化。多くは保存療法で症状管理可能とされる。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '無痛性の弾発は「治すべき異常」ではないことを説明し、不必要な不安・過治療を避ける。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '難治性の症候例で腱延長等が検討されることがある（まれ・医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '症状管理・柔軟性/制御改善期',
        period: '目安: 4〜8週',
        goals: ['疼痛を伴う弾発の減少', '該当筋の柔軟性・骨盤制御の改善'],
        allowed: ['ストレッチ・筋膜リリース系アプローチ', '殿筋・体幹強化', '動作修正'],
        avoid: ['弾発を故意に繰り返す癖', '疼痛下での反復練習継続'],
        criteria: ['疼痛の消失（弾発音の完全消失は目標にしない）'],
      },
    ],
    returnCriteria: [
      { text: '疼痛なく競技動作を反復できること。音の残存のみでは制限しない。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法で良好な経過が多い。音自体は残存することが多いことをあらかじめ共有する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    outcomes: [
      { name: 'HAGOS', target: '股関節・鼠径部機能', range: '各0-100' },
      { name: 'NRS', target: '疼痛強度（弾発時）', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '股関節を動かしたときに、筋のスジ（腱）が骨の出っ張りを乗り越えて「ポキッ」と鳴る状態です。音だけなら心配のないことが多く、痛みを伴う場合にケアが必要です。',
      dos: ['股関節まわりのストレッチとお尻の筋トレを続けましょう'],
      donts: ['わざと鳴らす癖', '痛いのに同じ練習を繰り返すこと'],
      seekCare: ['痛みが強くなる・引っかかって動かなくなる感じがある'],
      goal: '音を完全に消すことではなく、「痛みなく動ける」ことが目標です。',
    },
    motionCapture: [
      { movement: '弾発誘発動作', purpose: '弾発発生タイミングとフォームの評価', setup: '該当動作が映る方向から。', watchFor: ['弾発時の骨盤位置', '代償動作'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 腸腰筋関連疼痛
  {
    id: 'iliopsoas-related-pain',
    category: 'hip',
    names: {
      ja: '腸腰筋関連疼痛',
      en: 'Iliopsoas-related Groin Pain',
      abbreviations: [],
      synonyms: ['腸腰筋炎', '腸腰筋滑液包炎', 'iliopsoas syndrome'],
      note: 'Doha合意（2015）の鼠径部痛分類における一区分。',
    },
    keywords: ['鼠径部', '股関節前面', 'キック', 'もも上げ', '抵抗下屈曲', 'サッカー'],
    overview: [
      { text: '腸腰筋（腱・筋腹・滑液包）に由来する鼠径部〜股関節前面の疼痛。キック・スプリント動作の多い競技で頻度が高い。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '腸骨筋＋大腰筋が合して小転子に停止。股関節前方で関節包・唇と近接し、関節内病変との鑑別・併存が問題になる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: 'サッカー等キック動作競技の鼠径部痛の一因。単独より他のentity（内転筋関連等）との併存が多いと報告される。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    mechanism: [
      { text: 'キック・加速動作での反復的な遠心性負荷、股関節伸展域での伸張負荷、体幹骨盤制御不良。', certainty: 'low', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '鼠径部前面の疼痛（もも上げ・キック・階段で誘発）。座位からの立ち上がりでの違和感。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '誘発動作（キック・ダッシュ・もも上げ）', '練習量の変化', '疼痛部位（前面か内側か）',
      '併存症状（内転筋部・恥骨部・下腹部）', '股関節深部症状（クリック等）の有無',
    ],
    physicalExam: [
      { text: 'Doha合意の定義: 腸腰筋の圧痛＋抵抗下股関節屈曲での疼痛再現、または伸張での疼痛。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '内転筋・恥骨・鼠径管related所見の併存評価、関節内病変（FADIR）のスクリーニング。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '抵抗下股関節屈曲テスト',
        target: '腸腰筋related疼痛',
        method: '背臥位・股関節90°または伸展位で屈曲抵抗。',
        positive: '腸腰筋部の疼痛再現',
        caution: '単独で他entityを除外できない。触診・伸張テストと組み合わせる。',
        status: 'needs_pro_review',
      },
      {
        name: 'Thomasテスト位での伸張痛',
        target: '腸腰筋の伸張性・疼痛',
        method: 'Thomasテスト肢位で伸張時痛・タイトネスを評価。',
        positive: '前面の疼痛再現・伸張制限',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '内転筋関連鼠径部痛', distinguishing: '内転筋起始部圧痛・抵抗下内転痛。' },
      { group: 'likely', name: 'FAI・唇損傷', distinguishing: '深部の衝突痛・FADIR陽性。併存に注意。' },
      { group: 'must_not_miss', name: '大腿骨頸部疲労骨折', distinguishing: 'ランナーの進行性疼痛・夜間痛。', urgency: 'early_visit' },
      { group: 'similar', name: '鼠径ヘルニア・鼠径管related', distinguishing: '咳嗽時痛・鼠径管部圧痛。' },
    ],
    redFlags: [
      { finding: '進行性の疼痛＋夜間痛（ランナー）', action: '疲労骨折の除外。荷重制限し受診。', urgency: 'early_visit' },
      { finding: '発熱・体重減少を伴う鼠径部痛', action: '感染・腫瘍・内科疾患の除外は医師判断。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '診断は臨床所見が中心。超音波で腱・滑液包の評価が行われることがある（検者依存）。関節内病変疑いはMRI等（医師判断）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: 'Doha合意では鼠径部痛を内転筋関連・腸腰筋関連・鼠径管関連・恥骨関連・股関節関連に分類する。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    conservative: [
      { text: '負荷管理（キック量等）＋腸腰筋の段階的負荷（等尺性→遠心性）＋体幹骨盤制御・殿筋機能の改善。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '伸張痛が主体の時期に強いストレッチを反復しない。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '手術適応は極めて限定的（難治例の腱延長等・医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷管理・等尺期',
        period: '目安: 0〜3週',
        goals: ['疼痛の鎮静化', '等尺性負荷の耐容'],
        allowed: ['等尺性股関節屈曲（疼痛許容範囲）', '体幹・殿筋トレーニング'],
        avoid: ['全力キック・ダッシュ', '強いストレッチ'],
        criteria: ['日常動作の疼痛消失', '等尺性負荷で疼痛増悪なし'],
      },
      {
        name: '漸増負荷・競技復帰期',
        period: '目安: 3週以降',
        goals: ['遠心性負荷・スプリント/キックの段階的再獲得'],
        allowed: ['漸増的な筋力・スプリントドリル', '段階的キックプログラム'],
        avoid: ['負荷の急増'],
        criteria: ['最大下→最大のキック/スプリントで疼痛なし'],
      },
    ],
    returnCriteria: [
      { text: '全力キック・加速動作を疼痛なく反復でき、翌日の症状再燃がないこと。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '負荷管理と段階的リハビリで良好な経過が多いが、複数entityの併存例では遷延しうる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'HAGOS', target: '股関節・鼠径部機能', range: '各0-100' },
      { name: 'NRS', target: '疼痛強度（キック時）', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '股関節の前を通る「腸腰筋」という、もも上げやキックで働く筋肉に負担がたまって痛みが出ている状態です。',
      dos: ['痛みの範囲内での筋トレから段階的に強くしていきましょう', '体幹・お尻の筋トレはキックの負担を減らします'],
      donts: ['痛みがあるままの全力キック・ダッシュ', '強く伸ばすストレッチのやり過ぎ'],
      seekCare: ['安静にしていても痛む・夜間に痛む', '徐々に痛みが強くなり続ける'],
      goal: 'キックやダッシュを痛みなく全力で行える状態まで、負荷を段階的に戻していきます。',
    },
    motionCapture: [
      { movement: 'キック動作', purpose: '負荷集中要因の評価', setup: '側面＋正面。', watchFor: ['骨盤の代償', '支持脚の安定性', '疼痛出現局面'] },
    ],
    references: [
      {
        authors: 'Weir A, Brukner P, Delahunt E, et al.',
        title: 'Doha agreement meeting on terminology and definitions in groin pain in athletes',
        source: 'Br J Sports Med', year: 2015, verified: false,
        note: '鼠径部痛の分類・定義に関する国際合意。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 大転子部痛症候群
  {
    id: 'gtps',
    category: 'hip',
    names: {
      ja: '大転子部痛症候群',
      en: 'Greater Trochanteric Pain Syndrome',
      abbreviations: ['GTPS'],
      synonyms: ['大転子滑液包炎', '中殿筋腱障害を含む外側股関節痛', 'trochanteric bursitis'],
      note: '従来「滑液包炎」とされたが、主病態は中殿筋・小殿筋腱障害であることが多いと再解釈されている。',
    },
    keywords: ['股関節外側', '側臥位で痛い', '横向きで寝られない', '中高年女性', '階段', '片脚立ち'],
    overview: [
      { text: '大転子部外側の疼痛を主徴とする症候群。主病態は中殿筋・小殿筋腱の腱症（±滑液包の二次変化）と考えられている。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '中高年女性に多く、側臥位（患側を下）での疼痛・夜間痛が特徴的で睡眠を妨げることが多い。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '中殿筋・小殿筋腱の大転子付着部と複数の滑液包。腸脛靭帯による圧迫が内転位で増大する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中高年女性に好発。ランナーにも見られる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '内転位での圧迫負荷（脚組み・患側下側臥位・骨盤落下歩行）と腱への過負荷/低負荷の繰り返しが関与するとされる。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '大転子部の限局痛。側臥位・階段・片脚立位・長時間立位で増悪。大腿外側への放散もある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（外側に限局か）', '側臥位での疼痛・睡眠障害', '階段・片脚立ちでの疼痛',
      '脚を組む癖・立ち方の癖', '活動量の変化', 'ステロイド注射歴',
    ],
    physicalExam: [
      { text: '大転子部の限局圧痛（診断の中心）。片脚立位30秒での疼痛再現、抵抗下外転痛。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '腰椎由来の関連痛・股OAとの鑑別評価を併せて行う。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '片脚立位テスト（30秒）',
        target: '殿筋腱障害',
        method: '患側片脚立位を30秒保持。',
        positive: '大転子部痛の再現',
        caution: '診断精度の報告あり（対象により変動）。圧痛と組み合わせる。',
        status: 'needs_literature', refs: [0],
      },
      {
        name: '抵抗下外転・外旋テスト',
        target: '中殿筋・小殿筋腱',
        method: '側臥位等で外転に抵抗。',
        positive: '外側部の疼痛再現',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: '変形性股関節症', distinguishing: '鼠径部痛・可動域制限が主体。併存も多い。' },
      { group: 'likely', name: '腰椎由来の関連痛（L4-5領域）', distinguishing: '腰部所見・神経症状。' },
      { group: 'must_not_miss', name: '大腿骨近位部の腫瘍・骨折', distinguishing: '夜間進行痛・外傷歴。疑えば医師へ。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '外傷後の急性外側部痛・荷重困難', action: '骨折除外。受診。', urgency: 'early_visit' },
      { finding: '進行性の夜間痛＋全身症状', action: '腫瘍・感染の除外は医師判断。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '診断は臨床所見が中心。超音波・MRIで腱障害・滑液包変化が確認できるが、無症候者にも所見はありうる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '確立した重症度分類はない。腱症の一般的な病期概念（反応性〜変性）が参考にされる。', certainty: 'low', status: 'needs_literature' },
    ],
    conservative: [
      { text: '第一選択: 教育＋負荷管理（圧迫肢位の回避: 脚組み・患側下側臥位・骨盤落下立位）＋漸増的な外転筋強化。教育＋運動が注射より長期成績で優れたとするRCTがある。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '就寝時は膝間に枕を挟む等の工夫。強い圧迫ストレッチ（腸脛靭帯を大転子に押し付ける形）は避ける。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '難治例で腱修復等が検討されることがある（まれ・医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '教育・負荷管理＋等尺期',
        period: '目安: 0〜4週',
        goals: ['圧迫負荷の削減', '疼痛の鎮静化'],
        allowed: ['等尺性外転運動', '姿勢・生活指導の徹底'],
        avoid: ['脚組み・患側下側臥位', '内転位での反復負荷'],
        criteria: ['夜間痛の軽減', '圧痛の軽減'],
      },
      {
        name: '漸増負荷期',
        period: '目安: 4〜12週',
        goals: ['外転筋の漸増的強化', '片脚動作の再獲得'],
        allowed: ['段階的な荷重下外転筋トレーニング', '階段・片脚動作の練習'],
        avoid: ['急激な負荷増加'],
        criteria: ['片脚立位30秒疼痛なし', '階段で疼痛なし'],
      },
    ],
    returnCriteria: [
      { text: '夜間痛の消失、片脚動作・目標活動（歩行距離・ラン等）を疼痛なく行えること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '教育＋運動療法で多くが改善するが、経過は数ヶ月単位になりうることを共有する。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    outcomes: [
      { name: 'VISA-G', target: 'GTPSの重症度', range: '0-100（高いほど良好）' },
      { name: 'NRS', target: '疼痛（夜間・片脚立位）', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '股関節の外側の出っ張り（大転子）につくお尻の筋肉のスジが弱って痛みが出る状態です。「横向きに寝ると痛い」「片脚立ちで痛い」が典型です。',
      dos: ['お尻の横の筋肉を少しずつ鍛える運動を続けましょう', '寝るときは膝の間にクッションを挟むと楽になります'],
      donts: ['脚を組む・痛い側を下にして寝る', '外側をぐいぐい伸ばす強いストレッチ'],
      seekCare: ['夜の痛みがどんどん強くなる', '転倒後に痛みが出た'],
      goal: '外側への「圧迫」を減らしながら筋肉を強くすることで、夜ぐっすり眠れて片脚でしっかり立てる状態を目指します。数ヶ月単位で良くなっていくことが多い症状です。',
    },
    motionCapture: [
      { movement: '歩行・片脚立位', purpose: '骨盤落下・内転位負荷の評価', setup: '正面＋後方。', watchFor: ['骨盤落下', '体幹側方傾斜', '股関節内転位'] },
    ],
    references: [
      {
        authors: 'Mellor R, Bennell K, Grimaldi A, et al.',
        title: 'Education plus exercise versus corticosteroid injection use versus a wait and see approach on global outcome and pain from gluteal tendinopathy (LEAP trial)',
        source: 'BMJ', year: 2018, verified: false,
        note: '教育＋運動療法の有効性を示したRCT。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── 中殿筋・小殿筋腱障害
  {
    id: 'gluteal-tendinopathy',
    category: 'hip',
    names: {
      ja: '中殿筋・小殿筋腱障害',
      en: 'Gluteal Tendinopathy (Gluteus Medius/Minimus)',
      abbreviations: [],
      synonyms: ['殿筋腱症', 'gluteal tendinopathy', '中殿筋腱炎'],
      note: 'GTPSの主要な病態実体。GTPSページと併せて参照。',
    },
    keywords: ['股関節外側', '腱症', '片脚立位', '骨盤落下', '中高年女性', 'ランナー'],
    overview: [
      { text: '中殿筋・小殿筋の大転子付着部腱の変性・障害。外側股関節痛（GTPS）の中心病態と位置づけられる。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '管理の原則は腱症一般と同様: 圧迫・過負荷の管理と漸増的負荷（等尺性→等張性→機能的）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '中殿筋・小殿筋は片脚立位時の骨盤水平保持の主動筋。付着部は内転位で腸脛靭帯からの圧迫を受けやすい。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '中高年女性・閉経後に多い。ランナーの外側股関節痛としても重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '腱への圧縮負荷（内転位）＋引張負荷の複合。急な負荷変化・骨盤制御不良・ホルモン要因が関与するとされる。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '大転子部痛（GTPSと同様）。荷重活動時・夜間側臥位での疼痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛の経過と負荷変化（ランニング量等）', '側臥位・階段・片脚立位での疼痛',
      '閉経状況', '生活習慣（脚組み・立ち方）', '過去の治療（注射等）',
    ],
    physicalExam: [
      { text: '大転子部圧痛＋機能的誘発（片脚立位・抵抗下外転）。骨盤制御（Trendelenburg）の評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '片脚立位30秒・抵抗下外転',
        target: '殿筋腱障害',
        method: 'GTPSページ参照。',
        positive: '外側部痛の再現',
        status: 'needs_literature', refs: [0],
      },
    ],
    differentials: [
      { group: 'likely', name: 'GTPS（滑液包炎優位）', distinguishing: '臨床上の区別は困難で管理は共通。' },
      { group: 'likely', name: '股OA', distinguishing: '鼠径部痛・可動域制限。' },
      { group: 'similar', name: '腰椎由来関連痛', distinguishing: '腰部所見。' },
    ],
    redFlags: [
      { finding: '進行性夜間痛・全身症状', action: '腫瘍等の除外は医師判断。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: '超音波・MRIで腱肥厚・部分断裂等が確認されうるが、所見と症状の対応づけが必要。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    classification: [
      { text: '腱症の連続病期モデル（反応性→修復不全→変性）が参考にされる。部分/完全断裂は別管理（医師評価）。', certainty: 'low', status: 'needs_literature', level: 'pro' },
    ],
    conservative: [
      { text: '教育＋圧迫回避＋漸増負荷プログラム（等尺性外転→荷重下外転→片脚機能訓練）。LEAP試験で教育＋運動の長期有効性が示された。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    surgical: [
      { text: '高度断裂・難治例で腱修復が検討される（医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '等尺・教育期',
        period: '0〜4週',
        goals: ['疼痛管理', '圧迫肢位の排除'],
        allowed: ['等尺性外転', '生活指導'],
        avoid: ['内転位負荷', 'ランニング継続（症状次第）'],
        criteria: ['夜間痛軽減'],
      },
      {
        name: '漸増負荷・機能期',
        period: '4〜12週以降',
        goals: ['腱の負荷耐容性回復', '片脚機能・ラン復帰'],
        allowed: ['漸増荷重トレーニング', '段階的ラン再開'],
        avoid: ['急な負荷増'],
        criteria: ['片脚立位・階段で疼痛なし', 'ラン再開後の再燃なし'],
      },
    ],
    returnCriteria: [
      { text: '目標活動（ラン距離等）を疼痛・翌日再燃なく達成できること。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '運動療法ベースで良好な改善が期待できるが、数ヶ月の時間軸を要する。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    outcomes: [
      { name: 'VISA-G', target: '重症度', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: 'お尻の横の筋肉（中殿筋・小殿筋）のスジが、負担の蓄積で弱っている状態です。骨盤を水平に保つ大事な筋肉なので、歩き・階段・片脚立ちで痛みが出ます。',
      dos: ['「少しずつ強くする」筋トレが治療の中心です。継続しましょう'],
      donts: ['脚組み・患側を下にした横寝・強い外側ストレッチ'],
      seekCare: ['痛みが増え続ける・夜間痛が悪化する'],
      goal: 'スジは急には強くなりません。数ヶ月かけて負荷に耐える力を取り戻し、痛みなく歩き・走れる状態を目指します。',
    },
    motionCapture: [
      { movement: 'ランニング（復帰期）', purpose: '骨盤落下・クロスオーバー接地の評価', setup: '後方から。トレッドミル可。', watchFor: ['骨盤落下', 'クロスオーバー', '体幹側屈'] },
    ],
    references: [
      {
        authors: 'Mellor R, Bennell K, Grimaldi A, et al.',
        title: 'Education plus exercise versus corticosteroid injection use versus a wait and see approach (LEAP trial)',
        source: 'BMJ', year: 2018, verified: false,
        note: '殿筋腱症への教育＋運動療法RCT。',
      },
    ],
    meta: draftMeta(),
  },
]
