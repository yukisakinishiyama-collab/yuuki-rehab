// 会員プランのご案内（患者様にお見せする説明）の、料金の計算と、契約書のひな形との金額の一致の確認
// 実行: npx tsx tools/test-member-guide.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'
register(
  'data:text/javascript,' +
    encodeURIComponent(
      "export async function resolve(s, c, next) { if (s.startsWith('@/')) s = new URL('../src/' + s.slice(2), import.meta.url.replace(/[^/]*$/, '') + 'x').href.replace('/x/../', '/'); try { return await next(s, c) } catch (e) { if (!/\\\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }",
    ),
)

const root = new URL('../', import.meta.url)
const guide = await import(new URL('src/lib/contracts/member-guide.ts', root).href)
const member = await import(new URL('src/lib/contracts/member.ts', root).href)
const { CONTRACT_TEMPLATES } = await import(new URL('src/data/contract-templates.ts', root).href)
const tpl = (id) => CONTRACT_TEMPLATES.find((t) => t.id === id)

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

test('会員プランの1か月の金額：月額＋1部位施術料（1,500円）×部位×回数', () => {
  assert.equal(guide.memberMonthly({ plan: '一般会員', visits: 4, parts: 1, physioFee: 0 }), 29000)
  assert.equal(guide.memberMonthly({ plan: '一般会員', visits: 8, parts: 1, physioFee: 0 }), 35000)
  assert.equal(guide.memberMonthly({ plan: '一般会員', visits: 12, parts: 1, physioFee: 0 }), 41000)
  assert.equal(guide.memberMonthly({ plan: '学生会員', visits: 8, parts: 1, physioFee: 0 }), 31000)
  assert.equal(guide.memberMonthly({ plan: '兄弟・親子プラン', visits: 8, parts: 1, physioFee: 0 }), 42000)
  // 2部位なら施術料も2倍
  assert.equal(guide.memberMonthly({ plan: '一般会員', visits: 8, parts: 2, physioFee: 0 }), 47000)
  // 物理療法は月額に含まれるので、会員の金額は変わらない
  assert.equal(guide.memberMonthly({ plan: '一般会員', visits: 8, parts: 1, physioFee: 3500 }), 35000)
})

test('都度払いの1か月の金額：（リハビリ2,850円＋施術1,500円×部位＋物理療法）×回数', () => {
  assert.equal(guide.paygPerVisit(1, 0), 4350)
  assert.equal(guide.paygMonthly({ plan: '一般会員', visits: 4, parts: 1, physioFee: 0 }), 17400)
  assert.equal(guide.paygMonthly({ plan: '一般会員', visits: 8, parts: 1, physioFee: 0 }), 34800)
  assert.equal(guide.paygMonthly({ plan: '一般会員', visits: 12, parts: 1, physioFee: 0 }), 52200)
  assert.equal(guide.paygMonthly({ plan: '一般会員', visits: 8, parts: 1, physioFee: 1600 }), 47600)
  assert.equal(guide.paygMonthly({ plan: '一般会員', visits: 8, parts: 1, physioFee: 3500 }), 62800)
  assert.equal(guide.paygMonthly({ plan: '一般会員', visits: 8, parts: 2, physioFee: 0 }), 46800)
})

test('どちらが少ないか：物理療法なし・月8回は都度払いが200円少ない（正直に出す）', () => {
  const c8 = guide.compareGuide({ plan: '一般会員', visits: 8, parts: 1, physioFee: 0 })
  assert.deepEqual(c8, { payg: 34800, member: 35000, diff: -200, cheaper: 'payg' })
  const c9 = guide.compareGuide({ plan: '一般会員', visits: 9, parts: 1, physioFee: 0 })
  assert.equal(c9.cheaper, 'member')
  assert.equal(c9.diff, 2650)
  assert.equal(guide.compareGuide({ plan: '一般会員', visits: 4, parts: 1, physioFee: 0 }).cheaper, 'payg')
})

test('会員プランのほうが少なくなる回数（一般：なし9回・エレサス6回・体外衝撃波4回）', () => {
  assert.equal(guide.breakEvenVisits('一般会員', 1, 0), 9)
  assert.equal(guide.breakEvenVisits('一般会員', 1, 1600), 6)
  assert.equal(guide.breakEvenVisits('一般会員', 1, 3500), 4)
  assert.equal(guide.breakEvenVisits('学生会員', 1, 0), 7)
  assert.equal(guide.breakEvenVisits('学生会員', 1, 3500), 3)
  assert.equal(guide.breakEvenVisits('兄弟・親子プラン', 1, 0), 11)
  // 施術料は会員・都度払いとも1部位1,500円なので、部位の数では変わらない
  assert.equal(guide.breakEvenVisits('一般会員', 3, 0), 9)
})

