import type { Phase, ExpertOpinion } from '@/types/protocol'

export interface ProtocolTemplate {
  key: string
  title: string
  joint: string
  discussion: ExpertOpinion[]
  consensusNotes: string
  phases: Omit<Phase, 'id'>[]
}

// ─── ACL再建後 ──────────────────────────────────────────────────────────────
const ACL_RECONSTRUCTION: ProtocolTemplate = {
  key: 'acl_reconstruction',
  title: 'ACL再建後リハビリテーション',
  joint: 'knee',
  discussion: [
    {
      role: '膝専門PT',
      emoji: '🦴',
      focus: '段階的荷重と筋力回復',
      recommendations: [
        '術後早期からの可動域訓練（屈曲・伸展）で拘縮予防',
        '大腿四頭筋セッティングから段階的に筋力強化',
        'LSI（患健比）70%以上を復帰基準の目安とする（要確認）',
        '神経筋コントロール訓練は早期から組み込む',
      ],
      cautions: [
        '移植腱の成熟には6〜9ヶ月かかる（目安・要確認）',
        '過度な屈曲負荷は移植腱に不利に働く時期がある',
      ],
    },
    {
      role: 'スポーツ整形外科医',
      emoji: '🏥',
      focus: '医学的管理と復帰基準',
      recommendations: [
        '術後炎症・腫脹のモニタリングを継続する',
        '画像・臨床所見に基づいた段階的荷重許可',
        '競技復帰には機能的・時期的両方の基準を満たすこと',
      ],
      cautions: [
        '再断裂リスクは術後2年以内に高い（文献差あり・要確認）',
        '疼痛・腫脹増悪時は即時中止し受診を',
      ],
    },
    {
      role: 'S&Cコーチ視点',
      emoji: '💪',
      focus: '競技体力・動作の再獲得',
      recommendations: [
        'Phase 3以降でアジリティ・方向転換訓練を導入',
        '着地動作の神経筋制御（ニーイン抑制）を重視',
        '競技種目特有の動作パターンでテストを行う',
      ],
      cautions: [
        'ジャンプ・着地訓練は医師・PTの許可後に開始',
        '心理的恐怖感（ACL fear）への配慮も忘れずに',
      ],
    },
  ],
  consensusNotes:
    'ACL再建後は時間基準だけでなく機能基準（ROM、LSI、ホップテスト等）での段階移行が推奨される。再断裂予防のため競技復帰の判断は慎重に行うこと。',
  phases: [
    {
      order: 1,
      title: '急性期・保護期',
      goals: ['疼痛・腫脹の管理', '可動域の早期回復（特に伸展）', '大腿四頭筋の活性化', '安全な荷重開始'],
      exercises: [
        { name: '大腿四頭筋セッティング', dose: '10回×3セット', notes: '疼痛がない範囲で' },
        { name: 'SLR（下肢伸展挙上）', dose: '10回×3セット' },
        { name: '膝関節可動域訓練（他動・自動）', dose: '屈曲・伸展', notes: '伸展0°を優先確保' },
        { name: 'アイシング', dose: '20分×1日複数回', notes: '腫脹・疼痛コントロール' },
        { name: '部分荷重歩行（松葉杖）', dose: '疼痛・腫脹に応じて段階的に' },
      ],
      advanceCriteria: [
        { label: '膝関節伸展ROM', target: '0° 達成（要確認）' },
        { label: '膝関節屈曲ROM', target: '90°以上（目安）' },
        { label: '大腿四頭筋収縮', target: '自動可能' },
        { label: 'フルウェイトベアリング', target: '松葉杖なし歩行可能' },
      ],
      precautions: ['移植腱保護のため過負荷を避ける', '伸展制限（ラグ）を見逃さない'],
      redFlags: ['著明な腫脹増悪', '発熱・発赤（感染徴候）', '鋭い疼痛'],
      outcomes: ['疼痛NRS', '膝屈伸ROM(°)', '下肢周径(cm)'],
      evidence: 'consensus',
      durationWeeks: '0〜4週（目安）',
    },
    {
      order: 2,
      title: '回復期・可動域・基礎筋力',
      goals: ['完全可動域の回復', '筋力の段階的強化（CKC訓練）', '正常歩行パターンの獲得', '下肢バランス・固有受容感覚の回復'],
      exercises: [
        { name: 'ミニスクワット（CKC）', dose: '0〜60°、10回×3セット' },
        { name: 'レッグプレス', dose: '軽荷重から段階的に' },
        { name: 'ステップアップ', dose: '前方・側方' },
        { name: '自転車エルゴメーター', dose: '低負荷から開始' },
        { name: '片脚立位バランス', dose: '30秒×3回' },
      ],
      advanceCriteria: [
        { label: '膝屈曲ROM', target: '120°以上（目安）' },
        { label: '大腿四頭筋筋力（患健比LSI）', target: '60%以上（目安・要確認）' },
        { label: '正常歩行', target: '跛行なし' },
      ],
      precautions: ['OKCエクステンションは術式・医師指示に従う', '疼痛があれば負荷を下げる'],
      redFlags: ['疼痛増悪', '腫脹の再燃', '膝の不安定感'],
      outcomes: ['膝屈伸ROM', 'MMT/筋力テスト', 'LSI（患健比%）'],
      evidence: 'consensus',
      durationWeeks: '4〜12週（目安）',
    },
    {
      order: 3,
      title: '機能改善期・筋力・神経筋制御',
      goals: ['筋力の十分な回復（LSI≧70%目安）', '動的バランス・神経筋コントロール', 'ランニング準備', '着地動作の改善（ニーイン抑制）'],
      exercises: [
        { name: 'レッグプレス（高負荷）', dose: '段階的に増量' },
        { name: 'スプリットスクワット', dose: '10回×3セット' },
        { name: 'ジョグ準備（ウォーキング→速歩）' },
        { name: 'バランスボード・不安定面訓練' },
        { name: '側方ステップ・切り返し動作（軽度）' },
      ],
      advanceCriteria: [
        { label: '大腿四頭筋LSI', target: '70%以上（目安・要確認）' },
        { label: 'ハムストリングスLSI', target: '70%以上（目安・要確認）' },
        { label: '直線ジョグ', target: '痛みなく可能' },
        { label: '着地時のニーイン', target: '軽度以下' },
      ],
      precautions: ['方向転換・ピボットは医師許可後', '過負荷での再受傷に注意'],
      redFlags: ['膝の不安定感・giving way', '疼痛NRS 3以上での運動継続'],
      outcomes: ['LSI（%）', 'ホップテスト（目安）', '着地評価'],
      evidence: 'consensus',
      durationWeeks: '3〜6ヶ月（目安）',
    },
    {
      order: 4,
      title: '競技復帰期',
      goals: ['競技動作の完全回復', '再受傷予防動作の定着', '心理的準備（ACLへの恐怖感克服）', '競技復帰判定'],
      exercises: [
        { name: 'スポーツ特異的アジリティ訓練' },
        { name: '方向転換・カッティング動作' },
        { name: 'ジャンプ・着地訓練（両脚→片脚）' },
        { name: 'チームプレー参加（段階的）' },
      ],
      advanceCriteria: [
        { label: 'LSI（大腿四頭筋）', target: '90%以上（要確認）' },
        { label: 'ホップテスト', target: '90%以上（要確認）' },
        { label: '術後経過', target: '6〜9ヶ月以上（目安）' },
        { label: '心理的準備', target: 'ACL-RSI等で確認（推奨）' },
      ],
      precautions: ['接触プレー復帰は医師判断を必ず仰ぐ', '疲労時の動作崩れに注意'],
      redFlags: ['不安定感', '疼痛再燃', '腫脹'],
      outcomes: ['LSI', 'ホップテスト', 'ACL-RSI（心理スコア）'],
      evidence: 'consensus',
      durationWeeks: '6ヶ月〜（要個別評価）',
    },
  ],
}

