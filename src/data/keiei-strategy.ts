/**
 * 経営方針（院長の「競合分析および今後の経営戦略」を、アプリで見て・進められる形にしたもの）
 *
 * 2026-11-27 院長「この内容を今後の経営課題としてガイド、登録してください。また変更したほうが良いものがあれば
 * いつでも指摘、修正してください」。もとの文は docs/keiei-strategy-2026-11.md（院長の文のまま）。
 * 画面は 経営 →「経営方針（90日計画）」（/marketing/sales/strategy）。進み具合は KV の keiei:strategy（院長だけ）。
 * 経営相談（AI）にも、この方針の要点と進み具合を渡す（lib/marketing/keiei-chat-server.ts）。
 *
 * 方針を変えるときは、ここを直す（id は進み具合の保存に使うので、言葉を直しても id は変えない）。
 */

export const STRATEGY_ID = '2026-11'

export interface StrategyTask {
  id: string
  text: string
  /** アプリの中で、これに使える画面 */
  link?: { href: string; label: string }
}

export interface StrategyPhase {
  key: 'p1' | 'p2' | 'p3'
  /** 何日目から何日目まで（1 から） */
  from: number
  to: number
  title: string
  tasks: StrategyTask[]
}

export interface StrategyReview {
  id: string
  title: string
  detail: string
}

export const STRATEGY = {
  id: STRATEGY_ID,
  registeredAt: '2026-11-27',
  title: '身体機能回復・復帰支援型整骨院へ',
  motto: '技術の獲得から、技術の価値化へ',
  philosophy: '至誠謙和',
  vision:
    '痛みへの施術だけでなく、身体機能の評価・一人ひとりの運動支援・経過の見える化・生活と競技への復帰支援をひとつにした「身体機能回復・復帰支援型整骨院」をめざす。',
  stance: [
    '整形外科とは、診断や保険診療で競わない。医師の方針を尊重した運動支援と、身体機能の継続した管理で補う立場に立つ。',
    '整骨院・整体院とは、価格の安さや広告の量ではなく、客観的な評価・施術の個別性・運動支援の専門性・経過の説明と料金の分かりやすさで差をつける。',
  ],
  services: [
    { title: 'スポーツ復帰支援', who: '学生・社会人のアスリート' },
    { title: '術後の運動サポート', who: 'ACL・半月板・股関節鏡・足関節などの術後の方' },
    { title: '大人のスポーツコンディショニング', who: 'ランニング・ゴルフなどを楽しむ方' },
    { title: '歩行・生活機能サポート', who: '中高年・高齢の方' },
  ],
  passport:
    'リハビリパスポート：痛み・可動域・筋力・動作・身体機能の評価・自主トレ・復帰の目標を記録し、その変化を患者さんご自身が確かめられるしくみ（将来、エコー・表面筋電図・モーションキャプチャー・AI の動作解析は、安全と測る正確さを確かめてから）。',
  entry: {
    name: '初回の身体機能評価・相談（試験）',
    minutes: 20,
    price: 2000,
    contents: ['問診', '身体機能の確認', 'これからの方針の説明', '必要に応じて自費リハビリ・医療機関の受診のご案内'],
    note: '契約を前提にしない。ご自身の状態と必要な支援を理解したうえで、選んでいただく。',
  },
  channels: ['Google検索', 'Googleビジネスプロフィール', 'ホームページ', 'Instagram', '公式LINE', '通っている方からのご紹介', '院内サイネージ'],
  timeSlots: [
    { when: '午前', who: '中高年・高齢の方' },
    { when: '午後の早い時間', who: '術後の方・大人の方' },
    { when: '夕方', who: '学生アスリート' },
    { when: '夜', who: '社会人・大人のスポーツ愛好家' },
  ],
  timeSlotNote: '使える時間を制限するのではなく、空いている時間帯の稼働を上げるため。',
  goal: {
    /** 戦略の目標（安定して達成したい月商） */
    monthlySales: 1_500_000,
    trial: {
      assessments: 16,
      assessmentPrice: 2000,
      selfUsers: 8,
      visitsEach: 4,
      selfPrice: 4350,
    },
    trialNote: '仮定に基づく試算。実際の料金・利用・予約枠・人件費・キャンセル率で確かめ直す。',
  },
  budget: { yen: 50_000, days: 90, note: '既存の機器・設備・アプリを生かし、高額な機器の購入は原則見送る。院長・スタッフの作業時間と外注費は含まない。' },
  allocation: [
    { label: '臨床サービスの充実', pct: 35 },
    { label: '新しい患者さんの獲得', pct: 25 },
    { label: '患者さんの体験の改善', pct: 20 },
    { label: '収益と業務の改善', pct: 15 },
    { label: '新しい技術の開発', pct: 5 },
  ],
  rules: [
    '医療機関との関係・柔道整復師の業務の範囲・広告の決まり・個人情報の保護を守る。',
    '患者さんにとって要らない施術や、続ける契約をすすめない。',
    'この戦略は公開情報と仮想の専門家チームによる検討から出した仮説。実際の患者さんの数字と経営の指標で確かめ続ける。',
  ],
  kpis: [
    { label: '月の売上（NOAH）', target: '150万円以上（アプリの月の目標は 200万円）', link: { href: '/marketing/sales/monthly', label: '月次レポート' } },
    { label: '初回の身体機能評価の数', target: '月 16人', link: { href: '/marketing/sales/pdca', label: 'PDCA（施策）' } },
    { label: '予約の数・初めての方', target: '—', link: { href: '/marketing/analytics', label: '集客の効果' } },
    { label: 'キャンセル率', target: '—', link: { href: '/marketing/sales/cancellations', label: 'キャンセル分析' } },
    { label: '患者さんの層ごとの売上・通院の続き方', target: '—', link: { href: '/marketing/sales/patients', label: '患者さんの動き' } },
  ],
}

