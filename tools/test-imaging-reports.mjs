// 画像レポート（DICOMの読み取り）の決まりを確かめる（外には送らない・データは架空）
// 実行: npx tsx tools/test-imaging-reports.mjs
import { checkIdentity, countsLabel, sameName, splitEmphasis, toImagingReport } from '../src/lib/karte/imaging.ts'
import { isValidReportPath } from '../src/lib/karte/imaging-storage-server.ts'

let passed = 0
let failed = 0
function ok(cond, label, detail) {
  if (cond) passed += 1
  else {
    failed += 1
    console.log(`✗ ${label}${detail !== undefined ? `\n   実際: ${JSON.stringify(detail)}` : ''}`)
  }
}

const pt = { name: '試験 花子', kana: 'しけん はなこ', birthDate: '2017-11-15' }
const cd = (over = {}) => ({ name: '試験 花子', id: '0099887766', birth_date: '2017-11-15', sex: 'F', ...over })

// ── CDの方とカルテの方が同じか ──
ok(checkIdentity(cd(), pt).level === 'ok', '生年月日が同じならそのまま進める')
ok(checkIdentity(cd({ name: 'SHIKEN HANAKO' }), pt).level === 'ok', 'CDがローマ字でも、生年月日が同じなら進める')
const diff = checkIdentity(cd({ birth_date: '2017-11-16' }), pt)
ok(diff.level === 'mismatch' && diff.message.includes('2017-11-16') && diff.message.includes('2017-11-15'), '生年月日がちがえば止める（両方の日付を出す）', diff)
ok(checkIdentity(cd({ name: '別人 太郎' }), pt).level === 'check', '生年月日が同じでお名前がちがえば、確かめてもらう')
ok(checkIdentity(cd({ birth_date: '' }), pt).level === 'ok', '生年月日が無くても、お名前が同じなら進める')
ok(checkIdentity(cd({ birth_date: '', name: '別人 太郎' }), pt).level === 'mismatch', '生年月日が無く、お名前がちがえば止める')
ok(checkIdentity(cd({ birth_date: '', name: 'SHIKEN HANAKO' }), pt).level === 'check', '生年月日が無く、お名前も比べられなければ、確かめてもらう')
ok(checkIdentity(cd({ birth_date: '', name: '' }), pt).level === 'check', 'CDに何も無ければ、確かめてもらう')
ok(checkIdentity(cd(), { ...pt, birthDate: '' }).level === 'ok', 'カルテに生年月日が無くても、お名前が同じなら進める')
ok(sameName('試験　花子', pt) === true && sameName('花子 試験', pt) === true && sameName('シケン ハナコ', pt) === false, 'お名前は空白・姓名の順のちがいを無視する')
ok(sameName('しけん はなこ', pt) === true, 'ふりがなでも同じと見る')
ok(sameName('SHIKEN^HANAKO', pt) === null && sameName('', pt) === null, 'ローマ字・空は比べられない')

// ── 読影の結果 → カルテの記録 ──
const result = {
  title_region: '右足関節', headline: '骨折を示す所見なし', summary: ['**骨折なし。** 前方に少量の液体'], study_date: '2026-10-27',
  estimates: [{ condition: '前方の刺激', percent: 35.4, basis: '圧痛と一致' }, { condition: 'x', percent: 999, basis: '' }],
  modalities: ['単純X線', 'MRI'], counts: { 単純X線: 4, MRI: 139 }, institution: '架空病院', bytes: 1000, file_name: '画像所見レポート_0099887766_20261027.pdf', minutes: 12,
}
const rep = toImagingReport({ id: 'r1', patientId: 'p1', result, complaint: '前方の痛み', storagePath: 'p1/r1.pdf', bytes: 1234, submittedAt: '2026-11-18T10:00:00.000Z' })
ok(rep.region === '右足関節' && rep.studyDate === '2026-10-27' && rep.bytes === 1234 && rep.author === 'Claude（AI）', '部位・撮影日・大きさ・読影者', rep)
ok(rep.estimates[0].percent === 35 && rep.estimates[1].percent === 100, '見積もりは 0〜100 の整数にそろえる', rep.estimates)
ok(countsLabel(rep) === '単純X線 4枚・MRI 139枚', '枚数の書き方', countsLabel(rep))
ok(countsLabel({ modalities: ['MRI'], imageCounts: {} }) === 'MRI', '枚数が無ければ種類だけ')
const odd = toImagingReport({ id: 'r2', patientId: 'p1', result: { ...result, study_date: '20261027', file_name: 'a/b:c.pdf', summary: 'x', counts: null, estimates: null }, complaint: '', storagePath: 'p1/r2.pdf', bytes: 1, submittedAt: 'x' })
ok(odd.studyDate === '' && odd.fileName === 'abc.pdf' && odd.summary.length === 0 && odd.estimates.length === 0, '形のおかしい値はそのまま入れない', odd)

// ── 強調 ──
ok(JSON.stringify(splitEmphasis('**骨折なし。** 前方に**液体**あり')) === JSON.stringify([
  { text: '骨折なし。', bold: true }, { text: ' 前方に', bold: false }, { text: '液体', bold: true }, { text: 'あり', bold: false }]), '**…** を強調に分ける')
ok(splitEmphasis('<b>x</b>')[0].text === '<b>x</b>', 'タグは文字のまま（HTMLにしない）')

// ── 保存先 ──
ok(isValidReportPath('pt_abc-1/rep_1.pdf'), '保存先：患者ID/レポートID.pdf')
ok(!isValidReportPath('../x/y.pdf') && !isValidReportPath('a/b.jpg') && !isValidReportPath('a/b/c.pdf') && !isValidReportPath('a/.pdf'), '保存先：ほかの形は受けない')

console.log(`\n${passed} 件成功 / ${failed} 件失敗`)
if (failed) process.exit(1)