test('入力は計算できる範囲にそろえる（回数1〜31・部位1〜3・おかしな値）', () => {
  assert.deepEqual(guide.normalizeGuideInput({ plan: '一般会員', visits: 0, parts: 9, physioFee: -5 }), { plan: '一般会員', visits: 1, parts: 3, physioFee: 0 })
  assert.deepEqual(guide.normalizeGuideInput({ plan: '一般会員', visits: 99, parts: 0, physioFee: NaN }), { plan: '一般会員', visits: 31, parts: 1, physioFee: 0 })
  assert.equal(guide.memberMonthly({ plan: '一般会員', visits: NaN, parts: 1, physioFee: 0 }), 24500)
})

test('金額の書き方', () => {
  assert.equal(guide.yen(23000), '23,000円')
  assert.equal(guide.MEMBER_PART_FEE_TEXT, '1,500円（健康保険の施術を併用する日は1,000円＋保険の窓口料金）')
})

test('契約書・料金案内のひな形と、ご案内の金額が同じ', () => {
  const contract = tpl('member-contract').body
  const policy = tpl('fee-cancel-policy').body
  // 月額
  for (const [plan, row] of [
    ['一般会員', /\| 一般会員 \| 23,000円 \|/],
    ['学生会員', /\| 学生会員（学校名：＿+） \| 19,000円 \|/],
    ['兄弟・親子プラン', /\| 兄弟・親子プラン（2名まで） \| 30,000円 \|/],
  ]) {
    assert.match(contract, row, plan)
    assert.ok(member.MEMBER_FEES[plan].includes(guide.yen(guide.MEMBER_MONTHLY[plan])), `${plan} の月額`)
  }
  // 来院ごとの1部位施術料と、保険を併用する日
  const fee = guide.yen(guide.MEMBER_PART_FEE)
  const ins = guide.yen(guide.MEMBER_PART_FEE_WITH_INSURANCE)
  assert.ok(contract.includes(`| 来院ごとの1部位施術料（別途） | ${fee}（健康保険の施術を併用する日は${ins}＋保険の窓口料金） | □ 確認しました |`))
  assert.ok(contract.includes(`□ 1部位施術料（${fee}。健康保険の施術を併用する日は${ins}＋保険の窓口料金）は、来院した方ごと・施術した部位ごとにかかります。`))
  assert.ok(policy.includes(`| 来院ごとの1部位施術料（別途） | ${fee} |`))
  assert.ok(policy.includes(`健康保険の施術を併用する日の1部位施術料は、${ins}＋保険の窓口料金です。`))
  // 古い金額（1部位施術料 1,000円）が残っていない
  assert.ok(!/1部位施術料（別途） \| 1,000円/.test(contract + policy))
  assert.ok(!contract.includes('1部位施術料（1,000円）'))
  // 都度払い・物理療法・特別手技療法
  assert.ok(policy.includes(`| リハビリ（約30分） | ${guide.yen(guide.PAYG_FEES.rehab)} |`))
  assert.ok(policy.includes(`| 施術料金（1部位） | ${guide.yen(guide.PAYG_FEES.part)} |`))
  for (const p of guide.PHYSIO_OPTIONS) {
    if (p.fee > 0) assert.ok(policy.includes(`| ${p.name} | ${guide.yen(p.fee)} |`), p.name)
  }
  for (const s of guide.SPECIAL_PLANS) {
    assert.ok(policy.includes(`| ${s.name} | ${guide.yen(s.nonMember)} | ${guide.yen(s.member)} | ${guide.yen(s.student)} |`), s.name)
  }
})

test('院の記録（兄弟・親子プランの入会）にも新しい施術料が出る', () => {
  const html = member.memberEventHtml(
    { kind: 'join', plan: '兄弟・親子プラン', start: '2026-12-01', partner: { name: '山田 花子', relation: '妹' } },
    { state: 'none', label: '', pausedMonths: 0 },
  )
  assert.match(html, /来院した方ごと・施術した部位ごとに1,500円（健康保険の施術を併用する日は1,000円＋保険の窓口料金）/)
})

console.log(`\n会員プランのご案内：${passed} 件 OK`)
