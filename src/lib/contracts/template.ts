// ──────────────────────────────────────────────
// 契約書のひな形（data/contract-templates.ts）を読み、画面と印刷の形にする（純粋な関数）
//
// □ はチェック（checks[i]）、＿＿ や「　　　年　　　月　　　日」や表の空のマスは記入欄（inputs[i]）。
// 番号 i は文面の上から順に振るので、同じ版の文面なら、画面・保存・印刷で同じ番号になる。
// ──────────────────────────────────────────────

export type Part =
  | { t: 'text'; v: string; b?: boolean }
  | { t: 'check'; i: number; b?: boolean }
  | { t: 'blank'; i: number; kind: 'text' | 'date' | 'time'; width: number }

export type Block =
  | { type: 'title'; text: string }
  | { type: 'h2' | 'h3' | 'note' | 'p' | 'clinic'; parts: Part[] }
  | { type: 'ul'; items: Part[][] }
  | { type: 'table'; head: Part[][] | null; rows: Part[][][] }

export interface ParsedTemplate {
  blocks: Block[]
  checkCount: number
  blankCount: number
}

const TOKEN = /(□)|(＿{2,})|(　{2,}年　{2,}月　{2,}日)|(　{2,}時　{2,}分)|（(　{2,})）/g

export function parseTemplate(body: string): ParsedTemplate {
  let c = 0
  let b = 0

  const inline = (text: string): Part[] => {
    const parts: Part[] = []
    // **太字** を分ける
    const segs = text.split(/(\*\*[^*]+\*\*)/).filter((s) => s !== '')
    for (const seg of segs) {
      const bold = /^\*\*[^*]+\*\*$/.test(seg)
      const s = bold ? seg.slice(2, -2) : seg
      let last = 0
      TOKEN.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = TOKEN.exec(s))) {
        if (m.index > last) parts.push({ t: 'text', v: s.slice(last, m.index), b: bold || undefined })
        if (m[1]) parts.push({ t: 'check', i: c++, b: bold || undefined })
        else if (m[2]) parts.push({ t: 'blank', i: b++, kind: 'text', width: Math.max(4, Math.min(16, m[2].length)) })
        else if (m[3]) parts.push({ t: 'blank', i: b++, kind: 'date', width: 9 })
        else if (m[4]) parts.push({ t: 'blank', i: b++, kind: 'time', width: 5 })
        else if (m[5]) {
          parts.push({ t: 'text', v: '（', b: bold || undefined })
          parts.push({ t: 'blank', i: b++, kind: 'text', width: 6 })
          parts.push({ t: 'text', v: '）', b: bold || undefined })
        }
        last = m.index + m[0].length
      }
      if (last < s.length) parts.push({ t: 'text', v: s.slice(last), b: bold || undefined })
    }
    return parts
  }

  // マスの前後の半角の空白だけを落とす。全角の空白は残す（「　　　年　　　月　　　日」の頭の空白が消えると、
  // 日付の記入欄として読めなくなるため。2026-11-11 までは表の中の日付が記入欄になっていなかった）。
  // 空白（全角を含む）だけのマスは、空のマス＝記入欄。
  const cells = (line: string): string[] =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((x) => x.replace(/^[ \t]+|[ \t]+$/g, ''))
      .map((x) => (x.trim() === '' ? '' : x))

  const blocks: Block[] = []
  const lines = body.replace(/\r/g, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (line.startsWith('# ')) {
      blocks.push({ type: 'title', text: line.slice(2).trim() })
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', parts: inline(line.slice(4)) })
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', parts: inline(line.slice(3)) })
    } else if (line.startsWith('> ')) {
      blocks.push({ type: 'note', parts: inline(line.slice(2)) })
    } else if (line === 'ゆうき整骨院') {
      blocks.push({ type: 'clinic', parts: [{ t: 'text', v: line }] })
    } else if (line.startsWith('|')) {
      const rowsRaw: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rowsRaw.push(cells(lines[i]))
        i++
      }
      i--
      const allBold = (row: string[]) => row.every((x) => /^\*\*[^*]+\*\*$/.test(x))
      let head: Part[][] | null = null
      let body2 = rowsRaw
      if (rowsRaw.length > 1 && allBold(rowsRaw[0])) {
        head = rowsRaw[0].map((x) => inline(x))
        body2 = rowsRaw.slice(1)
      }
      const rows = body2.map((row) =>
        row.map((cell) => (cell === '' ? [{ t: 'blank', i: b++, kind: 'text', width: 12 } as Part] : inline(cell))),
      )
      blocks.push({ type: 'table', head, rows })
    } else if (line.startsWith('・')) {
      const items: Part[][] = []
      while (i < lines.length && lines[i].trim().startsWith('・')) {
        items.push(inline(lines[i].trim().slice(1)))
        i++
      }
      i--
      blocks.push({ type: 'ul', items })
    } else {
      blocks.push({ type: 'p', parts: inline(line) })
    }
  }
  return { blocks, checkCount: c, blankCount: b }
}

// ── 印刷・保存の形（HTML の文字列） ─────────────────────────

export function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 2026-11-20 → 2026年11月20日 */
export function jaDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : ymd
}

function jaTime(hm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm)
  return m ? `${Number(m[1])}時${m[2]}分` : hm
}

