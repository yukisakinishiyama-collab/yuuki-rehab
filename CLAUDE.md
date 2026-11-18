# CLAUDE.md

このファイルは、リポジトリで作業する Claude Code (claude.ai/code) へのガイダンスを提供します。

@AGENTS.md

## コマンド

```bash
npm run dev      # 開発サーバー起動 (localhost:3000)
npm run build    # 本番ビルド
npm run lint     # ESLint
```

テストは `npm run test:tools`（`tools/test-*.mjs` と `tools/marketing/test-*.mjs` をまとめて tsx で走らせる。外には送らない・データは架空）。1本だけなら `npx tsx tools/test-◯◯.mjs`（node だけだと `@/` を読めず止まるものがある）。

## アーキテクチャ

ゆうき整骨院のサイトと院内アプリで、同一の Next.js App Router 上に二つの領域がある。

**公開サイト** — `src/app/(website)/` — 症状別ページ（ACL、半月板など）、ブログ、FAQ、料金、競技復帰ドリル。コンポーネントは `src/components/site/`。患者さん向けの LINE 予約の入口 `src/app/liff/` と `/api/liff` も公開。

**院内アプリ** — `src/app/(app)/` — 予約管理・カルテ・経営（売上・来院）・集客の4つに絞った院内専用アプリ。共通の枠は `src/components/rehab/AppShell.tsx` → `src/components/clinic/ClinicShell.tsx`（メニューは `src/components/clinic/nav.ts`。PCは左、スマホは下の5タブ）。

- 今日（ホーム）: `/dashboard` → `src/components/clinic/TodayDashboard.tsx`
  - 患者さんに見せる紹介動画（料金と会員プランのご紹介。声の解説つき・約2分。2026-11-16 院長の依頼。2026-11-17 に金額の見せ方と案内役を作り直した＝都度払いの月の合計を先に → 月額はリハビリ約8回分 → 含まれる物理療法は追加料金なし → 月8回で比べる。DECISIONS.md）: 今日 →「患者さんに見せる」→ `/dashboard/price-video`（`src/components/clinic/IntroVideoPage.tsx`）。「患者さんに見せる」を押すと、メニューを隠して動画だけを画面いっぱいに出す（`IntroVideoStage.tsx`。横長の画面＝横向き、縦長＝縦向きの動画。何も保存しない）。カルテの「契約・同意書」タブの「紹介動画を見せる」でも、カルテを開いたまま同じ動画を再生できる。動画・絵・字幕は `public/intro/`、動画の中の金額と決まりは `src/data/intro-videos.ts`（動画の金額は書きかえられないので、料金・条件を変えたら動画を作り直して `PRICE_GUIDE_FACTS` も直す。ひな形の金額や、カルテの「会員プランのご案内」の計算とずれると `npx tsx tools/test-intro-videos.mjs` が知らせる）。院内で通院中の方に見せる前提。SNS など院の外には、広告として点検し直すまで出さない。2本目の「料金のしくみと健康保険のご案内」（約4分20秒。2026-11-17 院長の依頼＝「高い」と言われる前に、保険が使えるケガ・使えないもの（厚生労働省の案内）→ 窓口は1〜3割 → 国が決めた1か所の施術料金は全部で676円（窓口3割で約200円。`INSURANCE_ONE_PART`）→ なぜ保険だけで終わらないほうがよいか（線のグラフ＝痛みは早く引くが筋力・バランスは遅れて戻る・イメージ図／100人の図＝足首のねんざでバランスの運動を加えると、くり返した人 33人→22人。研究の数字と出どころは `FEE_VIDEO_EVIDENCE`）→ 保険と自費は役割がちがう・時期と目的で使い分ける（帯のグラフ）→ 保険＋自費という選び方（ケガの手当ては保険・運動療法の時間は自費。理由＝ねんざ・打撲の保険の料金表に運動療法の項目が無い。組み合わせの合計金額は出さない）→ 2,850円に含まれるもの → 当院の特殊な物理療法（保険の電気＝電療料は機器にかかわらず1か所1回46円／専用の機器は用意と点検に費用がかかるので使う日だけ自費 1回1,100〜3,500円・会員は月額に含む。`FEE_SYSTEM_FACTS.devices`。ほかの院との比較・機器の効果の約束はしない）→ 料金の約束）は別の枠：今日 →「患者さんに見せる」→ `/dashboard/fee-video`（`FeeVideoPage.tsx`）。2本のページは共通の枠 `IntroVideoShell.tsx` を使い、並べる順は `INTRO_VIDEOS`。中身は `FEE_SYSTEM_FACTS`。保険の金額は1か所の例（令和8年7月からの金額）だけで、改定で変わったら直して動画を作り直す。「保険では不十分だから自費」とは言わない
