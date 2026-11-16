// 患者さんによる「日時の変更」まわりの確認：変更用のリンク・お知らせの文面・予約システムからの「変更」の知らせ
// 実行: npx tsx tools/test-reservation-change.mjs
// 外には送らない（fetch を差しかえて LINE の返事をまねる）。KV は一時フォルダのファイル。データはすべて架空
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

const root = new URL('../', import.meta.url)
const imp = (p) => import(new URL(p, root).href)

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsv-change-'))
const cwd = process.cwd()
process.chdir(dir)
const realFetch = globalThis.fetch
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_API_BASE_URL|MARKETING_MODE)/.test(k)) delete process.env[k]
const SECRET = 'test-shared-secret'
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
process.env.RESERVATION_NOTIFY_SECRET = SECRET
process.env.RESERVATION_NOTIFY_LINE_USER_ID = 'U00000000000000000000000000000000'

const HANAKO = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const LIFFER = 'Ucccccccccccccccccccccccccccccccc'
const OWNER = 'U00000000000000000000000000000000'
const RESERVE = 'https://script.google.com/macros/s/AKfycby6httkx008ojq7MIBpC7pDmfsJQAtQx6xpYNkD67JM7K7jgGaWGkTky9RHW04M1qm9/exec'

const pushes = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u === 'https://api.line.me/v2/bot/message/push') {
    const body = JSON.parse(init.body)
    pushes.push({ to: body.to, text: body.messages[0].text })
    return new Response('{}', { status: 200 })
  }
  throw new Error(`外への通信はしない: ${u}`)
}

