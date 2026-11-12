// カルテ連携の患者番号：数字だけを番号として扱う・まちがった番号を送っていた方への送り直しの文（数字・名前はすべて架空）
// 実行: npx tsx tools/test-line-link-patientno.mjs
import { isPatientNo, linkNoticeText, PATIENT_NO_CORRECTION } from '../src/lib/line-link.ts'
import fs from 'node:fs'

let passed = 0
let failed = 0
const check = (label, condition, detail) => {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`) }
  else { failed += 1; console.log(`  ✗ ${label}${detail !== undefined ? `\n      実際: ${JSON.stringify(detail)}` : ''}`) }
}

console.log('\n【患者番号として使える値】')
check('数字1〜6けたは番号', isPatientNo('28') && isPatientNo('3017') && isPatientNo(' 5 ') && isPatientNo('123456'))
check('「院側手動登録」は番号ではない', !isPatientNo('院側手動登録'))
check('空・無し・7けた以上・数値型は番号ではない', !isPatientNo('') && !isPatientNo(undefined) && !isPatientNo(null) && !isPatientNo('1234567') && !isPatientNo(28))

console.log('\n【お知らせの文】')
const base = { name: '試験 花子', fallback: '番号は受付でお渡しします（いまは発行できませんでした）', sign: 'ゆうき整骨院' }
const normal = linkNoticeText({ ...base, patientNo: '28' })
check('ふつうのお知らせ：連携が済みました＋番号', normal.startsWith('試験 花子さんのカルテとこのLINEの連携が済みました。') && normal.includes('\n\n患者番号：28\n') && normal.endsWith('\n\nゆうき整骨院'), normal)
check('ふつうのお知らせに「誤り」の文は入らない', !normal.includes('誤り'))
const fixed = linkNoticeText({ ...base, patientNo: '28', corrected: true })
check('送り直し：誤りがありました＋正しい番号', fixed.startsWith(`試験 花子さんへ。${PATIENT_NO_CORRECTION}`) && fixed.includes('\n\n患者番号：28\n') && fixed.includes('電話番号の下4桁') && fixed.endsWith('\n\nゆうき整骨院'), fixed)
check('送り直しの文に「連携が済みました」は重ねない', !fixed.includes('連携が済みました'))
const none = linkNoticeText({ ...base, patientNo: '院側手動登録', corrected: true })
check('数字でない番号は、文に出さない（受付でお渡しします、にする）', !none.includes('院側手動登録') && !none.includes('患者番号：') && none.includes(base.fallback) && !none.includes('誤り'), none)
const empty = linkNoticeText({ ...base, patientNo: undefined })
check('番号が無いときも今までどおりの文', empty.includes(base.fallback) && !empty.includes('患者番号：'), empty)
check('言い切り・誇張の言葉が無い', !/絶対|必ず治|No\.?1|最安|医師が推薦/.test(normal + fixed))

console.log('\n【サーバー側のつなぎ】')
const server = fs.readFileSync(new URL('../src/lib/line-link-server.ts', import.meta.url), 'utf8')
const resend = fs.readFileSync(new URL('../src/app/api/line-link/resend/route.ts', import.meta.url), 'utf8')
const liff = fs.readFileSync(new URL('../src/app/api/liff/link/route.ts', import.meta.url), 'utf8')
check('予約システムから受け取るのは数字の番号だけ', server.includes("isPatientNo(patientNo) ? { patientNo } : { error: 'bad_number' }"))
check('一覧には数字の番号だけを出す', server.includes('patientNo: isPatientNo(patientNo) ? patientNo.trim() : undefined'))
check('送り直す前に、数字でない控えはもらい直して保存する', resend.includes('await refreshPatientNo(stored)') && resend.includes('if (fresh.refreshed) await saveLineLink(link)'))
check('連携し直すときも、数字でない控えは使わない', liff.includes('isPatientNo(existing?.patientNo) ? existing?.patientNo : undefined'))

console.log(`\n結果: ${passed} 件成功 / ${failed} 件失敗`)
process.exit(failed ? 1 : 0)