- 予約: `/yoyaku`（GAS の予約管理画面を常駐 iframe で表示。`src/components/rehab/YoyakuFrame.tsx`）
- カルテ: `/patients/**`（`src/components/rehab-management/`。SOAP・来院カレンダー・評価・アウトカム・問診・メモ・疑問・AI相談・患部の写真・画像レポート（CDのDICOMの読影。下の「画像レポート」）・契約・同意書（指で署名・院保管用と患者様控えの印刷・会員プランの状態・患者様にお見せする「会員プランのご案内」）・キャンセル・紹介状）
  - 再評価の時期（2026-11-18 院長の指示書。DECISIONS.md）: 予定日を決めた方だけ、患者さん一覧とカルテの上に小さなマーク（「評価まもなく」3日前〜前日・「要再評価」当日・「評価期限超過」。赤は使わない＝医学的な危険の知らせとは別）。押すと「評価・測定」のいちばん上の「再評価」欄（`ReevalPanel.tsx`。予定日を決める＝7・14・28日後・日付／延期は理由必須／前回と今回の比べ＝今ある記録だけ／「再評価を完了する」で履歴に残して次回日を入れる）。予定は `pt_reeval_plans`、決まりは `src/lib/reeval/`（日本時間で数える）。SOAP の「再評価予定」に日付を書いて保存するとその日が予定日になる（SOAP の保存では完了にしない。前のカルテの日付は自動で予定にしない）。`npx tsx tools/test-reeval.mjs`
  - 自宅運動の実施状況は 実施・一部実施・未実施・未確認（新しいカルテの初期値は未確認）。未実施・一部は理由をタップで（`src/lib/karte/adherence.ts`）。簡易メモに種類（治療方針の説明・同意、中断の申し出 など。`src/lib/karte/memo-kinds.ts`）。`npx tsx tools/test-adherence-memo.mjs`
  - 図の左右（2026-11-18 院長の指摘で直した。DECISIONS.md）: 人体図（`BodyMap.tsx`）の前面は向かって左が患者さんの右、背面は向かって左が患者さんの左（図の角に「右」「左」）。腰部の解剖図の後面も向かって右が患者さんの右。部位の ID と名前はカルテの保存値なので変えない（動かすのは絵の上の場所だけ）。ペン・×印の座標は、前の決まりで描いた記録（`diagramLayout` が無い）を出すとき・引き継ぐときに左右を入れかえる（`src/lib/anatomy/layout.ts`）。`npx tsx tools/test-diagram-layout.mjs`
  - SOAP の「文を選ぶ」（2026-11-18 院長の依頼。DECISIONS.md）: 文字を書く 19 の欄に「＋ 文を選ぶ」（`SoapPhraseField.tsx`）。タップで欄のうしろに足し、もう一度で外す（書いてある文字は消さない）。その方の部位の文を先に出す。数字を書く文は「＿」が選ばれてそのまま打てる。文は `src/data/soap-phrases.ts`（足す・直すのはここだけ。院にある機器の名前だけ・効果を約束する言い方は入れない）、入れ方の決まりは `src/lib/karte/soap-phrases.ts`。`npx tsx tools/test-soap-phrases.mjs`
  - 復帰プログラム（2026-11-18 院長の依頼。DECISIONS.md）: 「評価・測定」の再評価の下の欄（`ReturnProgramPanel.tsx`）。段階的に競技・ランニング・投球へ戻す手順が10本（投球・ACL後ランニング・足首ねんざ・骨ストレス障害・アキレス腱・膝蓋腱・オスグッド・ハムストリング・内転筋・成長期の腰。手関節・頚部は文献を確かめられず作っていない）。中身と文献は `src/data/return-programs.ts`＝`sources[].found` は PubMed で読んだ範囲（`checked`＝全文／抄録）に書いてあったことだけ、段階の距離・回数は当院用の目安、確かめられなかったことは `unverified`。効果・復帰を約束する言い方はしない・医師の指示を優先・論文の表は写さない。その方の進み具合（始める・進む・戻す・終了・中止・再開と履歴）は `pt_return_programs`（`src/lib/return-programs/`）。プログラムと段階の id は保存値（変えない）。進行中の段階は SOAP の「文を選ぶ」にも出る。院内用で、患者さんにお見せする画面ではない。消した「プロトコル立案」「疾患/文献ライブラリ」とは別。`npx tsx tools/test-return-programs.mjs`
  - 資料（2026-11-18 院長の依頼。DECISIONS.md）: カルテの「資料」タブ（`DocsTab.tsx`）に、その方の症例に関する論文・リハビリプロトコル・医療機関の書類を、ファイル（PDF・画像・Word・Excel・PowerPoint。1つ20MBまで）かリンク（URL・DOI・PMID）で入れる。種類・題名・メモつき。ファイルは Supabase Storage の非公開バケット karte-docs、題名・メモ・保存場所は `pt_karte_docs`（ふつうの同期）。大きい PDF は API を通せない（1回4.5MB）ので、`/api/karte/docs` が作った署名つきの宛先へ端末から直接送り、開くときは1時間だけ使える URL（`src/lib/karte/doc-rules.ts`・`doc-client.ts`・`doc-storage-server.ts`）。ほかのカルテの論文・プロトコルは送り直さずに入れられる（医療機関の書類・その他は出さない）。ファイルを消すのは、同じ保存場所を指す資料がほかに無いときだけ。削除済みの「疾患/文献ライブラリ」とは別（院長が自分で入れる添付）。`npx tsx tools/test-karte-docs.mjs`
