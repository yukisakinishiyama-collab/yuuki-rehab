// 患者さんにお見せする紹介動画（今日 →「患者さんに見せる」）の検査
//   npx tsx tools/test-intro-videos.mjs
// - 動画・絵・字幕のファイルがそろっているか（大きすぎないか）
// - 動画の中の金額（PRICE_GUIDE_FACTS）が、契約書・料金案内のひな形と同じか
//   （料金を変えたのに古い動画を見せ続けないように。ずれたら動画を作り直して FACTS も直す）
// - カルテの「会員プランのご案内」（lib/contracts/member-guide.ts）と同じ金額・同じ比べ方か
// - 向きの選び方・長さの表記
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { PRICE_GUIDE_FACTS as F, PRICE_GUIDE_VIDEO as V, lengthLabel, paygPerVisit, pickOrientation, yen } from '../src/data/intro-videos.ts'
import { CONTRACT_TEMPLATES } from '../src/data/contract-templates.ts'
import * as G from '../src/lib/contracts/member-guide.ts'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('✓', name) }
const pub = (p) => new URL(`../public${p}`, import.meta.url)
const body = (id) => CONTRACT_TEMPLATES.find((x) => x.id === id).body

t('横向き・縦向きの動画と絵がある（mp4・大きすぎない）', () => {
  for (const o of ['land', 'port']) {
    const f = V.files[o]
    assert.ok(existsSync(pub(f.src)), `${f.src} が無い`)
    assert.ok(existsSync(pub(f.poster)), `${f.poster} が無い`)
    const size = statSync(pub(f.src)).size
    assert.ok(size > 500_000 && size < 15_000_000, `${f.src} の大きさ ${size}`)
    // mp4 のしるし（先頭の ftyp）
    assert.equal(readFileSync(pub(f.src)).subarray(4, 8).toString('latin1'), 'ftyp')
  }
  assert.ok(V.files.land.width > V.files.land.height)
  assert.ok(V.files.port.height > V.files.port.width)
})

t('字幕（声の文字）は時刻の順に並び、動画の長さに収まる', () => {
  const vtt = readFileSync(pub(V.captions), 'utf8')
  assert.ok(vtt.startsWith('WEBVTT'))
  const sec = (s) => { const [h, m, x] = s.split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(x) }
  const cues = [...vtt.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n(.+)/g)].map((m) => [sec(m[1]), sec(m[2]), m[3]])
  assert.ok(cues.length >= 20, `字幕が ${cues.length} 行`)
  let prev = 0
  for (const [a, b, text] of cues) {
    assert.ok(a >= prev - 0.2 && b > a, `時刻の順がおかしい：${text}`)
    assert.ok(text.trim().length > 0)
    prev = b
  }
  assert.ok(prev <= V.seconds + 1, `最後の字幕 ${prev} が動画の長さ ${V.seconds} を超える`)
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
  // 動画の比べ方（月8回・微弱電流あり／なし）は、ご案内の計算と同じ数字になる
  const elesas = G.PHYSIO_OPTIONS.find((p) => p.id === 'elesas').fee
  assert.deepEqual(G.compareGuide({ plan: '一般会員', visits: 8, parts: 1, physioFee: elesas }), { payg: 47600, member: 35000, diff: 12600, cheaper: 'member' })
  assert.deepEqual(G.compareGuide({ plan: '一般会員', visits: 8, parts: 1, physioFee: 0 }), { payg: 34800, member: 35000, diff: -200, cheaper: 'payg' })
  // ご案内から動画へ、動画からご案内へ行ける
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  assert.ok(read('src/components/rehab-management/ContractsTab.tsx').includes('href="/dashboard/price-video"'))
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
  assert.ok(existsSync(new URL('../src/app/(app)/dashboard/price-video/page.tsx', import.meta.url)))
  assert.ok(read('src/components/clinic/TodayDashboard.tsx').includes('href="/dashboard/price-video"'))
  assert.ok(read('next.config.ts').includes("source: '/intro/:path*'"))
  assert.ok(read('src/app/robots.ts').includes("'/intro/'"))
  // /dashboard の下なので、院内アプリのパスワードで守られる
  assert.ok(read('src/proxy.ts').includes("'/dashboard/:path*'"))
})

console.log(`${n}件成功 / 0件失敗`)
