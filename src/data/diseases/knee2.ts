// 疾患ページ: 膝カテゴリ 2/3（下書き・医師監修前）
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

export const KNEE_PAGES_2: DiseasePage[] = [
  // ───────────────────────────── 半月板切除術後
  {
    id: 'post-meniscectomy',
    category: 'knee',
    names: {
      ja: '半月板切除術後',
      en: 'Post Partial Meniscectomy',
      abbreviations: [],
      synonyms: ['半月板部分切除術後', 'APM後'],
      note: '縫合術後と進行が大きく異なる（制限が短い）。長期的な軟骨保護の観点から負荷管理・筋力維持が重要。',
    },
    keywords: ['術後', '半月板', '切除', '部分切除', '水腫', '筋力'],
    overview: [
      { text: '損傷半月板の一部を切除した術後のリハビリ。構造的治癒を待つ必要がないため回復は比較的速いが、切除に伴う荷重分散能低下を筋機能で補う視点が長期的に重要。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '術後の水腫再燃は負荷過多のサイン。負荷量の漸増管理が経過を左右する。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '切除量・部位により接触圧の増加程度が異なる。外側切除は外側コンパートメントへの影響が問題となりやすいとされる。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    epidemiology: [
      { text: '変性断裂への切除術は近年適応が慎重化している（保存療法優先の潮流）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '術後問題: 水腫遷延・quad抑制・早期過負荷による症状再燃、長期の関節症性変化。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    symptoms: [
      { text: '（経過中の注意）水腫の反復・裂隙痛の持続は負荷過多または他病変。発熱等はレッドフラッグ参照。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '切除部位・量（術記録）', '執刀医の指示', '術後経過と水腫の変動', '職業・競技の膝負荷',
      '術前からの筋力低下の程度',
    ],
    physicalExam: [
      { text: 'ROM・膝蓋跳動（水腫）・quad機能・歩行。負荷後の水腫反応を経時評価。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '感染・DVT', distinguishing: '術後共通レッドフラッグ。', urgency: 'same_day' },
      { group: 'likely', name: '残存断裂・軟骨病変', distinguishing: '症状の遷延・キャッチング。執刀医評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '発熱・創部異常', action: '執刀医へ即連絡。', urgency: 'same_day' },
      { finding: '下腿腫脹・胸痛', action: 'DVT/PE疑い。緊急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: '術後評価は執刀医による。', status: 'verified' },
    ],
    classification: [
      { text: '該当なし。', status: 'verified' },
    ],
    conservative: [
      { text: '早期: 腫脹管理・ROM・quad活性化・許可範囲の荷重（多くは早期全荷重）。中期: 漸増筋力・有酸素。後期: ラン→競技。水腫をモニタしながら漸増する。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '長期視点: 体重管理・quad/殿筋の筋力維持は関節保護の観点で継続を勧める。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '再手術等は医師判断。', status: 'verified' },
    ],
    rehabPhases: [
      {
        name: '早期回復期',
        period: '目安: 0〜2週',
        goals: ['腫脹管理', 'ROM回復', 'quad活性化'],
        allowed: ['許可範囲の荷重歩行', 'クアッドセット・SLR', 'ROM運動'],
        avoid: ['水腫を増やす過負荷', '深屈曲位負荷の急な導入'],
        criteria: ['水腫軽減', '歩行時痛なし', '伸展0°'],
      },
      {
        name: '筋力回復期',
        period: '目安: 2〜6週',
        goals: ['筋力回復', '階段・しゃがみ動作'],
        allowed: ['漸増CKC・エルゴメーター'],
        avoid: ['負荷後の水腫を無視した増量'],
        criteria: ['階段昇降で疼痛なし', '水腫再燃なし'],
      },
      {
        name: '復帰期',
        period: '目安: 4〜8週（個人差大）',
        goals: ['ラン→競技復帰'],
        allowed: ['段階的ラン・アジリティ'],
        avoid: ['基準未達での復帰'],
        criteria: ['筋力・ホップ基準', '負荷後24時間の症状なし'],
        mdCheck: '競技復帰の許可',
      },
    ],
    returnCriteria: [
      { text: '水腫なく競技負荷に耐えること・筋力/ホップ基準・負荷後の再燃なし。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '短期的な症状改善は良好なことが多いが、切除量に応じた長期の関節症リスクが指摘される。筋力・体重管理の継続が推奨される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KOOS', target: '膝機能・QOL', range: '各0-100' },
    ],
    patientExplanation: {
      whatIs: '傷んだ半月板の一部を取り除いた手術のあとの回復期間です。回復は比較的早めですが、クッションが少し減ったぶん、筋肉で膝を守る意識が長期的に大切です。',
      dos: ['太もも・お尻の筋トレを習慣にしましょう（一生ものの膝の保険です）', '腫れが出たら負荷を一段戻しましょう'],
      donts: ['腫れているのに運動量を増やすこと'],
      seekCare: ['発熱・傷の異常', 'ふくらはぎの腫れ', '引っかかりや腫れが続く'],
      goal: '数週間で日常・スポーツへの復帰を目指しつつ、その先の膝を守る筋力づくりまでを目標にします。',
    },
    motionCapture: [
      { movement: 'スクワット・階段', purpose: '荷重対称性の回復評価', setup: '正面＋側面。', watchFor: ['患側回避', '膝内外反'] },
    ],
    references: [],
    protocolTemplateKey: 'meniscus_resection',
    protocolJoint: 'knee',
    meta: draftMeta(),
  },

  // ───────────────────────────── 膝蓋大腿関節痛
  {
    id: 'pfp',
    category: 'knee',
    names: {
      ja: '膝蓋大腿関節痛',
      en: 'Patellofemoral Pain',
      abbreviations: ['PFP', 'PFPS'],
      synonyms: ['膝蓋大腿疼痛症候群', '膝前部痛', 'anterior knee pain', 'ランナー膝（膝蓋大腿）'],
      note: '「軟骨軟化症」の名称は病態を正確に反映しないため国際的には使用が推奨されない。',
    },
    keywords: ['膝前面', '階段下り', 'しゃがみ', '長座位', 'ランニング', '若年女性', 'お皿の痛み'],
    overview: [
      { text: '膝蓋骨周囲〜後面の活動関連痛。ランニング・階段（特に下り）・しゃがみ・長時間座位で増悪する。若年活動者に多い代表的な膝前部痛。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '単一の構造的原因に還元できない多因子性の疼痛で、画像所見との対応は弱い。負荷管理＋運動療法が治療の中心。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: 'PF関節は屈曲角度とともに接触圧が増加する。大腿四頭筋（特に内側広筋）・股関節外転外旋筋・足部アライメントが負荷分布に影響。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '若年〜活動的な成人、女性にやや多い。ランナー・ジャンプ競技・成長期にも多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '負荷急増（走行量・階段・しゃがみ作業）＋近位（股関節筋機能）・局所（quad）・遠位（足部）要因の複合。心理社会的要因も慢性化に関与しうる。', certainty: 'moderate', status: 'needs_literature', refs: [0], level: 'pro' },
    ],
    symptoms: [
      { text: '膝前面のびまん性疼痛（指差しできないことが多い）。階段下り・しゃがみ・長座位（movie sign）・ランで増悪。軽い引っかかり感・ギシギシ感を伴うことも。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（びまん性か限局か）', '誘発動作（下り階段・しゃがみ・座位後）', '負荷履歴（走行量・練習変化）',
      '外傷歴（脱臼歴があれば別評価）', '腫脹の有無（PFPでは通常軽微）', '心理的要因（恐怖回避等）',
    ],
    physicalExam: [
      { text: 'しゃがみ・階段での疼痛再現、片脚スクワットの質（膝外反・骨盤落下）、quad/股関節筋力、足部評価。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '関節水腫・裂隙圧痛・不安定性があれば他診断を再考する。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'しゃがみ込み・階段下降での疼痛再現',
        target: 'PF関節負荷での症状再現',
        method: '機能動作で膝前面痛の再現を確認。',
        positive: '膝前面痛の再現',
        caution: '特異的な単一テストはなく、除外診断＋症状パターンで判断する。',
        status: 'needs_literature', refs: [0],
      },
    ],
    differentials: [
      { group: 'likely', name: '膝蓋腱障害', distinguishing: '膝蓋腱近位の限局圧痛・ジャンプ選手。' },
      { group: 'likely', name: '脂肪体炎（Hoffa）', distinguishing: '膝蓋腱深部の限局痛・伸展端で増悪。' },
      { group: 'must_not_miss', name: '離断性骨軟骨炎（若年）', distinguishing: '限局痛・水腫・引っかかり。画像評価は医師。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '膝蓋骨不安定症', distinguishing: '脱臼・亜脱臼エピソード・apprehension陽性。' },
      { group: 'similar', name: '大腿骨・膝蓋骨の骨性病変', distinguishing: '夜間痛・進行痛は医師評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '著明な水腫・夜間痛・進行性疼痛', action: '他疾患の除外は医師判断。', urgency: 'confirm_md' },
      { finding: '成長期の限局した骨痛・引っかかり', action: 'OCD等の評価。整形外科受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'PFPの診断に画像は必須でない（臨床診断）。画像所見（軟骨変化等）は無症候者にもあり、症状との対応は弱い。非典型例・レッドフラッグで医師が判断。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    classification: [
      { text: '確立した重症度分類はない。疼痛強度・機能制限・負荷耐容で管理を段階づける。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '国際コンセンサス: 運動療法（膝＋股関節の複合強化）が最も推奨される。短期的には足部装具・テーピング等の併用が有効な場合がある。教育（負荷管理・予後理解）を必ず含める。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '負荷管理: 疼痛許容範囲（例: NRS 3以下で翌日に持ち越さない）での活動継続を基本とし、完全休止より漸進的曝露を優先。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: 'PFPに対する手術適応は原則としてない（明確な構造的病変を除く）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・導入期',
        period: '目安: 0〜4週',
        goals: ['疼痛の鎮静化', '負荷管理の習得', '筋トレ導入'],
        allowed: ['疼痛許容範囲のquad/股関節トレーニング', '低負荷有酸素'],
        avoid: ['疼痛を悪化させる負荷の継続（下り走等）'],
        criteria: ['日常動作の疼痛軽減'],
      },
      {
        name: '漸増負荷期',
        period: '目安: 4〜12週',
        goals: ['筋力向上', '段階的なラン・階段負荷'],
        allowed: ['漸増スクワット系・片脚訓練', 'ラン再開プログラム'],
        avoid: ['急な負荷増'],
        criteria: ['片脚スクワットの質改善', 'ラン時痛の管理'],
      },
    ],
    returnCriteria: [
      { text: '目標活動（走行距離・競技）を疼痛許容範囲で達成し、翌日への持ち越しがないこと。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '運動療法で改善が期待できるが、長期に症状が残存する例も少なくないと報告され、教育と負荷管理の継続が重要。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    outcomes: [
      { name: 'AKPS（Kujala）', target: '膝前部痛の機能', range: '0-100（高いほど良好）' },
      { name: 'NRS', target: '疼痛（活動時）', range: '0-10' },
    ],
    patientExplanation: {
      whatIs: '膝のお皿の周りに負担が集まって痛みが出ている状態です。レントゲンで異常が出ないことが多く、「軟骨がすり減ったから治らない」という病気ではありません。',
      dos: ['太ももとお尻の筋トレが一番効果の裏付けがある治療です', '痛みが軽い範囲（目安: 我慢できる程度で翌日に残らない）での運動は続けてOKです'],
      donts: ['痛みを悪化させる負荷をそのまま続けること', '完全に安静にしてしまうこと'],
      seekCare: ['膝に水がたまる・夜間痛・急な悪化', 'お皿が外れる感じがある'],
      goal: '筋力と負荷の調整で、痛みなく走れる・階段を下りられる膝を取り戻します。数ヶ月単位で根気よく取り組む価値のある症状です。',
    },
    motionCapture: [
      { movement: '片脚スクワット・ステップダウン', purpose: '動的膝外反・骨盤制御の評価', setup: '正面から。', watchFor: ['膝内側崩れ', '骨盤落下', '体幹傾斜'] },
      { movement: 'ランニング', purpose: '接地・ケイデンスの評価', setup: '側面＋後方。', watchFor: ['オーバーストライド', 'クロスオーバー', '過度な沈み込み'] },
    ],
    references: [
      {
        authors: 'Collins NJ, Barton CJ, van Middelkoop M, et al.',
        title: '2018 Consensus statement on exercise therapy and physical interventions to treat patellofemoral pain',
        source: 'Br J Sports Med', year: 2018, verified: false,
        note: 'PFPの国際コンセンサス（運動療法推奨）。',
      },
    ],
    protocolTemplateKey: 'pfp',
    protocolJoint: 'knee',
    meta: draftMeta(),
  },

  // ───────────────────────────── 膝蓋骨脱臼
  {
    id: 'patellar-dislocation',
    category: 'knee',
    names: {
      ja: '膝蓋骨脱臼',
      en: 'Patellar Dislocation',
      abbreviations: [],
      synonyms: ['膝蓋骨亜脱臼', '反復性膝蓋骨脱臼', 'patellar instability'],
      note: '初回外傷性脱臼と反復性で方針が異なる。骨軟骨骨折の合併に注意。',
    },
    keywords: ['お皿が外れた', '脱臼', '若年女性', 'apprehension', 'MPFL', '血腫'],
    overview: [
      { text: '膝蓋骨（多くは外側へ）の脱臼。初回は外傷性が多く、内側膝蓋大腿靱帯（MPFL）損傷と関節血腫を伴う。骨軟骨骨折の合併評価が重要。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '再脱臼リスクは年齢・骨形態（滑車形成不全等）で異なり、初回の多くは保存療法が選択されるが方針は医師と個別に決定される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: 'MPFLは外側脱臼への一次制動。滑車溝形態・膝蓋骨高位・TT-TG距離・下肢アライメントが安定性に関与。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '10〜20歳代・女性に多い。初回脱臼後の再脱臼は若年・骨形態要因で高くなると報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '膝軽度屈曲・外反＋大腿内旋（体幹の回旋）での非接触受傷が典型。直達外力もある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '受傷時の脱臼感（自然整復が多い）・急速な腫脹（血腫）・内側の圧痛。慢性期は不安定感・apprehension。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '脱臼の回数（初回か反復か）', '整復の状況（自然整復か）', '受傷機転', '腫脹の程度',
      '家族歴・全身弛緩性', '「外れそう」で避けている動作',
    ],
    physicalExam: [
      { text: '膝蓋跳動（血腫）、内側支帯/MPFL走行部圧痛、apprehension test、Jサイン、quad機能。急性期の無理な外側押し込みは行わない。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Patellar apprehension test',
        target: '膝蓋骨不安定性',
        method: '膝軽度屈曲位で膝蓋骨を外側へ押し、防御反応・不安感をみる。',
        positive: '不安感・防御反応',
        caution: '急性期は疼痛で評価困難。愛護的に。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '骨軟骨骨折（脱臼合併）', distinguishing: '血腫・遊離体症状。画像評価必須（医師）。', urgency: 'early_visit' },
      { group: 'likely', name: 'ACL損傷', distinguishing: '同様に血腫を来す。受傷機転・Lachmanで鑑別。' },
      { group: 'similar', name: 'PFP', distinguishing: '脱臼エピソードなし・びまん性痛。' },
    ],
    redFlags: [
      { finding: '整復されていない脱臼', action: '整復は医療機関で。受診。', urgency: 'emergency' },
      { finding: '受傷後の著明な血腫・ロッキング様症状', action: '骨軟骨骨折評価。早期受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（脱臼骨片・形態評価）・MRI（MPFL・骨軟骨損傷）。撮影・判断は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '初回/反復性、骨形態リスク（滑車形成不全・膝蓋骨高位・TT-TG）による層別が方針に影響（評価は医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '初回（骨軟骨骨折なし）: 短期間の保護→早期からのquad・股関節強化・動作制御訓練。装具の使用は施設方針による。', certainty: 'moderate', status: 'needs_literature' },
      { text: '再発予防: 膝外反制御（着地・切り返し）の動作学習が重要。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '骨軟骨骨折合併・反復性ではMPFL再建±骨性手術が検討される（医師判断）。術後は施設プロトコルに従う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護・鎮静期',
        period: '目安: 0〜3週',
        goals: ['腫脹管理', 'quad活性化', '保護下の荷重'],
        allowed: ['装具/指示下の荷重・ROM', 'クアッドセット'],
        avoid: ['外側への不安定感を誘発する肢位', '深屈曲＋回旋'],
        criteria: ['腫脹軽減', '歩行安定'],
      },
      {
        name: '筋力・制御期',
        period: '目安: 3〜8週',
        goals: ['quad/股関節筋力', '膝外反制御の学習'],
        allowed: ['漸増筋力・バランス訓練'],
        avoid: ['急な切り返し'],
        criteria: ['片脚動作の質改善', '不安感の軽減'],
      },
      {
        name: '復帰期',
        period: '目安: 8週以降（基準ベース）',
        goals: ['ジャンプ・切り返しの再獲得'],
        allowed: ['段階的な競技動作'],
        avoid: ['基準未達での復帰'],
        criteria: ['apprehension陰性化傾向', 'ホップ・切り返しで不安なし'],
      },
    ],
    returnCriteria: [
      { text: '不安感なく競技動作（着地・切り返し）が可能、筋力・動作の質、（術後は）医師許可を組み合わせる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '初回保存後の再脱臼リスクは無視できず、若年・形態要因で高い。再発例は手術検討となることが多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'Kujala / BPII', target: '膝蓋大腿機能・不安定感', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '膝のお皿が外側に外れた（外れかけた）状態です。多くは自然に戻りますが、中の靱帯が傷つき、骨のかけらができることもあるため、初回はしっかり評価が必要です。',
      dos: ['太もも・お尻の筋トレと、膝が内に入らない動き方の練習が再発予防の柱です'],
      donts: ['膝が内に入るしゃがみ方・着地の癖のまま復帰すること'],
      seekCare: ['また外れた・外れそうな感じが強い', '膝に何か挟まる感じ・伸びない'],
      goal: '再発させないこと。筋力と動作を整え、必要なら手術も含めて医師と最適な道を選びます。',
    },
    motionCapture: [
      { movement: '着地・切り返し', purpose: '膝外反・体幹制御の評価', setup: '正面から。', watchFor: ['膝内側崩れ', '体幹回旋の遅れ'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 膝蓋腱障害
  {
    id: 'patellar-tendinopathy',
    category: 'knee',
    names: {
      ja: '膝蓋腱障害',
      en: 'Patellar Tendinopathy',
      abbreviations: [],
      synonyms: ['ジャンパー膝', 'jumper\'s knee', '膝蓋腱炎', '膝蓋靱帯炎'],
      note: '病態は変性主体の「腱症」であり、単純な炎症ではないという理解が管理の前提。',
    },
    keywords: ['膝蓋腱', 'ジャンプ', 'バレーボール', 'バスケットボール', '膝蓋骨下極', '着地'],
    overview: [
      { text: '膝蓋骨下極付着部の膝蓋腱の腱症。ジャンプ・着地の反復負荷で生じ、バレーボール・バスケットボール選手に高頻度。', certainty: 'moderate', status: 'needs_literature' },
      { text: '管理の柱は負荷管理＋漸増的な腱負荷トレーニング（等尺性→重錘遅速→エネルギー蓄積型）。完全安静は推奨されない。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '膝蓋骨下極深層線維が好発部位。伸展機構としてquadの牽引負荷が集中する。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: 'ジャンプ量の多い競技の男性に多いと報告される。シーズン中の負荷急増で悪化。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: 'エネルギー蓄積負荷（ジャンプ着地）の反復と回復不足。足関節背屈制限・着地戦略も負荷に影響。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    symptoms: [
      { text: '膝蓋骨下極の限局痛。ジャンプ・着地・減速で誘発され、ウォームアップで軽減し翌日悪化するパターンが典型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '疼痛部位（下極に限局か）', 'ジャンプ量・練習負荷の履歴', 'ウォームアップ効果の有無',
      '朝のこわばり・翌日痛', 'シーズン状況（試合期か）',
    ],
    physicalExam: [
      { text: '下極の限局圧痛、片脚デクラインスクワットでの疼痛再現（NRSで定量）、quad・カーフ機能、足関節背屈。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '片脚デクラインスクワット',
        target: '膝蓋腱への負荷再現',
        method: '約25°の傾斜台で片脚スクワット。疼痛をNRSで記録。',
        positive: '下極痛の再現',
        caution: '経過モニタリング指標としても用いる。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: 'PFP', distinguishing: 'びまん性の膝前面痛。圧痛の限局性で区別。' },
      { group: 'likely', name: '脂肪体炎', distinguishing: '腱深部・伸展端の痛み。' },
      { group: 'must_not_miss', name: '（成長期）シンディング・ラーセン・ヨハンソン病/オスグッド', distinguishing: '骨端部の圧痛。年齢で判断。' },
      { group: 'must_not_miss', name: '膝蓋腱部分断裂', distinguishing: '急性増悪・機能低下。医師評価。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '急激な断裂様エピソード・伸展不能', action: '腱断裂疑い。受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: '超音波・MRIで腱肥厚・低エコー像等が見られるが、無症候ジャンパーにも所見があり画像だけで重症度を判断しない。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    classification: [
      { text: 'Blazina分類等（疼痛と競技への影響による段階）が参考に用いられる。', certainty: 'low', status: 'needs_literature' },
    ],
    conservative: [
      { text: '負荷管理（ジャンプ量調整。試合期は等尺性で疼痛管理しつつ継続する戦略もある）→重い遅い抵抗運動（HSR）/漸増スクワット→エネルギー蓄積型（ジャンプ）→競技特異負荷の段階プログラム。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '注射・受動的治療単独の長期効果は限定的とされ、運動ベースが原則。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    ],
    surgical: [
      { text: '長期の適切な保存療法に抵抗する例で手術が検討されることがある（医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・等尺期',
        period: '症状に応じて',
        goals: ['疼痛の管理（試合期対応含む）'],
        allowed: ['等尺性quad負荷（スパニッシュスクワット等）'],
        avoid: ['ジャンプ量の無管理な継続'],
        criteria: ['デクラインスクワット痛の軽減'],
      },
      {
        name: '筋力（HSR）期',
        period: '目安: 4〜12週',
        goals: ['腱の負荷耐容性向上・quad筋力'],
        allowed: ['重錘での遅いスクワット系トレーニング'],
        avoid: ['急なプライオ導入'],
        criteria: ['負荷中〜翌日の疼痛が許容範囲'],
      },
      {
        name: 'エネルギー蓄積・復帰期',
        period: '基準達成後',
        goals: ['ジャンプ・着地負荷の再獲得'],
        allowed: ['段階的プライオメトリクス→競技練習'],
        avoid: ['一気のジャンプ量回復'],
        criteria: ['ジャンプ後24時間の疼痛管理', '競技量に段階耐容'],
      },
    ],
    returnCriteria: [
      { text: '競技相当のジャンプ量に対し、疼痛が許容範囲かつ翌日に悪化しないことを段階確認。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '改善には数ヶ月を要することが多く、シーズン要因で長期化しやすい。負荷管理の質が経過を左右する。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'VISA-P', target: '膝蓋腱障害の重症度', range: '0-100（高いほど良好）' },
    ],
    patientExplanation: {
      whatIs: 'ジャンプの繰り返しで、お皿の下の腱が変性して痛む状態（ジャンパー膝）です。「休めば治る」ものではなく、「正しく負荷をかけて強くする」ことが治療になります。',
      dos: ['ゆっくり重い筋トレ（処方します）を続けることが腱を強くする一番の方法です', '痛み日記（ジャンプ量と翌朝の痛み）をつけると調整しやすくなります'],
      donts: ['完全に休んでゼロにすること／痛みを無視して跳び続けること（両極端はどちらも×）'],
      seekCare: ['「ブチッ」という感じの後に力が入らない（すぐ受診）'],
      goal: '腱の強さを取り戻し、必要なジャンプ量を痛みなくこなせる状態へ。数ヶ月単位の計画で確実に進めます。',
    },
    motionCapture: [
      { movement: 'ジャンプ着地・デクラインスクワット', purpose: '着地戦略・負荷集中の評価', setup: '側面＋正面。', watchFor: ['浅い膝屈曲の硬い着地', '足関節背屈不足', '体幹前傾不足'] },
    ],
    references: [
      {
        authors: 'Malliaras P, Cook J, Purdam C, Rio E',
        title: 'Patellar tendinopathy: clinical diagnosis, load management, and advice for challenging case presentations',
        source: 'J Orthop Sports Phys Ther', year: 2015, verified: false,
        note: '負荷管理・段階的リハの臨床指針。',
      },
    ],
    meta: draftMeta(),
  },

  // ───────────────────────────── オスグッド病
  {
    id: 'osgood-schlatter',
    category: 'knee',
    names: {
      ja: 'オスグッド病',
      en: 'Osgood-Schlatter Disease',
      abbreviations: ['OSD'],
      synonyms: ['オスグット', 'オスグッド・シュラッター病', '脛骨粗面骨端症'],
      note: '成長期の骨端症であり、成人の腱障害とは病態・経過が異なる。',
    },
    keywords: ['成長期', '脛骨粗面', '膝下の痛み', 'サッカー', '小中学生', '骨端症', 'ジャンプ'],
    overview: [
      { text: '成長期（おおむね10〜15歳）の脛骨粗面骨端部に生じる牽引性骨端症。quadの反復牽引負荷により、脛骨粗面の疼痛・腫隆を呈する。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '成長終了とともに軽快することが多い自己限定性の疾患だが、症状期間は長引くこともあり、負荷管理による活動継続の支援が中心となる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '脛骨粗面の二次骨化中心（骨端核）は成長期に力学的に脆弱で、膝蓋腱の牽引ストレスを受ける。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '成長スパート期の活動的な児童・生徒に多い（サッカー・バスケ・跳躍系）。両側性も少なくない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '成長期の骨端脆弱性＋ジャンプ・キック・ダッシュの反復牽引。大腿前面の柔軟性低下・負荷急増が背景要因。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '脛骨粗面の限局痛・圧痛・腫隆。ランニング・ジャンプ・キック・正座で増悪、安静で軽快。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '年齢・身長の伸び（成長スパート）', '練習量・所属チーム数（掛け持ち）', '疼痛部位（粗面に限局か）',
      '両側性か', '安静時痛・夜間痛の有無（あれば他疾患考慮）', '本人・保護者の目標と大会予定',
    ],
    physicalExam: [
      { text: '粗面の圧痛・腫隆、quad柔軟性（尻踵距離）、ジャンプ・しゃがみでの疼痛再現、股関節・体幹機能。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'must_not_miss', name: '脛骨粗面裂離骨折', distinguishing: '急な激痛・伸展不能・段差。緊急評価。', urgency: 'early_visit' },
      { group: 'must_not_miss', name: '骨腫瘍（若年）', distinguishing: '夜間痛・安静時痛・非典型部位。医師評価。', urgency: 'confirm_md' },
      { group: 'likely', name: 'シンディング・ラーセン・ヨハンソン病', distinguishing: '膝蓋骨下極側の骨端症。' },
      { group: 'similar', name: '膝蓋腱障害', distinguishing: '骨端線閉鎖後の年代。' },
    ],
    redFlags: [
      { finding: 'ジャンプ着地等での急な激痛・膝伸展不能', action: '裂離骨折疑い。受診。', urgency: 'early_visit' },
      { finding: '夜間痛・安静時痛・局所の熱感増悪', action: '腫瘍・感染の除外は医師判断。', urgency: 'confirm_md' },
    ],
    imaging: [
      { text: 'X線で骨端の不整・分節像等が見られるが、無症候側にも類似所見はありうる。裂離骨折・他疾患の除外目的の撮影判断は医師。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '確立した重症度分類はない。疼痛と活動レベル（プレー可否）で管理を段階づける。', certainty: 'low', status: 'needs_pro_review' },
    ],
    conservative: [
      { text: '負荷管理（練習量・ジャンプ/キック量の調整。完全休止は必須でないことが多い）＋quad柔軟性改善＋股関節・体幹の強化＋着地/キック動作の質改善。アイシングで疼痛管理。', certainty: 'moderate', status: 'needs_pro_review' },
      { text: '本人・保護者・指導者への教育（成長に伴う自己限定性・負荷と症状の関係）が管理の成否を左右する。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '成長終了後の遺残骨片が症状を残す場合に摘出が検討されることがある（まれ・医師判断）。', certainty: 'low', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛管理・負荷調整期',
        period: '症状に応じて',
        goals: ['疼痛の管理（活動は許容範囲で継続）', '柔軟性改善の開始'],
        allowed: ['痛みが許容範囲の練習参加（内容調整）', 'quad/ハムのストレッチ', '股関節・体幹トレーニング'],
        avoid: ['疼痛を悪化させるジャンプ・キックの量', '複数チーム掛け持ちでの負荷過多'],
        criteria: ['プレー中〜翌日の疼痛が許容範囲'],
      },
      {
        name: '段階的復帰・維持期',
        period: '症状の推移に応じて',
        goals: ['通常練習への段階復帰', '再燃予防の習慣化'],
        allowed: ['段階的な練習量回復'],
        avoid: ['成長スパート中の急な負荷増'],
        criteria: ['フル練習で疼痛管理可能'],
      },
    ],
    returnCriteria: [
      { text: '疼痛が許容範囲でプレーでき、翌日に持ち越さないこと。成長期は再燃と軽快を繰り返しうるため、量の調整を継続。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '成長終了とともに多くは軽快する。一部で遺残骨片による症状が残ることがある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'NRS', target: '疼痛（活動時）', range: '0-10' },
      { name: '活動レベル（練習参加度）', target: '機能', range: '記述' },
    ],
    patientExplanation: {
      whatIs: '成長期に、すねの骨の膝側にある「成長中のやわらかい部分」が、太ももの筋肉に引っ張られて痛む状態です。骨が大人になれば多くは自然に落ち着く、成長期特有のものです。',
      dos: ['練習量を「痛みと相談しながら」調整すれば、多くの場合スポーツは続けられます', '太もも前のストレッチとお尻・体幹の筋トレを毎日の習慣に', '痛むときは運動後のアイシングを'],
      donts: ['痛みを隠して全メニューをこなすこと', '「根性」で悪化させること（長引く原因になります）'],
      seekCare: ['ジャンプの瞬間などに「ブチッ」と激痛が走り膝が伸ばせない（すぐ受診）', '夜も痛む・じっとしていても痛む'],
      goal: '成長が落ち着くまで、痛みをコントロールしながら大好きなスポーツを続けられるようにサポートします。',
    },
    motionCapture: [
      { movement: 'ジャンプ着地・キック', purpose: '粗面への負荷集中要因の評価', setup: '側面＋正面。', watchFor: ['硬い着地', '膝主導のフォーム', '股関節の使えていなさ'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 離断性骨軟骨炎
  {
    id: 'knee-ocd',
    category: 'knee',
    names: {
      ja: '離断性骨軟骨炎',
      en: 'Osteochondritis Dissecans (Knee)',
      abbreviations: ['OCD'],
      synonyms: ['膝離断性骨軟骨炎', 'osteochondritis dissecans'],
      note: '成長期（若年型）と成人型で治癒能・方針が異なる。早期発見が予後を左右する。',
    },
    keywords: ['若年', '大腿骨内側顆', '軟骨', '遊離体', 'ロッキング', '運動時痛'],
    overview: [
      { text: '軟骨下骨の血流障害等により骨軟骨片が母床から分離しうる疾患。膝では大腿骨内側顆外側部が好発。進行すると遊離体化し関節障害を残す。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '骨端線閉鎖前の安定病変は保存療法（負荷制限）での治癒が期待できるため、疑い時点での医師紹介・確定診断が重要。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '軟骨下骨の分離が軟骨面に及ぶと不安定化する。病変の安定性が治療方針の鍵。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '10歳代のスポーツ活動者に多い。両側例もある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '反復負荷・血流要因等が想定されるが確定していない。', certainty: 'low', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '初期は漠然とした運動時膝痛。進行で水腫・引っかかり・ロッキング（遊離体）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '年齢・骨成熟度', '疼痛の部位と経過', '水腫・引っかかり・ロッキングの有無',
      '練習量', '画像検査の有無と医師の説明（病期・安定性）',
    ],
    physicalExam: [
      { text: '大腿骨内側顆の圧痛（屈曲位で触知）、水腫、ROM。Wilsonテストは感度が低いとされ参考程度。', certainty: 'low', status: 'needs_literature' },
    ],
    specialTests: [
      {
        name: 'Wilson test',
        target: '内側顆OCD',
        method: '膝屈曲位から内旋位で伸展し疼痛、外旋で軽快をみる。',
        positive: '内旋伸展での疼痛・外旋で軽減',
        caution: '診断精度は低いと報告され、陰性でも除外できない。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: 'PFP・膝蓋腱障害', distinguishing: '前面のびまん性/腱限局痛。OCDは顆部限局＋水腫。' },
      { group: 'must_not_miss', name: '若年性関節疾患・腫瘍', distinguishing: '夜間痛・全身症状。医師評価。', urgency: 'confirm_md' },
      { group: 'similar', name: '半月板損傷', distinguishing: '裂隙圧痛・受傷機転。' },
    ],
    redFlags: [
      { finding: '若年者の持続する運動時膝痛＋水腫', action: 'OCDを疑い整形外科受診（X線/MRI判断は医師）。', urgency: 'early_visit' },
      { finding: 'ロッキング', action: '遊離体の可能性。早期受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線（顆間窩撮影含む）・MRIで病変の部位・安定性を評価（医師）。病期判定が方針を決める。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '安定/不安定病変、骨端線の開存で層別される（画像・鏡視分類は医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '若年・安定病変: 医師の方針に基づく数ヶ月単位の負荷制限（跳躍・走行の停止等）と段階復帰。治癒確認は画像による。制限中の体力・下肢機能維持を支援する。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    surgical: [
      { text: '不安定病変・遊離体・成人型ではドリリング・固定・骨軟骨移植等が検討される（医師判断）。術後は施設プロトコルに従う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '負荷制限期（保存例）',
        period: '医師の指示（数ヶ月単位）',
        goals: ['病変部の保護', '体力・筋力の維持'],
        allowed: ['非荷重〜低衝撃運動（指示範囲）', '上肢・体幹トレーニング'],
        avoid: ['ジャンプ・ランニング等の衝撃負荷', '指示外の競技参加'],
        criteria: ['画像での治癒傾向（医師評価）'],
        mdCheck: '全ての負荷段階変更',
      },
      {
        name: '段階復帰期',
        period: '医師許可後',
        goals: ['衝撃負荷への段階的再適応'],
        allowed: ['ウォーク→ジョグ→ラン→ジャンプの段階導入'],
        avoid: ['段階飛ばし・疼痛/水腫の無視'],
        criteria: ['各段階で症状なし', '最終的に医師の競技許可'],
      },
    ],
    returnCriteria: [
      { text: '画像上の治癒（医師判定）を前提に、段階的衝撃負荷で症状（疼痛・水腫）が出ないことを確認して復帰。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '若年・安定病変は保存治癒が期待できる。不安定・成人型は軟骨障害を残すリスクがあり長期フォローが必要。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'IKDC-SKF / KOOS-Child', target: '膝機能（年齢に応じて）', range: '0-100' },
    ],
    patientExplanation: {
      whatIs: '膝の骨の表面近く（軟骨の下）の一部の血流が悪くなり、骨と軟骨のかけらが剥がれかけてしまう病気です。成長期に見つかれば、運動を一定期間調整することで治る可能性が高くなります。',
      dos: ['医師が決めた「やってよい運動」を守りながら体力を保ちましょう'],
      donts: ['「痛くないから」と勝手にジャンプ・ランニングを再開すること（かけらが剥がれる原因になります）'],
      seekCare: ['膝が引っかかって動かない', '腫れが強くなる'],
      goal: '骨がしっかり治ってから段階的に復帰することで、将来の膝を守ります。治療期間は長く感じるかもしれませんが、若い軟骨を残すための大切な時間です。',
    },
    motionCapture: [
      { movement: '復帰期の着地動作', purpose: '衝撃負荷の質の評価（許可後）', setup: '側面＋正面。', watchFor: ['硬い着地', '患側回避'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