- 経営: `/marketing/sales`（NOAH の売上・来院）、`/marketing/analytics`（集客の効果）
- 集客: `/marketing/**`（自動投稿・投稿づくり・LINE導線・口コミ返信など。`src/lib/marketing/`）。Google検索向けの投稿（「下関市彦島＋症状」に絞った決まった文＋院の写真の画像。`src/data/gbp-seo-posts.ts`・`src/lib/marketing/gbp-seo*.ts`・写真は `assets/gbp-photos/`。人物が特定されないもの＝`GBP_SAFE_PHOTOS` だけを置く）は、自動投稿の設定でオンにすると毎週（既定は月12時・金18時）承認なしで予約される。投稿ごとの予約ボタンのタップ・予約と、Googleの成果（Business Profile Performance API：表示・電話・ルート・ウェブサイト・「検索された言葉」。`gbp-performance*.ts`・`/api/marketing/google/performance`）は 経営 → 集客の効果 に出る。Search Console（ホームページの検索キーワード・掲載順位。`gsc*.ts`・`/api/marketing/google/search-console`）も同じ「Googleとつなぐ」で webmasters.readonly を一緒にもらって読む。GA4 は未設置（アカウントが無い）。`node tools/test-gbp-seo.mjs`。集客の効果には、予約画面の進み具合（ネット予約の画面を開いてから確定するまで、段階ごとの回数。予約システム v3.17〜が日付×流入元で数える。人数ではなく回数・お名前などは数えない。`booking-funnel.ts`・`npx tsx tools/marketing/test-booking-funnel.mjs`）も出る。Google へ出す投稿は、Google の審査で拒否されないように（2026-11-12 に調べた：「予約」ボタンに予約システム＝script.google.com のアドレスを入れた投稿と、本文に電話番号を書いた投稿が拒否されていた）、ボタンのリンクは院のホームページ（shimonoseki-yuuki.com のそのページ＋utm_source=google_post）か公式LINEだけにし、本文から URL・電話番号を取る（`gbp-post-rules.ts`）。出したあと、Google の審査の結果を jobs/run で確かめ、拒否なら「公開失敗（Googleが拒否）」にして院長のLINEへ。Googleの画面から出した投稿の拒否も半日に1回見て、「投稿の予定と結果」に出す（`gbp-posts-server.ts`・`/api/marketing/google/posts`）。`npx tsx tools/test-gbp-post-rules.mjs`。宣伝の短い動画（YouTubeショート・TikTok。同じ18テーマを絵＋文字の縦動画・約16秒に。絵は基本AI＝前半2場面は OpenAI の画像生成で作ったイメージ（場面の説明は英語で `ai` に。院・スタッフ・施術はAIに描かせない。画面に「映像はイメージです」）、後半は人物が特定されない院の写真 `PROMO_SAFE_PHOTOS`（足首とエコー・エコーの機械・器具・外観）だけ。文面は `src/data/promo-videos.ts`、組み立ては `src/lib/marketing/promo-video-render.tsx`（next/og の文字の面＋ffmpeg）、作りおきと毎週の予約は `promo-video-server.ts`、YouTube の連携は `youtube-server.ts`）は、自動投稿の設定でオンにすると毎週（既定は水13:30）同じ動画を両方へ予約する。自動で出すときは Buffer（審査済みの投稿サービス。`src/lib/marketing/buffer*.ts`・`/api/marketing/buffer`。キーは院長が設定画面に貼る＝KV の `buffer:config`、または Vercel の BUFFER_API_KEY）を通し、院長の承認が要る（`src/lib/marketing/promo-approval.ts`）：投稿の前日に見本の動画と「承認して投稿・今回は見送る・別の動画にする」を院長のLINEへ（jobs/run の `requestPromoApprovals`）→ 承認した動画だけ、時間になったら Buffer で公開（承認が無いまま時刻から24時間たったら出さない）→ 出たかを後で確かめ、出せなければ動画と文をLINEへ（`checkBufferPromoPosts`）。Buffer につないでいない媒体は、時間になると動画と貼る文を院長のLINEへ届けて手で投稿。YouTube に直接送るのは「YouTubeとつなぐ」と「審査に通った」の両方がそろったときだけ（審査の前に送ると非公開に固定されるため）。同じ動画は Instagram のリールにも出す（設定の `instagramReels`。Buffer は通さず、ふだんの投稿と同じ Instagram の連携で `publishInstagramReel`＝media_type REELS・フィードにも表示。承認の流れは同じ。連携が無ければLINEへ届けて手で）。`node tools/test-promo-video.mjs`・`node tools/test-promo-approval.mjs`

