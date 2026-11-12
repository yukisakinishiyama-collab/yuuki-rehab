// 予約システムの氏名・電話番号から、カルテの患者さんを探せるかの試験（数字・名前はすべて架空）
// 実行: node tools/test-karte-link.mjs
import { matchKartePatients, phoneDigits, nameKey } from '../src/lib/karte-link.ts'

let passed = 0
let failed = 0
const check = (label, condition, detail) => {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`) }
  else { failed += 1; console.log(`  ✗ ${label}${detail !== undefined ? `\n      実際: ${JSON.stringify(detail)}` : ''}`) }
}

const patients = [
  { id: 'p1', name: '山田 太郎', phone: '090-1111-2222' },
  { id: 'p2', name: '山田太郎', phone: '080-3333-4444' },
  { id: 'p3', name: '佐藤 花子', phone: '09011112222' },
  { id: 'p4', name: '鈴木 次郎', phone: '' },
]

check('電話番号の数字だけを取り出す', phoneDigits('090-1111-2222') === '09011112222')
check('国番号つきは0始まりに直す', phoneDigits('+81 90 1111 2222') === '09011112222', phoneDigits('+81 90 1111 2222'))
check('氏名の空白は無視する', nameKey('山田　太郎') === '山田太郎')

check('電話＋氏名が一致する人が最優先', matchKartePatients(patients, '山田 太郎', '09011112222').map(p => p.id).join() === 'p1')
check('空白の有無は同じ人として扱う', matchKartePatients(patients, '山田太郎', '090-1111-2222').map(p => p.id).join() === 'p1')
check('氏名が違えば電話番号で探す', matchKartePatients(patients, '山田 花子', '09011112222').map(p => p.id).join() === 'p1,p3', matchKartePatients(patients, '山田 花子', '09011112222'))
check('電話番号が無ければ氏名で探す', matchKartePatients(patients, '鈴木 次郎', '').map(p => p.id).join() === 'p4')
check('同じ氏名が複数なら候補をすべて返す', matchKartePatients(patients, '山田太郎', '').map(p => p.id).join() === 'p1,p2')
check('先頭の0が落ちた電話番号でも同じ人', matchKartePatients(patients, '佐藤 花子', '9011112222').map(p => p.id).join() === 'p3')
check('当てはまらなければ空', matchKartePatients(patients, '該当 なし', '08099999999').length === 0)
check('氏名も電話も空なら空', matchKartePatients(patients, '', '').length === 0)

console.log(`\n結果: ${passed} 件成功 / ${failed} 件失敗`)
process.exit(failed ? 1 : 0)