/** 90日の実行計画（院長の文の3段階） */
export const STRATEGY_PHASES: StrategyPhase[] = [
  {
    key: 'p1',
    from: 1,
    to: 30,
    title: '整える（1〜30日）',
    tasks: [
      { id: 'p1-service', text: '4つの主力サービスの中身（対象・内容・時間・料金）を決める' },
      { id: 'p1-price', text: '料金体系を決める（初回の身体機能評価 20分・2,000円の試験を含む）' },
      { id: 'p1-format', text: '身体機能評価のフォーマットを決める', link: { href: '/patients', label: 'カルテ → 評価・測定 → アウトカム（疾患・競技のセット）' } },
      { id: 'p1-web', text: 'ホームページと予約の導線を整える', link: { href: '/marketing/analytics', label: '集客の効果（予約画面の進み具合）' } },
    ],
  },
  {
    key: 'p2',
    from: 31,
    to: 60,
    title: '試す（31〜60日）',
    tasks: [
      { id: 'p2-passport', text: 'リハビリパスポートを試す（まずは院内で、アウトカムのグラフを患者さんと一緒に見る）', link: { href: '/patients', label: 'カルテ → 評価・測定 → アウトカム' } },
      { id: 'p2-content', text: '大人・中高年の方に向けた発信を始める', link: { href: '/marketing/compose', label: '投稿を作る' } },
      { id: 'p2-signage', text: '院内サイネージで、評価と自費の目的を分かりやすく伝える', link: { href: '/dashboard', label: '今日 → 患者さんに見せる' } },
      { id: 'p2-report', text: '医療機関への経過報告書をそろえる', link: { href: '/patients', label: 'カルテ → 紹介状' } },
    ],
  },
  {
    key: 'p3',
    from: 61,
    to: 90,
    title: '測って絞る（61〜90日）',
    tasks: [
      { id: 'p3-analyze', text: '新規の数・予約率・キャンセル率・患者さんの層ごとの売上・時間あたりの収益・満足度を見る', link: { href: '/marketing/sales/monthly', label: '月次レポート' } },
      { id: 'p3-focus', text: '効果の高い施策に力を集める（続ける・直す・やめる）', link: { href: '/marketing/sales/pdca', label: 'PDCA（施策）' } },
    ],
  },
]

/**
 * 見直したほうがよい点（2026-11-27 Claude が戦略を読んで気づいたこと。院長が確かめる）
 * 確かめた結果は画面で「確認した」にできる。新しく気づいたら、ここに足す（id は変えない）
 */
