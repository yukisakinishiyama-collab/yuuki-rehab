// 「予約」（予約システムの管理画面）を早く開くための決まりの確認（2026-11-19 院長「予約に移るのに時間がかかる」）
//   npx tsx tools/test-yoyaku-preload.mjs
// - 待っているあいだの文・この端末のふだんの秒数（lib/yoyaku-preload.ts）
// - 画面の部品が決まりどおりになっているか（先に開く・開き終わりの合図・アプリ全体を読み直さない）
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as P from '../src/lib/yoyaku-preload.ts'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('  ✓', name) }
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

t('かかった時間を残す：新しい5回まで。短すぎ（もう開いていた）・長すぎ（端末が眠っていた）は残さない', () => {
  let h = []
  for (const ms of [6100, 5200, 7300, 4800, 6900, 5600]) h = P.rememberLoadMs(h, ms)
  assert.deepEqual(h, [5200, 7300, 4800, 6900, 5600])
  assert.deepEqual(P.rememberLoadMs(h, 150), h)
  assert.deepEqual(P.rememberLoadMs(h, 300_000), h)
  assert.deepEqual(P.rememberLoadMs([], Number.NaN), [])
  assert.deepEqual(P.rememberLoadMs([], 3456.7), [3457])
})

t('残した時間を読む：こわれた値・数でないものは捨てる', () => {
  assert.deepEqual(P.parseLoadHistory(null), [])
  assert.deepEqual(P.parseLoadHistory('こわれた'), [])
  assert.deepEqual(P.parseLoadHistory('{"a":1}'), [])
  assert.deepEqual(P.parseLoadHistory('[1000,"x",-5,2000,null,3000]'), [1000, 2000, 3000])
  assert.deepEqual(P.parseLoadHistory(JSON.stringify([1, 2, 3, 4, 5, 6, 7].map((x) => x * 1000))), [3000, 4000, 5000, 6000, 7000])
})

t('ふだんの秒数＝まん中の値（1秒単位・少なくとも1秒）。まだ無ければ null', () => {
  assert.equal(P.typicalLoadSeconds([]), null)
  assert.equal(P.typicalLoadSeconds([6200]), 6)
  assert.equal(P.typicalLoadSeconds([4000, 9000, 5000]), 5) // 1回だけ遅くても、まん中の値はずれにくい
  assert.equal(P.typicalLoadSeconds([4000, 6000]), 5)
  assert.equal(P.typicalLoadSeconds([300]), 1)
})

t('待っているあいだの文：はじめは「数秒かかります」、ふだんの秒数があればそれを出す。とても長いときは別のタブを案内', () => {
  const first = P.loadingText(0, null)
  assert.equal(first.title, '予約システムを開いています…')
  assert.equal(first.detail, 'はじめは数秒かかります。')
  assert.equal(P.loadingText(3400, null).detail, 'はじめは数秒かかります。（3秒）')
  assert.equal(P.loadingText(2000, 6).detail, 'この端末では、ふだん約6秒で開きます。（2秒）')
  assert.equal(P.loadingText(17_000, 6).detail, 'この端末では、ふだん約6秒で開きます。（17秒）')
  assert.match(P.loadingText(18_000, 6).detail, /^18秒たちました。いつもより時間がかかっています。.*新しいタブで開く/)
  // 言い方：あせらせない・責めない
  for (const ms of [0, 5000, 30_000]) for (const ty of [null, 6]) {
    const { title, detail } = P.loadingText(ms, ty)
    assert.ok(!/エラー|失敗|お待たせ/.test(title + detail), title + detail)
  }
})

t('先に開くのは、画面が落ち着いたらすぐ（遅くとも1.5秒）。前の「2.5秒待つ」はやめた', () => {
  assert.ok(P.PRELOAD_IDLE_TIMEOUT_MS <= 1500 && P.PRELOAD_FALLBACK_DELAY_MS < 1000)
  const frame = read('src/components/rehab/YoyakuFrame.tsx')
  assert.ok(!/setTimeout\(\(\) => setMounted\(true\), 2500\)/.test(frame), '2.5秒待つ形が残っている')
  assert.ok(frame.includes('requestIdleCallback') && frame.includes('PRELOAD_IDLE_TIMEOUT_MS') && frame.includes('PRELOAD_FALLBACK_DELAY_MS'))
  // 通信を節約する設定の端末では、先に開かない（今までどおり）
  assert.ok(frame.includes('conn?.saveData'))
  // 予約システムの入口へ先に通り道をつなぐ
  assert.ok(frame.includes("preconnect('https://script.google.com')"))
})