予約のLINE（LINE連携の方へ。2026-11-05 院長の依頼）: 予約システムから「新しい予約」の通知が来たら、電話＋お名前（無ければカルテのお名前＋生年月日）で LINE 連携を探し、15秒待って予約システムが送っていなければ「確定しました」を1通。予約は KV の `linersv:<予約番号>` に控え、jobs/run から前日の10〜20時に前日のお知らせを送る（予約システムと同じ印で1通だけ・「予約のお知らせ停止」の方には送らない・テストの見本だけだった分は「動かす」にしたらご本人へ）。「今日」の「LINEで予約日時を送る」を開くと、読んだ一覧で控えをそろえる。どれも 集客 → 自動化設定 の「予約確認の LINE」「前日のお知らせ」に従う。`src/lib/marketing/line-reservation-server.ts`・`patient-line-push-server.ts`・`node tools/test-line-reservation.mjs`。患者さんが予約ページで日時を変更したとき（2026-11-16 院長の依頼。予約システム v3.20〜）は、予約システムから kind:'change' が届き、院長のLINEへ知らせ、ご本人のLINEへ「日時を変更しました」を1通、控えを新しい日時に直す（`onChangeReservation`）。確定・前日・変更のお知らせには、日時の変更・キャンセルを入力なしで開けるリンク（予約ページの ?rsv=予約番号&rk=署名。署名は予約システムと同じ計算＝`src/lib/reservation-change-link.ts`。文面は `src/lib/reservation-message.ts`）を入れる。`npx tsx tools/test-reservation-change.mjs`

院内アプリと院内用のAPIは `src/proxy.ts` の Basic 認証（院長／スタッフのパスワード）で守る。LINE の中のブラウザはパスワードの入力画面を出さないので、院長のLINEへ送るお知らせ（`owner-notify.ts`）の院内アプリへのリンクには、送るときに openExternalBrowser=1 を付けて端末のブラウザで開かせる（`src/lib/marketing/line-links.ts`・`npx tsx tools/marketing/test-line-links.mjs`）。パスワードが無いまま画面を開いたときは、401 のまま「LINE からはブラウザで開く」の案内を出す（`npx tsx tools/test-proxy.mjs`）。以前あった動作解析（動画・姿勢）、プロトコル立案・疾患/文献ライブラリ、患者さん向けの説明・問診・カラダマップの画面は削除済み。（患者様にお見せする画面は、カルテの「会員プランのご案内」と、今日の「患者さんに見せる」の紹介動画だけ。院長の指示で 2026-11-13・2026-11-16 に足した。DECISIONS.md）

### データ層

