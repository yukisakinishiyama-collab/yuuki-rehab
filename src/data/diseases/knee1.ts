// 疾患ページ: 膝カテゴリ 1/3（下書き・医師監修前）
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

export const KNEE_PAGES_1: DiseasePage[] = [
  // ───────────────────────────── ACL再建術後
  {
    id: 'post-aclr',
    category: 'knee',
    names: {
      ja: 'ACL再建術後',
      en: 'Post ACL Reconstruction',
      abbreviations: ['ACLR'],
      synonyms: ['前十字靱帯再建術後', 'ACL再建後'],
      note: '移植腱（ハムストリング腱/BTB/大腿四頭筋腱）・合併処置（半月板縫合等）で進行が異なる。疾患ページ「前十字靱帯損傷」と併読。',
    },
    keywords: ['術後', 'ACL', '再建', '移植腱', '荷重', '伸展制限', '復帰', '再断裂'],
    overview: [
      { text: '自家腱等を用いたACL再建術後のリハビリテーション。移植腱のリモデリング過程を考慮した段階的負荷と、再損傷予防を見据えた機能再建が中心。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '早期の伸展獲得と大腿四頭筋活性化、基準ベースの段階進行、復帰時期を焦らないことが再断裂予防の観点から重視される。', certainty: 'moderate', status: 'needs_literature', refs: [0, 1] },
    ],
    anatomy: [
      { text: '移植腱は術後に壊死→再血行化→リモデリングの過程をたどり、力学的に脆弱な時期が存在するとされる（時期の詳細は研究により幅がある）。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
      { text: '採取部位の問題: ハムストリング腱採取後の屈筋筋力低下、BTB採取後の膝前部痛・膝蓋腱障害に留意。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '若年競技者で再断裂・対側損傷リスクが高いと報告され、9ヶ月未満の早期復帰はリスク増加と関連するとの報告がある。', certainty: 'moderate', status: 'needs_literature', refs: [1] },
    ],
    mechanism: [
      { text: '術後合併症・問題の例: 関節線維症（伸展制限）、膝前部痛、採取部痛、感染、DVT、再断裂。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    symptoms: [
      { text: '（経過中の注意）急な腫脹・発熱・安静時痛の増悪、ふくらはぎの腫脹はレッドフラッグ参照。', certainty: 'expert', status: 'verified' },
    ],
    interviewItems: [
      '術式（移植腱の種類）・合併処置（半月板縫合・軟骨処置・LET等）', '執刀医の荷重・ROM・装具指示',
      '術後週数', '伸展・屈曲の自覚的制限', '膝前部痛・採取部痛の有無', '腫脹の変動', '心理的不安（再受傷恐怖）',
    ],
    physicalExam: [
      { text: '膝伸展（健側比較・ラグの有無）・屈曲ROM、膝蓋跳動（腫脹）、大腿四頭筋の随意収縮・周径、歩行の質。', status: 'needs_pro_review' },
      { text: '筋力は時期に応じて等尺→等張→（設備があれば）等速性・HHDで定量。LSIと絶対値の両方を解釈。', status: 'needs_pro_review', level: 'pro' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '術後感染', distinguishing: '発熱・熱感・安静時痛・CRP上昇（採血は医師）。', urgency: 'same_day' },
      { group: 'must_not_miss', name: 'DVT', distinguishing: '下腿腫脹・把握痛。', urgency: 'same_day' },
      { group: 'likely', name: '関節線維症・cyclops病変', distinguishing: '伸展制限の遷延・伸展時の前方詰まり感。医師と対応協議。', urgency: 'confirm_md' },
      { group: 'likely', name: '半月板縫合部トラブル（合併処置例）', distinguishing: '裂隙痛・キャッチング再燃。執刀医へ。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '術後の発熱・創部発赤・安静時痛増悪', action: '感染疑い。リハ中止し執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '下腿腫脹・胸痛・呼吸苦', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
      { finding: '明確な受傷機転を伴う急な不安定感・腫脹（復帰期）', action: '再断裂疑い。執刀医受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '術後評価は執刀医による。復帰期のMRIによる移植腱成熟評価は研究段階で、ルーチンではない。', certainty: 'low', status: 'needs_literature', level: 'research' },
    ],
    classification: [
      { text: '該当なし（術式・医師プロトコルに従う）。', status: 'verified' },
    ],
    conservative: [
      { text: '基準ベースの段階リハビリ: 伸展0°・腫脹管理・quad活性化（初期）→筋力・神経筋制御（中期）→ラン・ジャンプ・アジリティ（後期）→復帰テストバッテリー。詳細は疾患ページ「前十字靱帯損傷」のリハビリ段階を参照。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '合併処置（半月板縫合等）がある場合はそちらの保護が優先され、荷重・屈曲制限が変わる。', certainty: 'expert', status: 'verified' },
    ],
    surgical: [
      { text: '再断裂時の再再建等は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護・活性化期',
        period: '目安: 0〜4週',
        goals: ['伸展0°', '腫脹管理', 'quad随意収縮', '指示範囲の荷重'],
        allowed: ['クアッドセット・SLR（指示による）', 'ヒールスライド', '許可範囲の荷重歩行'],
        avoid: ['指示外の荷重/ROM', '早期の抵抗下OKC伸展', '腫脹を増やす過負荷'],
        criteria: ['伸展0°・屈曲90°以上', '膝蓋跳動軽減', 'quad収縮良好'],
        mdCheck: '荷重・装具・合併処置の制限',
      },
      {
        name: '筋力・歩行正常化期',
        period: '目安: 4〜12週',
        goals: ['正常歩行', 'ROM正常化', '基礎筋力回復'],
        allowed: ['CKC漸増', 'エルゴメーター', 'バランス訓練'],
        avoid: ['ピボット動作', '過度なOKC伸展負荷（時期は医師方針）'],
        criteria: ['跛行なし', 'ROM左右差なし', '片脚立位安定'],
      },
      {
        name: 'ラン・パワー期',
        period: '目安: 3〜6ヶ月',
        goals: ['ジョグ→ラン', 'ジャンプ着地の質', '筋力LSI改善'],
        allowed: ['段階的ラン', 'プライオ導入', '筋力強化継続'],
        avoid: ['基準未達での競技動作'],
        criteria: ['筋力LSI基準（施設値）', '着地の質良好', '腫脹再燃なし'],
        mdCheck: 'ラン・ジャンプ開始許可',
      },
      {
        name: '競技復帰期',
        period: '目安: 6〜9ヶ月以降（時期のみで判断しない）',
        goals: ['競技動作の再獲得', '心理的準備', '再発予防プログラム定着'],
        allowed: ['アジリティ・カッティング', '段階的競技参加'],
        avoid: ['機能・心理基準未達での復帰'],
        criteria: ['ホップLSI・筋力基準', 'ACL-RSI', '執刀医の許可'],
        mdCheck: '最終復帰許可',
      },
    ],
    returnCriteria: [
      { text: '時期（月数）＋筋力/ホップLSI＋動作の質＋心理評価＋医師許可の複合基準。基準達成と復帰時期の遅延が再損傷リスク低下と関連するとの報告がある。', certainty: 'moderate', status: 'needs_literature', refs: [1] },
    ],
    prognosis: [
      { text: '競技復帰率は高い報告が多いが、元のレベルへの復帰・再断裂リスクは年齢・競技・基準達成度で異なる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'IKDC-SKF / KOOS', target: '症状・機能', range: '0-100' },
      { name: 'ACL-RSI', target: '心理的準備', range: '0-100' },
      { name: 'ホップテストLSI', target: '片脚機能', range: '%（健側比）' },
    ],
    patientExplanation: {
      whatIs: '切れた前十字靱帯を、自分の腱を移植して作り直した手術のあとの回復期間です。移植した腱が体に馴染んで強くなるには時間がかかるため、段階を守ることがとても大切です。',
      dos: ['膝を伸ばす練習と太ももの筋トレは、最初の最重要課題です', '各段階の「合格基準」を一緒にクリアしていきましょう'],
      donts: ['「調子がいいから」と段階を飛ばすこと（再断裂の最大リスクです）', '腫れや痛みを無視した練習'],
      seekCare: ['発熱・傷の異常・急な腫れ', 'ふくらはぎの腫れ・胸の苦しさ（すぐ連絡）', 'ガクッと外れた感じがした'],
      goal: '焦らず基準をクリアしながら、再断裂しにくい体を作って競技復帰することがゴールです。多くの場合6〜9ヶ月以上の道のりになりますが、その時間は移植腱を強くするための必要な時間です。',
    },
    motionCapture: [
      { movement: '片脚スクワット・着地（時期に応じて）', purpose: '膝外反・荷重対称性の評価', setup: '正面＋側面。', watchFor: ['膝内側崩れ', '患側回避', '着地の硬さ'] },
      { movement: 'ホップテスト', purpose: '距離LSIと着地の質', setup: '側面＋正面。', watchFor: ['距離左右差', '着地安定性'] },
    ],
    references: [
      {
        authors: 'van Melick N, van Cingel REH, Brooijmans F, et al.',
        title: 'Evidence-based clinical practice update: practice guidelines for anterior cruciate ligament rehabilitation',
        source: 'Br J Sports Med', year: 2016, verified: false,
        note: '基準ベース進行のガイドライン。',
      },
      {
        authors: 'Grindem H, Snyder-Mackler L, Moksnes H, et al.',
        title: 'Simple decision rules can reduce reinjury risk by 84% after ACL reconstruction',
        source: 'Br J Sports Med', year: 2016, verified: false,
        note: '復帰基準・時期と再損傷リスク。',
      },
    ],
    protocolTemplateKey: 'acl_reconstruction',
    protocolJoint: 'knee',
    meta: draftMeta(),
  },

  // ───────────────────────────── ACL修復術後
  {
    id: 'post-acl-repair',
    category: 'knee',
    names: {
      ja: 'ACL修復術後',
      en: 'Post ACL Repair (Primary Repair)',
      abbreviations: [],
      synonyms: ['前十字靱帯修復術後', 'ACL縫合術後'],
      note: '再建術と異なり自分の靱帯を温存縫合する術式。適応・成績の評価が定まりきっていない発展中の領域で、施設ごとのプロトコル差が大きい。',
    },
    keywords: ['術後', 'ACL', '修復', '縫合', '温存'],
    overview: [
      { text: '近位断裂等の限られた適応に対し靱帯を温存縫合（±補強）する術式後のリハビリ。再建術とは治癒過程が異なり、執刀医のプロトコル遵守が特に重要。', certainty: 'low', status: 'needs_md_review' },
      { text: '再建術との比較成績は研究が進行中で、見解が定まっていない。', certainty: 'divided', status: 'needs_literature', level: 'pro' },
    ],
    anatomy: [
      { text: '縫合された靱帯実質の治癒（血行の乏しい環境）が課題。補強（internal brace等）の有無で初期強度の考え方が変わる。', certainty: 'low', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '適応は断裂部位・組織質などで限定される。実施施設は限られる。', certainty: 'low', status: 'needs_md_review' },
    ],
    mechanism: [
      { text: '術後問題は再建術に準じる（伸展制限・quad抑制・再断裂等）。再断裂率の報告は幅が大きい。', certainty: 'low', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '（経過中の注意）再建術後ページのレッドフラッグに準じる。', status: 'verified' },
    ],
    interviewItems: [
      '術式詳細（縫合方法・補強の有無）', '執刀医のプロトコル（再建より保守的な場合がある）',
      '術後週数・現在の制限', '不安定感の有無',
    ],
    physicalExam: [
      { text: 'ROM・腫脹・quad機能・歩行。安定性の徒手検査は執刀医の方針を確認してから（時期尚早の前方ストレスを避ける）。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '感染・DVT', distinguishing: '術後共通のレッドフラッグ。', urgency: 'same_day' },
      { group: 'likely', name: '修復部の治癒不全・再断裂', distinguishing: '不安定感の残存/再燃。執刀医評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '発熱・創部異常・急な腫脹', action: '執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '不安定感の明らかな再燃', action: '修復部破綻の可能性。執刀医受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '治癒評価は執刀医による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '執刀医プロトコルを最優先としつつ、原則は再建術後に準じる（伸展獲得・quad活性化・基準ベース進行）。修復部保護のため初期の前方剪断負荷に一層の注意を払う方針が多い。', certainty: 'low', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '治癒不全時の再建術移行は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護期〜復帰期',
        period: '執刀医プロトコルによる',
        goals: ['再建術後ページの各期に準じる（ただし進行判断は施設プロトコル優先）'],
        allowed: ['指示範囲の運動'],
        avoid: ['プロトコル外の負荷', '早期の前方剪断負荷'],
        criteria: ['執刀医の段階許可＋機能基準'],
        mdCheck: '全段階の進行',
      },
    ],
    returnCriteria: [
      { text: '再建術後と同様の複合基準＋執刀医の許可。エビデンスが発展中のため保守的な判断が妥当。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '適応良好例で良好な報告がある一方、再断裂率が再建より高いとする報告もあり一定しない。', certainty: 'divided', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'IKDC-SKF / KOOS / ACL-RSI', target: '再建術後に準じる', range: '各尺度による' },
    ],
    patientExplanation: {
      whatIs: '切れた前十字靱帯を、取り替えずに縫い合わせて温存した手術のあとの回復期間です。比較的新しい方法のため、担当の先生の計画に沿って慎重に進めます。',
      dos: ['先生の計画表どおりの段階を守りましょう'],
      donts: ['他の人（再建術の人）のペースと比べて焦ること'],
      seekCare: ['ガクッと外れる感じの再発', '発熱・急な腫れ'],
      goal: '縫い合わせた靱帯がしっかり治ることが最優先。基準を一つずつ確認しながら復帰を目指します。',
    },
    motionCapture: [
      { movement: '再建術後ページに準じる', purpose: '荷重対称性・着地の質', setup: '正面＋側面。', watchFor: ['膝外反', '患側回避'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 後十字靱帯損傷
  {
    id: 'pcl-injury',
    category: 'knee',
    names: {
      ja: '後十字靱帯損傷',
      en: 'Posterior Cruciate Ligament Injury',
      abbreviations: ['PCL損傷'],
      synonyms: ['後十字靭帯損傷', 'PCL tear'],
      note: '単独損傷は保存療法で管理されることが多い点がACLと異なる。',
    },
    keywords: ['膝', 'ダッシュボード', '脛骨粗面打撲', '膝過屈曲', '後方落ち込み', 'sag'],
    overview: [
      { text: '脛骨の後方偏位を制動するPCLの損傷。脛骨前面への直達外力（ダッシュボード損傷・転倒時の脛骨粗面打撲）や過屈曲で生じる。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '単独損傷の多くは保存療法（quad強化中心）で管理されるが、複合靱帯損傷は方針が大きく異なるため合併評価が重要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: 'PCLは前外側束・後内側束からなり、屈曲位で後方制動の主役となる。血行はACLより良好で治癒能が比較的期待されるとされる。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '交通外傷・スポーツ（ラグビー・柔道等の膝前面打撲/過屈曲）で発生。ACLより頻度は低い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '屈曲位での脛骨前面後方への直達外力、過屈曲、過伸展（複合損傷に注意）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '受傷時の膝後方痛・腫脹（ACLほど著明でないことも）。慢性期は下り坂・減速時の不安定感、膝前部痛（PF関節負荷増大）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転（脛骨前面打撲・過屈曲・交通外傷）', '腫脹の程度と時期', '不安定感の性状（後方性・減速時）',
      '複合損傷を示唆する高エネルギー外傷か', '膝前部痛の有無（慢性期）',
    ],
    physicalExam: [
      { text: '後方落ち込み（posterior sag）の視診、脛骨粗面の前方段差消失。複合損傷（外側・後外側支持機構）の評価を必ず併施。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: 'Posterior drawer test',
        target: 'PCL',
        method: '膝90°屈曲位で脛骨を後方へ押す。',
        positive: '後方移動量の増大（グレード分類）',
        sensitivity: '比較的高いと報告', specificity: '比較的高いと報告',
        caution: '開始肢位で脛骨が既に後方落ちしていると前方引き出しと誤認しうる（ACLとの鑑別で重要）。',
        status: 'needs_literature',
      },
      {
        name: 'Posterior sag sign / Godfrey test',
        target: 'PCL',
        method: '股・膝90°で下腿を支持し、脛骨の後方落ち込みを観察。',
        positive: '脛骨粗面の後方落ち込み',
        status: 'needs_pro_review',
      },
      {
        name: 'Dial test',
        target: '後外側支持機構（複合損傷評価）',
        method: '腹臥位で膝30°/90°での下腿外旋角を左右比較。',
        positive: '外旋増大（30°のみ=PLC、両方=PLC+PCL示唆）',
        caution: '複合損傷の見逃し防止に重要。判定は医師と共有。',
        status: 'needs_literature', level: 'pro',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '複合靱帯損傷・膝関節脱臼', distinguishing: '高エネルギー・多方向不安定性。血管評価必須。', urgency: 'emergency' },
      { group: 'likely', name: 'ACL損傷', distinguishing: '前方不安定性。sagによる誤認に注意。' },
      { group: 'similar', name: '膝後方の軟部損傷（腓腹筋等）', distinguishing: '安定性は保たれる。' },
    ],
    redFlags: [
      { finding: '高エネルギー外傷・多方向不安定', action: '脱臼・血管損傷評価のため救急対応。', urgency: 'emergency' },
      { finding: '足部の血流・神経障害', action: '直ちに医師へ。', urgency: 'emergency' },
    ],
    imaging: [
      { text: 'X線（裂離骨折・後方落ち込みのストレス撮影は医師判断）、MRIで靱帯・合併損傷評価。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '後方移動量によるGrade I〜III。IIIや複合損傷は手術検討対象となりうる（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '単独Grade I-II（多くのIII単独も）は保存療法が第一選択とされることが多い: 大腿四頭筋強化を中心に、初期はハムストリングスの強い単独収縮（後方剪断）を避ける方針が一般的。', certainty: 'moderate', status: 'needs_literature' },
      { text: '急性期に後方サポート装具（PCLブレース）を用いる施設もある（医師方針）。', certainty: 'low', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '複合損傷・裂離骨折・保存無効例で再建等が検討される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜4週',
        goals: ['腫脹管理', 'quad活性化', '後方剪断の回避'],
        allowed: ['クアッドセット', '伸展位保持・許可範囲ROM', '荷重（指示による）'],
        avoid: ['深屈曲での荷重', 'ハム単独の強い収縮（レッグカール）'],
        criteria: ['腫脹軽減', 'quad収縮良好'],
        mdCheck: '装具・複合損傷の有無',
      },
      {
        name: '筋力回復期',
        period: '目安: 4〜12週',
        goals: ['quad筋力の回復', '正常歩行・基本動作'],
        allowed: ['CKC中心の漸増', 'エルゴメーター'],
        avoid: ['急な減速・下り坂の反復（初期）'],
        criteria: ['ROM正常化', '筋力LSI改善傾向'],
      },
      {
        name: '復帰期',
        period: '目安: 3ヶ月以降（基準ベース）',
        goals: ['ラン→競技動作'],
        allowed: ['段階的ラン・アジリティ'],
        avoid: ['基準未達での復帰'],
        criteria: ['筋力・ホップ基準', '不安定感なし'],
      },
    ],
    returnCriteria: [
      { text: 'quad筋力の回復・減速動作の質・症状（不安定感・PF痛）の管理を基準に段階判断。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '単独損傷の保存療法は良好な機能予後の報告が多いが、長期的にPF関節・内側コンパートメントの負荷増大とOAリスクが指摘される。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    outcomes: [
      { name: 'IKDC-SKF / KOOS', target: '膝機能', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '膝の中で、すねの骨が後ろにずれるのを防ぐ「後十字靱帯」を傷めた状態です。前十字靱帯と違い、多くの場合は手術をせずに太ももの筋トレを柱に治療します。',
      dos: ['太ももの前の筋肉（大腿四頭筋）の強化が治療の主役です'],
      donts: ['初期の深い曲げ込み・裏ももだけを強く使う運動（時期による）'],
      seekCare: ['事故など強い衝撃で受傷し、脚の色やしびれがおかしい（緊急）', '不安定感が悪化する'],
      goal: '筋力でしっかり支えられる膝を作り、競技・生活への復帰を目指します。',
    },
    motionCapture: [
      { movement: '減速・下り動作', purpose: '後方不安定感と代償の評価', setup: '側面から。', watchFor: ['膝折れ感の訴え', 'quad回避パターン'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 内側側副靱帯損傷
  {
    id: 'mcl-injury',
    category: 'knee',
    names: {
      ja: '内側側副靱帯損傷',
      en: 'Medial Collateral Ligament Injury',
      abbreviations: ['MCL損傷'],
      synonyms: ['内側側副靭帯損傷', 'MCL sprain'],
      note: '膝靱帯損傷の中で治癒能が高く、単独例の多くは保存療法が標準。',
    },
    keywords: ['膝内側', '外反', 'タックル', 'スキー', '接触', '圧痛'],
    overview: [
      { text: '膝外反強制で生じる内側支持機構の損傷。血行が良く治癒能が高いため、単独損傷は装具＋早期運動の保存療法が標準的。', certainty: 'moderate', status: 'needs_literature' },
      { text: 'Grade IIIや脛骨側裂離、ACL合併例は方針が異なるため重症度・合併評価が重要。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '浅層MCL・深層MCL・後斜靱帯からなる内側複合体。大腿骨側損傷が多い。深層は内側半月板と連続する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: 'コンタクトスポーツ（ラグビー・柔道）・スキーで頻度が高い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '接触性: 膝外側からのタックル等。非接触性: スキーの外反捻転など。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '内側の限局痛・圧痛、外反ストレスでの疼痛±開大感。Grade IIIでは逆に疼痛が軽いことがある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転（接触/非接触・外反）', '圧痛部位（大腿骨側/関節裂隙/脛骨側）', '腫脹の部位（関節内か内側限局か）',
      '不安定感の有無', '合併症状（ACL: ポップ音・関節血腫、半月板: ロッキング）',
    ],
    physicalExam: [
      { text: 'MCL走行に沿った圧痛の局在、外反ストレステスト（0°・30°）。0°での開大は複合損傷を示唆。', status: 'needs_md_review' },
    ],
    specialTests: [
      {
        name: '外反ストレステスト（30°/0°）',
        target: 'MCL（30°）・複合損傷（0°）',
        method: '膝30°と0°で外反ストレス。開大量と端点を左右比較。',
        positive: '疼痛・開大増加（Grade判定）',
        caution: '0°開大はACL/PCL合併を疑い医師評価へ。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: 'ACL損傷（合併）', distinguishing: '関節血腫・Lachman。外反外旋機序では常に念頭に。' },
      { group: 'likely', name: '内側半月板損傷', distinguishing: '裂隙圧痛・ロッキング。深層MCLと連続するため合併も。' },
      { group: 'must_not_miss', name: '骨端線損傷（成長期）', distinguishing: '成長期の「MCL様」外反痛は骨端線損傷の可能性。X線評価。', urgency: 'early_visit' },
      { group: 'similar', name: '鵞足部痛', distinguishing: 'より遠位前方の圧痛。' },
    ],
    redFlags: [
      { finding: '0°伸展位での著明な開大・多方向不安定', action: '複合靱帯損傷。医師評価へ。', urgency: 'early_visit' },
      { finding: '成長期の外反受傷', action: '骨端線損傷除外のためX線（医師）。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線で裂離・骨端線評価。MRIは重症度・合併評価に有用（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Grade I（圧痛のみ）/II（開大あり端点あり）/III（端点不明瞭）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: 'Grade I-II: 早期運動＋段階的負荷（必要に応じヒンジ付き装具）。Grade III単独も装具下保存で良好とする報告が多い。長期固定は避ける。', certainty: 'moderate', status: 'needs_literature' },
      { text: '内側への外反負荷を管理しつつ、quad/ham・殿筋強化、段階的なラテラル動作再獲得。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '脛骨側剥離（Stener様）・複合損傷等で手術が検討される（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜2週（Gradeによる）',
        goals: ['疼痛・腫脹管理', 'ROM確保', '外反負荷の保護'],
        allowed: ['装具下の荷重・ROM運動', 'quadセット'],
        avoid: ['外反ストレス動作', 'カッティング'],
        criteria: ['歩行時痛の消失', 'ROM改善'],
      },
      {
        name: '筋力・動作期',
        period: '目安: 2〜6週',
        goals: ['筋力回復', '直線ラン再開'],
        allowed: ['漸増筋力トレーニング', '直線ジョグ→ラン'],
        avoid: ['急な切り返し（初期）'],
        criteria: ['外反ストレス痛なし', 'ラン疼痛なし'],
      },
      {
        name: '復帰期',
        period: '目安: 4〜8週（Grade II-IIIは延長）',
        goals: ['ラテラル・接触動作の再獲得'],
        allowed: ['カッティング・競技練習の段階導入'],
        avoid: ['基準未達での接触プレー'],
        criteria: ['ラテラル動作で疼痛・不安感なし'],
      },
    ],
    returnCriteria: [
      { text: '外反ストレスでの疼痛消失、ラテラル/カッティング動作の質、競技動作での不安感なしで判断。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '単独例の予後は良好。複合損傷例は主損傷の方針に従う。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'IKDC-SKF / KOOS', target: '膝機能', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '膝の内側を支える靱帯を、膝が内側に入る力（外反）で傷めた状態です。血行が良い場所なので、多くは手術なしでしっかり治ります。',
      dos: ['装具や許可の範囲で早くから動かすことが、きれいに治るコツです'],
      donts: ['膝が内に入る動き（切り返し等）の早期再開'],
      seekCare: ['膝がグラグラして体重を支えられない', '（成長期のお子さん）強い痛みが続く'],
      goal: '靱帯の治りに合わせて「まっすぐ→横の動き」の順で戻し、完全復帰を目指します。',
    },
    motionCapture: [
      { movement: 'サイドステップ・カッティング（復帰期）', purpose: '外反制御の評価', setup: '正面から。', watchFor: ['膝内側崩れ', '減速時の外反'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 外側側副靱帯損傷
  {
    id: 'lcl-injury',
    category: 'knee',
    names: {
      ja: '外側側副靱帯損傷',
      en: 'Lateral Collateral Ligament Injury',
      abbreviations: ['LCL損傷'],
      synonyms: ['外側側副靭帯損傷', '腓側側副靱帯損傷'],
      note: '単独損傷はまれで、後外側支持機構（PLC）損傷の一部として生じることが多い。腓骨神経障害の合併に注意。',
    },
    keywords: ['膝外側', '内反', 'PLC', '腓骨神経', '下垂足'],
    overview: [
      { text: '膝内反強制で生じる外側支持機構の損傷。単独はまれで、PLC・十字靱帯との複合損傷が多い。腓骨神経障害合併の有無を必ず確認する。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: 'LCL（腓骨頭に停止）は内反制動の一次支持。膝窩筋腱・膝窩腓骨靱帯等とともにPLCを構成し、外旋・内反を制御する。腓骨神経が腓骨頭近傍を走行。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '頻度は膝靱帯損傷の中で低い。高エネルギー外傷・スポーツの内反/過伸展外力で生じる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '内反強制・過伸展・前内側からの直達外力。複合損傷では脱臼相当の外力を念頭に。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '外側の疼痛・圧痛（腓骨頭周囲）、内反不安定感、（複合例で）足背のしびれ・下垂足。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    interviewItems: [
      '受傷機転（内反・過伸展・高エネルギーか）', '外側〜腓骨頭の疼痛', 'しびれ・足の上がりにくさ',
      '不安定感（スラスト）の有無', '他部位損傷',
    ],
    physicalExam: [
      { text: '内反ストレステスト（0°/30°）、腓骨頭圧痛、腓骨神経機能（足背屈・母趾伸展・足背感覚）、歩行での内反スラスト。', status: 'needs_md_review' },
      { text: 'Dial test等でPLC合併を評価（医師と共有）。', status: 'needs_md_review', level: 'pro' },
    ],
    specialTests: [
      {
        name: '内反ストレステスト（30°/0°）',
        target: 'LCL（30°）・複合損傷（0°）',
        method: '膝30°と0°で内反ストレス。',
        positive: '外側の開大・疼痛',
        caution: '0°開大や外旋増大は複合損傷。医師評価へ。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '膝関節脱臼・複合靱帯損傷', distinguishing: '多方向不安定・高エネルギー。血管神経評価必須。', urgency: 'emergency' },
      { group: 'must_not_miss', name: '腓骨神経損傷', distinguishing: '下垂足・足背感覚障害。早期に医師へ。', urgency: 'early_visit' },
      { group: 'likely', name: '腸脛靭帯炎・大腿二頭筋腱障害', distinguishing: '使いすぎ性・外傷歴なし。' },
      { group: 'similar', name: '外側半月板損傷', distinguishing: '裂隙圧痛・キャッチング。' },
    ],
    redFlags: [
      { finding: '下垂足・足背のしびれ', action: '腓骨神経障害。早期に医師評価。', urgency: 'early_visit' },
      { finding: '多方向の不安定性・高エネルギー外傷', action: '脱臼整復後の可能性。血管評価含め救急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: 'X線（裂離・arcuate sign）、MRIで複合損傷評価（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Grade I〜III。III・PLC合併は手術検討対象となることが多い（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: 'Grade I-II単独: 装具下の早期運動＋筋力回復。内反スラスト歩行の是正（殿筋・股関節制御）を含める。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: 'Grade III・PLC複合損傷では修復/再建が検討される（医師判断）。術後は施設プロトコルに従う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜3週',
        goals: ['内反負荷の保護', 'ROM・quad維持'],
        allowed: ['装具下ROM・荷重（指示）', 'quadセット'],
        avoid: ['内反負荷・過伸展'],
        criteria: ['疼痛・腫脹の軽減'],
      },
      {
        name: '筋力・歩行是正期',
        period: '目安: 3〜8週',
        goals: ['筋力回復', 'スラストのない歩行'],
        allowed: ['漸増筋力・股関節制御訓練'],
        avoid: ['切り返し（初期）'],
        criteria: ['スラスト消失', 'ラン開始基準'],
      },
      {
        name: '復帰期',
        period: '基準達成後',
        goals: ['競技動作再獲得'],
        allowed: ['段階的アジリティ'],
        avoid: ['基準未達での接触プレー'],
        criteria: ['内反ストレスで症状なし・動作の質'],
      },
    ],
    returnCriteria: [
      { text: '不安定感なく切り返し・接触動作が可能で、歩行/ランでスラストがないこと。複合例は医師許可を前提。', certainty: 'expert', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '単独軽症例は良好。複合損傷は治療戦略により経過が大きく異なる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'IKDC-SKF', target: '膝機能', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '膝の外側を支える靱帯を、膝が外に開く力で傷めた状態です。外側の損傷は神経が近くを通るため、足のしびれや上がりにくさがないかも確認します。',
      dos: ['許可範囲での運動と、お尻の筋トレで膝のブレを減らしましょう'],
      donts: ['膝が外に開く動き・過伸展の早期再開'],
      seekCare: ['足の甲のしびれ・つま先が上がらない（早めに受診）', '膝が多方向にグラグラする'],
      goal: '靱帯の治りと歩き方の癖の修正を両立し、ブレのない膝で復帰することが目標です。',
    },
    motionCapture: [
      { movement: '歩行・ランニング', purpose: '内反スラストの評価', setup: '正面＋後方。', watchFor: ['立脚期の外側動揺', '体幹代償'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 半月板縫合術後
  {
    id: 'post-meniscus-repair',
    category: 'knee',
    names: {
      ja: '半月板縫合術後',
      en: 'Post Meniscus Repair',
      abbreviations: [],
      synonyms: ['半月板修復術後'],
      note: '切除後と混同しないこと。縫合部治癒のため制限が長く、プロトコルは執刀医指示が最優先。',
    },
    keywords: ['術後', '半月板', '縫合', '荷重制限', '屈曲制限', '深屈曲'],
    overview: [
      { text: '断裂した半月板を温存縫合した術後のリハビリ。縫合部の治癒（血行の乏しい組織）を守るため、荷重・屈曲角度の管理が中心課題となる。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '制限内容（荷重開始時期・屈曲角度・深屈曲解禁）は断裂形態・部位・縫合法で大きく異なる。一般値をそのまま適用しない。', certainty: 'expert', status: 'verified' },
    ],
    anatomy: [
      { text: '辺縁部（血行あり）の縫合は治癒が期待しやすく、内縁側ほど治癒環境が厳しい。root修復・radial tear修復は特に保護的な管理となることが多い。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '温存重視の潮流により縫合術の割合は増加傾向と報告される。', certainty: 'low', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '術後リスク: 深屈曲・荷重下回旋による縫合部への負荷、過度な安静による拘縮・筋萎縮。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    symptoms: [
      { text: '（経過中の注意）裂隙痛の再燃・キャッチング・ロッキングは縫合部トラブルの可能性。執刀医へ。', certainty: 'expert', status: 'needs_md_review' },
    ],
    interviewItems: [
      '断裂形態・部位・縫合法（root修復か等）', 'ACL再建併用の有無', '執刀医の荷重/屈曲角度制限と期間',
      '術後週数', '裂隙部症状の有無',
    ],
    physicalExam: [
      { text: '指示範囲内でROM・腫脹・quad機能・歩行を評価。制限角度を超える他動屈曲や深屈曲テストは行わない。', certainty: 'expert', status: 'needs_md_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '感染・DVT', distinguishing: '術後共通レッドフラッグ。', urgency: 'same_day' },
      { group: 'likely', name: '縫合部治癒不全', distinguishing: '裂隙痛・ロッキング再燃。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '発熱・創部異常・急な腫脹', action: '執刀医へ即連絡。', urgency: 'same_day' },
      { finding: 'ロッキングの再出現', action: '縫合部破綻の可能性。執刀医受診。', urgency: 'early_visit' },
      { finding: '下腿腫脹・胸痛', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: '治癒評価は執刀医による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし（術式による）。', status: 'verified' },
    ],
    conservative: [
      { text: '一般的な流れ: 免荷/部分荷重＋屈曲制限（例: 0-90°）→段階的荷重/角度拡大→深屈曲・捻り解禁は後期→ラン・競技復帰。全て執刀医の設定が優先。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '治癒不全時の再手術・部分切除への変更は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜6週（指示による）',
        goals: ['縫合部保護', '指示範囲のROM', 'quad活性化'],
        allowed: ['指示範囲のROM・荷重', 'クアッドセット・SLR'],
        avoid: ['制限を超える屈曲・荷重', '荷重下の回旋'],
        criteria: ['執刀医の許可'],
        mdCheck: '荷重・角度制限の全変更',
      },
      {
        name: '機能回復期',
        period: '目安: 6〜12週',
        goals: ['全荷重歩行の正常化', '筋力回復'],
        allowed: ['漸増CKC（角度管理下）', 'エルゴメーター'],
        avoid: ['深屈曲位での負荷', 'しゃがみ込み・正座'],
        criteria: ['跛行なし', '腫脹なし', '筋力回復傾向'],
      },
      {
        name: '復帰期',
        period: '目安: 3〜6ヶ月（医師許可後）',
        goals: ['ラン→競技動作', '深屈曲の段階的解禁'],
        allowed: ['段階的ラン・アジリティ', '許可後の深屈曲動作'],
        avoid: ['基準・許可前の捻り/深屈曲競技動作'],
        criteria: ['筋力・ホップ基準', '裂隙症状なし', '執刀医許可'],
        mdCheck: '深屈曲・競技復帰の許可',
      },
    ],
    returnCriteria: [
      { text: '執刀医許可を前提に、裂隙症状なし・筋力/ホップ基準・競技動作（捻り含む）の耐容で判断。切除後より長い時間軸になるのが通常。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '治癒すれば長期的な半月板機能温存が期待できる。治癒率は部位・形態で異なる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KOOS / IKDC-SKF', target: '膝機能', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '傷んだ半月板を切り取らずに縫って残した手術のあとの回復期間です。縫った場所がくっつくのに時間がかかるため、「切除」の人より制限が長いのが正常です。',
      dos: ['体重のかけ方・曲げてよい角度の指示を守りましょう', '許可範囲での筋トレは治りを妨げません。続けましょう'],
      donts: ['指示前の深いしゃがみ込み・正座・ひねり', '他の人（切除術）の回復ペースと比べて焦ること'],
      seekCare: ['膝が引っかかって伸びない', '発熱・急な腫れ', 'ふくらはぎの腫れ（すぐ連絡）'],
      goal: 'クッションを一生ものとして残すための手術です。治癒の時間に投資して、制限解除を一段ずつ進みましょう。',
    },
    motionCapture: [
      { movement: '歩行→スクワット（許可角度内）', purpose: '荷重対称性・回避パターンの評価', setup: '正面＋側面。', watchFor: ['患側回避', '許可角度超過の癖'] },
    ],
    references: [],
    protocolTemplateKey: 'meniscus_repair',
    protocolJoint: 'knee',
    meta: draftMeta(),
  },
]