t('開き終わりの合図（iframe の読みこみ・予約画面からの合図）で「開いています」を消す。読み直すときはまた出す', () => {
  const frame = read('src/components/rehab/YoyakuFrame.tsx')
  assert.ok(frame.includes('onLoad={markReady}') && frame.includes('ref={startTimer}') && frame.includes('key={adminUrl}'))
  assert.ok(/'yuuki:karte-hello'[\s\S]{0,400}markReady\(\)/.test(frame), '予約画面からの合図で開き終わりにする')
  assert.ok(/if \(current !== d\.url\) \{\n\s+setReady\(false\)/.test(frame), '行き先が変わったら、また「開いています」')
  assert.ok(frame.includes('role="status"') && frame.includes('wait.title') && frame.includes('wait.detail'))
  // かかった時間はこの端末にだけ残す（同期しない・お名前などは入らない数字だけ）
  assert.ok(frame.includes('LOAD_HISTORY_KEY'))
  assert.equal(P.LOAD_HISTORY_KEY, 'yoyaku_frame_load_ms')
})

t('起動時の取り込みで記録が変わっても、アプリ全体は読み直さない（裏で開いた予約の画面を捨てない）', () => {
  const shell = read('src/components/rehab/AppShell.tsx')
  assert.ok(!shell.includes('window.location.reload()'), 'アプリ全体の読み直しが残っている')
  assert.ok(shell.includes('<Fragment key={contentVersion}>{children}</Fragment>'))
  assert.ok(shell.includes('settleStartupChange()') && shell.includes('setContentVersion((v) => v + 1)'))
  // 予約の画面は、作り直す中身（children）の外に置く
  const i = shell.indexOf('<Fragment key={contentVersion}>')
  const j = shell.indexOf('<YoyakuFrame')
  assert.ok(i > 0 && j > i && !shell.slice(i, j).includes('</ClinicShell>'))
  assert.ok(shell.slice(shell.indexOf('{children}</Fragment>'), j).length < 200)
  // 作り直したあと、予約の方のカルテを開く流れが「また読み直し待ち」にならないように、印をもどす
  const sync = read('src/lib/sync-service.ts')
  assert.ok(/export function settleStartupChange\(\): void \{\n  if \(startupPull\) startupPull = startupPull\.then\(\(r\) => \(\{ ok: r\.ok, changed: false \}\)\)/.test(sync))
  assert.ok(!/location\.reload/.test(read('src/lib/karte-auto-create.ts')))
})

t('予約の画面へ「いま見えているか」を知らせる（予約システム v3.23 が、見えていないあいだ20秒ごとの読み直しを止める）', () => {
  assert.deepEqual(P.frameVisibleMessage(true), { type: 'yuuki:karte-visible', visible: true })
  assert.deepEqual(P.frameVisibleMessage(false), { type: 'yuuki:karte-visible', visible: false })
  const frame = read('src/components/rehab/YoyakuFrame.tsx')
  // 合図が届いた画面（event.source）を控え、そこへ送る。宛先は合図の出どころだけ
  assert.ok(/'yuuki:karte-hello'[\s\S]{0,600}frameWindowRef\.current = \{ win: source, origin: event\.origin \}[\s\S]{0,80}postFrameVisible\(\)/.test(frame))
  assert.ok(/postMessage\(frameVisibleMessage\(visibleRef\.current\), \{ targetOrigin: target\.origin \}\)/.test(frame))
  // 「予約」に切りかえた・ほかの画面や来院予定（日にち）へ移ったときにも知らせる（見えているのは予約表のときだけ。2026-11-24）
  assert.ok(/const frameShown = visible && view === 'slots'/.test(frame))
  assert.ok(/visibleRef\.current = frameShown\n\s+postFrameVisible\(\)/.test(frame))
})

console.log(`\n${n} 件すべて通過`)