export const STRATEGY_REVIEWS: StrategyReview[] = [
  {
    id: 'r-trial',
    title: '試算の内訳を書き分ける',
    detail:
      '月 171,200円は「初回の評価 16人×2,000円＝32,000円」と「自費 8人×4回×4,350円＝139,200円」を足した数です。文では自費の追加だけで 171,200円のように読めます。なお 4,350円は、いまの料金表（自費リハビリ 2,850円＋1部位 1,500円）と同じです。',
  },
  {
    id: 'r-goal',
    title: '目標の金額をそろえる',
    detail:
      '戦略は「月商 150万円以上を安定して」、アプリの「月の目標への道すじ」は 200万円（2026-11-27 院長が 300万円から変更）。150万円・200万円が、NOAH の金額分析の総額（保険の請求分を含む）のことか、決めておくと比べやすくなります。',
  },
  {
    id: 'r-entry',
    title: '初回の評価（2,000円）を始める前に決めること',
    detail:
      '金額は、ホームページの料金ページ・紹介動画・会員プランのご案内・契約書のひな形とそろえる決まりです（動画は作り直し）。保険の施術と同じ日に行うときの扱い（同じ時間に保険と自費を重ねない・請求は施術のとおり）を先に決めます。看板・チラシ・ホームページで料金や「術後サポート」を出すときは、柔道整復師法の広告の決まりに合うかを公開の前に確かめます。',
  },
  {
    id: 'r-passport',
    title: 'リハビリパスポートは「院内で一緒に見る」から',
    detail:
      '患者さんがご自分の記録を見るしくみは、いまの決まり（患者さんにお見せする画面は会員プランのご案内と紹介動画だけ）を変えることになります。まずは院内で、アウトカムのグラフを一緒に見る形で始め、ご本人のスマホで見る形は、見せ方（LINE でご本人だけ）・同意・プライバシーポリシーの追記を決めてからにします。',
  },
  {
    id: 'r-motion',
    title: '動作解析・新しい機器は90日の計画の外に',
    detail:
      'AI の動作解析は、以前院長の判断でアプリから外した機能です。戻すときは改めて決めます。エコー・表面筋電図・モーションキャプチャーは機器の購入が要るので、「高額な機器の購入は原則見送る」とあわせて、90日のあとに考えます。',
  },
  {
    id: 'r-subsidy',
    title: '医療費助成の前提は正しい（学生の方への説明はていねいに）',
    detail:
      '下関市は令和7年12月から、高校生年代まで通院の自己負担を全額助成しています（市の案内で確認）。学生の方の保険の施術は窓口の負担がないため、自費をおすすめするときは、保険でできることと自費の目的のちがいを、いつも以上にていねいに説明します（紹介動画と同じ考え方）。',
  },
  {
    id: 'r-timeslot',
    title: '時間帯ごとの埋まり具合を見えるようにする',
    detail:
      'いまの今日の画面の空きは午前・午後の枠の数だけで、時間帯ごとの埋まり具合（稼働）をまとめて見る画面はまだありません。これを出すと、時間帯ごとの集患の効果を数で確かめられます（アプリで作れます）。',
  },
  {
    id: 'r-satisfaction',
    title: '満足度は「送らない」方法で測る',
    detail:
      '満足度を測る方法がまだありません。公式LINE でアンケートを送ると、ブロックが増えるおそれがあります（11/26 のブロック対策）。会計時の紙や、院内の QR からの短いアンケートなど、こちらから送らない方法から始めます。',
  },
  {
    id: 'r-budget',
    title: '予算 5万円に、いま使っている有料のものを入れるか',
    detail:
      'アプリで使っている有料のもの（AI の相談・画像づくり・投稿サービスなど）も 90日・5万円に含めるかを決めておくと、管理しやすくなります。',
  },
]

/** 試算（院長の文の数字から計算。画面とテストで同じ） */
export function trialBreakdown(t = STRATEGY.goal.trial) {
  const assessment = t.assessments * t.assessmentPrice
  const self = t.selfUsers * t.visitsEach * t.selfPrice
  return { assessment, self, total: assessment + self }
}
