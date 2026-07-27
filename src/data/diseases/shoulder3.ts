// 疾患ページ: 肩関節カテゴリ 3/3（下書き・医師監修前）
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

export const SHOULDER_PAGES_3: DiseasePage[] = [
  // ───────────────────────────── 鎖骨骨折
  {
    id: 'clavicle-fracture',
    category: 'shoulder',
    names: {
      ja: '鎖骨骨折',
      en: 'Clavicle Fracture',
      abbreviations: [],
      synonyms: ['鎖骨中央1/3骨折', '鎖骨遠位端骨折'],
      note: '中央1/3が大半。保存/手術の選択は転位・短縮・年齢・活動性による（医師判断）。',
    },
    keywords: ['転倒', '自転車', 'コンタクト', '鎖骨', '腕つり', '偽関節'],
    overview: [
      { text: '肩からの転倒・直達外力で生じる高頻度の骨折。中央1/3が大半で、多くは保存療法で癒合するが、高度転位・短縮例では手術が検討される。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '中央1/3は筋牽引で転位しやすい（近位は上方へ）。遠位端骨折は烏口鎖骨靱帯の関与で偽関節リスクが高い型がある。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '若年男性のスポーツ・交通外傷、高齢者の転倒で多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '肩外側からの転倒・直達外力。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '限局痛・腫脹・変形・轢音、患肢の挙上困難（健側手で支える姿勢）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転', '治療方針（保存/手術）と医師の指示（固定期間・可動域）',
      '職業・競技（復帰要求）', '喫煙（癒合への影響）',
    ],
    physicalExam: [
      { text: '（治療方針決定後のリハ評価として）指示範囲のROM・周囲筋機能・姿勢。皮膚の圧迫・神経血管症状の確認。', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '気胸・肋骨骨折合併（高エネルギー）', distinguishing: '呼吸苦・胸痛。救急評価。', urgency: 'emergency' },
      { group: 'must_not_miss', name: '神経血管損傷', distinguishing: 'しびれ・冷感・脈拍差。', urgency: 'emergency' },
      { group: 'likely', name: '肩鎖関節脱臼', distinguishing: 'X線で鑑別（医師）。' },
    ],
    redFlags: [
      { finding: '呼吸苦・皮膚を突き上げる骨片・神経血管症状', action: '緊急評価。', urgency: 'emergency' },
      { finding: '固定中の疼痛増悪・轢音の持続', action: '転位進行・癒合不全評価。医師へ。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'X線で診断・経過評価（医師）。癒合判定に基づき負荷を進める。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '部位（中央/遠位/近位）・転位の程度（医師判定）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '三角巾/クラビクルバンド固定（期間は医師）→肘手指の早期運動→振り子→段階的挙上（癒合に応じて）→筋力・競技復帰。固定中の廃用予防（把握運動等）を丁寧に。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: 'プレート/髄内固定後は早期ROMが許可されることが多い（執刀医プロトコル優先）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '固定・保護期',
        period: '目安: 0〜3週（方針による）',
        goals: ['骨折部の安静', '遠位関節の維持'],
        allowed: ['肘・手指のROM', '把握運動', '振り子（許可後）'],
        avoid: ['患肢での荷重・挙上', '指示外の固定除去'],
        criteria: ['疼痛の軽減・医師の許可'],
        mdCheck: '固定期間・挙上開始時期',
      },
      {
        name: '可動域回復期',
        period: '3〜8週',
        goals: ['段階的挙上ROMの回復'],
        allowed: ['自動介助→自動挙上（角度は指示）', '肩甲骨運動'],
        avoid: ['癒合前の抵抗運動・重量物'],
        criteria: ['癒合の進行（医師）・全可動域接近'],
      },
      {
        name: '筋力・復帰期',
        period: '8週以降',
        goals: ['筋力回復・職業/競技復帰'],
        allowed: ['漸増抵抗運動・接触の段階導入（許可後）'],
        avoid: ['癒合確認前の接触プレー'],
        criteria: ['癒合（医師）・筋力/機能の回復'],
        mdCheck: 'コンタクト復帰の許可',
      },
    ],
    returnCriteria: [
      { text: '骨癒合（医師判定）を前提に、全可動域・筋力・接触耐容の段階確認。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '多くは良好に癒合。短縮・偽関節例で症状が残ることがあり、その際は医師と対応協議。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'DASH / QuickDASH', target: '上肢機能', range: '0-100（低いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '鎖骨が折れた状態です。多くはバンドや三角巾で固定して骨がつくのを待ちますが、ずれが大きい場合は手術になることもあります。',
      dos: ['固定中も肘から先はよく動かしましょう（固まり予防）', '骨のつき具合に合わせて段階的に腕を上げていきます'],
      donts: ['自己判断での固定具の除去・重い物の持ち上げ'],
      seekCare: ['息苦しさ・しびれ・手の色が悪い（すぐ受診）', '固定中に痛みが強くなる'],
      goal: '骨をしっかりつけて、肩の動きと力を取り戻し、仕事・競技へ復帰することが目標です。',
    },
    motionCapture: [
      { movement: '挙上動作（回復期）', purpose: '代償・可動域回復の評価', setup: '正面＋後方。', watchFor: ['肩甲骨代償', '体幹側屈'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 投球障害肩
  {
    id: 'throwing-shoulder',
    category: 'shoulder',
    names: {
      ja: '投球障害肩',
      en: "Thrower's Shoulder",
      abbreviations: [],
      synonyms: ['野球肩', 'リトルリーグショルダー（成長期）', '投球肩障害'],
      note: '単一疾患でなく、成長期の骨端線障害から成人の内インピンジ・SLAP等まで年齢で病態が異なる包括概念。',
    },
    keywords: ['野球', '投球', 'ピッチャー', '球速低下', '成長期', '肘下がり', 'GIRD'],
    overview: [
      { text: '投球動作の反復により生じる肩障害の総称。成長期は上腕骨近位骨端線障害（リトルリーグショルダー）、成人は内インピンジメント・SLAP・腱板関節側損傷などが含まれる。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '共通する管理原則: 投球負荷の管理（球数・登板間隔）＋全身運動連鎖の是正＋段階的投球再開。成長期の骨端線障害は投球中止・医師管理が原則。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '成長期の骨端線は投球の回旋牽引に脆弱。成人ではレイバック期の後上方接触（内インピンジ）・減速期の牽引が病変部位に対応する。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '球数・連投・ポジション（投手/捕手）・年間投球期間が危険因子として繰り返し報告されている。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '局所要因（GIRD・肩甲骨機能不全）＋全身要因（股関節・体幹の連鎖不良・肘下がりフォーム）＋負荷要因（球数・疲労）の複合。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '投球時・投球後の肩痛、球速/制球の低下、違和感。成長期は近位上腕骨部の圧痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '年齢（成長期か）', '疼痛の投球相', '球数・登板頻度・チーム掛け持ち',
      'ポジション・投球フォームの指摘歴', '肘症状の併存', '休止と再発の履歴',
    ],
    physicalExam: [
      { text: '成長期: 近位上腕骨骨端線部の圧痛（あれば投球中止・X線へ）。共通: 肩ROM（total arc・GIRD）、肩甲骨、腱板筋力、下肢・体幹連鎖（片脚バランス・股関節回旋）。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: 'Total arc・GIRD評価',
        target: '投球側の回旋可動域適応/病的変化',
        method: '背臥位90°外転位で内外旋を左右測定。',
        positive: 'total arc減少・内旋の著明な低下',
        caution: '外旋増大は適応変化でもある。左右のtotal arcで解釈。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '上腕骨近位骨端線障害（成長期）', distinguishing: '骨端線部の圧痛。X線評価（医師）と投球中止。', urgency: 'early_visit' },
      { group: 'likely', name: 'SLAP・内インピンジ・腱板関節側損傷（成人）', distinguishing: '各ページ参照。連続体として評価。' },
      { group: 'likely', name: '肩甲上神経障害・Bennett骨棘（まれ）', distinguishing: '棘下筋萎縮等。医師評価。', urgency: 'confirm_md' },
      { group: 'similar', name: '頚椎・胸郭出口由来', distinguishing: 'しびれ・神経所見。' },
    ],
    redFlags: [
      { finding: '成長期投手の肩痛＋骨端線部圧痛', action: '投球を中止しX線評価（医師）へ。骨端線障害は休止で治るが、投げ続けると変形リスク。', urgency: 'early_visit' },
      { finding: '急性の脱力・断裂様エピソード', action: '腱板断裂等の評価。医師へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '成長期はX線（両側比較）で骨端線を評価（医師）。成人はMRIが病変評価に用いられるが無症候所見が多い。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '年齢・病変部位による整理（骨端線/唇/腱板/インピンジ）。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '成長期: 医師管理下の投球中止（多くは数週〜数ヶ月）＋この間の運動連鎖トレーニング→段階的投球再開。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '成人: SLAPページに準じた包括的リハ（後方柔軟性・肩甲骨・腱板・下肢体幹・フォーム）＋インターバルスローイング。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '成人の構造的病変で保存無効例に手術が検討される（医師判断）。成長期はまず保存。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: 'ノースロー・機能是正期',
        period: '病態による（成長期は医師指示）',
        goals: ['疼痛の消失', '可動域・連鎖機能の是正'],
        allowed: ['投球以外の全身トレーニング', '後方ストレッチ・肩甲骨/腱板訓練'],
        avoid: ['「痛くない範囲」での投球継続（成長期は特に）'],
        criteria: ['圧痛・日常痛の消失', '機能指標の改善'],
        mdCheck: '成長期の再開判断（画像含む）',
      },
      {
        name: '段階的投球再開期',
        period: '基準達成後',
        goals: ['距離・強度の段階回復とフォーム定着'],
        allowed: ['インターバルスローイング', 'フォームドリル'],
        avoid: ['球数・強度の急増'],
        criteria: ['各段階で疼痛なし'],
      },
      {
        name: '実戦復帰・予防期',
        period: 'プログラム完遂後',
        goals: ['実戦復帰と再発予防の習慣化'],
        allowed: ['ブルペン→実戦の段階', '球数管理の運用'],
        avoid: ['連投・オフ期ゼロの通年投球'],
        criteria: ['実戦強度で症状なし'],
      },
    ],
    returnCriteria: [
      { text: '（成長期は医師の画像確認を前提に）段階的投球プログラムの無症状完遂＋フォーム・球数管理の定着。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '成長期骨端線障害は適切な休止で予後良好。成人例は病態により幅がある。負荷管理が再発予防の中心。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KJOC score', target: '投球肩肘機能', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '投げすぎや体の使い方の偏りで肩に負担が集中した状態の総称です。成長期は骨の成長線、大人は軟骨やスジと、年齢で傷む場所が違います。',
      dos: ['休んでいる間に、下半身・体幹を含む「投げられる体づくり」をしましょう', '再開は段階プログラムに沿って'],
      donts: ['（特に成長期）痛みを隠して投げ続けること', '球数・連投の無理'],
      seekCare: ['（成長期）投げると肩の付け根が痛い（レントゲン確認を）', '休んでも再開すると必ず痛む'],
      goal: '肩だけでなく全身とスケジュールを整えて、長く投げ続けられる選手になることがゴールです。',
    },
    motionCapture: [
      { movement: '投球動作', purpose: 'フォーム破綻点の評価', setup: '側面＋後方（高速推奨）。', watchFor: ['肘下がり', '体の早期開き', '下肢主導の欠如'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 腱板修復術後
  {
    id: 'post-rotator-cuff-repair',
    category: 'shoulder',
    names: {
      ja: '腱板修復術後',
      en: 'Post Rotator Cuff Repair (ARCR)',
      abbreviations: ['ARCR'],
      synonyms: ['鏡視下腱板修復術後'],
      note: '再断裂予防のための修復部保護と拘縮予防のバランスが核心。進行は断裂サイズ・組織条件により執刀医が設定。',
    },
    keywords: ['術後', '腱板', '装具', '外転枕', '他動から', '再断裂'],
    overview: [
      { text: '鏡視下腱板修復術後のリハビリ。腱骨治癒には時間を要し、初期の過負荷は再断裂リスクとなるため、装具管理と他動→自動→抵抗の段階原則を厳守する。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '進行速度（早期/遅延プロトコル）は断裂サイズ・組織質で執刀医が決定。一律の週数適用をしない。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '修復腱の腱骨治癒は数ヶ月単位。大断裂・変性例は治癒不全リスクが高い。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '中高年の症候性断裂への標準術式として広く実施される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '術後課題: 再断裂（初期過負荷・巨大断裂）、拘縮（過度の固定・疼痛回避）、夜間痛の遷延。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '（経過中の注意）急な疼痛悪化＋脱力の再出現は再断裂評価（執刀医）。発熱・創部異常はレッドフラッグ。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '断裂サイズ・修復法・組織質（術記録）', '執刀医のプロトコル（装具期間・他動/自動開始時期）',
      '術後週数', '夜間痛・装具管理状況', '職業（復帰要求・重量作業か）',
    ],
    physicalExam: [
      { text: '指示された時期・範囲でのみ評価（早期の自動挙上・抵抗テストは行わない）。他動ROM・肩甲骨状態・遠位機能。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '感染', distinguishing: '発熱・創部異常・疼痛増悪。', urgency: 'same_day' },
      { group: 'must_not_miss', name: '再断裂', distinguishing: '急な脱力・挙上不能の再出現。執刀医へ。', urgency: 'early_visit' },
      { group: 'likely', name: '術後拘縮', distinguishing: 'ROM回復の停滞。プログラム調整（執刀医と）。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '発熱・創部の発赤/浸出', action: '執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '装具期間中の急な激痛・ポップ感', action: '再断裂疑い。執刀医受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '修復部の評価は執刀医（超音波/MRI）による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし（術式・サイズによりプロトコル選択）。', status: 'verified' },
    ],
    conservative: [
      { text: '一般的な流れ: 装具固定期（振り子・受動ROMは指示範囲）→他動→自動介助→自動挙上→（数ヶ月後）漸増抵抗。日常使用の指導（装具下でできること/いけないこと）が拘縮・再断裂予防の両面で重要。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '再断裂時の再修復等は執刀医判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '装具・保護期',
        period: '目安: 0〜4〜6週（サイズによる）',
        goals: ['修復部保護', '疼痛・夜間痛の管理', '遠位・肩甲骨の維持'],
        allowed: ['指示範囲の他動ROM・振り子', '肘手指運動', '肩甲骨セッティング'],
        avoid: ['自動挙上・物の把持挙上', '装具の自己判断除去', '結帯方向の強制'],
        criteria: ['執刀医の段階許可'],
        mdCheck: '装具期間・他動範囲',
      },
      {
        name: '可動域回復期',
        period: '目安: 6〜12週',
        goals: ['他動→自動介助→自動ROMの回復'],
        allowed: ['滑車・テーブルスライド→自動挙上の段階'],
        avoid: ['抵抗運動の早期導入', '重量物'],
        criteria: ['自動挙上の獲得・疼痛管理'],
      },
      {
        name: '筋力強化期',
        period: '目安: 3〜6ヶ月',
        goals: ['腱板・肩甲骨筋の漸増強化'],
        allowed: ['チューブ→軽重錘の漸増'],
        avoid: ['急な重量増・反動動作'],
        criteria: ['日常動作の完全化・筋力の漸増'],
        mdCheck: '抵抗運動開始・強度の目安',
      },
      {
        name: '復帰期',
        period: '目安: 6ヶ月以降',
        goals: ['職業・スポーツ動作の再獲得'],
        allowed: ['段階的な重量作業/競技動作（許可後）'],
        avoid: ['基準未達での重量作業・投球'],
        criteria: ['筋力回復・執刀医の許可'],
        mdCheck: '重量作業・スポーツ復帰の許可',
      },
    ],
    returnCriteria: [
      { text: '執刀医の治癒評価を前提に、疼痛なく目標動作が可能で筋力が回復していること。重量作業・オーバーヘッド競技は後期（半年以降が目安）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '疼痛・機能の改善が期待できるが、再断裂率はサイズ依存で無視できない。再断裂しても症状は改善している例もある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'Shoulder36 / DASH', target: '肩・上肢機能', range: '尺度による' },
      { name: 'NRS（夜間）', target: '疼痛', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '肩の切れたスジ（腱板）を縫い付けた手術のあとの回復期間です。縫った腱が骨に生着するには数ヶ月かかるため、初期は「動かさない勇気」、その後は「段階的に動かす根気」が必要です。',
      dos: ['装具の期間・外してよい場面のルールを守りましょう', '指示された他動運動（力を抜いて動かしてもらう）は拘縮予防に大切です'],
      donts: ['装具期間中に腕を自分の力で上げる・物を持つ', '「調子がいいから」と重い物を早く持つこと（再断裂の典型）'],
      seekCare: ['発熱・傷の異常', '「ブチッ」という感覚の後に急に力が入らなくなった'],
      goal: '半年〜1年かけて、夜ぐっすり眠れて腕が上がる肩を取り戻します。長い道のりですが、段階を守ることが一番の近道です。',
    },
    motionCapture: [
      { movement: '挙上動作（自動期以降）', purpose: '代償パターンの評価', setup: '正面＋後方。', watchFor: ['すくめ代償', '体幹側屈', '肩甲骨過剰回旋'] },
    ],
    references: [],
    protocolTemplateKey: 'rotator_cuff_repair',
    protocolJoint: 'shoulder',
    meta: draftMeta(),
  },

  // ───────────────────────────── Bankart修復術後
  {
    id: 'post-bankart-repair',
    category: 'shoulder',
    names: {
      ja: 'Bankart修復術後',
      en: 'Post Bankart Repair',
      abbreviations: [],
      synonyms: ['鏡視下Bankart法術後', '関節唇修復術後（前方）'],
      note: '外旋制限期間の遵守が修復部保護の要。コンタクト復帰時期は執刀医と競技要求で決定。',
    },
    keywords: ['術後', 'Bankart', '脱臼', '外旋制限', 'コンタクト復帰'],
    overview: [
      { text: '前方不安定症に対する鏡視下関節唇修復術後のリハビリ。修復唇の治癒保護（初期の外転外旋制限）と、段階的な筋性安定化・競技復帰が中心。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '修復された前下方唇・関節包は初期の外転外旋端で最も緊張するため、当該域の保護期間が設定される。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '若年不安定症への標準術式。骨欠損例はLatarjet等が選択される（術式により後療法が異なる）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    mechanism: [
      { text: '術後課題: 再脱臼（早期の危険肢位・接触）、外旋可動域の回復遅延、投球選手の外旋要求との両立。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '（経過中の注意）明確な外傷後の不安感再燃・脱臼感は修復部評価（執刀医）。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '術式（アンカー数・併用処置：remplissage等）', '執刀医の装具・外旋制限指示',
      '術後週数', '競技（コンタクト/オーバーヘッド）と復帰目標時期',
    ],
    physicalExam: [
      { text: '指示範囲でROM（外旋は制限期間を厳守）・筋力・肩甲骨機能。apprehension誘発は後期まで行わない。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '感染・神経障害', distinguishing: '術後共通＋腋窩神経確認。', urgency: 'same_day' },
      { group: 'likely', name: '修復部の再損傷', distinguishing: '外傷後の不安感再燃。', urgency: 'early_visit' },
    ],
    redFlags: [
      { finding: '発熱・創部異常', action: '執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '再脱臼・強い不安感の再出現', action: '執刀医受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '術後評価は執刀医による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '一般的な流れ: 装具期（外旋中間位まで等の制限）→段階的ROM（外旋は週数に応じ漸増）→腱板/肩甲骨強化→競技動作→接触・投球の段階復帰。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '再手術（骨性手術への変更等）は執刀医判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜4〜6週',
        goals: ['修復部保護', '遠位・肩甲骨の維持'],
        allowed: ['装具下生活・肘手指運動', '指示範囲のROM（外旋制限内）'],
        avoid: ['外転外旋の複合', '結髪動作の強制'],
        criteria: ['執刀医の段階許可'],
        mdCheck: '外旋許容角度の推移',
      },
      {
        name: '可動域・筋力期',
        period: '6〜12週',
        goals: ['ROMの段階回復', '腱板・肩甲骨筋の強化'],
        allowed: ['外旋の漸増・チューブ訓練'],
        avoid: ['端域の強制ストレッチ'],
        criteria: ['中間域筋力の回復・不安感なし'],
      },
      {
        name: '競技準備期',
        period: '3〜6ヶ月',
        goals: ['競技動作の再獲得'],
        allowed: ['投球プログラム/接触準備ドリル'],
        avoid: ['許可前の実戦接触'],
        criteria: ['競技肢位で不安感なし・筋力基準'],
        mdCheck: 'コンタクト/投球復帰の許可',
      },
    ],
    returnCriteria: [
      { text: '執刀医許可＋筋力/可動域の回復＋競技肢位での不安感消失。コンタクト競技は概ね後期復帰（時期は術式・医師による）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '再脱臼率は年齢・骨欠損・競技で異なる。適応良好例では復帰率が高い報告が多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'WOSI / Rowe', target: '不安定症QOL・安定性', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '外れやすくなった肩の「フチの縁どり（関節唇）」を縫い付けて安定させた手術のあとの回復期間です。縫った組織を守るため、初めは腕を外に捻る動きを制限します。',
      dos: ['装具と「捻ってよい角度」の指示を守りましょう', '段階が進んだら、肩の深部筋と肩甲骨の筋トレをしっかりと'],
      donts: ['早期の「腕を横に開いて外に捻る」動作・つり革を急に掴むような動き'],
      seekCare: ['また外れた/外れそうな感じ・発熱・傷の異常'],
      goal: '「外れない肩」を組織の治癒＋筋肉の両面で完成させ、競技復帰まで段階的に進みます。',
    },
    motionCapture: [
      { movement: '競技動作（準備期）', purpose: '危険肢位の制御評価', setup: '側面＋後方。', watchFor: ['外転外旋端の急激な使用', '肩甲骨の遅れ'] },
    ],
    references: [],
    protocolTemplateKey: 'shoulder_instability',
    protocolJoint: 'shoulder',
    meta: draftMeta(),
  },

  // ───────────────────────────── 人工肩関節置換術後
  {
    id: 'post-shoulder-arthroplasty',
    category: 'shoulder',
    names: {
      ja: '人工肩関節置換術後',
      en: 'Post Shoulder Arthroplasty (TSA/RSA)',
      abbreviations: ['TSA', 'RSA'],
      synonyms: ['人工肩関節全置換術後', 'リバース型人工肩関節術後'],
      note: '解剖学的TSA（肩甲下筋修復の保護が必要）とリバース型RSA（脱臼肢位・力学が異なる）で後療法が根本的に異なる。',
    },
    keywords: ['術後', '人工関節', 'リバース', 'TSA', '高齢者', '腱板断裂性関節症'],
    overview: [
      { text: '肩OA・腱板断裂性関節症等への人工肩関節置換術後のリハビリ。TSAかRSAかで保護すべき組織・到達目標・危険肢位が異なるため、術式確認が第一。', certainty: 'moderate', status: 'needs_md_review' },
      { text: 'TSA: 肩甲下筋修復部の保護（外旋・伸展の制限）。RSA: 三角筋駆動の力学再教育と脱臼肢位（伸展内旋内転の複合等・機種による）の回避。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: 'RSAは回転中心を内下方化し三角筋で挙上を駆動する設計。腱板非機能例でも挙上再建が可能だが、内外旋の回復には限界がありうる。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '高齢者を中心に増加傾向。RSAの適応拡大が進む。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '術後課題: TSA=肩甲下筋不全、RSA=脱臼・肩峰疲労骨折・ノッチング（機種による）。共通: 拘縮・過負荷。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    symptoms: [
      { text: '（経過中の注意）急な疼痛と変形感は脱臼評価（RSA）。発熱・創部異常は感染評価。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '術式（TSA/RSA・機種）と執刀医の指示（装具・禁忌肢位・ROM目標）',
      '術前の腱板状態・可動域', '術後週数', '生活環境と目標（更衣・家事・趣味）',
    ],
    physicalExam: [
      { text: '指示範囲のROM・三角筋/残存腱板機能・肩甲骨。TSAでは抵抗下内旋（belly press系）を治癒期まで行わない。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '感染・脱臼・周囲骨折', distinguishing: '急性変化は執刀医へ。', urgency: 'same_day' },
    ],
    redFlags: [
      { finding: '急な激痛・変形・可動不能（RSA）', action: '脱臼疑い。動かさず執刀医/救急へ。', urgency: 'emergency' },
      { finding: '発熱・創部異常', action: '感染疑い。執刀医へ即連絡。', urgency: 'same_day' },
    ],
    imaging: [
      { text: 'インプラント評価は執刀医による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '術後リハ: 装具期の管理→他動→自動介助→自動→軽負荷強化の段階（TSAは外旋制限、RSAは伸展内旋の複合回避等、術式別ルールで）。目標設定は「疼痛のないADL」を軸に現実的に。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '再置換等は執刀医判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜4〜6週',
        goals: ['組織保護（術式別）', '疼痛管理', '遠位機能維持'],
        allowed: ['指示範囲の他動ROM・振り子', '肘手指運動'],
        avoid: ['TSA: 外旋端・抵抗下内旋／RSA: 脱臼肢位・体重支持', '患肢での荷重支持（プッシュアップ様動作）'],
        criteria: ['執刀医の段階許可'],
        mdCheck: '術式別の禁忌肢位・期間',
      },
      {
        name: '可動域・自動運動期',
        period: '6〜12週',
        goals: ['自動挙上の獲得', 'ADLの拡大'],
        allowed: ['自動介助→自動挙上・ADL練習'],
        avoid: ['重量物・端域の強制'],
        criteria: ['ADL到達度の改善'],
      },
      {
        name: '機能定着期',
        period: '3ヶ月以降',
        goals: ['軽負荷筋力・生活/趣味への復帰'],
        allowed: ['軽負荷チューブ訓練・趣味活動（許可範囲）'],
        avoid: ['高負荷・衝撃・転倒リスク活動'],
        criteria: ['目標ADL/活動の達成'],
        mdCheck: '活動範囲の上限',
      },
    ],
    returnCriteria: [
      { text: '目標ADL（更衣・整容・家事・軽い趣味）の達成で評価。到達可動域の見込みは術式・術前状態により医師と共有。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '疼痛改善は高い確率で得られる。機能到達は術式・術前腱板/三角筋の状態に依存する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'Shoulder36 / DASH', target: '肩・上肢機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '傷んだ肩関節を人工の関節に置き換えた手術のあとの回復期間です。手術のタイプ（通常型かリバース型か）で、守るべき動きと目指せる動きが違うため、あなたの術式に合わせた計画で進めます。',
      dos: ['「してよい動き・避ける動き」のルールを生活に取り入れましょう', '他動→自分の力、の順番を守って動きを取り戻します'],
      donts: ['腕で体を支える動作（ベッドから腕で押して起きる等）※時期・術式によります', '重い物を早期に持つこと'],
      seekCare: ['急な激痛で腕が動かせない（すぐ連絡）', '発熱・傷の異常'],
      goal: '痛みなく着替え・食事・家事ができる肩を取り戻すことが第一目標です。どこまで挙がるようになるかは手術のタイプによるので、目標は主治医と一緒に設定します。',
    },
    motionCapture: [
      { movement: '挙上・ADL動作', purpose: '到達度と代償の評価', setup: '正面＋側面。', watchFor: ['体幹代償', '危険肢位の混入'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