// ─── 足関節外側靱帯捻挫 ───────────────────────────────────────────────────────
const ANKLE_SPRAIN: ProtocolTemplate = {
  key: 'ankle_sprain',
  title: '足関節外側靱帯捻挫リハビリテーション',
  joint: 'ankle',
  discussion: [
    {
      role: '足関節専門PT',
      emoji: '🦴',
      focus: 'PRICE・早期荷重・バランス訓練',
      recommendations: [
        '受傷早期はPRICE（保護・安静・アイシング・圧迫・挙上）',
        '疼痛が許容できる範囲で早期荷重を開始する',
        '足関節固有受容感覚訓練（バランスボード等）は必須',
        '腓骨筋群の筋力強化を重視する',
      ],
      cautions: [
        '骨折除外のためOttawa Ankle Rulesの確認を推奨',
        '高位捻挫（遠位脛腓靱帯損傷）は回復に時間がかかる',
      ],
    },
    {
      role: 'スポーツ医',
      emoji: '🏥',
      focus: '画像診断・重症度分類',
      recommendations: [
        '重症度（Grade Ⅰ〜Ⅲ）に応じた管理を行う',
        '骨折・腓骨筋腱損傷の除外が先決',
        'Grade Ⅲは固定期間・装具選択の判断が必要',
      ],
      cautions: [
        '反復捻挫例は慢性足関節不安定症（CAI）への移行に注意',
        '競技復帰基準は主観だけでなく機能テストで確認する',
      ],
    },
  ],
  consensusNotes:
    '足関節捻挫は「軽症」と誤認されやすいが、不適切な管理は慢性不安定症につながる。固有受容感覚訓練を含む包括的リハが再発予防に重要。',
  phases: [
    {
      order: 1,
      title: '急性期（PRICE期）',
      goals: ['疼痛・腫脹の軽減', '骨折・重篤損傷の除外', '荷重可否の判断', '可動域の維持'],
      exercises: [
        { name: 'PRICE（保護・安静・アイシング・圧迫・挙上）', dose: '受傷後48〜72時間' },
        { name: '足趾・足首の自動運動（疼痛許容範囲内）' },
        { name: '松葉杖での移動（必要時）' },
      ],
      advanceCriteria: [
        { label: '疼痛NRS', target: '歩行時3以下（目安）' },
        { label: '腫脹', target: '著明な増悪がない' },
      ],
      precautions: ['荷重時の強い疼痛は骨折の可能性→受診'],
      redFlags: ['荷重不能', '骨性圧痛', '著明な変形'],
      outcomes: ['疼痛NRS', '足首周径(cm)'],
      evidence: 'guideline',
      durationWeeks: '受傷後0〜1週（目安）',
    },
    {
      order: 2,
      title: '回復期・可動域・荷重回復',
      goals: ['完全荷重の獲得', '足関節ROM回復', '正常歩行パターン', '腫脹消退'],
      exercises: [
        { name: '足関節ROM訓練（底屈・背屈・内外反）', dose: '疼痛のない範囲で' },
        { name: 'カーフレイズ（両脚）', dose: '10回×3セット' },
        { name: '装具着用での完全荷重歩行' },
        { name: '片脚立位（平地）', dose: '可能な範囲で' },
      ],
      advanceCriteria: [
        { label: '完全荷重', target: '疼痛なく可能' },
        { label: '足関節背屈ROM', target: '正常側と同等（目安）' },
        { label: '正常歩行', target: '跛行なし' },
      ],
      precautions: ['内反方向への強い力は靱帯の再損傷リスク'],
      redFlags: ['歩行時疼痛増悪', '腫脹再燃'],
      outcomes: ['足関節ROM', '疼痛NRS', '歩行評価'],
      evidence: 'consensus',
      durationWeeks: '1〜3週（目安）',
    },
    {
      order: 3,
      title: '機能改善期・神経筋制御',
      goals: ['固有受容感覚・バランス能力の回復', '腓骨筋群の筋力強化', 'スポーツ動作への準備', '再発予防'],
      exercises: [
        { name: 'バランスボード訓練', dose: '1分×3セット' },
        { name: 'カーフレイズ（片脚）', dose: '10回×3セット' },
        { name: 'レジスタンスバンド 外反・底屈訓練' },
        { name: '前後左右ステップ訓練' },
        { name: 'ジョグ（直線）' },
      ],
      advanceCriteria: [
        { label: '片脚立位バランス', target: '30秒以上（目安）' },
        { label: '腓骨筋筋力', target: '正常側と同等（目安）' },
        { label: '直線ジョグ', target: '疼痛なく可能' },
      ],
      precautions: ['不安定な路面でのトレーニングは装具着用を検討'],
      redFlags: ['繰り返す不安定感', '慢性腫脹'],
      outcomes: ['バランステスト（片脚立位秒数）', 'LSI（腓骨筋）'],
      evidence: 'guideline',
      durationWeeks: '3〜6週（目安）',
    },
    {
      order: 4,
      title: '競技復帰期',
      goals: ['競技特有の動作遂行', '再発予防動作の定着', '競技復帰判定'],
      exercises: [
        { name: '方向転換・アジリティ訓練' },
        { name: 'ジャンプ・着地（両脚→片脚）' },
        { name: 'スポーツ特異的ドリル' },
      ],
      advanceCriteria: [
        { label: '機能的テスト', target: '疼痛なく実施可能（要個別評価）' },
        { label: '再発予防知識', target: '習得済み' },
      ],
      precautions: ['接触プレー復帰は医師・PTと相談の上で'],
      redFlags: ['活動時の不安定感', '疼痛再燃'],
      outcomes: ['機能的評価テスト', 'FAAM（目安）'],
      evidence: 'consensus',
      durationWeeks: '6週〜（個別差大）',
    },
  ],
}

