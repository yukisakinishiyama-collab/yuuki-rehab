// 患者さんにお見せする紹介動画（今日 →「患者さんに見せる」）の検査
//   npx tsx tools/test-intro-videos.mjs
// - 動画・絵・字幕のファイルがそろっているか（大きすぎないか）。2本（料金と会員プラン／料金のしくみと健康保険）とも
// - 動画の中の金額（PRICE_GUIDE_FACTS）が、契約書・料金案内のひな形と同じか
//   （料金を変えたのに古い動画を見せ続けないように。ずれたら動画を作り直して FACTS も直す）
// - カルテの「会員プランのご案内」（lib/contracts/member-guide.ts）と同じ金額・同じ比べ方か
// - 向きの選び方・長さの表記
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { FEE_SYSTEM_FACTS as FS, FEE_SYSTEM_VIDEO as FV, FEE_VIDEO_EVIDENCE as EV, INSURANCE_ONE_PART as IO, INTRO_VIDEOS, insuranceOnePartTotal, windowPayment, PRICE_GUIDE_FACTS as F, PRICE_GUIDE_VIDEO as V, lengthLabel, paygPerVisit, pickOrientation, videoMemberMonthly, videoPaygMonthly, yen } from '../src/data/intro-videos.ts'
import { CONTRACT_TEMPLATES } from '../src/data/contract-templates.ts'
import * as G from '../src/lib/contracts/member-guide.ts'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('✓', name) }
const pub = (p) => new URL(`../public${p}`, import.meta.url)
const body = (id) => CONTRACT_TEMPLATES.find((x) => x.id === id).body

t('横向き・縦向きの動画と絵がある（mp4・大きすぎない。2本とも）', () => {
  assert.deepEqual(INTRO_VIDEOS.map((x) => x.id), ['price-guide', 'fee-insurance'])
  assert.equal(new Set(INTRO_VIDEOS.map((x) => x.page)).size, INTRO_VIDEOS.length, '動画ごとに別のページ')
  for (const video of INTRO_VIDEOS) {
    for (const o of ['land', 'port']) {
      const f = video.files[o]
      assert.ok(existsSync(pub(f.src)), `${f.src} が無い`)
      assert.ok(existsSync(pub(f.poster)), `${f.poster} が無い`)
      const size = statSync(pub(f.src)).size
      assert.ok(size > 500_000 && size < 15_000_000, `${f.src} の大きさ ${size}`)
      // mp4 のしるし（先頭の ftyp）
      assert.equal(readFileSync(pub(f.src)).subarray(4, 8).toString('latin1'), 'ftyp')
    }
    assert.ok(video.files.land.width > video.files.land.height)
    assert.ok(video.files.port.height > video.files.port.width)
  }
})

t('字幕（声の文字）は時刻の順に並び、動画の長さに収まる（2本とも）', () => {
  const sec = (s) => { const [h, m, x] = s.split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(x) }
  for (const video of INTRO_VIDEOS) {
    const vtt = readFileSync(pub(video.captions), 'utf8')
    assert.ok(vtt.startsWith('WEBVTT'))
    const cues = [...vtt.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n(.+)/g)].map((m) => [sec(m[1]), sec(m[2]), m[3]])
    assert.ok(cues.length >= 20, `${video.id}：字幕が ${cues.length} 行`)
    let prev = 0
    for (const [a, b, text] of cues) {
      assert.ok(a >= prev - 0.2 && b > a, `${video.id}：時刻の順がおかしい：${text}`)
      assert.ok(text.trim().length > 0)
      prev = b
    }
    assert.ok(prev <= video.seconds + 1, `${video.id}：最後の字幕 ${prev} が動画の長さ ${video.seconds} を超える`)
  }
})

