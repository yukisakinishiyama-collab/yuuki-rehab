// 疑問メモのAI相談に送る要約の試験（お名前などが混ざらないか。データはすべて架空）
// 実行: npx tsx tools/test-consult-context.mjs（@/ の読み替えに tsx が必要）
import { ageBand, buildConsultItems, findIdentifierLeaks } from '../src/lib/karte/consult-context.ts'

let passed = 0, failed = 0
const check = (label, ok, detail) => {
  if (ok) { passed += 1; console.log(`  ✓ ${label}`) }
  else { failed += 1; console.log(`  ✗ ${label}${detail !== undefined ? `\n      実際: ${JSON.stringify(detail)}` : ''}`) }
}

const today = new Date('2026-11-06')
console.log('年代')
check('40代', ageBand('1980-12-01', today) === '40代' , ageBand('1980-12-01', today))
check('誕生日前は1つ下', ageBand('1986-12-01', today) === '30代', ageBand('1986-12-01', today))
check('10代前半', ageBand('2013-01-01', today) === '10代前半')
check('不明なら空', ageBand('', today) === '')

const patient = {
  id: 'p1', name: '架空 太郎', kana: 'カクウ タロウ', birthDate: '1990-05-05', gender: 'male',
  phone: '090-0000-1234', emergencyContact: '架空 花子 080-0000-9999', mainComplaint: '右膝の痛み',
  bodyRegion: 'knee', diagnosisLabel: '半月板損傷疑い', onsetDate: '2026-10-01', firstVisitDate: '2026-10-03',
  status: 'active', therapistNotes: '', createdAt: '', updatedAt: '', address: '山口県架空市1-2-3', email: 'kakuu@example.test',
  insurance: { insurerNumber: '12345678' }, noah: { ids: ['99999'] },
}
const intakes = [{ id: 'i1', patientId: 'p1', intakeDate: '2026-10-03', isNewInjury: true, chiefComplaint: '階段で右膝が痛い', injuryDate: '2026-10-01',
  injuryMechanism: 'サッカーで着地時にひねった', firstTimeSymptoм: true, previousSameInjury: false, previousTreatment: '', painLocations: [], jointDetailLocations: {},
  painNrs: 6, painCharacter: ['鋭痛'], painTiming: ['動作時'], worseFactor: '階段の降り', betterFactor: '安静', adlDifficulty: ['階段'], occupation: '会社員',
  sportsActivity: 'サッカー週2', importantGoal: '試合に出る', pastMedicalHistory: 'なし', currentMedications: 'なし', imagingResults: '未検査', suspectedDiagnosis: '', therapistNotes: '', createdAt: '' }]
const soapNotes = [
  { id: 's1', patientId: 'p1', visitDate: '2026-10-03', visitNumber: 1, painToday: 6, changeFromLast: '', adlDifficulty: '階段', homeExerciseAdherence: 'not_done', patientConcern: '', patientGoalToday: '',
    romFindings: '屈曲 右120/左140', strengthFindings: '', specialTestFindings: 'McMurray 右(+)', tenderness: '内側関節裂隙', swelling: true, heat: false, gait: '', singleLegStance: '', squat: '',
    therapistObservation: '', improvements: '', remainingIssues: '', priorityIssue: '', currentPhase: 1, visitFrequencyAppropriate: true, exerciseLoadAppropriate: true, physicianReferralNeeded: false,
    treatmentToday: 'アイシング', nextGoal: '', homeExercise: '', forbiddenMovements: '深屈曲' },
  { id: 's2', patientId: 'p1', visitDate: '2026-10-20', visitNumber: 2, painToday: 3, changeFromLast: '軽減', adlDifficulty: '', homeExerciseAdherence: 'done', patientConcern: '', patientGoalToday: '',
    romFindings: '', strengthFindings: '', specialTestFindings: '', tenderness: '', swelling: false, heat: false, gait: '', singleLegStance: '', squat: '',
    therapistObservation: '', improvements: '腫脹消失', remainingIssues: '降り動作の痛み', priorityIssue: '', currentPhase: 2, visitFrequencyAppropriate: true, exerciseLoadAppropriate: true, physicianReferralNeeded: false,
    treatmentToday: '', nextGoal: '', homeExercise: 'セッティング', forbiddenMovements: '' },
]
const tests = [{ id: 't1', patientId: 'p1', measuredDate: '2026-10-03', bodyRegion: 'knee', testName: 'McMurray', rightResult: 'positive', leftResult: 'negative', result: 'positive', painLocation: '', apprehension: false, clickSound: true, limitation: false, memo: '', patientFriendlyExplanation: '', createdAt: '' }]
const memos = [{ id: 'm1', patientId: 'p1', memoDate: '2026-10-21', content: '本人は来週の試合に出たい意向', createdAt: '' }]

console.log('要約')
const items = buildConsultItems({ patient, intakes, soapNotes, specialTests: tests, memos }, today)
const all = items.map(i => i.text).join('\n')
check('5項目できる', items.length === 5, items.map(i => i.key))
for (const bad of ['架空', 'タロウ', '090', '1234', '1990', '花子', '架空市', 'example.test', '12345678', '99999', '会社員'])
  check(`「${bad}」を送らない`, !all.includes(bad))
check('年代・性別・部位を送る', /30代/.test(all) && /男性/.test(all) && /膝/.test(all))
const soap = items.find(i => i.key === 'soap').text
check('SOAPは新しい順', soap.indexOf('2026-10-20') < soap.indexOf('2026-10-03'))
check('テストの左右', /右:positive 左:negative/.test(all))

console.log('漏れの検出')
check('普通は漏れなし', findIdentifierLeaks(items, patient).length === 0)
const leaky = buildConsultItems({ patient, intakes, soapNotes, specialTests: tests, memos: [{ id: 'm2', patientId: 'p1', memoDate: '2026-10-22', content: '架空太郎さんは来週来院', createdAt: '' }] }, today)
check('メモにお名前（空白なし）があれば検出', findIdentifierLeaks(leaky, patient).includes('簡易メモ'))
const leakyPhone = buildConsultItems({ patient, intakes: [{ ...intakes[0], therapistNotes: '連絡先 09000001234' }], soapNotes, specialTests: tests, memos }, today)
check('電話番号（ハイフンなし）も検出', findIdentifierLeaks(leakyPhone, patient).some(l => l.includes('問診')))

console.log(`\n${passed}件成功 / ${failed}件失敗`)
if (failed > 0) process.exit(1)