- カルテ: `src/lib/patient-store.ts` 経由で端末の `localStorage`（`pt_*`）に保存。`/api/sync` でクラウド（Supabase の KV）と同期（`src/lib/sync-service.ts`・`sync-merge.ts`。変わった記録だけを id ごとに送って重ねる。カルテの画面では15秒ごとに取り込み、「すぐに反映する」ボタンで今すぐ）
- 契約書・同意書: ひな形は `src/data/contract-templates.ts`（もとはドライブ「ゆうき整骨院_契約書テンプレート」。7種類。「施術・リハビリテーション 説明および同意書」は院長の PDF から＝7 の「同意します」だけにチェックのときに署名できる `src/lib/contracts/consent.ts`）。署名済みの一覧は `pt_contracts`、署名入りの本文は KV の `kcdoc:<id>`（`/api/karte/contracts`。一度保存したら書きかえない）。記入欄は、署名と □ のチェック以外をカルテ・今日の日付・会員の手続きの欄から自動で埋める（`src/lib/contracts/autofill.ts`。欄は前の文字と表の行の見出しで見分ける。`node tools/test-contracts.mjs`）。会員プランの書類（入会・休会・解約）は、いちばん上に「ご契約内容」の枠（だれが・どのプランを・いくらで・いつから＋直筆の署名）が入り、院保管用にも患者様控えにも同じものが出る。署名済みの一覧の「内容を見る・印刷する」で、アプリの画面でも中身を確かめられる（`src/lib/contracts/summary.ts`。枠の数字は文面から読む。前に署名した書類は保存した本文を書きかえず、見るとき・印刷するときにだけ枠を足す）。会員プランのご案内（`src/components/rehab-management/MemberPlanGuide.tsx`。「契約・同意書」タブの「ご案内を開く」で画面いっぱいに出す、患者様にお見せする説明。対象 → 状態と目標 → 内容 → 料金 → 都度払いとの比較（その方の回数・部位・物理療法で計算）→ 重要事項 → 選び方と流れ。最後のページから入会の契約書へ進める。となりの「紹介動画を見せる」で、同じ内容の動画をその場で画面いっぱいに再生できる。何も保存しない。2026-11-13 院長の指示。効果を約束する言い方はしない）の金額と計算は `src/lib/contracts/member-guide.ts`（月額・来院ごとの1部位施術料＝健康保険を使う日 1,000円＋保険の窓口料金／使わない日 1,500円・会員は材料費の追加なし・都度払いの料金）。ひな形・紹介動画（`src/data/intro-videos.ts`）・ホームページの料金ページと、金額も言い方も同じにする（`npx tsx tools/test-member-guide.mjs`・`npx tsx tools/test-intro-videos.mjs`。どれかを変えたら全部直す。2026-11-16 院長の指示）。会員の日付の決まりは `src/lib/contracts/member.ts`（兄弟・親子プラン＝2名まで月額30,000円は契約者のカルテで手続きし、もう1名のカルテにも `memberStatusForPatient` で状態を出す）。アウトカムは `pt_outcomes`（指標と競技ごとの評価セット＝野球・サッカー・陸上・バスケ/バレー・ACL術後は `src/data/outcome-metrics.ts`、LSI・左右差・GIRD/TRM の計算は `src/lib/outcomes/calc.ts`、患者さんごとの競技は `pt_outcome_settings`。目安の線は論文で使われた値で、出どころを画面に出す。`node tools/test-outcome-sets.mjs`）
- バックアップ: 設定 → バックアップ（`src/components/clinic/BackupPanel.tsx`・`src/lib/backup/`）。クラウドの毎月の控え（KV の `backup:YYYY-MM`、12か月。Cron で毎日確かめて無ければ作る `/api/backup/monthly`）と、院長のパソコンのフォルダへの保存（File System Access。カルテ全部・署名入りの契約書・写真・資料のファイル）。`/api/backup` は院長だけ
- 端末ログイン: `src/lib/rehab-store.ts`（院内専用のため未ログインなら自動ログイン）
- 集客・経営: `src/lib/marketing/kv-store-server.ts`（Supabase 設定時は KV テーブル）
- 予約: GAS の予約システム（`?api=feed` / `?api=hubstats` / `?api=noahstats`）と連携