try {
  const { reservationChangeKey, reservationChangeUrl } = await imp('src/lib/reservation-change-link.ts')
  const msg = await imp('src/lib/reservation-message.ts')
  const { kvGet, kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { saveLineLink } = await imp('src/lib/line-link-server.ts')
  const { sealUserId } = await imp('src/lib/liff-ticket.ts')
  const { saveRule } = await imp('src/lib/marketing/automation-store-server.ts')
  const rsv = await imp('src/lib/marketing/line-reservation-server.ts')
  const route = await imp('src/app/api/marketing/reservation-notify/route.ts')

  const keyOf = (no) => createHmac('sha256', SECRET).update(`rsvchange:${no}`).digest('hex').slice(0, 24)
  const urlOf = (no) => `${RESERVE}?rsv=${no}&rk=${keyOf(no)}`

  await test('リンクの署名：予約システム（GAS の reservationLinkKey_）と同じ答えになる', () => {
    // 予約システムの試験（tests/test-patient-change.mjs）も、同じ鍵・同じ予約番号でこの値になることを確かめている
    assert.equal(reservationChangeKey('A2B3C4', SECRET), 'a719e2ce3093b3eb284831bf')
    assert.equal(reservationChangeKey('a2b3c4', SECRET), 'a719e2ce3093b3eb284831bf', '小文字は大文字にして数える')
    assert.equal(reservationChangeUrl('A2B3C4'), `${RESERVE}?rsv=A2B3C4&rk=a719e2ce3093b3eb284831bf`)
    assert.notEqual(reservationChangeKey('A2B3C5', SECRET), reservationChangeKey('A2B3C4', SECRET))
    assert.notEqual(reservationChangeKey('A2B3C4', 'other-secret'), reservationChangeKey('A2B3C4', SECRET))
  })

  await test('リンクを作らないとき：鍵が無い・予約番号の形が違う', () => {
    assert.equal(reservationChangeUrl('A2B3C4', ''), '')
    assert.equal(reservationChangeUrl(''), '')
    assert.equal(reservationChangeUrl(undefined), '')
    assert.equal(reservationChangeUrl('R-100'), '')
    assert.equal(reservationChangeUrl('A2B3C4&x=1'), '')
    assert.equal(reservationChangeUrl('ABC'), '')
  })

  await test('確定のお知らせ：リンクが無ければ今までどおり。あればリンクつきの案内になる', () => {
    const base = { name: '山田 花子', date: '2030-01-11', time: '10:30', reservationNo: 'A2B3C4' }
    assert.equal(
      msg.patientConfirmText(base),
      ['山田 花子 様', '', 'ゆうき整骨院です。ご予約ありがとうございます。', '以下の内容で確定しました。', '', '📅 日時：1月11日（金） 10:30〜', '🎫 予約番号：A2B3C4', '',
        '変更・キャンセルは、このトークまたは', 'お電話（083-265-4545）へお気軽にどうぞ。', '当日はお気をつけてお越しください😊'].join('\n'),
    )
    assert.equal(
      msg.patientConfirmText({ ...base, changeUrl: urlOf('A2B3C4') }),
      ['山田 花子 様', '', 'ゆうき整骨院です。ご予約ありがとうございます。', '以下の内容で確定しました。', '', '📅 日時：1月11日（金） 10:30〜', '🎫 予約番号：A2B3C4', '',
        '日時の変更・キャンセルは、こちらから（入力はいりません）', urlOf('A2B3C4'), 'このトーク・お電話（083-265-4545）でも承ります。', '当日はお気をつけてお越しください😊'].join('\n'),
    )
  })

  await test('前日のお知らせ：リンクが無ければ今までどおり。あればリンクつき', () => {
    const now = new Date('2030-01-10T02:00:00Z')
    const base = { name: '山田花子', date: '2030-01-11', time: '10:30', reservationNo: 'A2B3C4' }
    const plain = msg.patientRemindText(base, now)
    assert.match(plain, /明日のご予約のお知らせです。/)
    assert.match(plain, /変更・キャンセルは、このトークまたは\nお電話（083-265-4545）へどうぞ。/)
    assert.ok(!plain.includes('script.google.com'))
    const linked = msg.patientRemindText({ ...base, changeUrl: urlOf('A2B3C4') }, now)
    assert.ok(linked.includes(`日時の変更・キャンセルは、こちらから（入力はいりません）\n${urlOf('A2B3C4')}\nこのトーク・お電話（083-265-4545）でも承ります。`))
    assert.match(linked, /※このお知らせが不要な方は/)
    assert.equal(linked.replace(`日時の変更・キャンセルは、こちらから（入力はいりません）\n${urlOf('A2B3C4')}\nこのトーク・お電話（083-265-4545）でも承ります。`, '変更・キャンセルは、このトークまたは\nお電話（083-265-4545）へどうぞ。'), plain, 'ほかの行は同じ')
  })

  await test('文面に入れるリンクは、予約ページのものだけ（ほかのアドレス・改行は入れない）', () => {
    assert.equal(msg.safeChangeUrl(urlOf('A2B3C4')), urlOf('A2B3C4'))
    for (const bad of ['https://example.com/?rsv=A2B3C4&rk=x', `${RESERVE}`, `${RESERVE}?page=admin`, `${RESERVE}?rsv=A2B3C4\nhttps://example.com`, `${RESERVE}.example.com/?rsv=A`, '', undefined]) {
      assert.equal(msg.safeChangeUrl(bad), '', String(bad))
      assert.ok(!msg.patientConfirmText({ name: '山田', date: '2030-01-11', time: '10:30', reservationNo: 'A2B3C4', changeUrl: bad }).includes('example.com'))
    }
  })

  await test('「日時を変更しました」の文面：新しい日時・変更前・もう一度変えるときのリンク', () => {
    const text = msg.patientChangeText({ name: '山田花子', date: '2030-01-18', time: '17:00', prevDate: '2030-01-16', prevTime: '10:00', reservationNo: 'A2B3C4', changeUrl: urlOf('A2B3C4') })
    assert.equal(
      text,
      ['山田花子 様', '', 'ゆうき整骨院です。ご予約の日時を変更しました。', '', '📅 新しい日時：1月18日（金） 17:00〜', '（変更前：1月16日（水） 10:00〜）', '🎫 予約番号：A2B3C4', '',
        'もう一度変更・キャンセルするときは、こちらから', urlOf('A2B3C4'), 'このトーク・お電話（083-265-4545）でも承ります。', '当日はお気をつけてお越しください😊'].join('\n'),
    )
    const plain = msg.patientChangeText({ name: '山田\n花子', date: '2030-01-18', time: '17:00', reservationNo: 'A2B3C4' })
    assert.match(plain, /^山田 花子 様\n/, 'お名前の改行は取る')
    assert.ok(!plain.includes('変更前') && plain.includes('変更・キャンセルは、このトークまたは\nお電話（083-265-4545）へどうぞ。'))
    // 効果を約束する言葉・急がせる言葉は入れない
    for (const t of [text, plain]) assert.ok(!/治|必ず|今すぐ|限定/.test(t))
  })

  // ここから、予約システムからの「変更」の知らせ
  const NOW = new Date('2030-01-10T02:00:00Z') // 日本時間 1/10 11:00
  const opts = { now: NOW }
  await saveLineLink({ key: '09011112222|山田花子', name: '山田花子', phone: '09011112222', sealed: sealUserId(HANAKO, SECRET), linkedAt: '2030-01-01T00:00:00Z', via: 'liff-link' })

  await test('変更の知らせ：控えの日時を直し、前日のお知らせを送り直せるように戻し、ご本人へ「変更しました」を1通', async () => {
    await kvSet('linersv:A2B3C4', { reservationNo: 'A2B3C4', key: '09011112222|山田花子', date: '2030-01-11', time: '10:00', savedAt: '2030-01-05T00:00:00Z', confirmedAt: '2030-01-05T00:00:10Z', remindedAt: '2030-01-10T01:00:00Z' })
    const r = await rsv.onChangeReservation({ reservationNo: 'A2B3C4', name: '山田 花子', phone: '090-1111-2222', date: '2030-01-18', time: '17:00', prevDate: '2030-01-11', prevTime: '10:00' }, opts)
    assert.deepEqual(r, { delivered: true, note: 'sent' })
    const kept = await kvGet('linersv:A2B3C4')
    assert.equal(kept.date, '2030-01-18')
    assert.equal(kept.time, '17:00')
    assert.equal(kept.key, '09011112222|山田花子')
    assert.equal(kept.remindedAt, undefined, '新しい日にちの前日に、もう一度お知らせできる')
    assert.equal(kept.confirmedAt, '2030-01-05T00:00:10Z')
    assert.equal(pushes.length, 1)
    assert.equal(pushes[0].to, HANAKO)
    assert.match(pushes[0].text, /ご予約の日時を変更しました。/)
    assert.match(pushes[0].text, /新しい日時：1月18日（金） 17:00〜/)
    assert.match(pushes[0].text, /変更前：1月11日（金） 10:00〜/)
    assert.ok(pushes[0].text.includes(urlOf('A2B3C4')))
  })

  await test('同じ変更の知らせがもう一度来ても、二重には送らない。別の日時へ変えて戻したときは送る', async () => {
    const again = await rsv.onChangeReservation({ reservationNo: 'A2B3C4', name: '山田花子', phone: '09011112222', date: '2030-01-18', time: '17:00', prevDate: '2030-01-11', prevTime: '10:00' }, opts)
    assert.equal(again.note, '同じお知らせは送り済みです')
    assert.equal(pushes.length, 1)
    await rsv.onChangeReservation({ reservationNo: 'A2B3C4', name: '山田花子', phone: '09011112222', date: '2030-01-19', time: '11:00', prevDate: '2030-01-18', prevTime: '17:00' }, opts)
    const back = await rsv.onChangeReservation({ reservationNo: 'A2B3C4', name: '山田花子', phone: '09011112222', date: '2030-01-18', time: '17:00', prevDate: '2030-01-19', prevTime: '11:00' }, opts)
    assert.equal(back.delivered, true)
    assert.equal(pushes.length, 3)
    assert.equal((await kvGet('linersv:A2B3C4')).date, '2030-01-18')
  })

  await test('控えが無かった予約：電話＋お名前で LINE 連携の方とわかれば、控えを作って送る', async () => {
    const before = pushes.length
    const r = await rsv.onChangeReservation({ reservationNo: 'B7C8D9', name: '山田花子', phone: '09011112222', date: '2030-01-20', time: '15:30', prevDate: '2030-01-17', prevTime: '15:30' }, opts)
    assert.equal(r.delivered, true)
    assert.equal(pushes.length, before + 1)
    const kept = await kvGet('linersv:B7C8D9')
    assert.equal(kept.key, '09011112222|山田花子')
    assert.equal(kept.date, '2030-01-20')
  })

  await test('LINE 連携していない方：送らない・控えも作らない。LINE から予約した方は、予約の行の封印の宛先へ', async () => {
    const before = pushes.length
    const none = await rsv.onChangeReservation({ reservationNo: 'C1D2E3', name: '架空 次郎', phone: '09099998888', date: '2030-01-20', time: '16:00', prevDate: '2030-01-17', prevTime: '16:00' }, opts)
    assert.deepEqual(none, { delivered: false, note: 'LINE連携していない方' })
    assert.equal(pushes.length, before)
    assert.equal(await kvGet('linersv:C1D2E3'), null)
    const liff = await rsv.onChangeReservation({ reservationNo: 'C1D2E4', name: '架空 三郎', phone: '09077776666', date: '2030-01-20', time: '16:30', prevDate: '2030-01-17', prevTime: '16:30', sealed: sealUserId(LIFFER, SECRET) }, opts)
    assert.equal(liff.delivered, true)
    assert.equal(pushes.at(-1).to, LIFFER)
    assert.match(pushes.at(-1).text, /^架空 三郎 様/)
    // でたらめな封印では送らない
    const bad = await rsv.onChangeReservation({ reservationNo: 'C1D2E5', name: '架空 四郎', phone: '09077775555', date: '2030-01-20', time: '17:00', sealed: 's1.xxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyy' }, opts)
    assert.equal(bad.delivered, false)
  })

  await test('形のおかしい知らせ・過ぎた日への変更は送らない（過ぎた日の控えは消す）', async () => {
    const before = pushes.length
    assert.equal((await rsv.onChangeReservation({ reservationNo: 'A 1/2', date: '2030-01-18', time: '17:00' }, opts)).note, '予約番号・日時が読めません')
    assert.equal((await rsv.onChangeReservation({ reservationNo: 'A2B3C4', date: '2030/01/18', time: '17:00' }, opts)).note, '予約番号・日時が読めません')
    assert.equal((await rsv.onChangeReservation({ reservationNo: 'A2B3C4', name: '山田花子', phone: '09011112222', date: '2030-01-09', time: '17:00' }, opts)).note, '過ぎた日の予約')
    assert.equal(await kvGet('linersv:A2B3C4'), null)
    assert.equal(pushes.length, before)
  })

  await test('「止める」のときは送らないが、控えの日時は直す', async () => {
    await saveRule('reservation_confirm', { mode: 'off', dailyLimit: 60 })
    const before = pushes.length
    const r = await rsv.onChangeReservation({ reservationNo: 'B7C8D9', name: '山田花子', phone: '09011112222', date: '2030-01-22', time: '10:00', prevDate: '2030-01-20', prevTime: '15:30' }, opts)
    assert.deepEqual(r, { delivered: false, note: '自動化設定で止めています' })
    assert.equal(pushes.length, before)
    assert.equal((await kvGet('linersv:B7C8D9')).date, '2030-01-22')
    await saveRule('reservation_confirm', { mode: 'on', dailyLimit: 60 })
  })

  // 予約システムからの知らせの受け口（/api/marketing/reservation-notify）
  const post = (body, secret = SECRET) =>
    route.POST(new NextRequest('https://yuuki-rehab.vercel.app/api/marketing/reservation-notify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-reservation-secret': secret }, body: JSON.stringify(body) }))
  const today = new Date(Date.now() + 9 * 3600e3)
  const dayAfter = (n) => new Date(today.getTime() + n * 86400e3).toISOString().slice(0, 10)

  await test('受け口：kind "change" は、院長のLINEへ「日時を変更しました」（新しい日時・変更前）と、ご本人へ1通', async () => {
    pushes.length = 0
    const res = await post({ kind: 'change', reservationNo: 'D4E5F6', name: '山田 花子', kana: 'ヤマダ ハナコ', phone: '090-1111-2222', menu: '再診（同じ症状の続き）', date: dayAfter(5), time: '17:00', prevDate: dayAfter(2), prevTime: '10:00' })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.ok, true)
    assert.equal(data.patientDelivered, true, '予約システムの画面に「LINEに確認をお送りしました」と出すための返事')
    assert.equal(pushes.length, 2)
    const toPatient = pushes.find((p) => p.to === HANAKO)
    const toOwner = pushes.find((p) => p.to === OWNER)
    assert.match(toPatient.text, /ご予約の日時を変更しました。/)
    assert.ok(toPatient.text.includes(urlOf('D4E5F6')))
    assert.match(toOwner.text, /^🔁 患者さんが予約の日時を変更しました/)
    assert.ok(toOwner.text.includes(`新しい日時：${dayAfter(5)} 17:00`))
    assert.ok(toOwner.text.includes(`変更前：${dayAfter(2)} 10:00`))
    assert.match(toOwner.text, /氏名：山田 花子（ヤマダ ハナコ）/)
    assert.match(toOwner.text, /予約番号：D4E5F6/)
    assert.ok(!toOwner.text.includes('rk='), '院長への知らせには、変更用のリンクは入れない')
    assert.equal((await kvGet('linersv:D4E5F6')).date, dayAfter(5))
  })

  await test('受け口：LINE 連携していない方の変更は、院長へだけ知らせる', async () => {
    pushes.length = 0
    const data = await (await post({ kind: 'change', reservationNo: 'D4E5F7', name: '架空 次郎', phone: '09099998888', date: dayAfter(5), time: '18:00', prevDate: dayAfter(2), prevTime: '18:00' })).json()
    assert.equal(data.ok, true)
    assert.equal(data.patientDelivered, false)
    assert.deepEqual(pushes.map((p) => p.to), [OWNER])
  })

  await test('受け口：合言葉が違う・形がおかしい知らせは受けない', async () => {
    pushes.length = 0
    assert.equal((await post({ kind: 'change', reservationNo: 'D4E5F6', date: dayAfter(5), time: '17:00' }, 'wrong')).status, 401)
    assert.equal((await post({ kind: 'change', reservationNo: 'D4 E5', date: dayAfter(5), time: '17:00' })).status, 400)
    assert.equal((await post({ kind: 'change', reservationNo: 'D4E5F6', date: '11/20', time: '17:00' })).status, 400)
    assert.equal((await post({ kind: 'change', reservationNo: 'D4E5F6', date: dayAfter(5) })).status, 400)
    assert.equal(pushes.length, 0)
  })

  await test('受け口：LINE から予約した方への「確定しました」「前日のお知らせ」にも、変更用のリンクが入る', async () => {
    pushes.length = 0
    await saveRule('reservation_remind', { mode: 'on', dailyLimit: 60 })
    const sealed = sealUserId(LIFFER, SECRET)
    const confirm = await (await post({ kind: 'patient-confirm', sealed, reservationNo: 'E5F6G7', name: '架空 三郎', date: dayAfter(3), time: '10:30' })).json()
    assert.equal(confirm.delivered, true)
    assert.equal(pushes[0].to, LIFFER)
    assert.ok(pushes[0].text.includes(`日時の変更・キャンセルは、こちらから（入力はいりません）\n${urlOf('E5F6G7')}`))
    assert.match(pushes[0].text, /以下の内容で確定しました。/)
    const remind = await (await post({ kind: 'patient-remind', sealed, reservationNo: 'E5F6G7', name: '架空 三郎', date: dayAfter(1), time: '10:30' })).json()
    assert.equal(remind.delivered, true)
    assert.ok(pushes[1].text.includes(urlOf('E5F6G7')))
    // キャンセルの確認には入れない（もう変更できないため）
    await post({ kind: 'patient-cancel', sealed, reservationNo: 'E5F6G7', name: '架空 三郎', date: dayAfter(1), time: '10:30' })
    assert.ok(!pushes[2].text.includes('rk='))
  })
} finally {
  globalThis.fetch = realFetch
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
  process.chdir(cwd)
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${passed} 件 OK`)
