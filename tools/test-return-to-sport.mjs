// 治癒前の競技復帰に関する説明・意思確認書（2026-11-28 院長の PDF「この内容もアプリのカルテに組み込んで（契約書、同意書）」）
// 実行: npx tsx tools/test-return-to-sport.mjs
import assert from 'node:assert/strict'

const { CONTRACT_TEMPLATES, getContractTemplate } = await import('../src/data/contract-templates.ts')
const { parseTemplate } = await import('../src/lib/contracts/template.ts')
const { describeTemplate, autofillContract, effectiveInputs, sportOf } = await import('../src/lib/contracts/autofill.ts')
const { consentProblem, returnToSportProblem } = await import('../src/lib/contracts/consent.ts')

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const tpl = getContractTemplate('return-to-sport')
const parsed = parseTemplate(tpl.body)
const d = describeTemplate(parsed)

test('ひな形がある（題名・版・担当者・文面の大事な言葉はそのまま）', () => {
  assert.ok(tpl)
  assert.equal(tpl.title, '治癒前の競技復帰に関する説明・意思確認書')
  assert.equal(tpl.staffLabel, '説明担当者（柔道整復師）')
  assert.ok(CONTRACT_TEMPLATES.indexOf(tpl) > CONTRACT_TEMPLATES.findIndex((t) => t.id === 'medical-cooperation'))
  for (const s of [
    '競技復帰を許可する書類ではありません',
    '当院の評価では、現時点で安全な競技復帰に必要な回復が十分ではなく、下記の活動を推奨していません。',
    '痛み・腫れ等の再燃や悪化、再受傷・損傷の拡大',
    '治癒の遅延、競技離脱期間の延長、治療・手術等の追加が必要となる可能性',
    '関節の不安定性、可動域・筋力低下、慢性疼痛等の後遺症や競技能力低下の可能性',
    '本書は当院の責任を一律に免除するものではなく、患者本人・保護者の権利を制限するものでもありません。意思はいつでも変更できます。',
    '原本は当院で保管し、写しを患者本人・保護者へお渡しします。',
  ])
    assert.ok(tpl.body.includes(s), s)
  // 署名欄（確認日・署名）は文面に残さない（画面の署名欄で行う）
  assert.ok(!/確認日：|患者本人署名|保護者（親権者等）署名/.test(tpl.body))
})

test('□ 20・記入欄 12。同じ「その他」も行の頭で見分けられる', () => {
  assert.equal(parsed.checkCount, 20)
  assert.equal(parsed.blankCount, 12)
  const leads = d.checks.map((c) => c.lead)
  assert.equal(leads.filter((l) => l === '推奨しない活動').length, 4)
  assert.equal(leads.filter((l) => l === '当院の提案').length, 3)
  assert.equal(leads.filter((l) => l === '医師の指示').length, 3)
  assert.equal(leads.filter((l) => l === '希望する活動').length, 4)
  assert.equal(d.checks.filter((c) => c.section.startsWith('２') && !c.lead).length, 3)
  assert.deepEqual(d.blanks.filter((b) => b.kind === 'date').map((b) => b.row), ['生年月日', '受傷日', '希望する復帰日'])
})

test('患者さんの欄はカルテ・問診から（希望する復帰日は空けておく）', () => {
  const auto = autofillContract(parsed, {
    docId: 'return-to-sport',
    today: '2026-11-28',
    patient: { name: '試験 太郎', birthDate: '2010-04-02', onsetDate: '2026-11-01', diagnosisLabel: '右足関節捻挫', mainComplaint: '右足首の痛み', occupation: '下関市立見本中学校', sports: 'サッカー', injuryDate: '2026-11-20' },
  })
  const v = effectiveInputs(Array(parsed.blankCount).fill(null), auto)
  const at = (row) => v[d.blanks.find((b) => b.row === row || b.row.startsWith(row)).i]
  assert.equal(at('患者氏名'), '試験 太郎')
  assert.equal(at('生年月日'), '2010-04-02')
  assert.equal(at('競技・所属'), 'サッカー（下関市立見本中学校）')
  assert.equal(at('受傷日'), '2026-11-20')
  assert.equal(at('傷病名'), '右足関節捻挫（右足首の痛み）')
  assert.equal(at('希望する復帰日'), '')
  // 問診の受傷日が無ければ、カルテの発症日
  const auto2 = autofillContract(parsed, { docId: 'return-to-sport', today: '2026-11-28', patient: { name: 'a', onsetDate: '2026-11-01' } })
  assert.equal(effectiveInputs(Array(parsed.blankCount).fill(null), auto2)[d.blanks.find((b) => b.row === '受傷日').i], '2026-11-01')
  assert.equal(sportOf({ sports: '', occupation: '会社員' }), '')
})

