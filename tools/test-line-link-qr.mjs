// カルテの画面の「LINE連携のQRコード」（2026-11-19 院長の依頼）の確認
// 実行: npx tsx tools/test-line-link-qr.mjs
// 外には送らない（fetch を差しかえて、予約システムの患者番号と LINE の返事をまねる）。KV は一時フォルダのファイル。データはすべて架空
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'

const root = new URL('../', import.meta.url)
const imp = (p) => import(new URL(p, root).href)
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8')

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'line-qr-'))
const cwd = process.cwd()
process.chdir(dir)
const realFetch = globalThis.fetch
const saved = { ...process.env }
for (const k of Object.keys(process.env)) if (/^(SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_API_BASE_URL|MARKETING_MODE)/.test(k)) delete process.env[k]
const SECRET = 'test-shared-secret'
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
process.env.RESERVATION_NOTIFY_SECRET = SECRET

const HANAKO = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const OTHER = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const pushes = []
const patientNoCalls = []
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u === 'https://api.line.me/v2/bot/message/push') {
    const body = JSON.parse(init.body)
    pushes.push({ to: body.to, text: body.messages[0].text })
    return new Response('{}', { status: 200 })
  }
  if (u.includes('api=patientno')) {
    patientNoCalls.push(u)
    return new Response(JSON.stringify({ ok: true, patientNo: '2948' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  throw new Error(`外への通信はしない: ${u}`)
}

try {
  const Q = await imp('src/lib/line-link-qr.ts')
  const S = await imp('src/lib/line-link-qr-server.ts')
  const { KV_PREFIXES, kvGet, kvList, kvSet } = await imp('src/lib/marketing/kv-store-server.ts')
  const { listLineLinks, getLineLink } = await imp('src/lib/line-link-server.ts')
  const { issueTicket, unsealUserId } = await imp('src/lib/liff-ticket.ts')
  const route = await imp('src/app/api/liff/link/route.ts')
  const clinicRoute = await imp('src/app/api/line-link/qr/route.ts')
  const post = (body) =>
    route.POST(new NextRequest('https://yuuki-rehab.vercel.app/api/liff/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  const LIFF = '2010991753-yKKnDDnb'

  console.log('\n【決まり】')
  await test('QR の中は URL と番号だけ（お名前・電話番号は入れない）。LIFF ID・番号の形が違えば作らない', () => {
    const code = 'A'.repeat(24)
    assert.equal(Q.linkQrUrl(LIFF, code), `https://liff.line.me/${LIFF}/link?c=${code}`)
    assert.equal(Q.linkQrUrl('abc', code), '')
    assert.equal(Q.linkQrUrl(LIFF, 'short'), '')
    assert.equal(Q.linkQrUrl(LIFF, 'a b'.repeat(10)), '')
  })
  await test('LINE の画面に出すお名前は、カルテのお名前そのまま（2026-11-20 院長「名前の◯◯に患者様の名前が入っていませんでした」）', () => {
    assert.equal(Q.maskedName, undefined, '一部を伏せる関数は使わない')
    const page = read('src/app/liff/yoyaku/link/page.tsx')
    assert.ok(page.includes('{preview.name} 様'))
    assert.ok(!page.includes('maskedName'))
  })
  await test('10分・残り時間の表示', () => {
    assert.equal(Q.LINK_QR_TTL_MS, 10 * 60 * 1000)
    const now = new Date('2030-01-01T00:00:00Z')
    assert.equal(Q.remainingText('2030-01-01T00:09:12Z', now), 'あと 9分12秒')
    assert.equal(Q.remainingText('2030-01-01T00:00:30Z', now), 'あと 30秒')
    assert.equal(Q.remainingText('2029-12-31T23:59:00Z', now), '期限切れ')
  })
  await test('入れ物の頭（lqr:）は、LINE の連絡先の一覧にまぎれこまない', () => {
    assert.ok(KV_PREFIXES.includes(Q.LINK_QR_PREFIX))
  })

  console.log('\n【カルテの画面で作る（院内）】')
  const karte = { patientId: 'p_hanako', name: '架空 花子', phone: '090-1111-2222', birthDate: '1990-01-23' }
  let first
  await test('作る：10分の番号。カルテのお名前・電話番号・生年月日を置く', async () => {
    first = await S.createLinkQr(karte)
    assert.ok(Q.isValidLinkCode(first.code))
    assert.equal(first.status, 'waiting')
    assert.equal(first.phone, '09011112222')
    assert.equal(Date.parse(first.expiresAt) - Date.parse(first.createdAt), Q.LINK_QR_TTL_MS)
    const st = await S.linkQrStatus(first.code)
    assert.equal(st.status, 'waiting')
    assert.equal(st.name, undefined)
    assert.equal(st.phone, undefined)
  })
  let second
  await test('同じ方で作り直すと、前の番号は使えなくなる（中身も消す）', async () => {
    second = await S.createLinkQr(karte)
    const old = await kvGet(`lqr:${first.code}`)
    assert.equal(old.status, 'cancelled')
    assert.equal(old.name, '')
    assert.equal(old.phone, '')
    const peek = await S.previewLinkQr(first.code)
    assert.deepEqual(peek, { ok: false, reason: 'cancelled' })
  })
  await test('院内の API（Basic 認証の内側）：作る・状態・取り消し。お名前・電話番号は返さない', async () => {
    const res = await clinicRoute.POST(new NextRequest('https://x/api/line-link/qr', { method: 'POST', body: JSON.stringify({ patientId: 'p_taro', name: '架空 太郎', phone: '', birthDate: '' }) }))
    const d = await res.json()
    assert.equal(d.ok, true)
    assert.equal(d.needPhone, true)
    assert.ok(Q.isValidLinkCode(d.code))
    const st = await (await clinicRoute.GET(new NextRequest(`https://x/api/line-link/qr?c=${d.code}`))).json()
    assert.equal(st.status, 'waiting')
    assert.ok(!JSON.stringify(st).includes('架空'))
    await clinicRoute.DELETE(new NextRequest(`https://x/api/line-link/qr?c=${d.code}`, { method: 'DELETE' }))
    const st2 = await (await clinicRoute.GET(new NextRequest(`https://x/api/line-link/qr?c=${d.code}`))).json()
    assert.equal(st2.status, 'cancelled')
    const bad = await clinicRoute.POST(new NextRequest('https://x/api/line-link/qr', { method: 'POST', body: JSON.stringify({ patientId: 'p 1', name: '架空' }) }))
    assert.equal(bad.status, 400)
    assert.ok(read('src/proxy.ts').includes("'/api/line-link/:path*'"), '院内の API は Basic 認証の内側')
  })

  console.log('\n【患者さんの LINE で読み取る】')
  const ticket = issueTicket(HANAKO, SECRET)
  await test('チケット（LINE でログインした証明）が無いと、お名前も見せない', async () => {
    const res = await post({ ticket: 'x', code: second.code, peek: true })
    assert.equal(res.status, 401)
  })
  await test('読み取る：カルテのお名前（架空 花子）を出す', async () => {
    const d = await (await post({ ticket, code: second.code, peek: true })).json()
    assert.deepEqual(d, { ok: true, name: '架空 花子', needPhone: false })
  })
  await test('「結びつける」：お名前・電話・生年月日はカルテのもの。今までと同じ入れ物に、封印した LINE の ID で', async () => {
    pushes.length = 0
    const d = await (await post({ ticket, code: second.code })).json()
    assert.equal(d.ok, true)
    assert.equal(d.patientNo, '2948')
    assert.equal(d.notified, true)
    const link = await getLineLink('09011112222|架空花子')
    assert.equal(link.via, 'karte-qr')
    assert.equal(link.patientId, 'p_hanako')
    assert.equal(link.birthDate, '1990-01-23')
    assert.equal(link.name, '架空 花子')
    assert.ok(!JSON.stringify(link).includes(HANAKO), '生の LINE の ID は保存しない')
    assert.equal(unsealUserId(link.sealed, SECRET), HANAKO)
    assert.equal(pushes.length, 1)
    assert.equal(pushes[0].to, HANAKO)
    assert.ok(pushes[0].text.includes('架空 花子さんのカルテとこのLINEを結びつけました') && pushes[0].text.includes('患者番号：2948'))
  })
  await test('結びついたら番号の中身を消して、印（状態・患者番号）だけを残す。カルテの画面は「結びつきました」', async () => {
    const s = await kvGet(`lqr:${second.code}`)
    assert.equal(s.status, 'linked')
    assert.equal(s.name, '')
    assert.equal(s.phone, '')
    assert.equal(s.birthDate, '')
    assert.equal(s.patientNo, '2948')
    const st = await S.linkQrStatus(second.code)
    assert.equal(st.status, 'linked')
  })
  await test('同じ QR は2回使えない（別の LINE でも）', async () => {
    const res = await post({ ticket: issueTicket(OTHER, SECRET), code: second.code })
    assert.equal(res.status, 410)
    const d = await res.json()
    assert.equal(d.reason, 'used')
    assert.equal(unsealUserId((await getLineLink('09011112222|架空花子')).sealed, SECRET), HANAKO)
  })
  await test('同じ LINE で開き直す・もう一度押す（LINE が画面を読み直した）：「結びついています」（お名前と患者番号。2026-11-20）', async () => {
    const peek = await post({ ticket, code: second.code, peek: true })
    assert.equal(peek.status, 410)
    const d = await peek.json()
    assert.deepEqual(d, { ok: false, reason: 'used', already: { name: '架空 花子', patientNo: '2948' } })
    pushes.length = 0
    const again = await (await post({ ticket, code: second.code })).json()
    assert.deepEqual(again.already, { name: '架空 花子', patientNo: '2948' })
    assert.equal(pushes.length, 0, 'もう一度お知らせは送らない')
    // 番号には LINE の ID もお名前も残さない（結びつけの記録の封印と比べて見分ける。前に結びついた番号も同じ形）
    const s = await kvGet(`lqr:${second.code}`)
    assert.ok(!JSON.stringify(s).includes(HANAKO))
    assert.equal(s.name, '')
    assert.deepEqual(Object.keys(s).sort(), ['birthDate', 'code', 'createdAt', 'expiresAt', 'linkKey', 'linkedAt', 'name', 'patientId', 'patientNo', 'phone', 'status'])
    // 別の LINE では「結びついています」を出さない（今までどおり「使えません」）
    const other = await (await post({ ticket: issueTicket(OTHER, SECRET), code: second.code, peek: true })).json()
    assert.equal(other.already, undefined)
    assert.equal(other.reason, 'used')
  })
  await test('この LINE がいま結びついているカルテ（お名前そのままと患者番号）。ほかの LINE の分は出さない（2026-11-20）', async () => {
    const mine = await (await post({ ticket, mine: true })).json()
    assert.equal(mine.ok, true)
    assert.ok(mine.linked.some((l) => l.name === '架空 花子' && l.patientNo === '2948'))
    assert.ok(mine.linked.every((l) => Object.keys(l).every((k) => k === 'name' || k === 'patientNo')), 'お名前と患者番号だけ')
    const other = await (await post({ ticket: issueTicket('Ucccccccccccccccccccccccccccccccc', SECRET), mine: true })).json()
    assert.deepEqual(other, { ok: true, linked: [] })
    const noTicket = await post({ mine: true })
    assert.equal(noTicket.status, 401)
  })
  await test('一覧（カルテの画面）にはカルテの ID が出る・封印は出さない', async () => {
    const list = await listLineLinks()
    const row = list.find((l) => l.key === '09011112222|架空花子')
    assert.equal(row.patientId, 'p_hanako')
    assert.equal(row.sealed, undefined)
  })
  await test('10分を過ぎた QR は使えない', async () => {
    const old = await S.createLinkQr({ patientId: 'p_old', name: '架空 次郎', phone: '08033334444' }, new Date(Date.now() - 11 * 60 * 1000))
    const res = await post({ ticket, code: old.code, peek: true })
    assert.equal(res.status, 410)
    assert.equal((await res.json()).reason, 'expired')
    assert.equal((await S.linkQrStatus(old.code)).expired, true)
  })
  await test('カルテに電話番号が無い方：LINE の画面で電話番号を入れてもらって結びつける', async () => {
    const s = await S.createLinkQr({ patientId: 'p_nophone', name: '架空 三郎', phone: '', birthDate: '' })
    const peek = await (await post({ ticket: issueTicket(OTHER, SECRET), code: s.code, peek: true })).json()
    assert.equal(peek.needPhone, true)
    const noPhone = await post({ ticket: issueTicket(OTHER, SECRET), code: s.code })
    assert.equal(noPhone.status, 400)
    assert.equal((await noPhone.json()).reason, 'phone')
    const d = await (await post({ ticket: issueTicket(OTHER, SECRET), code: s.code, phone: '070-5555-6666' })).json()
    assert.equal(d.ok, true)
    const link = await getLineLink('07055556666|架空三郎')
    assert.equal(link.patientId, 'p_nophone')
    assert.equal(link.via, 'karte-qr')
  })
  await test('今までの入力（お名前・電話・生年月日）の結びつけも、同じように動く', async () => {
    const d = await (await post({ ticket: issueTicket(OTHER, SECRET), name: '架空 四郎', phone: '09077778888', birthDate: '1985-05-05' })).json()
    assert.equal(d.ok, true)
    const link = await getLineLink('09077778888|架空四郎')
    assert.equal(link.via, 'liff-link')
    assert.equal(link.birthDate, '1985-05-05')
    assert.equal(link.patientNo, '2948')
  })
  await test('番号の形が違う・無い番号は「読み取れませんでした」', async () => {
    const res = await post({ ticket, code: 'nope', peek: true })
    assert.equal(res.status, 410)
    assert.equal((await res.json()).reason, 'missing')
  })

  console.log('\n【画面】')
  await test('カルテの「公式LINE」の欄に「QRコードでLINEと結びつける」・結び直し', () => {
    const card = read('src/components/rehab-management/PatientProfileCard.tsx')
    assert.ok(card.includes('QRコードでLINEと結びつける') && card.includes('QRで結び直す') && card.includes('<LineLinkQrDialog'))
    const dlg = read('src/components/rehab-management/LineLinkQrDialog.tsx')
    assert.ok(dlg.includes("fetch('/api/line-link/qr'") && dlg.includes('linkQrUrl(liffId, code)') && dlg.includes('LINK_QR_POLL_MS'))
    assert.ok(dlg.includes("method: 'DELETE'"), '閉じたら（まだなら）番号を取り消す')
  })
  await test('カルテの画面は、カルテの ID でも LINE を見分ける（電話・生年月日の無いカルテでも）', async () => {
    // 見分け方は lib/line-link-match.ts の1か所（2026-11-25。サーバーが予約のお知らせを送るときと同じ決まり）
    const client = read('src/lib/line-link-client.ts')
    assert.ok(client.includes('return matchLinkForKarte(patient, links)'))
    const { matchLinkForKarte } = await imp('src/lib/line-link-match.ts')
    const links = [{ key: '08012345678|架空三郎', name: '架空 三郎', phone: '08012345678', patientId: 'p_nophone', linkedAt: '2030-01-01T00:00:00Z' }]
    assert.equal(matchLinkForKarte({ id: 'p_nophone', name: '架空 三郎', phone: '' }, links)?.key, '08012345678|架空三郎')
    assert.equal(matchLinkForKarte({ id: 'p_other', name: '架空 三郎', phone: '' }, links), null, 'ID も電話も生年月日も合わないカルテ')
  })
  await test('LINE の中の画面：QR から開いたら確かめて押すだけ。使えない QR は、今までの入力に切りかえる', () => {
    const page = read('src/app/liff/yoyaku/link/page.tsx')
    assert.ok(page.includes("get('c')") && page.includes('peek: true') && page.includes('submitQr'))
    assert.ok(page.includes('setDoneName(preview.name)'), '終わった画面にも、カルテのお名前を出す')
    assert.ok(page.includes('if (res.status === 410) {'))
    // 2026-11-20：開き直したら「結びついています」・LINE の中で確認に失敗したら「読み込み直す」・QR から開いたときの文
    assert.ok(page.includes('if (info?.already) return showAlready(info.already)'))
    assert.ok(page.includes("'結びついています'") && page.includes('読み込み直す'))
    assert.ok(page.includes("fromQr ? 'QRコードを確かめています…'"))
    assert.ok(page.includes('inLine ? failInLine(liff)'))
    assert.ok(page.includes('このLINEは、次のカルテと結びついています') && page.includes('mine: true'))
  })

  console.log(`\n${passed} 件すべて通過`)
} finally {
  globalThis.fetch = realFetch
  process.chdir(cwd)
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
}
