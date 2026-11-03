'use client'

/**
 * 集客 → 自動化設定（指示書6章④）
 *
 * 予約確認・LINE の自動案内・投稿案の自動作成・キャンセルの空き枠ストーリー・誕生日のご挨拶の ON/OFF と、
 * 上限・送る時間帯・止まる条件・動いた記録、公式LINE の今月の通数を1か所で見る。
 * - 変えられるのは院長だけ（スタッフは見るだけ。サーバーでも院長だけに限っている）
 * - 新しく動かすものは「テスト」で確かめてから「動かす」にする（予約確認のテストは院長の LINE にだけ届く）
 * - まだ作っていない自動化（前日リマインド・キャンセル待ち・週次レポート）は「未実装」と出す。動いているように見せない
 */
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { History, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { IconButton, Panel } from '@/components/clinic/Panel'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useApi } from '@/lib/marketing/use-api'
import { useMarketingRole } from '@/lib/marketing/use-role'
import {
  LINE_MENU_LABELS,
  MODE_LABELS,
  RUN_RESULT_LABELS,
  type AuditEntry,
  type AutomationMode,
  type AutomationRules,
  type AutomationRun,
  type LineMenuVariant,
} from '@/lib/marketing/automation-types'
import type { LineQuota } from '@/lib/marketing/line-quota-server'

interface AutomationData {
  rules: AutomationRules
  runs: AutomationRun[]
  quota: LineQuota
  ownerLineSet: boolean
  lineConfigured: boolean
  bookingConfigured: boolean
  autopilot: {
    enabled: boolean
    postsPerWeek: number
    generateHour: number
    cancelStory: boolean
    cancelStoryDays: 'today' | 'tomorrow'
    cancelStoryLeadMinutes: number
    cancelStoryFromHour: number
    cancelStoryToHour: number
    cancelStoryMaxPerDay: number
  } | null
  autopilotHistory: Array<{ weekStart: string; createdAt: string; status: string; items: number; proposed: number; approved: number; notifiedAt: string | null }>
  cancelStories: Array<{ at: string; scheduledAt: string; status: string }>
  birthday: { enabled: boolean; sent30: number; failed30: number } | null
  audit: AuditEntry[]
}

const AUTOMATION_LABELS: Record<AutomationRun['automation'], string> = {
  reservation_confirm: '予約確認の LINE',
  line_auto_reply: 'LINE の自動案内',
  autopilot: '投稿案の自動作成',
  cancel_story: 'キャンセルの空き枠ストーリー',
  birthday: '誕生日のご挨拶',
}

const MODE_BADGE: Record<AutomationMode, 'success' | 'warning' | 'secondary'> = { on: 'success', test: 'warning', off: 'secondary' }