// ─── 凍結肩 ─────────────────────────────────────────────────────────────────
const FROZEN_SHOULDER: ProtocolTemplate = {
  key: 'frozen_shoulder',
  title: '凍結肩（肩関節周囲炎）リハビリテーション',
  joint: 'shoulder',
  discussion: [
    {
      role: '肩専門PT',
      emoji: '🦴',
      focus: '疼痛管理と可動域回復',
      recommendations: [
        '急性期は疼痛管理を最優先し、無理な可動域訓練は避ける',
        '慢性期はストレッチング・関節モビライゼーションで可動域回復を図る',
        '自動介助運動（コードマン体操等）を早期から指導する',
        '日常生活動作（ADL）への介入も重要',
      ],
      cautions: [
        '疼痛期に無理な他動ストレッチは炎症を悪化させる可能性',
        '腱板損傷との鑑別を行うこと',
      ],
    },
    {
      role: '整形外科医',
      emoji: '🏥',
      focus: '医学的管理・注射療法',
      recommendations: [
        '疼痛期は肩峰下・関節内ステロイド注射の適応を検討',
        '糖尿病合併例は経過が長引く傾向がある',
        '保存療法無効例は関節鏡視下授動術を検討',
      ],
      cautions: [
        '他疾患（腱板断裂・石灰沈着など）との鑑別画像診断が必要',
        'ステロイド注射の回数・間隔は医師の管理下で',
      ],
    },
  ],
  consensusNotes:
    '凍結肩は疼痛期・拘縮期・解凍期の3期で対応が異なる。無理な可動域訓練は疼痛を増悪させるため、患者の状態を見極めながら段階的に介入する。',
  phases: [
    {
      order: 1,
      title: '疼痛期（急性期）',
      goals: ['疼痛コントロール', '不必要な動作制限の最小化', '睡眠障害の改善'],
      exercises: [
        { name: 'アイシング or 温熱（疼痛に応じて選択）', dose: '15〜20分' },
        { name: 'コードマン体操（振り子運動）', dose: '1〜2分×数回/日', notes: '疼痛のない範囲で' },
        { name: '頸部・胸椎モビライゼーション（関連痛の軽減）' },
      ],
      advanceCriteria: [
        { label: '安静時疼痛NRS', target: '3以下（目安）' },
        { label: '夜間痛', target: '軽減傾向' },
      ],
      precautions: ['疼痛増悪動作を避ける', '無理な可動域拡大訓練は禁忌'],
      redFlags: ['発熱・発赤（化膿性関節炎）', '急速な悪化'],
      outcomes: ['疼痛NRS（安静・運動・夜間）', '睡眠の質（主観）'],
      evidence: 'consensus',
      durationWeeks: '〜数週間（個人差大）',
    },
    {
      order: 2,
      title: '拘縮期',
      goals: ['可動域の段階的回復（屈曲・外転・外旋）', '日常生活動作の改善', '筋萎縮の予防'],
      exercises: [
        { name: '滑車を使った自動介助運動（屈曲）', dose: '10〜20回×3セット' },
        { name: '棒体操（外転・外旋）', dose: '10〜15回×3セット' },
        { name: '関節モビライゼーション（PT施行）' },
        { name: '肩甲骨周囲筋のストレッチ・強化' },
      ],
      advanceCriteria: [
        { label: '肩屈曲ROM', target: '120°以上（目安）' },
        { label: '外旋ROM', target: '30°以上（目安）' },
      ],
      precautions: ['ストレッチ後の疼痛増悪（24時間以内に改善しない場合は負荷を下げる）'],
      redFlags: ['疼痛の著明な増悪', '腫脹の出現'],
      outcomes: ['肩ROM全方向（°）', '疼痛NRS（運動時）'],
      evidence: 'consensus',
      durationWeeks: '数週〜数ヶ月（個人差大）',
    },
    {
      order: 3,
      title: '解凍期・機能回復',
      goals: ['完全ROM回復', '筋力・機能の回復', 'ADL・スポーツ復帰'],
      exercises: [
        { name: '積極的なストレッチング（全方向）' },
        { name: 'ローテーターカフ強化訓練' },
        { name: '肩甲骨安定化訓練' },
        { name: '競技・仕事特有の動作訓練' },
      ],
      advanceCriteria: [
        { label: '肩ROM', target: '健側比80%以上（目安）' },
        { label: '肩機能スコア（Constant等）', target: '改善（要確認）' },
      ],
      precautions: ['完全回復には1〜3年かかる場合もある'],
      redFlags: ['改善停滞（手術適応の再検討）'],
      outcomes: ['肩ROM', 'Constant Scoreまたは ASES（目安）'],
      evidence: 'consensus',
      durationWeeks: '〜数ヶ月（個人差大）',
    },
  ],
}

