'use client'

/**
 * LINE導線管理：顧客一覧・会話ログ・タグ・人対応切替＋会話シミュレーター
 * チャネル未接続でも、シミュレーターで友だち追加〜予約誘導まで全シナリオを検証できる。
 */
import { useCallback, useEffect, useState } from 'react'
import { CONTACT_TAGS, INTENT_LABELS, type BotReply, type IntentKey, type LineContact } from '@/lib/marketing/line-types'

export default function LinePage() {
  const [contacts, setContacts] = useState<LineContact[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [channelConfigured, setChannelConfigured] = useState<boolean | null>(null)
  const [simText, setSimText] = useState('')
  const [simButtons, setSimButtons] = useState<Array<{ label: string; data?: string; url?: string }>>([])
  const [busy, setBusy] = useState(false)

  const selected = contacts.find((c) => c.userId === selectedId)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/marketing/line/contacts')
    const data = await res.json()
    setContacts(data.contacts ?? [])
  }, [])

  useEffect(() => {
    refresh()
    fetch('/api/marketing/line/webhook')
      .then((r) => r.json())
      .then((d) => setChannelConfigured(Boolean(d.channelConfigured)))
      .catch(() => setChannelConfigured(false))
  }, [refresh])

  async function simulate(input: { kind: 'follow' | 'text' | 'postback'; text?: string; data?: string }, userId?: string) {
    const id = userId ?? selectedId.replace(/^sim_/, '') ?? 'demo'
    setBusy(true)
    try {
      const res = await fetch('/api/marketing/line/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-marketing-simulator': '1' },
        body: JSON.stringify({ userId: id, displayName: `テスト患者${id.slice(-2)}`, input }),
      })
      const data = await res.json()
      const buttons = (data.replies ?? []).flatMap((r: BotReply) => (r.type === 'buttons' ? r.buttons : []))
      setSimButtons(buttons)
      await refresh()
      setSelectedId(`sim_${id}`)
    } finally {
      setBusy(false)
    }
  }

  async function patch(userId: string, body: Record<string, unknown>) {
    await fetch('/api/marketing/line/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...body }),
    })
    await refresh()
  }

  const attention = contacts.filter((c) => c.needsAttention)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">LINE導線</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            channelConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {channelConfigured === null ? '接続確認中…' : channelConfigured ? 'LINEチャネル接続済み' : '未接続（シミュレーターで検証可）'}
        </span>
      </div>

      {attention.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-bold text-red-800">🔔 要対応 {attention.length}件</p>
          <ul className="mt-1 space-y-0.5 text-red-700">
            {attention.map((c) => (
              <li key={c.userId}>
                <button type="button" className="underline" onClick={() => setSelectedId(c.userId)}>
                  {c.displayName}
                </button>
                ：{c.needsAttention}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* 顧客一覧 */}
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">友だち（{contacts.length}）</h2>
            {!channelConfigured && (
              <button
                type="button"
                onClick={() => simulate({ kind: 'follow' }, `demo${Date.now() % 1000}`)}
                className="rounded bg-teal-700 px-2 py-1 text-xs font-bold text-white"
              >
                ＋友だち追加を試す
              </button>
            )}
          </div>
          <ul className="mt-2 max-h-[480px] space-y-1 overflow-y-auto">
            {contacts.map((c) => (
              <li key={c.userId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.userId)}
                  className={`w-full rounded-lg border p-2 text-left text-sm ${
                    selectedId === c.userId ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
                  }`}
                >
                  <span className="font-bold">{c.displayName}</span>
                  {c.handoff && <span className="ml-1 text-xs font-bold text-red-600">人対応中</span>}
                  <span className="block truncate text-xs text-slate-500">
                    {c.intent ? INTENT_LABELS[c.intent] : '未選択'} / {c.lastActiveAt.slice(5, 16).replace('T', ' ')}
                  </span>
                </button>
              </li>
            ))}
            {contacts.length === 0 && <li className="p-2 text-xs text-slate-500">「＋友だち追加を試す」でシナリオを体験できます</li>}
          </ul>
        </section>

        {/* 会話・詳細 */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-500">左の一覧から友だちを選択してください。</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{selected.displayName}</h2>
                <button
                  type="button"
                  onClick={() => patch(selected.userId, { handoff: !selected.handoff, needsAttention: '' })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    selected.handoff ? 'bg-emerald-600 text-white' : 'border border-red-300 bg-red-50 text-red-700'
                  }`}
                >
                  {selected.handoff ? '対応終了（自動応答を再開）' : '人対応に切り替え（自動応答停止）'}
                </button>
                {selected.needsAttention && (
                  <button type="button" onClick={() => patch(selected.userId, { needsAttention: '' })} className="rounded bg-slate-100 px-2 py-1 text-xs">
                    要対応を解除
                  </button>
                )}
              </div>

              {/* タグ */}
              <div className="flex flex-wrap gap-1.5">
                {CONTACT_TAGS.map((tag) => {
                  const on = selected.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        patch(selected.userId, { tags: on ? selected.tags.filter((t) => t !== tag) : [...selected.tags, tag] })
                      }
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        on ? 'border-teal-600 bg-teal-50 font-bold text-teal-800' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>

              {/* 会話ログ */}
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
                {selected.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                        m.from === 'user' ? 'bg-emerald-100' : 'border border-slate-200 bg-white'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {selected.messages.length === 0 && <p className="text-xs text-slate-400">まだ会話がありません</p>}
              </div>

              {/* シミュレーター入力（本番チャネル接続時はサーバー側で無効のため非表示） */}
              {selected.userId.startsWith('sim_') && !channelConfigured && (
                <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                  <p className="text-xs font-bold text-teal-800">シミュレーター（患者側の操作を再現）</p>
                  {simButtons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {simButtons.map((b, i) =>
                        b.url ? (
                          <a key={i} href={b.url} target="_blank" rel="noopener" className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-xs text-sky-700">
                            🔗 {b.label}
                          </a>
                        ) : (
                          <button
                            key={i}
                            type="button"
                            disabled={busy}
                            onClick={() => simulate({ kind: 'postback', data: b.data, text: b.label })}
                            className="rounded-full border border-teal-400 bg-white px-2.5 py-1 text-xs font-bold text-teal-800"
                          >
                            {b.label}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={simText}
                      onChange={(e) => setSimText(e.target.value)}
                      placeholder="患者としてメッセージを送る（例：足首をひねって腫れてきた）"
                      className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy || !simText.trim()}
                      onClick={() => {
                        simulate({ kind: 'text', text: simText })
                        setSimText('')
                      }}
                      className="whitespace-nowrap rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      送信
                    </button>
                  </div>
                </div>
              )}

              {/* メモ */}
              <label className="block text-sm">
                <span className="text-xs font-bold text-slate-600">院内メモ</span>
                <textarea
                  defaultValue={selected.memo}
                  onBlur={(e) => patch(selected.userId, { memo: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                />
              </label>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