t('料金のしくみと健康保険の動画：金額は料金案内・料金と会員プランの動画と同じ。言い方の決まり', () => {
  const fee = body('fee-cancel-policy')
  assert.ok(fee.includes(`| リハビリ（約30分） | ${yen(FS.paygRehab)} |`))
  assert.ok(fee.includes(`| 施術料金（1部位） | ${yen(FS.paygPart)} |`))
  assert.equal(FS.paygRehab, F.paygRehab)
  assert.equal(FS.paygPart, F.paygPart)
  assert.equal(FS.firstVisit, F.firstVisit)
  // 保険のきまりは厚生労働省の案内（出どころを画面に出す）。骨折・脱臼は医師の同意
  assert.ok(FS.insuranceSource.url.startsWith('https://www.mhlw.go.jp/'))
  assert.ok(FS.insuranceCovered.some((x) => x.includes('骨折') && x.includes('医師の同意')))
  assert.equal(FS.windowShare, '1〜3割')
  // 字幕（声の文）：保険の施術を下げて見せない・効果を約束しない・急がせない
  const vtt = readFileSync(pub(FV.captions), 'utf8')
  for (const word of ['不十分', '治ります', '必ず', '今だけ', '今すぐ', '他院']) assert.ok(!vtt.includes(word), `字幕に「${word}」`)
  for (const word of ['目的がちがう', '2,850円', '施術の前にお伝えします', '了承をいただいてから', '医師の同意']) assert.ok(vtt.includes(word), `字幕に「${word}」が無い`)
  // 1か所の料金（国が決めた金額・令和8年7月から）：後療料550円＋温罨法80円＋電療46円＝676円、窓口3割で約200円
  assert.deepEqual([IO.koryo, IO.onanpo, IO.denryo], [550, 80, 46])
  assert.equal(insuranceOnePartTotal(), 676)
  assert.deepEqual([0.3, 0.2, 0.1].map((r) => windowPayment(676, r)), [200, 140, 70])
  assert.equal(IO.since, '2026-07-01')
  assert.ok(IO.source.url.startsWith('https://www.mhlw.go.jp/'))
  assert.ok(vtt.includes(`${insuranceOnePartTotal()}円`) && vtt.includes(`およそ${windowPayment(insuranceOnePartTotal(), 0.3)}円`))
  // 研究の数字（100人中○人）は、声・字幕と出どころの数字が同じ。出どころを画面に出す
  assert.deepEqual([EV.painAtOneYear.min, EV.painAtOneYear.max], [5, 33])
  assert.deepEqual([EV.recurrence.usualCare, EV.recurrence.withBalanceTraining, EV.recurrence.weeks], [33, 22, 8])
  assert.ok(vtt.includes(`100人に${EV.painAtOneYear.min}人から${EV.painAtOneYear.max}人`))
  assert.ok(vtt.includes(`100人中${EV.recurrence.usualCare}人`) && vtt.includes(`100人中${EV.recurrence.withBalanceTraining}人`))
  assert.ok(EV.painAtOneYear.doi.startsWith('10.') && EV.recurrence.doi.startsWith('10.'))
  const page = readFileSync(new URL('../src/components/clinic/FeeVideoPage.tsx', import.meta.url), 'utf8')
  assert.ok(page.includes('EV.painAtOneYear.doi') && page.includes('EV.recurrence.doi') && page.includes('すべての方に当てはまるわけではない'))
  // 保険＋自費：理由（ねんざの保険の料金表に運動療法の項目が無い）を声で伝える。組み合わせの合計金額は出さない
  assert.deepEqual([...FS.exerciseItemOnlyFor], ['骨折', '脱臼', '不全骨折'])
  assert.ok(vtt.includes('運動療法の項目が、ないため') && vtt.includes('自費は、必要なぶんだけ'))
  assert.ok(!vtt.includes('3,050円'), '組み合わせの合計金額は出さない')
  // ほかの保険の金額（初検料など）は入れない
  for (const word of ['初検料', '1,560円', '再検料']) assert.ok(!vtt.includes(word), `字幕に「${word}」`)
})

t('動画の金額は、料金案内のひな形と同じ（都度払い・物理療法・会員の月額）', () => {
  const fee = body('fee-cancel-policy')
  assert.ok(fee.includes(`| リハビリ（約30分） | ${yen(F.paygRehab)} |`))
  assert.ok(fee.includes(`| 施術料金（1部位） | ${yen(F.paygPart)} |`))
  assert.ok(fee.includes(`| 一般会員（月額） | ${yen(F.memberGeneral)} |`))
  assert.ok(fee.includes(`| 学生会員（月額） | ${yen(F.memberStudent)} |`))
  // 物理療法：都度払いの表のうち、リハビリ・施術料金のほかの行のいちばん安い・高い金額
  const start = fee.indexOf('### (2)')
  const table = fee.slice(start, fee.indexOf('### (3)', start))
  const rows = [...table.matchAll(/^\| ([^|*]+) \| ([\d,]+)円 \|$/gm)].filter((m) => !/リハビリ|施術料金/.test(m[1]))
  const prices = rows.map((m) => Number(m[2].replace(/,/g, '')))
  assert.ok(prices.length >= 4, `物理療法の行が ${prices.length}`)
  assert.equal(Math.min(...prices), F.physioMin)
  assert.equal(Math.max(...prices), F.physioMax)
  assert.equal(paygPerVisit(), 4350)
})