// ─── 腰椎椎間板ヘルニア（保存療法） ──────────────────────────────────────────
const LUMBAR_DISC_CONSERVATIVE: ProtocolTemplate = {
  key: 'lumbar_disc_conservative',
  title: '腰椎椎間板ヘルニア保存療法リハビリテーション',
  joint: 'spine',
  discussion: [
    {
      role: '脊椎専門PT',
      emoji: '🦴',
      focus: '疼痛管理・体幹安定化・姿勢指導',
      recommendations: [
        '急性期は過度な安静を避け、可能な範囲での活動維持を推奨',
        '体幹深部筋（多裂筋・腹横筋）の活性化が重要',
        '姿勢・動作指導（腰椎ニュートラルポジション）を早期から実施',
        'マッケンジー法またはスタビライゼーション：症状に応じて選択',
      ],
      cautions: [
        '馬尾症候群（膀胱直腸障害・会陰部感覚障害）は緊急外科対応',
        '神経症状の悪化は要医師報告',
      ],
    },
    {
      role: '整形外科医',
      emoji: '🏥',
      focus: '手術適応の判断',
      recommendations: [
        '保存療法を6〜12週実施しても改善なければ手術適応を検討',
        '画像所見だけでなく症状・機能で判断する',
        '神経根ブロックの適応を検討することもある',
      ],
      cautions: [
        '馬尾症候群・進行性麻痺は保存療法の適応外',
        'MRI所見と症状の整合性を確認する',
      ],
    },
  ],
  consensusNotes:
    '腰椎椎間板ヘルニアの80%以上は保存療法で改善するとされる（要確認）。急性期の過度な安静は逆効果であり、活動維持と体幹安定化が回復を促す。',
  phases: [
    {
      order: 1,
      title: '急性期・疼痛管理',
      goals: ['疼痛・神経症状の軽減', '快適なポジション・姿勢の指導', '過度な安静の回避'],
      exercises: [
        { name: 'ニュートラルポジション保持（仰臥位）', notes: '疼痛軽減姿勢を探す' },
        { name: '膝抱え（腰椎屈曲）or 腹臥位伸展（症状に応じて）' },
        { name: '歩行（可能な範囲で継続）' },
        { name: '熱感・アイシング or 温熱（疼痛に応じて）' },
      ],
      advanceCriteria: [
        { label: '疼痛NRS（安静時）', target: '4以下（目安）' },
        { label: '神経症状', target: '増悪なし' },
      ],
      precautions: ['長時間の同一姿勢を避ける', '前屈・回旋複合動作を避ける'],
      redFlags: ['膀胱直腸障害（馬尾症候群）', '進行性の筋力低下', '発熱'],
      outcomes: ['疼痛NRS', 'ODI（Oswestry Disability Index）（目安）'],
      evidence: 'guideline',
      durationWeeks: '0〜2週（目安）',
    },
    {
      order: 2,
      title: '亜急性期・体幹安定化',
      goals: ['体幹深部筋の活性化', '疼痛のない可動域の回復', '日常生活動作の回復'],
      exercises: [
        { name: 'ドローイン（腹横筋活性化）', dose: '10秒保持×10回' },
        { name: '骨盤傾斜運動（アンタ―・ポステリア）', dose: '10回×3セット' },
        { name: 'バードドッグ', dose: '10回×3セット' },
        { name: 'ブリッジ（股関節伸展）', dose: '10回×3セット' },
        { name: '歩行・水中歩行（可能であれば）' },
      ],
      advanceCriteria: [
        { label: '疼痛NRS（歩行時）', target: '3以下（目安）' },
        { label: '体幹安定化運動', target: '10秒×10回が可能' },
      ],
      precautions: ['腰椎屈曲動作は疼痛がない範囲で段階的に', '腹圧上昇動作（トイレ等）に注意'],
      redFlags: ['神経症状増悪', '疼痛著明増悪'],
      outcomes: ['疼痛NRS', '体幹筋持久力テスト（目安）'],
      evidence: 'consensus',
      durationWeeks: '2〜6週（目安）',
    },
    {
      order: 3,
      title: '機能回復期・筋力強化',
      goals: ['体幹・下肢筋力の強化', '動作パターンの正常化', '仕事・スポーツへの準備'],
      exercises: [
        { name: 'プランク（フロント・サイド）', dose: '30秒×3セット' },
        { name: 'デッドリフト（軽荷重・フォーム習得から）' },
        { name: 'スクワット（疼痛のない範囲）' },
        { name: '有酸素運動（自転車・歩行・水中）' },
        { name: '職業・スポーツ特異的動作訓練' },
      ],
      advanceCriteria: [
        { label: '疼痛NRS', target: '日常生活で1以下（目安）' },
        { label: '体幹筋力', target: '改善（目安）' },
        { label: 'ODI', target: '20%以下（目安・要確認）' },
      ],
      precautions: ['高負荷での脊椎屈曲・回旋は慎重に'],
      redFlags: ['神経症状再燃', '疼痛増悪'],
      outcomes: ['ODI', '疼痛NRS', '体幹筋力テスト'],
      evidence: 'consensus',
      durationWeeks: '6〜12週（目安）',
    },
    {
      order: 4,
      title: '復帰・再発予防期',
      goals: ['仕事・スポーツへの完全復帰', '再発予防の習慣形成', '自己管理能力の獲得'],
      exercises: [
        { name: '腰椎保護エクササイズの継続（ホームプログラム）' },
        { name: '職業・スポーツ特異的訓練（フル参加）' },
        { name: '有酸素運動の習慣化' },
      ],
      advanceCriteria: [
        { label: '仕事・日常生活', target: '制限なく遂行可能' },
        { label: '疼痛管理', target: '自己管理できる' },
      ],
      precautions: ['再発しやすい姿勢・動作の継続的な注意'],
      redFlags: ['神経症状再出現', '疼痛の著明再燃（手術適応再検討）'],
      outcomes: ['ODI', '疼痛NRS', 'QOL指標'],
      evidence: 'consensus',
      durationWeeks: '3ヶ月〜（個別差あり）',
    },
  ],
}

