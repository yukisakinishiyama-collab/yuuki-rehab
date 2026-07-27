// 疾患ページ: 肩関節カテゴリ 2/3（下書き・医師監修前）
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

export const SHOULDER_PAGES_2: DiseasePage[] = [
  // ───────────────────────────── 反復性肩関節脱臼
  {
    id: 'recurrent-shoulder-dislocation',
    category: 'shoulder',
    names: {
      ja: '反復性肩関節脱臼',
      en: 'Recurrent Shoulder Dislocation',
      abbreviations: [],
      synonyms: ['習慣性肩関節脱臼（俗称）', 'recurrent anterior instability'],
      note: '脱臼を反復する確立した不安定症。反復は骨欠損を進行させるため、手術適応の検討が標準的。',
    },
    keywords: ['脱臼癖', '何度も外れる', '骨欠損', 'Bankart', 'Latarjet', '若年男性'],
    overview: [
      { text: '外傷性初回脱臼後に脱臼・亜脱臼を反復する状態。反復のたびに関節唇・骨の損傷が進行しうるため、活動性の高い例では手術的安定化の検討が標準的。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '「外れても自分で戻せるから大丈夫」という認識が骨欠損進行につながるため、教育が重要。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    anatomy: [
      { text: '反復例では関節窩前下縁の骨欠損・Hill-Sachs損傷の拡大が進み、軟部修復のみでは再発リスクが高くなる（glenoid track評価・医師）。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '初回脱臼が10代であるほど反復率が高いと報告される。コンタクト競技で高リスク。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '軽微な外力（寝返り・着替え等）でも脱臼するようになるのが進行のサイン。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '脱臼/亜脱臼の反復、外転外旋位の恐怖感、脱臼後の疼痛・脱力。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '脱臼回数・頻度・誘因の軽微化', '自己整復の有無', '初回年齢・治療歴',
      '競技・仕事の要求', '手術についての説明歴',
    ],
    physicalExam: [
      { text: '前方不安定症ページに準ずる（apprehension等）。腱板機能・神経評価も併施。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: 'Apprehension / Relocation',
        target: '前方不安定性',
        method: '前方不安定症ページ参照。',
        positive: '不安感の再現',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '多方向性不安定症', distinguishing: '非外傷性・全身弛緩性。方針が異なる。' },
      { group: 'must_not_miss', name: '骨欠損の進行・腱板断裂合併（中高年）', distinguishing: '画像評価（医師）。', urgency: 'confirm_md' },
    ],
    redFlags: [
      { finding: '整復不能・変形の持続', action: '救急受診。', urgency: 'emergency' },
      { finding: '脱臼後のしびれ・脱力の残存', action: '神経損傷評価。医師へ。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'CT（骨欠損定量）・MRI（唇・腱板）が術式選択に重要（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '骨欠損の程度・on-track/off-track評価（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '手術までの期間や手術非希望例での筋性安定化＋危険肢位の管理。反復例での保存単独の再発抑制効果は限定的とされる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '鏡視下Bankart修復（±補強）・骨欠損例はLatarjet等の骨性手術（医師判断）。術後リハは術式別プロトコルに従う。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '術前管理期（該当例）',
        period: '手術待機中',
        goals: ['脱臼機会の最小化', '筋機能の維持'],
        allowed: ['中間域の筋力トレーニング'],
        avoid: ['外転外旋の危険肢位・接触'],
        criteria: ['—'],
        mdCheck: '手術時期の調整',
      },
      {
        name: '術後（Bankart修復例の一般的流れ）',
        period: '執刀医プロトコルによる',
        goals: ['修復部保護→可動域→筋力→競技復帰'],
        allowed: ['固定期→段階的ROM（外旋制限あり）→漸増筋力→競技動作'],
        avoid: ['早期の外転外旋端・接触'],
        criteria: ['各期の執刀医許可＋機能基準'],
        mdCheck: '全段階',
      },
    ],
    returnCriteria: [
      { text: '術後は執刀医の許可を前提に、筋力・可動域・競技肢位での不安感消失で段階復帰（コンタクト復帰は概ね後期）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    prognosis: [
      { text: '適切な術式選択で再発率は低下するが、骨欠損進行例は複雑な手術を要する。放置は関節症リスク。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'WOSI / Rowe', target: '不安定症QOL・安定性', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '肩が何度も外れる状態です。外れるたびに骨や軟部組織の傷が進むため、「戻せるから大丈夫」ではなく、根本的な安定化（多くは手術）を検討する段階です。',
      dos: ['手術も含めた治療方針を早めに専門医と相談しましょう', 'それまでは外れやすい腕の位置を避け、肩まわりの筋トレを続けましょう'],
      donts: ['脱臼を繰り返しながらの競技継続（骨の削れが進みます）'],
      seekCare: ['外れて戻らない（救急）', 'しびれ・力が入らないが残る'],
      goal: '再発の連鎖を断ち、安心して競技・生活に戻れる肩を取り戻すことが目標です。',
    },
    motionCapture: [
      { movement: '競技動作（術後復帰期）', purpose: '危険肢位の制御評価', setup: '側面＋後方。', watchFor: ['外転外旋端の無防備な使用'] },
    ],
    references: [],
    protocolTemplateKey: 'shoulder_instability',
    protocolJoint: 'shoulder',
    meta: draftMeta(),
  },

  // ───────────────────────────── 関節唇損傷
  {
    id: 'glenoid-labrum-tear',
    category: 'shoulder',
    names: {
      ja: '関節唇損傷',
      en: 'Glenoid Labral Tear',
      abbreviations: [],
      synonyms: ['肩関節唇損傷', 'labral tear（shoulder）'],
      note: '部位により病態が異なる（前下方=不安定性関連、上方=SLAP）。無症候の唇変性も多い。',
    },
    keywords: ['関節唇', '肩の深部痛', 'クリック', '不安定感', '投球'],
    overview: [
      { text: '関節窩縁の線維軟骨（関節唇）の損傷。前下方（Bankart系）・上方（SLAP）・後方で臨床像が異なり、それぞれ不安定性・投球障害等と関連する。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '加齢に伴う唇の変性・断裂所見は無症候者にも多く、画像所見のみで症状の原因と断定しない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '関節唇は関節窩を深め安定性に寄与。上方唇には長頭腱が付着し牽引負荷を受ける。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '脱臼後の若年例（前下方）・投球選手（上方〜後上方）に多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '脱臼・亜脱臼、投球の反復牽引/捻転、圧迫外力（転倒手つき）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '深部痛・クリック・引っかかり感・不安定感（部位による）。特異的症状に乏しい。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '脱臼歴・外傷歴', '投球等の反復動作', '症状（深部痛/クリック/不安感）の性状',
      '画像・鏡視所見の説明歴',
    ],
    physicalExam: [
      { text: '不安定性評価（apprehension系）・SLAP誘発テスト・腱板/二頭筋評価を部位仮説に応じて組み合わせる。単一テストの精度は低い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    specialTests: [
      {
        name: "O'Brien test（active compression）",
        target: '上方唇・肩鎖関節',
        method: '前方挙上90°・内転10-15°で内旋位/外旋位の抵抗を比較。',
        positive: '内旋位で深部痛・外旋位で軽減',
        caution: '診断精度の報告は大きくばらつく。組み合わせで判断。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '前方不安定症・SLAP（それぞれのページ）', distinguishing: '部位別病態として整理。' },
      { group: 'likely', name: 'RCRSP・二頭筋長頭腱障害', distinguishing: '併存が多い。' },
      { group: 'similar', name: '肩鎖関節障害', distinguishing: '肩峰端の限局圧痛・水平内転痛。' },
    ],
    redFlags: [
      { finding: '外傷後の著明な不安定・整復不能', action: '救急対応。', urgency: 'emergency' },
    ],
    imaging: [
      { text: 'MR関節造影が唇評価に用いられる（医師判断）。変性所見の解釈は年齢を考慮。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '部位・形態による記載（Bankart・SLAP分類等）。判定は医師/鏡視。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '部位別ページ（前方不安定症・SLAP）の保存療法に準ずる。多くはまず保存療法（肩甲骨・腱板・動作修正）を試みる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '不安定性を伴う例・保存無効例で修復等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '該当病態のページに準拠',
        period: '—',
        goals: ['前方不安定症/SLAPページの段階を適用'],
        allowed: ['同ページ参照'],
        avoid: ['同ページ参照'],
        criteria: ['同ページ参照'],
      },
    ],
    returnCriteria: [
      { text: '該当病態ページの基準に準ずる。', status: 'verified' },
    ],
    prognosis: [
      { text: '部位・併存病変により大きく異なる。', certainty: 'low', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'WOSI / KJOC（投球）', target: '不安定・投球機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '肩の受け皿のフチにある軟骨の縁どり（関節唇）を傷めた状態です。傷む場所によって「外れやすさ」に関わるタイプと「投げる痛み」に関わるタイプがあります。',
      dos: ['タイプに合わせた筋トレ・フォーム調整を行いましょう'],
      donts: ['画像で「唇が切れている」＝即手術と考えること（無症状の人にもよくある所見です）'],
      seekCare: ['肩が外れる・外れそうな感覚', '深部の痛みが長引く'],
      goal: 'あなたの症状のタイプを見極め、まず運動療法で「使える肩」を目指します。',
    },
    motionCapture: [
      { movement: '投球／挙上動作', purpose: '該当病態の動作評価', setup: '側面＋後方。', watchFor: ['部位別ページ参照'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── SLAP損傷
  {
    id: 'slap-lesion',
    category: 'shoulder',
    names: {
      ja: 'SLAP損傷',
      en: 'SLAP Lesion (Superior Labrum Anterior-Posterior)',
      abbreviations: ['SLAP'],
      synonyms: ['上方関節唇損傷'],
      note: '投球選手の上方唇損傷。無症候変性が多く、手術成績も年齢で異なるため保存療法が第一選択となることが多い。',
    },
    keywords: ['投球', '野球', 'デッドアーム', '深部痛', '上方唇', 'バイオメカニクス'],
    overview: [
      { text: '上方関節唇の前後方向の損傷。投球の減速期牽引・肘下がり等の力学破綻と関連し、投球時の深部痛・パフォーマンス低下を呈する。', certainty: 'moderate', status: 'needs_md_review' },
      { text: '上方唇の変性は無症候投球者・中高年に多く、修復術の成績も一定でないため、まず包括的な保存療法（運動連鎖の是正）が推奨される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    anatomy: [
      { text: '上方唇は長頭腱付着と連続し、投球減速期に牽引負荷（peel-back機構は後上方病変で議論）。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: 'オーバーヘッド競技者に多い。加齢とともに無症候変性が増える。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '投球の反復（特に減速期の牽引・レイバック期の捻転）、転倒手つき等の急性外力。GIRD・肩甲骨機能不全・下肢体幹の連鎖不良が背景となる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '投球特定期（コッキング後期〜減速期）の深部痛、クリック、球速低下・制球難（デッドアーム）。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '投球時の疼痛出現期', '球数・登板間隔・シーズン状況', 'GIRDの既往指摘',
      'ポジション・投球フォーム変更歴', '画像所見の説明歴',
    ],
    physicalExam: [
      { text: '肩ROM（外旋増大・内旋減少=GIRD、total arcで評価）、肩甲骨機能、後方タイトネス、SLAP誘発テスト群、運動連鎖（股関節・体幹）評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: "O'Brien / labral tension系テスト",
        target: '上方唇',
        method: '標準手技。',
        positive: '深部痛の再現',
        caution: '単独の診断精度は低い。複数所見＋病歴で判断。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'likely', name: '内インピンジメント・後上方腱板関節側損傷', distinguishing: '投球選手で併存・連続体。' },
      { group: 'likely', name: '二頭筋長頭腱障害', distinguishing: '前面痛主体。' },
      { group: 'must_not_miss', name: '（成長期）上腕骨近位骨端線障害', distinguishing: 'リトルリーグショルダー。年齢で必ず考慮。', urgency: 'early_visit' },
      { group: 'similar', name: '肩鎖関節障害', distinguishing: '限局圧痛部位。' },
    ],
    redFlags: [
      { finding: '成長期投手の近位上腕骨部痛', action: '骨端線障害の除外（X線・医師）。投球中止し受診。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'MR関節造影が評価に用いられるが、無症候所見が多く臨床との統合が必須（医師）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    classification: [
      { text: 'SLAP分類（I〜IV＋拡張）。臨床的意義は限定的とする意見もある（判定は医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '第一選択: 投球負荷の管理＋後方タイトネス改善（スリーパー等）＋肩甲骨・腱板強化＋下肢体幹連鎖とフォームの是正＋段階的投球プログラム。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '保存無効例で修復/腱固定等（年齢・病型で選択・医師判断）。復帰率は術式・競技レベルで幅がある。', certainty: 'moderate', status: 'needs_literature' },
    ],
    rehabPhases: [
      {
        name: '負荷管理・機能是正期',
        period: '目安: 2〜6週',
        goals: ['投球痛の鎮静化', '可動域・肩甲骨機能の是正'],
        allowed: ['ノースロー期間の機能トレーニング', '後方ストレッチ・腱板/肩甲骨強化'],
        avoid: ['痛みを伴う全力投球の継続'],
        criteria: ['日常・基礎トレで疼痛なし', 'ROM左右差の改善'],
      },
      {
        name: '段階的投球再開期',
        period: '基準達成後（数週〜）',
        goals: ['距離・強度の段階的回復'],
        allowed: ['インターバルスローイングプログラム'],
        avoid: ['段階飛ばし・球数超過'],
        criteria: ['各段階で疼痛なし・フォーム維持'],
      },
      {
        name: '実戦復帰期',
        period: 'プログラム完遂後',
        goals: ['実戦強度への復帰・再発予防'],
        allowed: ['ブルペン→打者→実戦の段階'],
        avoid: ['連投・急な球数増'],
        criteria: ['実戦強度で疼痛なし・パフォーマンス回復'],
      },
    ],
    returnCriteria: [
      { text: '段階的投球プログラムを疼痛なく完遂し、球速・制球の回復と翌日の症状がないことを確認。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '保存療法での復帰例は多いが、ハイレベル投手の完全復帰率は術後含め課題が残ると報告される。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'KJOC score', target: '投球肩肘機能', range: '0-100（高いほど良好）' },
    ],
    patientExplanation: {
      whatIs: '肩の受け皿の上側の軟骨の縁どりが、投球の繰り返しで傷んだ状態です。投げ方・体の使い方全体を整えることが治療の中心で、手術は最後の選択肢です。',
      dos: ['肩の後ろの柔軟性・肩甲骨まわり・下半身の使い方をまとめて改善しましょう', '投球再開は段階プログラムに沿って'],
      donts: ['痛みをおしての全力投球・連投'],
      seekCare: ['（成長期）投げると肩の付け根が痛い（骨の成長線のチェックが必要）', '数ヶ月の保存療法でも投げられない'],
      goal: '「痛みなく、以前の球を投げられる」ことがゴールです。肩だけでなく全身の連鎖を整えて到達を目指します。',
    },
    motionCapture: [
      { movement: '投球動作（多段階）', purpose: '運動連鎖・肘下がり等の評価', setup: '側面＋後方（可能なら高速）。', watchFor: ['肘下がり', '体幹の早期開き', '下肢の使えていなさ'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 凍結肩
  {
    id: 'frozen-shoulder',
    category: 'shoulder',
    names: {
      ja: '凍結肩',
      en: 'Frozen Shoulder (Adhesive Capsulitis)',
      abbreviations: [],
      synonyms: ['肩関節周囲炎', '五十肩', '癒着性関節包炎'],
      note: '「五十肩」は俗称で多様な病態を含む。本ページは関節包の炎症・線維化による凍結肩を対象。',
    },
    keywords: ['五十肩', '夜間痛', '他動も動かない', '結帯', '結髪', '糖尿病', '50代'],
    overview: [
      { text: '関節包の炎症と線維化により、疼痛と他動可動域制限（特に外旋）を来す疾患。疼痛期→拘縮期→回復期の経過をとり、自然軽快傾向があるが年単位に及ぶことがある。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '病期に応じた介入（疼痛期は疼痛管理優先・攻めすぎない、拘縮期以降は可動域と機能）が原則。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    anatomy: [
      { text: '腱板疎部・烏口上腕靱帯周囲の炎症・肥厚、関節包容量の減少が特徴とされる。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '40〜60代・女性にやや多い。糖尿病・甲状腺疾患で頻度が高く難治とされる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '明確な誘因なく発症する一次性と、外傷・術後の二次性がある。炎症→線維化の機序は完全には解明されていない。', certainty: 'moderate', status: 'needs_literature' },
    ],
    symptoms: [
      { text: '疼痛期: 増悪する自発痛・夜間痛（睡眠障害）。拘縮期: 疼痛は軽減し他動含む全方向の制限（外旋顕著）。結髪・結帯困難。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '経過（疼痛先行か）・夜間痛の程度', '糖尿病・甲状腺疾患', '誘因（外傷・手術・固定）',
      '現在の病期の推定（痛み主体か硬さ主体か）', '生活での支障（着衣・洗髪）',
    ],
    physicalExam: [
      { text: '自動・他動ROMの両方の制限（他動外旋の制限が鑑別上重要）。カプセルエンドフィール。頚椎・腱板の併存評価。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '他動外旋制限の確認',
        target: '関節包性制限',
        method: '下垂位で他動外旋を左右比較。',
        positive: '著明な他動外旋制限（腱板断裂では保たれやすい）',
        caution: '肩OA・脱臼後拘縮でも制限される。X線（医師）で骨性疾患を除外。',
        status: 'needs_pro_review',
      },
    ],
    differentials: [
      { group: 'likely', name: 'RCRSP・腱板断裂', distinguishing: '他動ROMが比較的保たれる。' },
      { group: 'must_not_miss', name: '変形性肩関節症・脱臼（見逃し）', distinguishing: 'X線で鑑別（医師）。凍結肩診断の前提。', urgency: 'confirm_md' },
      { group: 'must_not_miss', name: '腫瘍・感染（まれ）', distinguishing: '進行性夜間痛・全身症状。', urgency: 'confirm_md' },
      { group: 'similar', name: '石灰沈着性腱板炎', distinguishing: '急性激痛発作・X線所見。' },
    ],
    redFlags: [
      { finding: '発熱・急性の激痛・熱感', action: '感染・結晶性の除外。当日中に医療相談。', urgency: 'same_day' },
      { finding: '外傷後の可動域喪失', action: '脱臼・骨折の除外（X線）。', urgency: 'early_visit' },
    ],
    imaging: [
      { text: 'X線は骨性疾患（OA・脱臼・石灰化）の除外に必要（医師）。凍結肩自体のX線は正常。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: '病期分類（疼痛期/拘縮期/回復期）。一次性/二次性。', certainty: 'moderate', status: 'needs_literature' },
    ],
    conservative: [
      { text: '疼痛期: 疼痛管理（医師の注射等含む）＋耐えられる範囲の穏やかなROM。強いストレッチは症状を悪化させうる。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
      { text: '拘縮期〜回復期: 段階的なストレッチ・モビライゼーション・滑車等の自主運動で可動域と機能を回復。', certainty: 'moderate', status: 'needs_literature', refs: [0] },
    ],
    surgical: [
      { text: '難治例で鏡視下関節包解離・麻酔下授動等（医師判断）。糖尿病例は難治性に留意。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '疼痛期',
        period: '数週〜数ヶ月',
        goals: ['疼痛・睡眠の管理', '悪化させない範囲の運動維持'],
        allowed: ['振り子・穏やかなROM（疼痛許容範囲）', '肩甲骨・遠位の運動'],
        avoid: ['強いストレッチ・痛みをこらえる運動'],
        criteria: ['夜間痛の軽減（拘縮期への移行）'],
        mdCheck: '疼痛管理（注射等）の選択肢',
      },
      {
        name: '拘縮期',
        period: '数ヶ月',
        goals: ['可動域の段階的回復', 'ADLの工夫'],
        allowed: ['段階的ストレッチ・滑車・棒体操', 'モビライゼーション'],
        avoid: ['急激な可動域獲得の強行'],
        criteria: ['ROMの漸進的改善'],
      },
      {
        name: '回復期',
        period: '数ヶ月',
        goals: ['可動域の正常化・筋力回復・生活/趣味への完全復帰'],
        allowed: ['筋力トレーニング・機能的動作訓練'],
        avoid: ['急な高負荷'],
        criteria: ['ADL支障の消失・目標動作の達成'],
      },
    ],
    returnCriteria: [
      { text: '目標ADL/活動（着衣・洗髪・仕事・趣味）の達成度で評価。可動域の完全な対称化にこだわりすぎない。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '多くは1〜3年の経過で改善するが、可動域制限が残る例もある。糖尿病例は遷延しやすい。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'SPADI / Shoulder36', target: '疼痛・機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '肩の関節を包む袋が炎症を起こして硬くなり、痛みと動きの制限が出る状態です。「五十肩」と呼ばれるものの代表で、時間はかかりますが多くの方が良くなっていきます。',
      dos: ['時期に合ったケアが大切です。痛みが強い時期は無理せず、硬さの時期になったらしっかり動かします', '夜の痛みには抱き枕などの姿勢の工夫を'],
      donts: ['痛みの強い時期に我慢して強いストレッチをすること（悪化のもと）'],
      seekCare: ['発熱を伴う・急激に痛みが強くなった', '（糖尿病の方）血糖管理も一緒に相談しましょう'],
      goal: '症状の波を乗りこなしながら、着替え・洗髪・仕事・趣味が不自由なくできる肩まで戻すことが目標です。',
    },
    motionCapture: [
      { movement: '挙上・結髪・結帯動作', purpose: '代償・到達度の経時評価', setup: '正面＋後方。', watchFor: ['体幹側屈代償', '肩甲骨過剰挙上', '到達距離の推移'] },
    ],
    references: [
      {
        authors: 'Kelley MJ, Shaffer MA, Kuhn JE, et al.',
        title: 'Shoulder pain and mobility deficits: adhesive capsulitis - Clinical Practice Guidelines (JOSPT)',
        source: 'J Orthop Sports Phys Ther', year: 2013, verified: false,
        note: 'JOSPT臨床実践ガイドライン。',
      },
    ],
    protocolTemplateKey: 'frozen_shoulder',
    protocolJoint: 'shoulder',
    meta: draftMeta(),
  },

  // ───────────────────────────── 変形性肩関節症
  {
    id: 'shoulder-oa',
    category: 'shoulder',
    names: {
      ja: '変形性肩関節症',
      en: 'Glenohumeral Osteoarthritis',
      abbreviations: ['肩OA'],
      synonyms: ['肩甲上腕関節症'],
      note: '腱板断裂性関節症（CTA）とは区別される（腱板の状態が方針を大きく変える）。',
    },
    keywords: ['肩', '中高年', '可動域制限', '轢音', 'ゴリゴリ', '人工関節'],
    overview: [
      { text: '肩甲上腕関節の軟骨変性を主体とする関節症。荷重関節でないため膝股より頻度は低いが、進行例では疼痛・可動域制限がQOLを大きく損なう。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '関節窩後方の摩耗パターンが多いとされる。腱板の温存状態が治療選択（解剖学的TSA vs リバース型）に直結する。', certainty: 'moderate', status: 'needs_md_review', level: 'pro' },
    ],
    epidemiology: [
      { text: '高齢者・重量作業歴・脱臼/骨折後（二次性）で見られる。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '一次性の変性に加え、外傷後・不安定症術後等の二次性がある。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '深部痛・轢音・可動域制限（外旋・挙上）・夜間痛。進行で結髪結帯等のADL障害。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '経過・外傷/手術歴', 'ADL支障（更衣・洗髪・高所）', '夜間痛', '職業歴',
      '画像・人工関節の説明歴',
    ],
    physicalExam: [
      { text: '自動/他動ROM（外旋制限）・轢音・腱板機能・肩甲骨代償。頚椎除外。', status: 'needs_pro_review' },
    ],
    specialTests: [],
    differentials: [
      { group: 'likely', name: '凍結肩', distinguishing: 'X線で骨変化なし（医師）。' },
      { group: 'likely', name: '腱板断裂性関節症（CTA）', distinguishing: '腱板広範断裂の合併。方針が異なる（医師）。' },
      { group: 'must_not_miss', name: '化膿性関節炎・腫瘍', distinguishing: '急性増悪・全身症状。', urgency: 'same_day' },
    ],
    redFlags: [
      { finding: '急性の熱感・激痛', action: '感染除外。当日中に医療相談。', urgency: 'same_day' },
    ],
    imaging: [
      { text: 'X線（裂隙狭小・骨棘・後方摩耗）。CT/MRIは術前評価（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'X線重症度・関節窩形態分類（医師）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: '可動域維持（疼痛許容範囲）・肩甲骨/腱板機能の最適化・ADL工夫・疼痛管理（医師の注射等）。進行例では過度なストレッチで疼痛が悪化することがあり漸進的に。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    surgical: [
      { text: '保存無効例で人工肩関節置換（解剖学的/リバース型・腱板状態で選択・医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保存管理期',
        period: '継続的',
        goals: ['疼痛管理', '可動域・機能の維持', 'ADL工夫'],
        allowed: ['疼痛許容範囲のROM・筋力運動', '生活動作の代替戦略'],
        avoid: ['疼痛を強く誘発する端域の反復'],
        criteria: ['ADL目標の維持'],
        mdCheck: '手術適応の相談時期',
      },
    ],
    returnCriteria: [
      { text: '患者目標（ADL・趣味）の達成度で評価。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '緩徐進行。人工関節は疼痛改善効果が高い（リバース型は挙上回復に優れるが内外旋に制約等、術式特性がある）。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'Shoulder36 / DASH', target: '肩機能・上肢機能', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '肩の関節の軟骨がすり減り、痛みや動かしにくさ・ゴリゴリ感が出る状態です。進み方はゆっくりで、工夫しながら長く付き合える方も多くいます。',
      dos: ['痛みの範囲で動かし続けることが硬さの予防になります', '生活動作の工夫（道具・高さの調整）も立派な治療です'],
      donts: ['痛みを強く誘発する無理なストレッチ'],
      seekCare: ['夜も眠れない痛みが続く（人工関節を含む相談のタイミング）', '急な熱感・激痛'],
      goal: '痛みと相談しながら生活・趣味を維持し、必要な時期が来たら手術も含めて医師と最適な選択をします。',
    },
    motionCapture: [
      { movement: '挙上・ADL動作', purpose: '代償と到達度の評価', setup: '正面＋後方。', watchFor: ['体幹代償', '肩甲骨代償'] },
    ],
    references: [],
    meta: draftMeta(),
  },

  // ───────────────────────────── 肩鎖関節損傷
  {
    id: 'ac-joint-injury',
    category: 'shoulder',
    names: {
      ja: '肩鎖関節損傷',
      en: 'Acromioclavicular Joint Injury',
      abbreviations: ['AC損傷', 'ACJ損傷'],
      synonyms: ['肩鎖関節脱臼', '肩鎖関節捻挫'],
      note: 'Rockwood分類でI-IIIは保存が多く、IV以上は手術検討（IIIは議論あり）。',
    },
    keywords: ['肩の上', '転倒', 'ラグビー', '柔道', '自転車', '鎖骨外端', 'ピアノキー'],
    overview: [
      { text: '肩外側からの転倒・衝突で生じる肩鎖関節の捻挫〜脱臼。コンタクト競技・自転車事故で多い。重症度により保存/手術が分かれる。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    anatomy: [
      { text: '肩鎖靱帯（水平安定性）と烏口鎖骨靱帯（垂直安定性）が支持。脱臼度はこれらの損傷程度で決まる。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    epidemiology: [
      { text: '若年男性・コンタクト/転倒リスク競技に多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    mechanism: [
      { text: '肩峰への直達外力（内転位での転倒着地）が典型。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    symptoms: [
      { text: '肩鎖関節部の限局痛・腫脹・変形（鎖骨外端の浮き上がり）、水平内転・挙上での疼痛。', certainty: 'moderate', status: 'needs_pro_review' },
    ],
    interviewItems: [
      '受傷機転', '変形の有無', '疼痛部位（関節上の限局か）', '競技・復帰目標',
      '（陳旧例）持ち上げ・ベンチプレスでの疼痛',
    ],
    physicalExam: [
      { text: '肩鎖関節の限局圧痛・段差/ピアノキーサイン、水平内転テスト、鎖骨遠位の安定性（愛護的）。神経血管確認。', status: 'needs_pro_review' },
    ],
    specialTests: [
      {
        name: '水平内転（cross-body adduction）テスト',
        target: '肩鎖関節',
        method: '90°前方挙上位から水平内転。',
        positive: '関節部の疼痛再現',
        caution: '後方組織の伸張痛と区別。圧痛の限局と組み合わせる。',
        status: 'needs_literature',
      },
    ],
    differentials: [
      { group: 'must_not_miss', name: '鎖骨遠位端骨折', distinguishing: 'X線で鑑別（医師）。小児は骨折が多い。', urgency: 'early_visit' },
      { group: 'likely', name: 'RCRSP', distinguishing: '疼痛弧・圧痛部位の違い。' },
      { group: 'similar', name: '肩鎖関節症（陳旧性）', distinguishing: '慢性経過・変性。' },
    ],
    redFlags: [
      { finding: '著明な変形・皮膚圧迫（高度脱臼）', action: '早期に医師評価（手術検討）。', urgency: 'early_visit' },
      { finding: '神経血管症状', action: '直ちに医師へ。', urgency: 'emergency' },
    ],
    imaging: [
      { text: 'X線（両側比較・重症度判定は医師）。Zanca撮影等。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    classification: [
      { text: 'Rockwood分類（I〜VI）。IIIの方針は議論がある（医師と共有）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    conservative: [
      { text: 'I-II（多くのIII）: 短期の三角巾→早期ROM→肩甲骨・腱板/僧帽筋の強化→段階的な荷重/接触復帰。変形残存はあっても機能は良好なことが多い。', certainty: 'moderate', status: 'needs_literature' },
    ],
    surgical: [
      { text: '高度脱臼（IV以上・一部のIII）で靱帯再建等（医師判断）。', certainty: 'moderate', status: 'needs_md_review' },
    ],
    rehabPhases: [
      {
        name: '保護期',
        period: '目安: 0〜2週',
        goals: ['疼痛管理', '保護下の基本動作'],
        allowed: ['三角巾下の日常', '肘手のROM・振り子'],
        avoid: ['重量物・水平内転の強制'],
        criteria: ['安静時痛の消失'],
      },
      {
        name: '可動域・筋力期',
        period: '2〜6週',
        goals: ['ROM回復', '肩甲骨・上肢筋力'],
        allowed: ['段階的挙上・チューブ訓練'],
        avoid: ['ベンチプレス等の高負荷（初期）'],
        criteria: ['全可動域の疼痛消失'],
      },
      {
        name: '復帰期',
        period: '6週以降（Gradeによる）',
        goals: ['荷重・接触動作の再獲得'],
        allowed: ['プレス系の漸増・接触の段階導入'],
        avoid: ['基準未達での接触プレー'],
        criteria: ['プッシュ系・接触で疼痛なし'],
      },
    ],
    returnCriteria: [
      { text: '圧痛・水平内転痛の消失、プッシュ系筋力の回復、接触への段階耐容で判断。', certainty: 'expert', status: 'needs_pro_review' },
    ],
    prognosis: [
      { text: '軽症例の機能予後は良好。変形は残ることを事前共有。陳旧例の一部で関節症性疼痛が残る。', certainty: 'moderate', status: 'needs_literature' },
    ],
    outcomes: [
      { name: 'DASH / SSV', target: '上肢機能・主観的肩価値', range: '尺度による' },
    ],
    patientExplanation: {
      whatIs: '肩の上、鎖骨の外端の関節を転倒などで傷めた状態です。出っ張りが残ることがありますが、多くは機能に問題なく回復します。',
      dos: ['痛みに応じて早めに動かし、肩甲骨まわりを鍛えましょう'],
      donts: ['初期の重い物の持ち上げ・腕を胸の前に強く引く動作'],
      seekCare: ['出っ張りが大きい・皮膚が突っ張る（手術の検討が必要な場合）'],
      goal: '見た目の段差より「痛みなく使えて競技に戻れる」ことがゴールです。',
    },
    motionCapture: [
      { movement: 'プッシュアップ・ベンチ動作（復帰期）', purpose: '荷重時の疼痛・代償評価', setup: '側面。', watchFor: ['患側回避', '肩甲骨の不安定'] },
    ],
    references: [],
    meta: draftMeta(),
  },
]
