// 復帰プログラムの確認（中身の形・文献の番号・進み具合の決まり・SOAP に入れる文）。データはすべて架空
// 実行: npx tsx tools/test-return-programs.mjs
import assert from 'node:assert/strict'
import { register } from 'node:module'
const SRC = new URL('../src/', import.meta.url).href
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { if (s.startsWith('@/')) s = ${JSON.stringify(SRC)} + s.slice(2); try { return await next(s, c) } catch (e) { if (!/\\.[a-z]+$/.test(s.split('?')[0])) return next(s + '.ts', c); throw e } }`,
    ),
)

const root = new URL('../', import.meta.url)
const D = await import(new URL('src/data/return-programs.ts', root).href)
const G = await import(new URL('src/lib/return-programs/progress.ts', root).href)
const P = await import(new URL('src/lib/karte/soap-phrases.ts', root).href)
const K = await import(new URL('src/lib/karte-dedupe.ts', root).href)

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

// PubMed で確かめた文献の番号（PMID → DOI）。2026-11-18 に PubMed の記録から写した。打ちまちがいを見つけるための控え
const VERIFIED = {
  23015866: '10.1177/1941738108331198',
  8883678: '10.1177/036354659602400506',
  29450826: '10.1007/s12178-018-9454-7',
  40298098: '10.1177/19417381251333402',
  38546157: '10.1177/19417381241237011',
  38439773: '10.26603/001c.94146',
  29720478: '10.1136/bjsports-2017-098602',
  35921783: '10.1016/j.ptsp.2022.07.006',
  27162233: '10.1136/bjsports-2016-096031',
  34158354: '10.1136/bjsports-2021-104087',
  30747379: '10.1007/s40279-019-01071-3',
  33962529: '10.2519/jospt.2021.9982',
  25103133: '10.2519/jospt.2014.5334',
  17307888: '10.1177/0363546506298279',
  26390272: '10.2519/jospt.2015.5885',
  33219115: '10.1136/bjsports-2020-103403',
  26390269: '10.2519/jospt.2015.5987',
  32284945: '10.1177/2325967120911106',
  23536466: '10.1136/bjsports-2013-092165',
  28035586: '10.1007/s40279-016-0667-x',
  32064292: '10.1177/2325967119897247',
  33115342: '10.2519/jospt.2021.9951',
  27347866: '10.1097/JSM.0000000000000334',
  33604151: '10.26603/001c.18715',
}
// 全文を読んだ文献（ほかは抄録だけ）
const FULLTEXT = new Set(['23015866', '33219115', '32284945'])

const programs = D.RETURN_PROGRAMS
const allText = (p) => [
  p.title, p.short, p.forWhom, p.evidence, ...p.before, ...p.rules, ...p.stop, ...(p.unverified ?? []),
  ...p.stages.flatMap((s) => [s.title, ...s.doing, ...(s.advance ?? [])]),
  ...p.sources.flatMap((s) => [s.label, s.found]),
]

test('プログラムは10本。id が重ならない・段階は4つ以上で id が重ならない', () => {
  assert.equal(programs.length, 10)
  assert.equal(new Set(programs.map((p) => p.id)).size, programs.length)
  for (const p of programs) {
    assert.ok(p.stages.length >= 4, p.id)
    assert.equal(new Set(p.stages.map((s) => s.id)).size, p.stages.length, p.id)
    assert.ok(/^[a-z][a-z-]+$/.test(p.id), p.id)
    for (const s of p.stages) {
      assert.ok(/^[a-z]\d+$/.test(s.id), `${p.id} ${s.id}`)
      assert.ok(s.doing.length >= 1, `${p.id} ${s.id}`)
    }
    assert.ok(p.before.length >= 1 && p.rules.length >= 2 && p.stop.length >= 1, p.id)
    assert.ok(p.forWhom.length > 10 && p.evidence.length > 30, p.id)
  }
})

test('保存値の id は変えていない（プログラムと段階。足すのはよいが、消す・変えるはしない）', () => {
  const ids = Object.fromEntries(programs.map((p) => [p.id, p.stages.map((s) => s.id).join(' ')]))
  const run = 'r1 r2 r3 r4 r5 r6 r7 r8'
  assert.deepEqual(ids, {
    throwing: 't1 t2 t3 t4 t5 t6 t7',
    'acl-running': run,
    'ankle-sprain': 'a1 a2 a3 a4 a5 a6',
    'bone-stress-running': run,
    achilles: 'c1 c2 c3 c4 c5',
    'patellar-tendon': 'p1 p2 p3 p4 p5',
    osgood: 'o1 o2 o3 o4 o5',
    hamstring: 'h1 h2 h3 h4 h5',
    adductor: 'g1 g2 g3 g4',
    'lumbar-youth': 'l1 l2 l3 l4 l5',
  })
})

test('短い名前と段階の名前に、SOAP の区切りの文字（、。改行）が無い', () => {
  for (const p of programs) {
    assert.ok(!/[、。\n]/.test(p.short), p.short)
    for (const s of p.stages) assert.ok(!/[、。\n]/.test(s.title), `${p.id}: ${s.title}`)
  }
})

test('文献：どのプログラムにも1本以上。PMID と DOI が PubMed の控えと合う。確認の範囲（全文／抄録）が正しい', () => {
  const seen = new Set()
  for (const p of programs) {
    assert.ok(p.sources.length >= 1, p.id)
    assert.equal(new Set(p.sources.map((s) => s.doi)).size, p.sources.length, `${p.id} 同じ文献が2回`)
    for (const s of p.sources) {
      assert.ok(s.found.length >= 20, `${p.id} ${s.label}`)
      assert.ok(/^10\.\d{4,}\/\S+$/.test(s.doi), s.doi)
      assert.ok(/（(19|20)\d\d）/.test(s.label), s.label)
      if (s.pmid) {
        assert.equal(VERIFIED[s.pmid], s.doi, `${p.id} ${s.label}`)
        assert.equal(s.checked, FULLTEXT.has(s.pmid) ? 'fulltext' : 'abstract', `${p.id} ${s.label}`)
        seen.add(s.pmid)
      } else {
        // PMID の無い文献は、料金の動画で使っている1本（Hupperets 2009）だけ
        assert.equal(s.doi, '10.1136/bmj.b2684', s.label)
        assert.equal(s.checked, 'abstract')
      }
    }
  }
  assert.equal(seen.size, Object.keys(VERIFIED).length, '控えにあるのに使っていない文献がある')
  assert.equal(D.pubmedUrl('23015866'), 'https://pubmed.ncbi.nlm.nih.gov/23015866/')
  assert.equal(D.doiUrl('10.1136/bmj.b2684'), 'https://doi.org/10.1136/bmj.b2684')
  assert.match(D.PROGRAMS_CHECKED_ON, /^\d{4}-\d{2}-\d{2}$/)
})

test('部位：膝・足・股・肩・肘・腰にプログラムがある。手関節・頚部は「確かめられていない」と出す', () => {
  const covered = new Set(programs.flatMap((p) => p.regions))
  for (const r of ['knee', 'ankle', 'hip', 'shoulder', 'elbow', 'lumbar']) assert.ok(covered.has(r), r)
  for (const r of ['wrist', 'cervical']) {
    assert.ok(!covered.has(r), r)
    assert.ok(D.NO_PROGRAM_REGIONS[r].includes('確かめられていません'), r)
  }
  for (const p of programs) for (const r of p.regions) assert.ok(P.PHRASE_REGIONS.includes(r), `${p.id} ${r}`)
})

test('言い方：治る・戻れることを約束しない。ほかの院と比べない。有意差なしを「差がない」と言い切らない', () => {
  const ng = /必ず|完治|治ります|治せ|絶対|保証|確実に|他院|当院だけ|No\.?1|最高|最先端|差はない|差がない|差は無い(?!。)|効果があります/
  for (const p of programs) for (const t of allText(p)) assert.ok(!ng.test(t), `${p.id}: ${t}`)
  assert.ok(D.PROGRAM_NOTE.includes('医師の指示'))
  assert.ok(D.COMMON_STOP.length >= 3)
})

test('確かめられなかった数字のあるプログラムには、その断り書きがある', () => {
  const by = Object.fromEntries(programs.map((p) => [p.id, p]))
  for (const id of ['achilles', 'osgood', 'hamstring', 'adductor', 'lumbar-youth', 'bone-stress-running', 'throwing']) {
    assert.ok((by[id].unverified ?? []).length >= 1, id)
  }
  // 医師の診断・許可が前提のもの
  for (const id of ['acl-running', 'bone-stress-running', 'lumbar-youth']) {
    assert.ok(by[id].before.some((t) => t.includes('医師')), id)
  }
  assert.ok(by.throwing.before.some((t) => t.includes('医師の投球許可')))
})

// ── 進み具合 ──
const stamp = (date, n, note) => ({ date, now: `${date}T03:00:0${n}.000Z`, eventId: `e${n}`, note })
const start = (over = {}) => G.startProgram({ id: 'rp1', patientId: 'p1', programId: 'throwing', ...stamp('2026-11-18', 0), ...over })

test('始める：最初の段階から。途中の段階も選べる。無い段階・無いプログラムは受けない', () => {
  const r = start()
  assert.equal(r.status, 'active')
  assert.equal(r.stageId, 't1')
  assert.equal(r.startedOn, '2026-11-18')
  assert.equal(r.stageSince, '2026-11-18')
  assert.deepEqual(r.events.map((e) => [e.kind, e.to]), [['start', 't1']])
  assert.equal(r.side, undefined)
  assert.equal(start({ stageId: 't3', side: 'right' }).stageId, 't3')
  assert.equal(start({ side: 'right' }).side, 'right')
  assert.equal(start({ side: 'na' }).side, undefined)
  assert.equal(start({ stageId: 'zz' }).stageId, 't1')
  assert.equal(start({ programId: 'nothing' }), null)
})

test('進む・戻す：履歴に残り、その日から数え直す。もとの記録は変えない', () => {
  const r0 = start()
  const r1 = G.moveStage(r0, 't2', stamp('2026-11-20', 1))
  assert.equal(r1.stageId, 't2')
  assert.equal(r1.stageSince, '2026-11-20')
  assert.deepEqual(r1.events.at(-1), { id: 'e1', kind: 'advance', at: '2026-11-20T03:00:01.000Z', date: '2026-11-20', from: 't1', to: 't2' })
  assert.equal(r0.stageId, 't1')
  assert.equal(r0.events.length, 1)
  const r2 = G.moveStage(r1, 't1', stamp('2026-11-22', 2, ' 翌日に張りが残った '))
  assert.equal(r2.events.at(-1).kind, 'back')
  assert.equal(r2.events.at(-1).note, '翌日に張りが残った')
  assert.equal(G.moveStage(r1, 't2', stamp('2026-11-22', 3)), null) // 同じ段階
  assert.equal(G.moveStage(r1, 'zz', stamp('2026-11-22', 3)), null) // 無い段階
  assert.equal(G.nextStage(r1).id, 't3')
  assert.equal(G.prevStage(r1).id, 't1')
  assert.equal(G.prevStage(r0), null)
  assert.equal(G.nextStage(start({ stageId: 't7' })), null)
})

test('終了・中止・再開：中止は理由が要る。終えたものは動かせない。再開はその日から数え直す', () => {
  const r = start({ stageId: 't7' })
  const done = G.finishProgram(r, stamp('2026-12-20', 1, '試合に復帰'))
  assert.equal(done.status, 'finished')
  assert.equal(done.events.at(-1).note, '試合に復帰')
  assert.equal(G.moveStage(done, 't6', stamp('2026-12-21', 2)), null)
  assert.equal(G.finishProgram(done, stamp('2026-12-21', 2)), null)
  assert.equal(G.stopProgram(r, stamp('2026-12-01', 1, '  ')), null) // 理由なし
  const stopped = G.stopProgram(r, stamp('2026-12-01', 1, '医師の指示で休止'))
  assert.equal(stopped.status, 'stopped')
  assert.equal(G.resumeProgram(r, stamp('2026-12-02', 2)), null) // 進行中は再開できない
  const again = G.resumeProgram(stopped, stamp('2026-12-10', 2))
  assert.equal(again.status, 'active')
  assert.equal(again.stageId, 't7')
  assert.equal(again.stageSince, '2026-12-10')
  assert.deepEqual(again.events.map((e) => e.kind), ['start', 'stop', 'resume'])
})

test('日数と位置：この段階になってからの日数・段階の番号', () => {
  const r = G.moveStage(start(), 't2', stamp('2026-11-20', 1))
  assert.equal(G.daysInStage(r, '2026-11-20'), 0)
  assert.equal(G.daysInStage(r, '2026-11-25'), 5)
  assert.equal(G.daysInStage(r, '2026-11-19'), 0) // 前の日付でも負にしない
  assert.equal(G.daysBetween('2026-12-31', '2027-01-02'), 2)
  const pos = G.stagePosition(r)
  assert.equal(pos.index, 1)
  assert.equal(pos.total, 7)
  assert.equal(G.stagePosition({ ...r, stageId: 'zz' }), null)
  assert.equal(G.stagePosition({ ...r, programId: 'nothing' }), null)
})

test('SOAP に入れる文：進行中のものだけ・新しく動かした順。「文を選ぶ」で足す・外すができる', () => {
  const a = G.moveStage(start(), 't3', stamp('2026-11-20', 1))
  const b = G.startProgram({ id: 'rp2', patientId: 'p1', programId: 'ankle-sprain', ...stamp('2026-11-21', 2) })
  const c = G.finishProgram(G.startProgram({ id: 'rp3', patientId: 'p1', programId: 'osgood', ...stamp('2026-11-01', 3) }), stamp('2026-11-10', 4))
  const other = G.startProgram({ id: 'rp4', patientId: 'p2', programId: 'achilles', ...stamp('2026-11-22', 5) })
  assert.equal(G.soapPhrase(a), '投球プログラム 段階3（塁間（20m））')
  assert.deepEqual(G.activeSoapPhrases([a, b, c, other], 'p1'), ['ねんざ復帰 段階1（腫れを落ち着かせて歩く）', '投球プログラム 段階3（塁間（20m））'])
  for (const p of programs) {
    for (const s of p.stages) {
      const phrase = G.soapPhrase({ ...a, programId: p.id, stageId: s.id })
      assert.ok(!/[、。\n]/.test(phrase), phrase)
      const added = P.togglePhrase('手技療法', phrase)
      assert.ok(P.hasPhrase(added, phrase), phrase)
      assert.equal(P.togglePhrase(added, phrase), '手技療法')
    }
  }
})

test('えらぶ画面：その方の部位に合うプログラムを先に。一覧は進行中が先', () => {
  const { mine, others } = G.programsFor(programs, ['knee'])
  assert.deepEqual(mine.map((p) => p.id), ['acl-running', 'bone-stress-running', 'patellar-tendon', 'osgood', 'hamstring'])
  assert.equal(mine.length + others.length, programs.length)
  assert.equal(G.programsFor(programs, []).mine.length, 0)
  assert.equal(G.programsFor(programs, ['wrist']).mine.length, 0)
  const a = start()
  const done = G.finishProgram({ ...start(), id: 'x' }, stamp('2026-11-30', 9))
  assert.deepEqual(G.sortRecords([done, a]).map((r) => r.id), ['rp1', 'x'])
})

test('保存のキー：pt_return_programs。重複したカルテの整理でも一緒に移す', () => {
  assert.equal(G.RETURN_PROGRAMS_KEY, 'pt_return_programs')
  assert.ok(K.PATIENT_RECORD_KEYS.includes('pt_return_programs'))
})

console.log(`\n${passed} 件成功・0 件失敗`)
