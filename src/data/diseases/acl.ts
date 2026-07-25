// 疾患ページ見本第1号: 前十字靱帯損傷
// 注意: 本データは下書きであり、医師監修前（meta.supervisor 未設定）。
// 数値・文献はすべて verified:false（原文未確認）として登録し、
// UI側で「未確認」「要監修」を明示する。

import type { DiseasePage } from '@/types/disease'

export const ACL_INJURY: DiseasePage = {
  id: 'acl-injury',
  category: 'knee',
  names: {
    ja: '前十字靱帯損傷',
    en: 'Anterior Cruciate Ligament Injury',
    abbreviations: ['ACL損傷', 'ACL断裂'],
    synonyms: ['前十字靭帯損傷', '前十字じん帯損傷', 'ACL rupture', 'ACL tear'],
    note: '表記は「靱帯」「靭帯」の両方が用いられるが、医学用語としては「靱帯」が正式。ACLは国際的に通用する略語。',
  },
  keywords: [
    '膝', '膝崩れ', 'giving way', '着地', 'カッティング', 'ジャンプ', 'サッカー', 'バスケットボール',
    'スキー', 'ハンドボール', '柔道', 'Lachman', 'ピボットシフト', '膝関節血腫', '再建術',
  ],

  overview: [
    { text: '膝関節内の前十字靱帯（脛骨の前方偏位と回旋を制動する靱帯）に生じる外傷性損傷。スポーツ外傷として頻度が高い。', certainty: 'high', status: 'needs_md_review' },
    { text: '多くは急性の外傷性損傷で、受傷時のポップ音・急速な腫脹（関節血腫）・プレー続行困難が典型的な経過。ただし典型像を示さない例も少なくない。', certainty: 'moderate', status: 'needs_md_review' },
    { text: '臨床上の重要性: 放置された不安定性は半月板・軟骨の二次損傷リスクを高める可能性が指摘されている。若年スポーツ選手では復帰と再損傷予防の両立が主要課題となる。', certainty: 'moderate', status: 'needs_literature', refs: [4] },
    { text: '自然経過: 靱帯実質部の自然治癒は期待しにくいとされてきたが、部分損傷や一部症例の治癒能については見解が分かれており、研究が続いている。', certainty: 'divided', status: 'needs_literature', level: 'pro' },
  ],

  anatomy: [
    { text: '大腿骨外側顆内側面から脛骨顆間隆起前方に走行。前内側線維束（AM束）と後外側線維束（PL束）に機能的に区分される。', certainty: 'high', status: 'needs_pro_review' },
    { text: '脛骨前方引き出しの一次制動、下腿内旋・膝過伸展の制動に関与。屈曲角度によりAM束・PL束の緊張が変化する。', certainty: 'high', status: 'needs_pro_review', level: 'pro' },
    { text: '血行は中膝動脈由来で乏しく、関節液環境にあることが治癒能の低さに関与するとされる。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    { text: '関連組織: 内側・外側半月板、MCL/LCL、関節軟骨、膝窩部血管神経束。合併損傷の評価が必須。', certainty: 'high', status: 'needs_pro_review' },
  ],

  epidemiology: [
    { text: '好発: 10〜30歳代のスポーツ活動者。カッティング・ジャンプ着地を伴う競技（サッカー・バスケットボール・ハンドボール・スキー・柔道など）に多い。', certainty: 'moderate', status: 'needs_literature' },
    { text: '性差: 同一競技条件では女性の受傷率が男性より高いと多くの研究で報告されている（解剖学的・神経筋的・ホルモン要因など多因子が想定される）。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    { text: '再損傷: 再建術後の移植腱再断裂および対側損傷は特に若年競技者で無視できない頻度で報告されている。復帰時期・機能基準との関連が指摘される。', certainty: 'moderate', status: 'needs_literature', refs: [3], level: 'pro' },
    { text: '数値（発生率・再断裂率など）は対象集団・定義により大きく異なるため、本ページでは断定値を掲載しない。文献確認後に対象集団を付記して追記すること。', certainty: 'insufficient', status: 'needs_literature' },
  ],

  mechanism: [
    { text: '非接触型が多数を占めるとされる: 減速・方向転換・着地時の「膝軽度屈曲＋外反＋下腿回旋」肢位が代表的。', certainty: 'moderate', status: 'needs_literature' },
    { text: '接触型: タックル等による膝外反強制など。合併損傷（MCL・半月板）の頻度が高くなる。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: '要因は多因子性: 解剖学的要因（顆間窩形態・脛骨後方傾斜など）、神経筋制御、疲労、床・シューズ環境などが複合する。単一要因で説明しない。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
  ],

  symptoms: [
    { text: '受傷時のポップ音・断裂感、数時間以内の関節腫脹（関節血腫）、プレー続行困難。', certainty: 'moderate', status: 'needs_md_review' },
    { text: '亜急性期以降: 膝崩れ（giving way）、方向転換・下り動作への不安感、大腿四頭筋筋力低下。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: 'ロッキング（完全伸展不能の持続）は半月板バケツ柄断裂などの合併を示唆するため、症状として重要。', certainty: 'moderate', status: 'needs_md_review' },
    { text: '注意: 症状のみでACL損傷を確定・除外することはできない。腫脹が軽度の断裂例、逆に他疾患による血腫例も存在する。', certainty: 'expert', status: 'needs_pro_review' },
  ],

  interviewItems: [
    '受傷日時・受傷機転（接触/非接触・動作の詳細）',
    '受傷時の音・断裂感の有無',
    '腫脹の出現時期（受傷後何時間か）',
    '受傷直後の荷重・歩行可否／プレー続行の可否',
    '膝崩れ（giving way）の有無・頻度・誘発動作',
    'ロッキング・引っかかり感の有無',
    '疼痛部位・強度（NRS）・経時変化',
    '過去の同側・対側膝外傷歴／手術歴',
    '既往歴・全身疾患・投薬（抗凝固薬は特に確認）',
    '発熱・感染兆候・しびれ等の神経症状の有無',
    '競技種目・ポジション・レベル・練習量・直近の負荷変化',
    '職業上の負荷（立ち仕事・重量物・階段など）',
    '患者の目標（競技復帰レベル・時期の希望）',
    '医療機関受診状況・画像検査の有無・医師の診断と指示',
  ],

  physicalExam: [
    { text: '視診: 腫脹（膝蓋跳動）、大腿四頭筋萎縮（慢性例）、歩行時の伸展回避。', status: 'needs_pro_review' },
    { text: 'ROM: 急性期は伸展制限が生じやすい。伸展制限の持続はロッキングとの鑑別を要する。角度は測定肢位（背臥位・ゴニオメーター）を統一して記録する。', status: 'needs_pro_review' },
    { text: '筋力: 大腿四頭筋・ハムストリングスのMMT/等速性・HHD評価。関節原性筋抑制（AMI）により急性期の評価値は低下しやすい。', level: 'pro', status: 'needs_pro_review' },
    { text: '左右差の解釈: 測定誤差と健側機能低下の可能性を考慮する。左右差が小さくても健側自体が低下していれば十分な機能とは言えない。', certainty: 'expert', status: 'needs_pro_review' },
    { text: '合併評価: 関節裂隙圧痛（半月板）、MCL/LCLストレステスト、膝窩部血管拍動・足部神経学的所見（高エネルギー外傷では必須）。', status: 'needs_md_review' },
  ],

  specialTests: [
    {
      name: 'Lachman test',
      target: 'ACL（脛骨前方偏位の制動性）',
      method: '膝約20〜30°屈曲位で大腿骨を固定し脛骨を前方に引き出す。エンドポイントの質と移動量を健側と比較。',
      positive: '前方移動量の増大・軟性エンドポイント',
      sensitivity: '約80〜90%台と報告（メタ解析）',
      specificity: '約90%台と報告（メタ解析）',
      caution: '急性期は防御性収縮で偽陰性になりうる。数値は対象集団・診断基準で変動する。',
      status: 'needs_literature',
      refs: [0],
    },
    {
      name: 'Pivot shift test',
      target: 'ACL（回旋不安定性）',
      method: '下腿内旋・外反ストレスを加えながら膝を屈曲し、脛骨外側プラトーの整復現象をみる。',
      positive: '屈曲20〜40°付近でのclunk（亜脱臼の整復）',
      sensitivity: '低い（覚醒下では特に低下）と報告',
      specificity: '高いと報告',
      caution: '疼痛・防御収縮の影響が大きく、覚醒下では感度が低い。陽性なら回旋不安定性を強く示唆。',
      status: 'needs_literature',
      refs: [0],
    },
    {
      name: 'Anterior drawer test',
      target: 'ACL',
      method: '膝90°屈曲位で脛骨を前方に引き出す。',
      positive: '前方移動量の増大',
      sensitivity: '報告により幅が大きい',
      specificity: '報告により幅が大きい',
      caution: '急性期の信頼性は低め。ハムストリングス防御・後方落ち込み（PCL損傷）との混同に注意。',
      status: 'needs_literature',
      refs: [0],
    },
  ],

  differentials: [
    { group: 'likely', name: '半月板損傷（単独・合併）', distinguishing: '関節裂隙圧痛・ロッキング・McMurray陽性。ACLとの合併が多い。' },
    { group: 'likely', name: 'MCL損傷', distinguishing: '内側裂隙上の圧痛・外反ストレス疼痛/開大。接触型で合併しやすい。' },
    { group: 'likely', name: '膝蓋骨脱臼（初回）', distinguishing: '受傷機転が類似し血腫も生じる。内側膝蓋大腿靱帯部圧痛・apprehension陽性。' },
    { group: 'must_not_miss', name: '骨折（脛骨プラトー・顆間隆起・骨端線損傷）', distinguishing: '荷重不能・骨圧痛・小児/高齢者。X線評価を優先。', urgency: 'early_visit' },
    { group: 'must_not_miss', name: '膝関節脱臼・多靱帯損傷（血管損傷リスク）', distinguishing: '高エネルギー外傷・著明な不安定性。足背動脈等の血流評価を必須とし救急対応。', urgency: 'emergency' },
    { group: 'must_not_miss', name: '化膿性関節炎', distinguishing: '発熱・安静時激痛・熱感。外傷歴が乏しい腫脹では考慮。', urgency: 'same_day' },
    { group: 'similar', name: 'PCL損傷', distinguishing: '脛骨粗面打撲等の機序・後方落ち込み徴候。前方引き出しの偽陽性に注意。' },
    { group: 'similar', name: '膝蓋腱・大腿四頭筋腱損傷', distinguishing: '伸展機構の連続性喪失（膝伸展不能・腱欠損触知）。', urgency: 'early_visit' },
  ],

  redFlags: [
    { finding: '高エネルギー外傷後の著明な不安定性・変形（膝関節脱臼疑い）', action: '血管損傷合併の可能性。整復・血流評価のため直ちに救急受診。', urgency: 'emergency' },
    { finding: '足部の血流障害・感覚障害・運動麻痺', action: '膝窩動脈・腓骨神経損傷疑い。直ちに医師へ。', urgency: 'emergency' },
    { finding: '発熱を伴う関節腫脹・安静時激痛', action: '化膿性関節炎の除外が必要。当日中に医療相談。', urgency: 'same_day' },
    { finding: '完全伸展不能が持続（ロッキング）', action: '半月板バケツ柄断裂等の可能性。早期に整形外科受診。', urgency: 'early_visit' },
    { finding: '下腿の腫脹・把握痛・ホーマンズ徴候等（術後・固定後）', action: 'DVT疑い。運動負荷を中止し担当医へ確認。', urgency: 'same_day' },
    { finding: '術後の急激な疼痛増悪・創部発赤・浸出', action: '感染疑い。リハビリ継続より医師への連絡を優先。', urgency: 'same_day' },
  ],

  imaging: [
    { text: '単純X線: 骨折（顆間隆起裂離・Segond骨折・プラトー骨折）の除外が主目的。靱帯実質は描出されない。外傷後はまず実施されることが多い。', certainty: 'high', status: 'needs_md_review' },
    { text: 'MRI: 靱帯実質・半月板・軟骨・骨挫傷の評価に有用。典型的骨挫傷パターン（大腿骨外側顆・脛骨外側後方）は受傷機転を裏付ける。', certainty: 'high', status: 'needs_md_review', level: 'pro' },
    { text: '注意: 画像所見と症状・機能は必ずしも一致しない。画像の最終評価・診断は医師が行う。', certainty: 'expert', status: 'verified' },
    { text: '超音波: 靱帯実質の直接評価には限界があるが、関節液貯留等の補助評価に用いられることがある。検者依存性・機器性能の影響が大きい。', certainty: 'low', status: 'needs_pro_review', level: 'pro' },
  ],

  classification: [
    { text: '損傷程度: 部分損傷／完全断裂。徒手検査・MRI・関節鏡所見を総合して判断される（判断は医師）。', status: 'needs_md_review' },
    { text: '合併損傷の有無（半月板・軟骨・他靱帯）が治療選択と経過に大きく影響するため、単独損傷か複合損傷かの区別が実務上重要。', certainty: 'moderate', status: 'needs_pro_review' },
  ],

  conservative: [
    { text: '適応の考え方: 活動レベル・年齢・不安定感の程度・合併損傷・患者目標により、保存療法か再建術かの判断は医師と患者の共同意思決定で行われる。見解が分かれる領域であり一律に決められない。', certainty: 'divided', status: 'needs_md_review' },
    { text: '急性期管理: 腫脹・疼痛管理（相対的安静・アイシング・圧迫）、伸展可動域の早期回復、大腿四頭筋の活性化（AMI対策）。', certainty: 'moderate', status: 'needs_pro_review' },
    { text: '運動療法: 段階的な筋力強化（CKC/OKCの負荷設定）、神経筋トレーニング、動作再学習。疼痛と腫脹をモニタリングしながら漸増する。', certainty: 'moderate', status: 'needs_literature', refs: [1] },
    { text: '装具・テーピング: 不安定感の軽減目的で用いられることがあるが、再受傷予防効果のエビデンスは限定的。', certainty: 'low', status: 'needs_literature', level: 'pro' },
    { text: '手術検討の目安: 保存療法下で膝崩れが反復する場合、半月板合併損傷がある場合等は再建術の適応が検討される（判断は医師）。', certainty: 'moderate', status: 'needs_md_review' },
  ],

  surgical: [
    { text: '代表術式: 自家腱（ハムストリング腱・骨付き膝蓋腱=BTB・大腿四頭筋腱）を用いた関節鏡視下再建術が標準的。修復術（縫合）は適応が限定される。', certainty: 'moderate', status: 'needs_md_review' },
    { text: '移植腱の成熟（リモデリング）には長期間を要し、術後早期〜中期は移植腱保護が最優先。過負荷の時期尚早な導入は避ける。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    { text: '合併処置（半月板縫合・軟骨処置・LET等）の有無で荷重・ROM制限が変わる。必ず術式詳細と医師の指示を確認してからリハビリを計画する。', certainty: 'expert', status: 'verified' },
    { text: '術後合併症の例: 感染・DVT・関節線維症（伸展制限）・膝前部痛・再断裂。急激な変化はレッドフラッグ参照。', certainty: 'moderate', status: 'needs_md_review' },
  ],

  rehabPhases: [
    {
      name: '急性期・保護期',
      period: '目安: 術後0〜4週（術式・指示で変動）',
      goals: ['腫脹・疼痛管理', '伸展0°の確保', '大腿四頭筋の随意収縮回復', '指示範囲内の荷重獲得'],
      allowed: ['クアッドセッティング', 'SLR（装具・指示に応じて）', 'ヒールスライド等のROM練習', '許可範囲の荷重歩行'],
      avoid: ['指示範囲を超える荷重・ROM', '早期の抵抗下OKC伸展（移植腱への負荷）', '腫脹を増悪させる過負荷'],
      criteria: ['伸展0°', '屈曲90°以上', '膝蓋跳動の軽減', '大腿四頭筋の随意収縮良好'],
      mdCheck: '荷重許可・装具設定・合併処置による制限',
    },
    {
      name: '可動域・基礎筋力回復期',
      period: '目安: 4〜12週',
      goals: ['ROMの正常化', '正常歩行の再獲得', '基礎筋力の回復'],
      allowed: ['CKCトレーニング（スクワット等の漸増）', 'エルゴメーター', 'バランストレーニング'],
      avoid: ['ピボット・カッティング動作', '疼痛・腫脹を残す負荷設定'],
      criteria: ['ROM左右差ほぼなし', '腫脹なし', '片脚立位安定', '正常歩行'],
    },
    {
      name: '筋力・神経筋制御期',
      period: '目安: 3〜6ヶ月',
      goals: ['筋力LSIの改善', 'ジョグ開始', '両脚→片脚のジャンプ着地基礎'],
      allowed: ['漸増的筋力トレーニング', 'ランニング（基準達成後）', 'プライオメトリクス導入'],
      avoid: ['基準未達での競技的動作', '着地時の膝外反を許容した反復練習'],
      criteria: ['筋力LSIの目標達成（施設基準）', '着地動作の質良好', '疼痛・腫脹なし'],
      mdCheck: 'ジョグ・ジャンプ開始の許可',
    },
    {
      name: '競技復帰準備・復帰期',
      period: '目安: 6ヶ月以降（時期のみで判断しない）',
      goals: ['競技特異的動作の再獲得', '心理的準備', '段階的復帰'],
      allowed: ['アジリティ・カッティング（段階的）', '部分参加→全体練習→試合'],
      avoid: ['機能基準・心理的準備を無視した早期復帰'],
      criteria: ['ホップテスト等のLSI基準', '競技動作の質', 'ACL-RSI等の心理評価', '医師の許可'],
      mdCheck: '競技復帰の最終許可',
    },
  ],

  returnCriteria: [
    { text: '復帰判断は「術後経過月数」単独では行わず、筋力・ホップ性能・動作の質・心理的準備・医師の許可を組み合わせる。', certainty: 'moderate', status: 'needs_literature', refs: [2, 3] },
    { text: '復帰時期を遅らせること・機能基準を満たすことが再損傷リスク低下と関連するとの報告がある（コホート研究）。', certainty: 'moderate', status: 'needs_literature', refs: [3], level: 'pro' },
    { text: 'LSIの限界: 健側も術後に機能低下するため、左右対称でも絶対的能力が不足している可能性がある。可能なら術前値・規範値も参照する。', certainty: 'moderate', status: 'needs_pro_review', level: 'pro' },
    { text: '心理的準備（再受傷不安）はACL-RSI等で評価し、低値の場合は復帰プログラムを調整する。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
  ],

  prognosis: [
    { text: '競技復帰率・復帰時期は競技レベル・年齢・治療選択で大きく異なる。断定的な期間提示は避け、個別に説明する。', certainty: 'moderate', status: 'needs_literature' },
    { text: '若年・高活動レベルは再損傷（同側・対側）リスクが高い集団として報告されている。復帰後も予防トレーニング継続が推奨される。', certainty: 'moderate', status: 'needs_literature', level: 'pro' },
    { text: '長期: ACL損傷膝は半月板・軟骨損傷の合併等を介して将来の変形性膝関節症リスク上昇と関連するとの報告があるが、再建術によるOA予防効果については見解が分かれる。', certainty: 'divided', status: 'needs_literature', level: 'research' },
  ],

  outcomes: [
    { name: 'IKDC-SKF', target: '膝の症状・機能（主観）', range: '0-100（高いほど良好）', note: '日本語版あり。ACL術後で汎用。' },
    { name: 'KOOS', target: '膝の痛み・症状・ADL・スポーツ・QOL', range: '各下位尺度0-100（高いほど良好）', note: '日本語版あり。' },
    { name: 'Lysholm score', target: '膝の症状・機能', range: '0-100', note: '古典的尺度。天井効果に注意。' },
    { name: 'ACL-RSI', target: '復帰への心理的準備', range: '0-100（高いほど準備良好）', note: '短縮版あり。カットオフは研究途上。' },
    { name: 'NRS', target: '疼痛強度', range: '0-10', note: '場面（安静時/動作時）を指定して記録。' },
  ],

  patientExplanation: {
    whatIs: '膝の中にある「前十字靱帯」という、すねの骨が前にずれたりねじれたりしないよう支えるスジを傷めた状態です。ジャンプの着地や急な方向転換で起こりやすいけがです。',
    dos: [
      '医師・スタッフから許可された範囲の運動・歩行は続けましょう',
      '腫れや痛みが強い時期は、アイシングと安静で膝を守りましょう',
      '太ももの前の筋肉に力を入れる練習は、回復の土台になります',
    ],
    donts: [
      '許可されていないジャンプ・ダッシュ・急な方向転換',
      '痛みや腫れを我慢しての練習継続',
      '自己判断での装具の取り外しや負荷アップ',
    ],
    seekCare: [
      '膝が伸びなくなった・引っかかって動かない',
      '発熱を伴う強い痛みや腫れ',
      'ふくらはぎの強い腫れ・痛み',
      '足の色が悪い・しびれが強い（すぐに受診）',
    ],
    goal: '焦らず段階を踏めば、多くの方が生活やスポーツへの復帰を目指せます。回復のスピードには個人差があるため、「何ヶ月」ではなく「できることが増えたか」を一緒に確認しながら進めます。',
  },

  motionCapture: [
    {
      movement: '両脚→片脚スクワット',
      purpose: '下肢アライメント（動的膝外反）と体幹制御の評価',
      setup: '正面から全身が入る距離で撮影。膝・足部が映る高さにカメラを固定。',
      watchFor: ['膝の内側への崩れ（knee-in）', '体幹側方傾斜', '骨盤落下', '足部回内'],
    },
    {
      movement: 'ドロップ着地・ジャンプ着地',
      purpose: '着地時の衝撃吸収戦略と膝外反の評価（許可後の段階で実施）',
      setup: '正面・側面の2方向撮影が望ましい。可能なら高フレームレート設定。',
      watchFor: ['着地時膝外反', '膝屈曲の浅い硬い着地', '左右非対称な荷重'],
    },
    {
      movement: '片脚ホップ（前方）',
      purpose: '距離LSIと着地の質の複合評価',
      setup: '側面からメジャーと共に撮影し距離を記録。着地安定まで撮影。',
      watchFor: ['距離の左右差', '着地の安定性', '着地時の体幹・膝制御'],
    },
  ],

  references: [
    {
      authors: 'Benjaminse A, Gokeler A, van der Schans CP',
      title: 'Clinical diagnosis of an anterior cruciate ligament rupture: a meta-analysis',
      source: 'J Orthop Sports Phys Ther', year: 2006,
      note: '徒手検査の診断精度メタ解析。感度・特異度の引用元。',
      verified: false,
    },
    {
      authors: 'van Melick N, van Cingel REH, Brooijmans F, et al.',
      title: 'Evidence-based clinical practice update: practice guidelines for anterior cruciate ligament rehabilitation',
      source: 'Br J Sports Med', year: 2016,
      note: 'ACLリハビリの実践ガイドライン（基準ベース進行を推奨）。',
      verified: false,
    },
    {
      authors: 'Ardern CL, Glasgow P, Schneiders A, et al.',
      title: '2016 Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern',
      source: 'Br J Sports Med', year: 2016,
      note: '競技復帰の多面的評価に関するコンセンサス。',
      verified: false,
    },
    {
      authors: 'Grindem H, Snyder-Mackler L, Moksnes H, Engebretsen L, Risberg MA',
      title: 'Simple decision rules can reduce reinjury risk by 84% after ACL reconstruction: the Delaware-Oslo ACL cohort study',
      source: 'Br J Sports Med', year: 2016,
      note: '復帰時期・機能基準と再損傷リスクの関連（コホート研究）。',
      verified: false,
    },
    {
      authors: '日本整形外科学会診療ガイドライン委員会（編）',
      title: '前十字靱帯（ACL）損傷診療ガイドライン',
      source: '南江堂', year: 2019,
      note: '国内診療ガイドライン。版・発行年は原本で要確認。',
      verified: false,
    },
  ],

  protocolTemplateKey: 'acl_reconstruction',
  protocolJoint: 'knee',

  meta: {
    createdAt: '2026-07-17',
    updatedAt: '2026-07-17',
    nextReviewDue: '2027-01-17',
    author: 'AI下書き（Claude）',
    supervisor: undefined, // 未監修: UI上で「医師監修前の下書き」を明示
    guidelineVersions: ['日本整形外科学会 ACL損傷診療ガイドライン（版は原本確認待ち）'],
    searchDate: undefined,
    changeLog: ['2026-07-17 AIによる初版下書き作成（全文献未確認・医師監修前）'],
  },
}