t('月額に含まれる物理療法（動画で「追加料金なし」と見せている4つ）：料金案内の金額・含まれる内容と同じ', () => {
  const fee = body('fee-cancel-policy')
  for (const p of F.includedPhysio) assert.ok(fee.includes(`| ${p.name} | ${yen(p.fee)} |`), p.name)
  // 料金案内の「会員プランに含まれる内容」に、この4つの名前がある（コンビネーションは「治療」「療法」のどちらの書き方も）
  const inc = fee.slice(fee.indexOf('### 会員プランに含まれる内容'), fee.indexOf('### ご注意事項'))
  for (const word of ['体外衝撃波', '5D', 'コンビネーション', '微弱電流エレサス']) assert.ok(inc.includes(word), word)
  // 使用は当院が判断する（通い放題・使い放題と誤解させない）
  assert.ok(fee.includes('物理療法の使用は、症状・評価結果・安全性・必要性を踏まえ当院が判断します'))
})

t('会員の1回ごとの施術料：保険を使う日・使わない日とも、ひな形と同じ', () => {
  const fee = body('fee-cancel-policy')
  const member = body('member-contract')
  const row = `| 来院ごとの1部位施術料（別途） | 健康保険を使う日 ${yen(F.memberPartWithInsurance)}＋保険の窓口料金／健康保険を使わない日 ${yen(F.memberPartNoInsurance)} |`
  assert.ok(fee.includes(row))
  assert.ok(member.includes(row))
  // 健康保険を使う日は、施術料金として別途 1,000円（＋保険の窓口料金）
  assert.ok(fee.includes(`施術料金として別途${yen(F.memberPartWithInsurance)}`))
})

