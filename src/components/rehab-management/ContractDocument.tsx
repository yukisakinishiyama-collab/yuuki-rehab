'use client'
/**
 * 契約書の文面を画面に出す（□ はタップできるチェック、＿＿ は記入欄）
 * 文面の読み方は lib/contracts/template.ts。チェック・記入の番号は印刷・保存と同じ。
 */
import type { Block, Part, ParsedTemplate } from '@/lib/contracts/template'

export default function ContractDocument({
  parsed,
  checks,
  inputs,
  onCheck,
  onInput,
}: {
  parsed: ParsedTemplate
  checks: boolean[]
  inputs: string[]
  onCheck: (i: number, v: boolean) => void
  onInput: (i: number, v: string) => void
}) {
  const renderParts = (parts: Part[], key: string) =>
    parts.map((p, idx) => {
      const k = `${key}-${idx}`
      if (p.t === 'text') return p.b ? <b key={k}>{p.v}</b> : <span key={k}>{p.v}</span>
      if (p.t === 'check') {
        return (
          <label key={k} className="mx-0.5 inline-flex cursor-pointer items-center align-middle max-lg:min-h-10">
            <input
              type="checkbox"
              checked={Boolean(checks[p.i])}
              onChange={(e) => onCheck(p.i, e.target.checked)}
              className="h-6 w-6 cursor-pointer rounded border-slate-400 accent-teal-700"
            />
          </label>
        )
      }
      const common =
        'mx-1 inline-block min-h-9 rounded-md border border-slate-300 bg-amber-50/60 px-2 py-1 align-middle text-[15px] focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-200'
      if (p.kind === 'date' || p.kind === 'time') {
        return (
          <input
            key={k}
            type={p.kind}
            value={inputs[p.i] ?? ''}
            onChange={(e) => onInput(p.i, e.target.value)}
            className={common}
            aria-label={p.kind === 'date' ? '日付' : '時刻'}
          />
        )
      }
      return (
        <input
          key={k}
          type="text"
          value={inputs[p.i] ?? ''}
          onChange={(e) => onInput(p.i, e.target.value)}
          className={common}
          style={{ width: `${Math.max(5, p.width)}em`, maxWidth: '100%' }}
          aria-label="記入欄"
        />
      )
    })

  const renderBlock = (block: Block, bi: number) => {
    const key = `b${bi}`
    switch (block.type) {
      case 'title':
        return (
          <h2 key={key} className="text-center text-xl font-black text-slate-900">
            {block.text}
          </h2>
        )
      case 'clinic':
        return (
          <p key={key} className="text-center text-sm text-slate-600">
            {renderParts(block.parts, key)}
          </p>
        )
      case 'h2':
        return (
          <h3 key={key} className="mt-5 border-b border-slate-300 pb-1 text-base font-bold text-slate-900">
            {renderParts(block.parts, key)}
          </h3>
        )
      case 'h3':
        return (
          <h4 key={key} className="mt-3 text-[15px] font-bold text-slate-800">
            {renderParts(block.parts, key)}
          </h4>
        )
      case 'note':
        return (
          <p key={key} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {renderParts(block.parts, key)}
          </p>
        )
      case 'p':
        return (
          <p key={key} className="leading-8 text-slate-800">
            {renderParts(block.parts, key)}
          </p>
        )
      case 'ul':
        return (
          <ul key={key} className="ml-5 list-disc space-y-1 text-slate-800">
            {block.items.map((it, ii) => (
              <li key={`${key}-${ii}`}>{renderParts(it, `${key}-${ii}`)}</li>
            ))}
          </ul>
        )
      case 'table':
        return (
          <div key={key} className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-[15px]">
              {block.head && (
                <thead>
                  <tr>
                    {block.head.map((h, hi) => (
                      <th key={`${key}-h${hi}`} className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-left font-bold">
                        {renderParts(h, `${key}-h${hi}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={`${key}-r${ri}`}>
                    {row.map((cell, ci) => {
                      const asHead = !block.head && ci === 0 && row.length === 2
                      const Tag = asHead ? 'th' : 'td'
                      return (
                        <Tag
                          key={`${key}-r${ri}-${ci}`}
                          className={`border border-slate-300 px-2 py-1.5 text-left align-middle ${asHead ? 'w-1/3 bg-slate-50 font-bold' : ''}`}
                        >
                          {renderParts(cell, `${key}-r${ri}-${ci}`)}
                        </Tag>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
    }
  }

  return <div className="space-y-2">{parsed.blocks.map(renderBlock)}</div>
}