function partsHtml(parts: Part[], checks: boolean[] | null, inputs: string[] | null): string {
  return parts
    .map((p) => {
      if (p.t === 'text') return p.b ? `<b>${escapeHtml(p.v)}</b>` : escapeHtml(p.v)
      if (p.t === 'check') {
        const box = checks && checks[p.i] ? '☑' : '☐'
        return `<span class="box">${box}</span>`
      }
      const raw = inputs ? String(inputs[p.i] ?? '').trim() : ''
      const v = p.kind === 'date' ? jaDate(raw) : p.kind === 'time' ? jaTime(raw) : raw
      return v
        ? `<span class="fill">${escapeHtml(v)}</span>`
        : `<span class="fill blank">${'&emsp;'.repeat(Math.max(3, Math.round(p.width / 1.5)))}</span>`
    })
    .join('')
}

/**
 * 文面を印刷・保存用の HTML にする。checks / inputs が null なら白紙（□ と空欄のまま）
 */
export function renderTemplateHtml(parsed: ParsedTemplate, checks: boolean[] | null, inputs: string[] | null): string {
  const out: string[] = []
  for (const block of parsed.blocks) {
    switch (block.type) {
      case 'title':
        out.push(`<h2 class="doc-title">${escapeHtml(block.text)}</h2>`)
        break
      case 'clinic':
        out.push(`<p class="doc-clinic">${partsHtml(block.parts, checks, inputs)}</p>`)
        break
      case 'h2':
        out.push(`<h3>${partsHtml(block.parts, checks, inputs)}</h3>`)
        break
      case 'h3':
        out.push(`<h4>${partsHtml(block.parts, checks, inputs)}</h4>`)
        break
      case 'note':
        out.push(`<p class="doc-note">${partsHtml(block.parts, checks, inputs)}</p>`)
        break
      case 'p':
        out.push(`<p>${partsHtml(block.parts, checks, inputs)}</p>`)
        break
      case 'ul':
        out.push(`<ul>${block.items.map((it) => `<li>${partsHtml(it, checks, inputs)}</li>`).join('')}</ul>`)
        break
      case 'table': {
        const head = block.head
          ? `<tr>${block.head.map((h) => `<th>${partsHtml(h, checks, inputs)}</th>`).join('')}</tr>`
          : ''
        const rows = block.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, ci) => {
                  const html = partsHtml(cell, checks, inputs)
                  // 見出しの行が無い2列の表は、左の列を見出しのマスにする
                  return !block.head && ci === 0 && row.length === 2 ? `<th>${html}</th>` : `<td>${html}</td>`
                })
                .join('')}</tr>`,
          )
          .join('')
        out.push(`<table>${head}${rows}</table>`)
        break
      }
    }
  }
  return out.join('\n')
}

/** 印刷用の見た目（白紙・署名済みの両方。A4 縦） */
export const CONTRACT_PRINT_CSS = `
.contract-paper{font-family:'Noto Sans JP','Hiragino Sans','Hiragino Kaku Gothic ProN',sans-serif;font-size:10pt;line-height:1.65;color:#111;background:#fff}
.contract-paper .copy-label{display:flex;justify-content:space-between;align-items:center;font-size:9pt;color:#333;border-bottom:1px solid #999;padding-bottom:3pt;margin-bottom:8pt}
.contract-paper .copy-label b{font-size:11pt;border:1.5px solid #111;padding:1pt 8pt}
.contract-paper .doc-title{font-size:14.5pt;text-align:center;margin:0 0 4pt;font-weight:700}
.contract-paper .doc-clinic{text-align:center;margin:0 0 6pt}
.contract-paper .doc-note{font-size:9pt;color:#333;margin:2pt 0 6pt}
.contract-paper h3{font-size:11pt;font-weight:700;margin:10pt 0 3pt;border-bottom:1px solid #999;padding-bottom:1pt;break-after:avoid}
.contract-paper h4{font-size:10.5pt;font-weight:700;margin:7pt 0 2pt;break-after:avoid}
.contract-paper p{margin:3pt 0}
.contract-paper ul{margin:2pt 0 2pt 14pt;padding:0}
.contract-paper table{border-collapse:collapse;width:100%;margin:4pt 0;break-inside:avoid}
.contract-paper th,.contract-paper td{border:1px solid #555;padding:3pt 5pt;text-align:left;vertical-align:top;font-weight:400}
.contract-paper th{background:#f1f1f1;font-weight:700}
.contract-paper .box{font-size:11.5pt}
.contract-paper .fill{border-bottom:1px solid #222;padding:0 3pt}
.contract-paper .member-box{border:1.5px solid #111;padding:6pt 8pt;margin:10pt 0;break-inside:avoid}
.contract-paper .member-box h3{margin-top:0}
.contract-paper .contract-summary{border:2px solid #111;padding:7pt 9pt 6pt;margin:8pt 0 10pt;break-inside:avoid}
.contract-paper .contract-summary h3{margin:0 0 3pt;border:0;padding:0;font-size:12.5pt}
.contract-paper .contract-summary table{margin:2pt 0}
.contract-paper .contract-summary th{width:36%}
.contract-paper .contract-summary td{font-weight:700}
.contract-paper .contract-summary .sum-sigs{display:flex;gap:6pt;margin-top:5pt}
.contract-paper .contract-summary .sum-sig{flex:1 1 0;min-width:0;border:1px solid #555;padding:2pt 5pt;font-size:8.5pt}
.contract-paper .contract-summary .sum-sig span{display:block}
.contract-paper .contract-summary .sum-sig img{height:34pt;max-width:100%;display:block}
.contract-paper .contract-summary .sum-note{font-size:8pt;color:#444;margin:4pt 0 0}
.contract-paper .sig img{height:46pt;max-width:100%;display:block}
.contract-paper .sigtable th{width:30%}
.contract-paper .meta{margin-top:8pt;font-size:7.5pt;color:#555}
.contract-paper .sig-empty{height:40pt}
`