function dt(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** 選んでいるものを teal で塗る切り替え（院長だけ押せる） */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  disabled: boolean
  label: string
}) {
  return (
    <div className="inline-flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => value !== o.value && onChange(o.value)}
          className={cn(
            'inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold disabled:cursor-not-allowed lg:min-h-8',
            value === o.value ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const MODE_OPTIONS: Array<{ value: AutomationMode; label: string }> = [
  { value: 'on', label: MODE_LABELS.on },
  { value: 'test', label: MODE_LABELS.test },
  { value: 'off', label: MODE_LABELS.off },
]
const ONOFF: Array<{ value: 'on' | 'off'; label: string }> = [
  { value: 'on', label: 'ON' },
  { value: 'off', label: 'OFF' },
]

/** 自動化1つのカード（上限・時間帯・止まる条件・動いた記録を同じ並びで出す） */
function AutomationCard({
  title,
  state,
  control,
  facts,
  children,
}: {
  title: string
  state: ReactNode
  control?: ReactNode
  facts: Array<{ label: string; value: ReactNode }>
  children?: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
          {title}
          {state}
        </h3>
        {control}
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[9rem_1fr]">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-xs font-bold text-slate-600 sm:pt-0.5">{f.label}</dt>
            <dd className="text-slate-800">{f.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  )
}

const pickAutomation = (json: Partial<AutomationData>) => (json.rules ? (json as AutomationData) : undefined)

export default function AutomationPage() {
  const { isAdmin } = useMarketingRole()
  const { data, error: loadError, loading, reload } = useApi('/api/marketing/automation', pickAutomation)
  const [saveError, setError] = useState('')
  const error = saveError || loadError
  const [saving, setSaving] = useState('')
  const [notice, setNotice] = useState('')
  // 1日の上限の入力（触っていないときは保存されている値を出す）
  const [limitInput, setLimitDraft] = useState<string | null>(null)
  const limitDraft = limitInput ?? String(data?.rules.reservation_confirm.dailyLimit ?? '')

  async function save(key: string, body: Record<string, unknown>, done: string) {
    setSaving(key)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/marketing/automation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...body }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `保存できませんでした（${res.status}）`)
      setNotice(done)
      setLimitDraft(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
    } finally {
      setSaving('')
    }
  }

  const rc = data?.rules.reservation_confirm
  const la = data?.rules.line_auto_reply
  const ap = data?.autopilot
  const quota = data?.quota
  const readOnly = !isAdmin

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="sr-only text-2xl font-bold lg:not-sr-only">自動化設定</h1>
          <p className="text-sm text-slate-600">
            新しく動かすものは「テスト」で確かめてから「動かす」にしてください。
            {readOnly && <span className="ml-1 font-bold text-amber-800">変えられるのは院長だけです（スタッフは見るだけ）。</span>}
          </p>
        </div>
        <IconButton label="読み直す" onClick={reload} disabled={loading}>
          <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} aria-hidden />
        </IconButton>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">
          {notice}
        </p>
      )}

      {!data && loading && <p className="text-sm text-slate-500">読み込んでいます…</p>}

      {data && rc && la && quota && (
        <>
          {/* 公式LINE の通数（8割で警告） */}
          <Panel title="公式LINE の今月の通数" icon={MessageCircle} attention={quota.warn}>
            {quota.state !== 'ok' ? (
              <p className="text-sm text-slate-700">
                <Badge variant={quota.state === 'not_connected' ? 'secondary' : 'danger'} className="mr-2">
                  {quota.state === 'not_connected' ? '未連携' : '取れない'}
                </Badge>
                {quota.note}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-2xl font-black tabular-nums text-slate-900">
                  {quota.used?.toLocaleString('ja-JP') ?? '—'}
                  <span className="ml-1 text-sm font-bold text-slate-600">
                    通{quota.limit !== null ? ` ／ 上限 ${quota.limit.toLocaleString('ja-JP')} 通` : '（上限なし）'}
                  </span>
                </p>
                {quota.ratio !== null && (
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div
                      className={cn('h-full rounded-full', quota.warn ? 'bg-amber-500' : 'bg-teal-600')}
                      style={{ width: `${Math.min(100, Math.round(quota.ratio * 100))}%` }}
                    />
                  </div>
                )}
                {quota.note && <p className={cn('text-sm', quota.warn ? 'font-bold text-amber-800' : 'text-slate-600')}>{quota.note}</p>}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              数はLINE公式の値（プッシュ・一斉配信。自動案内の返信は数えません）。料金は API で取れないため、LINE公式アカウントの管理画面で確認してください。
            </p>
          </Panel>

          <Panel title="自動化" icon={ShieldCheck}>
            <div className="space-y-3">
              {/* 予約確認の LINE */}
              <AutomationCard
                title="予約確認の LINE（患者さんへ）"
                state={<Badge variant={MODE_BADGE[rc.mode]}>{MODE_LABELS[rc.mode]}</Badge>}
                control={
                  <Segmented
                    label="予約確認の LINE の動かし方"
                    value={rc.mode}
                    options={MODE_OPTIONS}
                    disabled={readOnly || saving !== ''}
                    onChange={(mode) => void save('reservation_confirm', { mode }, `予約確認の LINE を「${MODE_LABELS[mode]}」にしました`)}
                  />
                }
                facts={[
                  { label: '送る相手', value: 'LINE からネット予約した方（予約のときに本人が LINE で確かめた方だけ）' },
                  { label: '送るとき', value: '予約が確定したとき・キャンセルを受けたとき、すぐ（予約のお知らせなので時間帯では止めません）' },
                  {
                    label: '1日の上限',
                    value: (
                      <span className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={limitDraft}
                          disabled={readOnly}
                          onChange={(e) => setLimitDraft(e.target.value)}
                          className="h-10 w-24 rounded-lg border border-slate-300 px-2 text-sm lg:h-8"
                          aria-label="1日の上限（通）"
                        />
                        通
                        {!readOnly && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving !== '' || limitDraft === String(rc.dailyLimit ?? '')}
                            onClick={() => void save('reservation_confirm', { mode: rc.mode, dailyLimit: Number(limitDraft) }, '1日の上限を保存しました')}
                          >
                            上限を保存
                          </Button>
                        )}
                      </span>
                    ),
                  },
                  { label: '止まる条件', value: '「止める」のとき／1日の上限に達したとき／テストのとき（患者さんには送らず、院長の LINE にだけ見本が届く）' },
                ]}
              >
                {!data.bookingConfigured && <p className="mt-2 text-sm font-bold text-amber-800">予約システムと未連携のため、いまは動いていません。</p>}
                {rc.mode === 'test' && !data.ownerLineSet && (
                  <p className="mt-2 text-sm font-bold text-amber-800">院長の LINE の送り先が未設定のため、テストの見本は届きません。</p>
                )}
              </AutomationCard>

              {/* LINE の自動案内 */}
              <AutomationCard
                title="LINE の自動案内（友だち追加・相談）"
                state={<Badge variant={MODE_BADGE[la.mode]}>{MODE_LABELS[la.mode]}</Badge>}
                control={
                  <Segmented
                    label="LINE の自動案内の動かし方"
                    value={la.mode}
                    options={MODE_OPTIONS}
                    disabled={readOnly || saving !== ''}
                    onChange={(mode) => void save('line_auto_reply', { mode }, `LINE の自動案内を「${MODE_LABELS[mode]}」にしました`)}
                  />
                }
                facts={[
                  {
                    label: '選択肢の形',
                    value: (
                      <span className="flex flex-col gap-1.5">
                        <Segmented<LineMenuVariant>
                          label="友だち追加のときの選択肢"
                          value={la.lineMenu ?? 'classic'}
                          options={[
                            { value: 'classic', label: '従来の7つ' },
                            { value: 'three', label: '3つ（指示書）' },
                          ]}
                          disabled={readOnly || saving !== ''}
                          onChange={(lineMenu) =>
                            void save('line_auto_reply', { mode: la.mode, lineMenu }, `選択肢を「${LINE_MENU_LABELS[lineMenu]}」にしました`)
                          }
                        />
                        <span className="text-xs leading-relaxed text-slate-600">
                          3つ：急なケガについて相談する／リハビリを予約する／料金・通院方法を確認する。
                          <br />
                          確かめ方：①動かし方を「テスト」、選択肢を「3つ」にする → ②院長の LINE から「急なケガについて相談する」などと送って返事を見る → ③よければ「動かす」に戻す。
                          テスト中は、ほかの方には自動の案内が返らず、スタッフの返信待ちになります（診療時間外の数分で済ませるのがおすすめ）。
                          LINE導線のシミュレーターは、本番では安全のため使えません（院内のパソコンで動かす開発用）。
                        </span>
                      </span>
                    ),
                  },
                  { label: '送るとき', value: '相手が送った・選んだとき（返信なので通数に数えません）' },
                  {
                    label: '止まる条件',
                    value:
                      'スタッフ対応中は自由入力に返さない／病名を聞く質問・苦情・料金のトラブルはスタッフへ引き継ぐ／止める・テスト中はスタッフの返信待ちにする（テストは院長の LINE にだけ返す）。緊急の可能性がある言葉には、止めていても受診の案内だけ返します',
                  },
                ]}
              />

              {/* 投稿案の自動作成 */}
              <AutomationCard
                title="投稿案の自動作成（Instagram・Google）"
                state={ap ? <Badge variant={ap.enabled ? 'success' : 'secondary'}>{ap.enabled ? 'ON' : 'OFF'}</Badge> : <Badge variant="warning">未取得</Badge>}
                control={
                  ap && (
                    <Segmented
                      label="投稿案の自動作成"
                      value={ap.enabled ? 'on' : 'off'}
                      options={ONOFF}
                      disabled={readOnly || saving !== ''}
                      onChange={(v) => void save('autopilot', { enabled: v === 'on' }, `投稿案の自動作成を ${v.toUpperCase()} にしました`)}
                    />
                  )
                }
                facts={[
                  { label: '作るとき', value: ap ? `毎週日曜 ${ap.generateHour}時ごろ、翌週の ${ap.postsPerWeek} 本分` : '—' },
                  { label: '止まる条件', value: '院長が承認するまで公開しない／予定を過ぎた案は出さない／NG表現が残る案は承認できない' },
                  {
                    label: '動いた記録',
                    value:
                      data.autopilotHistory.length === 0
                        ? 'まだありません'
                        : (
                            <ul className="space-y-0.5">
                              {data.autopilotHistory.map((h) => (
                                <li key={h.weekStart} className="text-xs text-slate-700">
                                  {h.weekStart} の週：{h.items} 本（承認 {h.approved}・承認待ち {h.proposed}）{h.notifiedAt ? `・院長へ通知 ${dt(h.notifiedAt)}` : ''}
                                </li>
                              ))}
                            </ul>
                          ),
                  },
                ]}
              >
                <p className="mt-2 text-xs">
                  <Link href="/marketing/autopilot" className="font-bold text-teal-800 underline">自動投稿の画面</Link>
                  で、本数・曜日と時刻・媒体を変えられます。
                </p>
              </AutomationCard>

              {/* キャンセルの空き枠ストーリー */}
              <AutomationCard
                title="キャンセルの空き枠ストーリー（Instagram）"
                state={ap ? <Badge variant={ap.cancelStory ? 'success' : 'secondary'}>{ap.cancelStory ? 'ON' : 'OFF'}</Badge> : <Badge variant="warning">未取得</Badge>}
                control={
                  ap && (
                    <Segmented
                      label="キャンセルの空き枠ストーリー"
                      value={ap.cancelStory ? 'on' : 'off'}
                      options={ONOFF}
                      disabled={readOnly || saving !== ''}
                      onChange={(v) => void save('cancel_story', { enabled: v === 'on' }, `キャンセルの空き枠ストーリーを ${v.toUpperCase()} にしました`)}
                    />
                  )
                }
                facts={[
                  {
                    label: '出すとき',
                    value: ap
                      ? `${ap.cancelStoryDays === 'today' ? '当日' : '当日と翌日'}のキャンセル。${ap.cancelStoryFromHour}時〜${ap.cancelStoryToHour}時`
                      : '—',
                  },
                  { label: '上限', value: ap ? `1日 ${ap.cancelStoryMaxPerDay} 回まで` : '—' },
                  {
                    label: '止まる条件',
                    value: ap ? `枠まで ${ap.cancelStoryLeadMinutes} 分を切ったら出さない／空きが埋まっていたら出さない／患者さんの情報は載せない` : '—',
                  },
                  {
                    label: '動いた記録',
                    value:
                      data.cancelStories.length === 0
                        ? 'まだありません'
                        : (
                            <ul className="space-y-0.5">
                              {data.cancelStories.map((c) => (
                                <li key={c.at} className="text-xs text-slate-700">
                                  {dt(c.at)}（{c.status}）
                                </li>
                              ))}
                            </ul>
                          ),
                  },
                ]}
              />

              {/* 誕生日のご挨拶 */}
              <AutomationCard
                title="誕生日のご挨拶（LINE）"
                state={data.birthday ? <Badge variant={data.birthday.enabled ? 'success' : 'secondary'}>{data.birthday.enabled ? 'ON' : 'OFF'}</Badge> : <Badge variant="warning">未取得</Badge>}
                control={
                  data.birthday && (
                    <Segmented
                      label="誕生日のご挨拶"
                      value={data.birthday.enabled ? 'on' : 'off'}
                      options={ONOFF}
                      disabled={readOnly || saving !== ''}
                      onChange={(v) => void save('birthday', { enabled: v === 'on' }, `誕生日のご挨拶を ${v.toUpperCase()} にしました`)}
                    />
                  )
                }
                facts={[
                  { label: '送る相手', value: 'カルテと LINE を結びつけた方のうち、今日が誕生日の方（1年に1回まで）' },
                  { label: '送るとき', value: '毎朝9時ごろ（定期実行）' },
                  { label: '直近30日', value: data.birthday ? `送った ${data.birthday.sent30} 件・失敗 ${data.birthday.failed30} 件` : '—' },
                ]}
              >
                <p className="mt-2 text-xs">
                  文面と見本の送信は
                  <Link href="/marketing/line" className="mx-1 font-bold text-teal-800 underline">LINE導線の画面</Link>
                  で変えられます。来院のおすすめや施術の指示は入れません。
                </p>
              </AutomationCard>

              {/* まだ作っていないもの */}
              {[
                { title: '予約前リマインド（患者さんへ）', note: '第2段階で作ります。同意のある方へ前日に1回、変更・キャンセル済みの予約には送らない形にします。いまは院長あての前日の一覧だけ、予約システムから届きます。' },
                { title: 'キャンセル待ちのお知らせ', note: '第2段階で作ります。希望した方を順に、同じ枠に重ねて送らない形にします。' },
                { title: '集客レポート（週次）', note: '第4段階で作ります。予約につながった媒体・テーマを、因果を決めつけない書き方でまとめます。' },
              ].map((x) => (
                <AutomationCard key={x.title} title={x.title} state={<Badge variant="outline">未実装</Badge>} facts={[{ label: '予定', value: x.note }]} />
              ))}
            </div>
          </Panel>

          <Panel title="動いた記録（7日）" icon={History} meta="お名前・LINE の ID は残していません">
            {data.runs.length === 0 ? (
              <p className="text-sm text-slate-600">この7日、記録はありません。</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data.runs.slice(0, 40).map((r, i) => (
                  <li key={`${r.at}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
                    <span className="text-xs tabular-nums text-slate-500">{dt(r.at)}</span>
                    <span className="font-medium text-slate-800">{AUTOMATION_LABELS[r.automation]}</span>
                    <Badge variant={r.result === 'sent' ? 'success' : r.result === 'error' ? 'danger' : r.result === 'test' ? 'warning' : 'secondary'}>
                      {RUN_RESULT_LABELS[r.result]}
                    </Badge>
                    <span className="text-xs text-slate-600">{r.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="変更の記録" icon={ShieldCheck} meta="だれが・いつ・何を変えたか">
            {data.audit.length === 0 ? (
              <p className="text-sm text-slate-600">まだ記録はありません。</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data.audit.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
                    <span className="text-xs tabular-nums text-slate-500">{dt(a.at)}</span>
                    <span className="text-xs font-bold text-slate-600">{a.role === 'admin' ? '院長' : a.role === 'staff' ? 'スタッフ' : a.role}</span>
                    <span className="font-medium text-slate-800">{a.target}</span>
                    <span className="text-xs text-slate-600">{a.action}{a.detail ? `：${a.detail}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="text-xs text-slate-500">
            LINE のメニュー（リッチメニュー）は
            <Link href="/marketing/line/richmenu" className={cn(buttonVariants({ variant: 'link' }), 'mx-1 h-auto p-0 text-xs font-bold')}>
              LINEのメニュー
            </Link>
            で変えられます。
          </p>
        </>
      )}
    </div>
  )
}