主な API: `/api/marketing/**`、`/api/sync`、`/api/yoyaku/feed`、`/api/intake-analysis`・`/api/referral-generate`（Anthropic SDK）、`/api/voice/transcribe`（カルテの音声入力。録音を OpenAI で文字に）・`/api/voice/organize`（文字起こしから患者さんの情報だけを Claude で S/O/A/P・メモに整理。欄に入れるだけで保存は院長）、`/api/karte/consult`（カルテの「疑問・AI相談」。お名前などを除いた要約と疑問を Claude に送る。`src/lib/karte/`）、`/api/karte/photos`（患部の写真。Supabase Storage の非公開バケット karte-photos に保存。メタデータは `pt_karte_photos`）、`/api/karte/docs`（カルテの資料。非公開バケット karte-docs。保存用の署名つきの宛先・開く用の URL・削除）、`/api/karte/imaging`（画像レポートのPDF。非公開バケット karte-imaging）、`/api/upload`（動画ストックの Vercel Blob 保存）、`/api/liff/verify`。

### 画像レポート（CDのDICOMの読影。2026-11-18 院長の依頼。DECISIONS.md）

カルテの「画像レポート」タブ（`src/components/rehab-management/ImagingReportsTab.tsx`）で、患者さんのCD（単純X線・MRI・CT）を読み取り、AIの画像所見レポート（参考意見・A4のPDF）を作ってカルテに提出する。以前の別アプリ「症例アシスト」は削除済み（計測・相談・イラストは移していない）。

- 読影は **院のパソコンの読影プログラム**（`tools/dicom-reader`。Python。127.0.0.1:8791 で待ち、そのパソコンの Claude Code＝院長の Claude のプランで読む。入れ方と決まりは `tools/dicom-reader/README.md`）。院内アプリのサーバーからAIは呼ばない。ほかの端末では、提出済みのレポートを見るだけ
- 流れ：CDを読み込む → CDの方とカルテの方が同じかを比べる（`src/lib/karte/imaging.ts` の `checkIdentity`。生年月日がちがえば確かめるまで進めない）→ 検査を選ぶ・主訴を書く・見本の画像に氏名などの文字が無いことを確かめる → 読影（10〜25分。画面を閉じてもパソコンの中で続く）→ 下書きのPDFを確かめる →「カルテに提出する」
- 氏名・患者ID・生年月日・施設名・撮影日はAIに渡さない。PDFの見出し・免責・「見積もりは主観的」の注記は読影プログラムが入れる（AIは決まった形の `report.json` と図の指定だけを書く）
- 保存：PDFは Supabase Storage の非公開バケット `karte-imaging`（`/api/karte/imaging`。`src/lib/karte/imaging-storage-server.ts`。4MBまで・書きかえない）、要点（部位・総括・見積もり・場所）は `pt_imaging_reports`（ほかのカルテの記録と同じく `/api/sync` で同期）。パソコンのフォルダへのバックアップには「画像レポート」フォルダとしてPDFも入る
- ブラウザから読影プログラムへは `src/lib/karte/imaging-client.ts`（`READER_URL`）。読影プログラムは決めたアドレス（本番の2つ）のページからしか受けない。プレビューで試すときは、パソコンの `config.json` の `origins` にそのアドレスを足す
- テスト：`npx tsx tools/test-imaging-reports.mjs`（比べ方・記録の形）、`python -m pytest tools/dicom-reader/tests -q`（架空のDICOMと Claude Code の代わりで、読み込み → 読影 → PDF まで。氏名などがAIの作業フォルダに無いことも確かめる）

### 解剖図（関節の部位えらび）

`src/components/rehab-management/AnatomyMap.tsx` が、`src/lib/anatomy/zones/<key>.json`（向きごとの画像 `public/anatomy/<key>/<view>.webp` ＋ 押せる部位の多角形）を読んで表示する。JSON が無い関節は従来の `JointDetailMap.tsx` に戻る。図と座標は Codex が `docs/anatomy-illustrations-brief.md` の仕様で納品し、`node tools/test-anatomy-zones.mjs` で検査する。部位ID（`JOINT_ZONES`）はカルテの保存値なので増減しない。計画全体は `docs/karte-soap-upgrade.md`。

### スタイリング

Tailwind CSS 4（`@tailwindcss/postcss` 経由）。カスタムトークン（`--color-navy`、`--color-line`）と `.hero-h1` のレスポンシブ見出しは `src/app/globals.css` の `@theme` で定義。CSS Modules は使用しない。日本語フォントスタック（Hiragino Sans → Noto Sans JP）。

### 型定義

カルテの型は `src/types/patient.ts`（Patient、SOAPNote、Evaluation、ROMRecord など）。復帰基準・アウトカム評価は `src/types/return-criteria.ts`・`src/types/outcome-scores.ts`。端末ログインのユーザーは `src/types/rehab.ts`。

### パスエイリアス

`@/*` は `src/*` に解決される。