t('動画と、カルテの「会員プランのご案内」の金額が同じ（月額・施術料・都度払い・材料費）', () => {
  assert.equal(G.MEMBER_MONTHLY['一般会員'], F.memberGeneral)
  assert.equal(G.MEMBER_MONTHLY['学生会員'], F.memberStudent)
  assert.equal(G.MEMBER_PART_FEE_WITH_INSURANCE, F.memberPartWithInsurance)
  assert.equal(G.MEMBER_PART_FEE, F.memberPartNoInsurance)
  assert.equal(G.MEMBER_MATERIALS_INCLUDED, F.memberMaterialsIncluded)
  assert.equal(G.PAYG_FEES.rehab, F.paygRehab)
  assert.equal(G.PAYG_FEES.part, F.paygPart)
  assert.equal(G.paygPerVisit(1, 0), paygPerVisit())
  // 動画の比べ方（月8回・物理療法なし／微弱電流を毎回／体外衝撃波を毎回）は、ご案内の計算と同じ数字になる
  const elesas = G.PHYSIO_OPTIONS.find((p) => p.id === 'elesas').fee
  const eswt = G.PHYSIO_OPTIONS.find((p) => p.id === 'eswt').fee
  assert.deepEqual(F.compareExamples.map((x) => x.fee), [elesas, eswt])
  assert.equal(F.compareVisits, 8)
  assert.deepEqual(G.compareGuide({ plan: '一般会員', visits: 8, parts: 1, physioFee: 0 }), { payg: 34800, member: 35000, diff: -200, cheaper: 'payg' })
  assert.deepEqual(G.compareGuide({ plan: '一般会員', visits: 8, parts: 1, physioFee: elesas }), { payg: 47600, member: 35000, diff: 12600, cheaper: 'member' })
  assert.deepEqual(G.compareGuide({ plan: '一般会員', visits: 8, parts: 1, physioFee: eswt }), { payg: 62800, member: 35000, diff: 27800, cheaper: 'member' })
  // 「物理療法なしでも月9回からは会員プランのほうが少ない」「月12回」
  assert.equal(G.breakEvenVisits('一般会員', 1, 0), 9)
  assert.deepEqual(G.compareGuide({ plan: '一般会員', visits: 9, parts: 1, physioFee: 0 }), { payg: 39150, member: 36500, diff: 2650, cheaper: 'member' })
  assert.deepEqual(G.compareGuide({ plan: '一般会員', visits: 12, parts: 1, physioFee: 0 }), { payg: 52200, member: 41000, diff: 11200, cheaper: 'member' })
  // スタッフ用の画面に出す数字（動画と同じ計算）
  for (const [n, fee] of [[8, 0], [8, elesas], [8, eswt], [9, 0], [12, 0]]) {
    const c = G.compareGuide({ plan: '一般会員', visits: n, parts: 1, physioFee: fee })
    assert.equal(videoPaygMonthly(n, fee), c.payg)
    assert.equal(videoMemberMonthly(n), c.member)
  }
  // 「月額23,000円は、リハビリおよそ8回分」
  assert.equal(F.paygRehab * 8, 22800)
  assert.ok(Math.abs(F.memberGeneral - F.paygRehab * 8) <= 300)
  // 学生会員は、各4,000円少ない
  assert.equal(F.memberGeneral - F.memberStudent, 4000)
  // カルテの「契約・同意書」タブから、カルテを開いたまま動画を再生できる。動画のページからは、ご案内への案内がある
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  const tab = read('src/components/rehab-management/ContractsTab.tsx')
  assert.ok(tab.includes('<IntroVideoStage ') && tab.includes('紹介動画を見せる'))
  assert.ok(tab.includes('pickOrientation(window.innerWidth, window.innerHeight)'))
  // 画面いっぱいの動画は1つの部品（今日のページとカルテで同じもの）。ご案内（z-[60]）より手前に出す
  const stage = read('src/components/clinic/IntroVideoStage.tsx')
  assert.ok(stage.includes('z-[70]') && stage.includes('no-print') && stage.includes('aria-modal="true"'))
  // 動画ごとのページは、共通の枠（IntroVideoShell）から、その動画を画面いっぱいに出す
  assert.ok(read('src/components/clinic/IntroVideoShell.tsx').includes('<IntroVideoStage video={V} '))
  assert.ok(read('src/components/clinic/IntroVideoPage.tsx').includes('<IntroVideoShell video={V}>'))
  assert.ok(read('src/components/clinic/FeeVideoPage.tsx').includes('<IntroVideoShell video={V}>'))
  assert.ok(read('src/components/clinic/IntroVideoPage.tsx').includes('会員プランのご案内'))
  assert.ok(read('src/components/rehab-management/MemberPlanGuide.tsx').includes("title: '材料費'"))
})

t('最低利用期間は、契約書と同じ', () => {
  assert.ok(body('member-contract').includes(`最低利用期間は、利用開始日から${F.minimumMonths}か月間です`))
})

t('向きの選び方（横長＝横向き・縦長＝縦向き）と、長さの表記', () => {
  assert.equal(pickOrientation(1024, 768), 'land')
  assert.equal(pickOrientation(768, 1024), 'port')
  assert.equal(pickOrientation(390, 844), 'port')
  assert.equal(pickOrientation(1366, 900), 'land')
  assert.equal(lengthLabel(125), '約2分')
  assert.equal(lengthLabel(38), '約40秒')
  assert.equal(yen(23000), '23,000円')
})

t('入口と画面がある（今日の画面から開く・検索には出さない）', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  assert.equal(V.page, '/dashboard/price-video')
  assert.equal(FV.page, '/dashboard/fee-video')
  for (const video of INTRO_VIDEOS) {
    assert.ok(existsSync(new URL(`../src/app/(app)${video.page}/page.tsx`, import.meta.url)), `${video.page} のページが無い`)
  }
  // 今日の「患者さんに見せる」に、動画ごとの入口を並べる
  const today = read('src/components/clinic/TodayDashboard.tsx')
  assert.ok(today.includes('INTRO_VIDEOS.map((v)') && today.includes('href={v.page}'))
  assert.ok(read('next.config.ts').includes("source: '/intro/:path*'"))
  assert.ok(read('src/app/robots.ts').includes("'/intro/'"))
  // /dashboard の下なので、院内アプリのパスワードで守られる
  assert.ok(read('src/proxy.ts').includes("'/dashboard/:path*'"))
})

console.log(`${n}件成功 / 0件失敗`)