// ─── TKA（人工膝関節）術後 ───────────────────────────────────────────────────
const TKA: ProtocolTemplate = {
  key: 'tka',
  title: '人工膝関節（TKA）術後リハビリテーション',
  joint: 'knee',
  discussion: [
    {
      role: '膝専門PT',
      emoji: '🦴',
      focus: '早期荷重・ROM回復・ADL自立',
      recommendations: [
        '術翌日からの積極的な可動域訓練が拘縮予防に重要',
        '早期荷重歩行（術後1〜2日目から）を推進する',
        '膝屈曲90°達成を早期目標とする（要確認）',
        '階段昇降・立ち上がりなどのADL訓練を重視',
      ],
      cautions: [
        'DVT（深部静脈血栓症）のリスク管理が重要',
        '過度な疼痛があれば運動強度を下げる',
      ],
    },
    {
      role: '整形外科医',
      emoji: '🏥',
      focus: '術後管理・合併症予防',
      recommendations: [
        'DVT予防（抗凝固療法・弾性ストッキング・早期離床）',
        '感染兆候（発熱・発赤・腫脹増悪）の監視',
        'インプラント保護のための荷重・動作制限の確認',
      ],
      cautions: [
        'DVT・肺塞栓症は生命に関わる合併症',
        '脱臼・骨折に注意する動作制限の遵守',
      ],
    },
  ],
  consensusNotes:
    'TKA後のリハビリは早期荷重・早期可動域訓練が標準的。DVTなど術後合併症の管理が最優先。ADL自立と生活の質改善を主目標とする。',
  phases: [
    {
      order: 1,
      title: '術後急性期（入院期）',
      goals: ['疼痛・腫脹管理', '早期離床・荷重開始', '膝屈曲90°到達', 'DVT予防', 'ADL基本動作習得'],
      exercises: [
        { name: '足首ポンピング運動（DVT予防）', dose: '20回×1日数回' },
        { name: '大腿四頭筋セッティング', dose: '10回×3セット' },
        { name: 'SLR', dose: '10回×3セット' },
        { name: '膝屈伸ROM訓練（CPM or 自動）', dose: '疼痛のない範囲' },
        { name: '平行棒内歩行（術後1〜2日目から）' },
        { name: '立ち上がり・座り動作訓練' },
      ],
      advanceCriteria: [
        { label: '膝屈曲ROM', target: '90°以上（目安）' },
        { label: '歩行', target: '歩行補助具使用で自立' },
        { label: '立ち上がり', target: '手すり使用で可能' },
      ],
      precautions: ['疼痛が強い場合は鎮痛剤の適切な使用を医師に相談', 'DVT症状（下肢疼痛・腫脹）に注意'],
      redFlags: ['DVT症状', '感染徴候（高熱・発赤・膿性分泌）', '異常な疼痛'],
      outcomes: ['疼痛NRS', '膝屈伸ROM(°)', '歩行自立度'],
      evidence: 'guideline',
      durationWeeks: '術後1〜2週（目安）',
    },
    {
      order: 2,
      title: '回復期・ADL獲得',
      goals: ['独歩での歩行自立', '階段昇降の習得', '膝屈曲120°以上（目安）', '在宅生活への準備'],
      exercises: [
        { name: '歩行訓練（距離延長）' },
        { name: '階段昇降訓練（手すり使用）' },
        { name: '自転車エルゴメーター（低負荷）' },
        { name: '大腿四頭筋・ハムストリングス強化' },
        { name: 'バランス訓練（平地）' },
      ],
      advanceCriteria: [
        { label: '膝屈曲ROM', target: '120°以上（目安）' },
        { label: '独歩', target: '補助具なし安全に可能' },
        { label: '階段昇降', target: '手すり使用で可能' },
      ],
      precautions: ['転倒リスク管理', '過度な荷重による疼痛増悪'],
      redFlags: ['膝屈曲著明制限（90°未満が持続）', '感染徴候'],
      outcomes: ['膝ROM', 'KOOS（目安）', '歩行速度', '6分間歩行テスト（目安）'],
      evidence: 'consensus',
      durationWeeks: '2〜8週（目安）',
    },
    {
      order: 3,
      title: '機能改善・社会復帰期',
      goals: ['活動・参加レベルの向上', '下肢筋力のさらなる回復', '趣味・社会活動への復帰'],
      exercises: [
        { name: 'レッグプレス・スクワット（疼痛のない範囲）' },
        { name: '有酸素運動（ウォーキング・水中歩行・自転車）' },
        { name: 'ADL・趣味活動への段階的参加' },
      ],
      advanceCriteria: [
        { label: '生活活動', target: '制限なく参加可能（目安）' },
        { label: 'KOOS（目安）', target: '術前より改善' },
      ],
      precautions: ['ランニング・重量スポーツはインプラント寿命に影響の可能性（要医師確認）'],
      redFlags: ['疼痛再燃', 'インプラント周囲感染'],
      outcomes: ['KOOS', 'TUG（Timed Up and Go）', '疼痛NRS'],
      evidence: 'consensus',
      durationWeeks: '2〜3ヶ月（目安）',
    },
  ],
}