/** すべてそろった状態を作る */
function filled() {
  const checked = Array(parsed.checkCount).fill(false)
  const values = Array(parsed.blankCount).fill('')
  const pick = (pred) => d.checks.filter(pred).forEach((c) => (checked[c.i] = true))
  values[d.blanks.find((b) => b.label === '評価所見・復帰を推奨しない理由').i] = '片脚ホップで痛みあり。腫れが残る'
  pick((c) => c.lead === '推奨しない活動' && c.after === '試合出場')
  pick((c) => c.lead === '当院の提案' && c.after.startsWith('負荷制限'))
  pick((c) => c.lead === '医師の指示' && c.after === '未確認')
  pick((c) => c.section.startsWith('２') && !c.lead)
  pick((c) => c.section.startsWith('３') && !c.lead)
  pick((c) => c.lead === '希望する活動' && c.after === '練習参加')
  return { checked, values }
}

test('そろっていれば署名できる', () => {
  const { checked, values } = filled()
  assert.equal(consentProblem('return-to-sport', d.checks, checked, d.blanks, values), null)
})

test('当院の見解・リスクの説明・ご本人の確認が欠けていたら署名しない（理由を1つ出す）', () => {
  const cases = [
    [(s) => (s.values[d.blanks.find((b) => b.label === '評価所見・復帰を推奨しない理由').i] = ' '), /推奨しない理由/],
    [(s) => d.checks.filter((c) => c.lead === '推奨しない活動').forEach((c) => (s.checked[c.i] = false)), /推奨しない活動/],
    [(s) => d.checks.filter((c) => c.lead === '当院の提案').forEach((c) => (s.checked[c.i] = false)), /当院の提案/],
    [(s) => d.checks.filter((c) => c.lead === '医師の指示').forEach((c) => (s.checked[c.i] = false)), /医師の指示/],
    [(s) => (s.checked[d.checks.find((c) => c.section.startsWith('２')).i] = false), /リスク（3つ）/],
    [(s) => (s.checked[d.checks.find((c) => c.after.startsWith('当院が上記')).i] = false), /理解しました/],
    [(s) => (s.checked[d.checks.find((c) => c.after.startsWith('質問する機会')).i] = false), /質問する機会/],
    [(s) => (s.checked[d.checks.find((c) => c.after.startsWith('上記の説明を受けたうえで')).i] = false), /希望します」にチェックが無い/],
    [(s) => d.checks.filter((c) => c.lead === '希望する活動').forEach((c) => (s.checked[c.i] = false)), /希望する活動/],
  ]
  for (const [spoil, re] of cases) {
    const s = filled()
    spoil(s)
    const msg = returnToSportProblem(d.checks, s.checked, d.blanks, s.values)
    assert.match(msg ?? '', re, String(re))
  }
})

test('ほかの書類の確かめ方は変わらない', () => {
  const t = getContractTemplate('treatment-consent')
  const td = describeTemplate(parseTemplate(t.body))
  const checked = Array(td.checks.length).fill(false)
  assert.match(consentProblem('treatment-consent', td.checks, checked), /同意します/)
  assert.equal(consentProblem('visit-frequency', [], []), null)
})

console.log(`\nreturn-to-sport: ${passed} passed`)
