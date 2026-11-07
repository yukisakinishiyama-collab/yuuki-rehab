// 経過カルテの助け（引き継ぎ・部位の移り変わり・表紙の提案）の試験。データは架空
// 実行: npx tsx tools/test-followup.mjs
import { carryForward, complaintEpisodes, coverSuggestion, latestNote } from '../src/lib/karte/followup.ts'

let passed = 0, failed = 0
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.log(`  ✗ ${label}${detail !== undefined ? `\n      実際: ${JSON.stringify(detail)}` : ''}`) } }
const c = (id, region, nrs, extra = {}) => ({ id, bodyRegion: region, side: 'right', diagnosisLabel: '', nrs, symptoms: [], ...extra })
const note = (date, n, complaints, extra = {}) => ({ id: `n${n}`, patientId: 'p', visitDate: date, visitNumber: n, createdAt: `${date}T00:00:00Z`, complaints, painToday: 3, currentPhase: 2, homeExercise: 'セッティング', forbiddenMovements: '深屈曲', recommendedFrequency: '週2回', nextGoal: '階段', treatmentToday: 'アイシング', painLocations: ['fkr'], treatmentAreas: ['fkr'], ...extra })

console.log('引き継ぎ')
const n1 = note('2026-10-03', 1, [c('k', 'knee', 6)])
const n2 = note('2026-10-10', 2, [c('k', 'knee', 4, { startedAt: '2026-10-03' }), c('a', 'ankle', 5, { status: 'resolved', resolvedAt: '2026-10-10' })])
check('最新は n2', latestNote([n1, n2])?.id === 'n2')
const cf = carryForward(n2)
check('終了した部位は引き継がない', cf.complaints.length === 1 && cf.complaints[0].id === 'k')
check('同じ id・開始日のまま、状態は経過中', cf.complaints[0].startedAt === '2026-10-03' && cf.complaints[0].status === 'active' && cf.complaints[0].resolvedAt === undefined)
check('前回の NRS', cf.previousNrs.k === 4)
check('前回の目標が今日の目標に', cf.patientGoalToday === '階段' && cf.homeExercise === 'セッティング' && cf.treatmentAreas[0] === 'fkr')
check('開始日が無い部位は前回の日付', carryForward(n1).complaints[0].startedAt === '2026-10-03')

console.log('部位の移り変わり')
const n3 = note('2026-10-20', 3, [c('h', 'hip', 5)])
const eps = complaintEpisodes([n3, n1, n2])
const byId = Object.fromEntries(eps.map(e => [e.id, e]))
check('3つの経過', eps.length === 3)
check('膝は記録から外れた（n3 に無い）', byId.k.state === 'dropped' && byId.k.endedAt === '2026-10-10' && byId.k.firstNrs === 6 && byId.k.lastNrs === 4 && byId.k.visits === 2, byId.k)
check('足首は軽快・終了', byId.a.state === 'resolved' && byId.a.endedAt === '2026-10-10')
check('股関節は経過中・先頭', byId.h.state === 'active' && eps[0].id === 'h')
check('ラベル', /右 股関節/.test(byId.h.label), byId.h.label)
check('部位のないカルテだけなら空', complaintEpisodes([note('2026-10-01', 1, undefined)]).length === 0)

console.log('表紙の提案')
const patient = { bodyRegion: 'knee', diagnosisLabel: '半月板損傷疑い' }
check('同じなら提案なし', coverSuggestion(patient, [c('k', 'knee', 3, { diagnosisLabel: '半月板損傷疑い' })]) === null)
check('傷病名が空なら部位だけ見る', coverSuggestion(patient, [c('k', 'knee', 3)]) === null)
const sg = coverSuggestion(patient, [c('k', 'knee', 3, { status: 'resolved' }), c('h', 'hip', 5, { diagnosisLabel: '股関節唇損傷' })])
check('主な部位が変われば提案', sg?.bodyRegion === 'hip' && sg?.diagnosisLabel === '股関節唇損傷' && /部位: 膝関節 → 股関節/.test(sg?.reason ?? ''), sg)
check('経過中の部位が無ければ提案なし', coverSuggestion(patient, [c('k', 'knee', 3, { status: 'resolved' })]) === null)

console.log(`\n${passed}件成功 / ${failed}件失敗`)
if (failed > 0) process.exit(1)