// ─── テンプレートマップ ────────────────────────────────────────────────────────
export const PROTOCOL_TEMPLATES: Record<string, ProtocolTemplate> = {
  acl_reconstruction: ACL_RECONSTRUCTION,
  ankle_sprain: ANKLE_SPRAIN,
  frozen_shoulder: FROZEN_SHOULDER,
  lumbar_disc_conservative: LUMBAR_DISC_CONSERVATIVE,
  tka: TKA,
}

// キーからテンプレートを取得（一致しない場合は汎用テンプレートを返す）
export function getTemplate(key: string): ProtocolTemplate | null {
  return PROTOCOL_TEMPLATES[key] ?? null
}

// 疾患名・関節から最も近いテンプレートを探す
export function findBestTemplate(diagnosis: string, joint?: string): ProtocolTemplate | null {
  const d = diagnosis.toLowerCase()

  // キーワードマッチング
  if (d.includes('acl') || d.includes('前十字靱帯')) return PROTOCOL_TEMPLATES.acl_reconstruction
  if (d.includes('捻挫') && (d.includes('足') || joint === 'ankle')) return PROTOCOL_TEMPLATES.ankle_sprain
  if (d.includes('凍結') || d.includes('五十肩') || d.includes('周囲炎')) return PROTOCOL_TEMPLATES.frozen_shoulder
  if (d.includes('ヘルニア') || d.includes('腰椎') || d.includes('椎間板')) return PROTOCOL_TEMPLATES.lumbar_disc_conservative
  if (d.includes('tka') || d.includes('人工膝') || d.includes('全置換')) return PROTOCOL_TEMPLATES.tka

  // 関節でフォールバック
  if (joint === 'ankle') return PROTOCOL_TEMPLATES.ankle_sprain
  if (joint === 'shoulder') return PROTOCOL_TEMPLATES.frozen_shoulder
  if (joint === 'spine') return PROTOCOL_TEMPLATES.lumbar_disc_conservative
  if (joint === 'knee') return PROTOCOL_TEMPLATES.acl_reconstruction

  return null
}
