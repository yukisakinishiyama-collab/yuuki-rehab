/**
 * PDF から「行ごとの文字」を取り出す、小さな読み取り（ブラウザでもサーバーでも動く。外のライブラリは使わない）
 *
 * 2026-11-27 NOAH の「来院者日報」（NOAH から Microsoft Print to PDF で保存したもの）を読むために作った。
 * 読めるもの：ふつうの PDF（xref 表・オブジェクトが並ぶ形）。圧縮は FlateDecode か無し。文字は ToUnicode の対応表があるフォント。
 * 読めないもの：オブジェクトストリームに入った PDF・暗号化・画像になった文字（スキャンなど）。読めないときは例外を投げる。
 *
 * 文字の位置は「書き始めの位置」だけを使う（字の幅は見ない）。
 * - 1つの TJ の中で、字と字のあいだが大きくあいている（0.2 文字分より広い）ところは、区切り（空白）にする
 * - 同じ高さ（2pt 以内）の文字を1行にまとめ、左から並べる
 */

export interface PdfLine {
  /** 1 から */
  page: number
  /** ページの下からの高さ（pt） */
  y: number
  /** 左から順の、区切られた文字のかたまり（NFKC で全角の数字などをそろえたもの） */
  tokens: string[]
}

type Matrix = [number, number, number, number, number, number]
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** a × b（PDF の行列の掛け算。点 p に a を先に、b を後でかける） */
function mul(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ]
}

/** バイト列 → 1バイト1文字の文字列（位置を数えるため。中身の文字としては使わない） */
function toBinary(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return out
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

interface PdfObject {
  dict: string
  stream?: Uint8Array
}

/** 文字列の pos から始まる << … >> の終わり（>> のあと）の位置 */
function dictEnd(s: string, pos: number): number {
  let depth = 0
  let i = pos
  while (i < s.length) {
    const c = s[i]
    if (c === '(') {
      // 文字列（かっこの入れ子と \ のエスケープ）
      let d = 1
      i += 1
      while (i < s.length && d > 0) {
        if (s[i] === '\\') i += 2
        else {
          if (s[i] === '(') d += 1
          else if (s[i] === ')') d -= 1
          i += 1
        }
      }
      continue
    }
    if (c === '<' && s[i + 1] === '<') {
      depth += 1
      i += 2
      continue
    }
    if (c === '>' && s[i + 1] === '>') {
      depth -= 1
      i += 2
      if (depth === 0) return i
      continue
    }
    i += 1
  }
  return s.length
}

/** オブジェクトを番号ごとに読む（あとに出てきた同じ番号が勝つ＝追記された PDF） */
function readObjects(bin: string, bytes: Uint8Array): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>()
  const re = /(\d+)\s+\d+\s+obj\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(bin))) {
    const num = Number(m[1])
    let i = m.index + m[0].length
    while (/\s/.test(bin[i] ?? '')) i += 1
    let dict = ''
    if (bin.startsWith('<<', i)) {
      const end = dictEnd(bin, i)
      dict = bin.slice(i, end)
      i = end
    } else {
      const end = bin.indexOf('endobj', i)
      dict = bin.slice(i, end === -1 ? undefined : end).trim()
      objects.set(num, { dict })
      continue
    }
    let j = i
    while (/\s/.test(bin[j] ?? '')) j += 1
    if (bin.startsWith('stream', j)) {
      let start = j + 6
      if (bin[start] === '\r') start += 1
      if (bin[start] === '\n') start += 1
      const lenMatch = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)
      let end = -1
      if (lenMatch) {
        const len = Number(lenMatch[1])
        const after = bin.slice(start + len, start + len + 20)
        if (/^\s*endstream/.test(after)) end = start + len
      }
      if (end === -1) {
        end = bin.indexOf('endstream', start)
        if (end === -1) throw new Error('PDF の形を読めませんでした（endstream が見つからない）')
        while (end > start && (bin[end - 1] === '\n' || bin[end - 1] === '\r')) end -= 1
      }
      objects.set(num, { dict, stream: bytes.subarray(start, end) })
      re.lastIndex = end
    } else {
      objects.set(num, { dict })
    }
  }
  return objects
}

const ref = (s: string | undefined): number | null => {
  const m = s?.match(/^\s*(\d+)\s+\d+\s+R/)
  return m ? Number(m[1]) : null
}

/** 辞書の中の /Key の値（参照・<<…>>・[…]・そのほかの1語）を取り出す */
function dictValue(dict: string, key: string): string | undefined {
  const re = new RegExp(`/${key}(?![A-Za-z0-9])\\s*`)
  const m = re.exec(dict)
  if (!m) return undefined
  const i = m.index + m[0].length
  if (dict.startsWith('<<', i)) return dict.slice(i, dictEnd(dict, i))
  if (dict[i] === '[') return dict.slice(i, dict.indexOf(']', i) + 1)
  const r = dict.slice(i).match(/^(\d+\s+\d+\s+R|\/[^\s/<>[\]()]+|[^\s/<>[\]()]+)/)
  return r?.[1]
}

async function streamData(obj: PdfObject | undefined): Promise<Uint8Array> {
  if (!obj?.stream) return new Uint8Array()
  const filter = dictValue(obj.dict, 'Filter') ?? ''
  if (!filter) return obj.stream
  if (/^\[?\s*\/FlateDecode\s*\]?$/.test(filter)) return inflate(obj.stream)
  throw new Error(`この PDF の圧縮（${filter}）は読めません`)
}

interface FontMap {
  bytes: 1 | 2
  map: Map<number, string>
  /** 字の幅（1000分の1文字）。無ければ dw */
  widths: Map<number, number>
  dw: number
}

function hexToString(hex: string): string {
  let out = ''
  for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16))
  if (hex.length === 2) out = String.fromCharCode(parseInt(hex, 16))
  return out
}

/** ToUnicode の対応表（bfchar・bfrange）を読む */
export function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>()
  for (const block of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) map.set(parseInt(m[1], 16), hexToString(m[2]))
  }
  for (const block of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(m[1], 16)
      const hi = parseInt(m[2], 16)
      if (hi < lo || hi - lo > 0xffff) continue
      if (m[3].startsWith('[')) {
        const list = [...m[3].matchAll(/<([0-9A-Fa-f]*)>/g)].map((x) => hexToString(x[1]))
        list.forEach((v, k) => map.set(lo + k, v))
      } else {
        const base = m[3].slice(1, -1)
        const first = hexToString(base)
        const lastCode = first.charCodeAt(first.length - 1)
        for (let c = lo; c <= hi; c += 1) map.set(c, first.slice(0, -1) + String.fromCharCode(lastCode + (c - lo)))
      }
    }
  }
  return map
}

/** CID フォントの /W（[c [w1 w2 …]] と [c1 c2 w] の並び）を読む */
export function parseCidWidths(w: string): Map<number, number> {
  const out = new Map<number, number>()
  const toks = w.replace(/^\[|\]$/g, ' ').match(/\[[^\]]*\]|[-\d.]+/g) ?? []
  for (let i = 0; i < toks.length; ) {
    const first = Number(toks[i])
    const next = toks[i + 1]
    if (next?.startsWith('[')) {
      const list = next.slice(1, -1).trim().split(/\s+/).filter(Boolean).map(Number)
      list.forEach((v, k) => out.set(first + k, v))
      i += 2
    } else if (next !== undefined && toks[i + 2] !== undefined) {
      const last = Number(next)
      const v = Number(toks[i + 2])
      for (let c = first; c <= last && c - first <= 0xffff; c += 1) out.set(c, v)
      i += 3
    } else break
  }
  return out
}

// ── 中身（コンテンツストリーム）の読み方 ─────────────────────────────

type Tok = { t: 'num'; v: number } | { t: 'str'; v: Uint8Array } | { t: 'name'; v: string } | { t: 'op'; v: string } | { t: 'arr'; v: Tok[] }

function tokenize(s: string): Tok[] {
  const out: Tok[] = []
  const stack: Tok[][] = []
  const push = (tok: Tok) => (stack.length ? stack[stack.length - 1].push(tok) : out.push(tok))
  let i = 0
  const n = s.length
  while (i < n) {
    const c = s[i]
    if (c === '%') {
      while (i < n && s[i] !== '\n' && s[i] !== '\r') i += 1
      continue
    }
    if (/\s/.test(c)) {
      i += 1
      continue
    }
    if (c === '[') {
      stack.push([])
      i += 1
      continue
    }
    if (c === ']') {
      const arr = stack.pop() ?? []
      push({ t: 'arr', v: arr })
      i += 1
      continue
    }
    if (c === '<' && s[i + 1] === '<') {
      // 辞書（BDC のしるしなど）。中身は使わない
      i = dictEnd(s, i)
      push({ t: 'op', v: '<<>>' })
      continue
    }
    if (c === '<') {
      const end = s.indexOf('>', i)
      const hex = s.slice(i + 1, end).replace(/\s+/g, '')
      const padded = hex.length % 2 ? `${hex}0` : hex
      const bytes = new Uint8Array(padded.length / 2)
      for (let k = 0; k < bytes.length; k += 1) bytes[k] = parseInt(padded.slice(k * 2, k * 2 + 2), 16)
      push({ t: 'str', v: bytes })
      i = end + 1
      continue
    }
    if (c === '(') {
      const bytes: number[] = []
      let depth = 1
      i += 1
      while (i < n && depth > 0) {
        const ch = s[i]
        if (ch === '\\') {
          const nx = s[i + 1]
          const esc: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 }
          if (nx in esc) {
            bytes.push(esc[nx])
            i += 2
          } else if (/[0-7]/.test(nx)) {
            const oct = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)![0]
            bytes.push(parseInt(oct, 8) & 0xff)
            i += 1 + oct.length
          } else {
            i += 2
          }
          continue
        }
        if (ch === '(') depth += 1
        if (ch === ')') {
          depth -= 1
          if (depth === 0) {
            i += 1
            break
          }
        }
        bytes.push(ch.charCodeAt(0) & 0xff)
        i += 1
      }
      push({ t: 'str', v: new Uint8Array(bytes) })
      continue
    }
    if (c === '/') {
      let j = i + 1
      while (j < n && !/[\s/<>[\]()%{}]/.test(s[j])) j += 1
      push({ t: 'name', v: s.slice(i + 1, j) })
      i = j
      continue
    }
    let j = i
    while (j < n && !/[\s/<>[\]()%{}]/.test(s[j])) j += 1
    if (j === i) j = i + 1
    const word = s.slice(i, j)
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) push({ t: 'num', v: Number(word) })
    else if (word === 'BI') {
      // 文字の中の画像：EI まで飛ばす
      const ei = s.indexOf('EI', j)
      j = ei === -1 ? n : ei + 2
    } else push({ t: 'op', v: word })
    i = j
  }
  return out
}

interface Run {
  x: number
  y: number
  seq: number
  tokens: string[]
}

function codesOf(bytes: Uint8Array, font: FontMap | undefined): number[] {
  const step = font?.bytes ?? 1
  const out: number[] = []
  for (let i = 0; i + step <= bytes.length; i += step) out.push(step === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i])
  return out
}

function charOf(code: number, font: FontMap | undefined): string {
  return font ? (font.map.get(code) ?? '') : String.fromCharCode(code)
}

function runsOfPage(content: string, fonts: Map<string, FontMap>): Run[] {
  const runs: Run[] = []
  const toks = tokenize(content)
  const args: Tok[] = []
  let ctm: Matrix = IDENTITY
  const stack: Array<{ ctm: Matrix; tc: number; tw: number; th: number; leading: number; font?: FontMap; size: number }> = []
  let tm: Matrix = IDENTITY
  let tlm: Matrix = IDENTITY
  let leading = 0
  let font: FontMap | undefined
  let size = 12
  let tc = 0
  let tw = 0
  let th = 1
  let seq = 0
  const num = (k: number) => {
    const t = args[args.length - k]
    return t && t.t === 'num' ? t.v : 0
  }
  const nextLine = (tx: number, ty: number) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm)
    tm = tlm
  }
  /**
   * 文字を出す（Tj・TJ）。かたまりごとに、書き始めの位置を字の幅から求める
   * （右寄せの数字が1つの TJ の中に大きなすき間をはさんで並ぶことがあるため）
   */
  const show = (items: Tok[]) => {
    let tx = 0
    let cur = ''
    let curX = 0
    const m = mul(tm, ctm)
    const flush = () => {
      const text = cur.normalize('NFKC').trim()
      if (text) runs.push({ x: curX * m[0] + m[4], y: curX * m[1] + m[5], seq: seq++, tokens: [text] })
      cur = ''
    }
    for (const it of items) {
      if (it.t === 'num') {
        if (it.v <= -200) flush()
        tx -= (it.v / 1000) * size * th
        continue
      }
      if (it.t !== 'str') continue
      for (const code of codesOf(it.v, font)) {
        const ch = charOf(code, font)
        if (/^\s*$/.test(ch)) flush()
        else {
          if (!cur) curX = tx
          cur += ch
        }
        const w = font ? (font.widths.get(code) ?? font.dw) : 500
        tx += ((w / 1000) * size + tc + (font?.bytes === 1 && code === 32 ? tw : 0)) * th
      }
    }
    flush()
    tm = mul([1, 0, 0, 1, tx, 0], tm)
  }
  for (const tok of toks) {
    if (tok.t !== 'op') {
      args.push(tok)
      continue
    }
    switch (tok.v) {
      case 'q':
        stack.push({ ctm, tc, tw, th, leading, font, size })
        break
      case 'Q': {
        const g = stack.pop()
        if (g) ({ ctm, tc, tw, th, leading, font, size } = g)
        break
      }
      case 'cm':
        ctm = mul([num(6), num(5), num(4), num(3), num(2), num(1)], ctm)
        break
      case 'BT':
        tm = IDENTITY
        tlm = IDENTITY
        break
      case 'Tf': {
        const name = args[args.length - 2]
        font = name && name.t === 'name' ? fonts.get(name.v) : undefined
        size = num(1)
        break
      }
      case 'Tc':
        tc = num(1)
        break
      case 'Tw':
        tw = num(1)
        break
      case 'Tz':
        th = num(1) / 100
        break
      case 'TL':
        leading = num(1)
        break
      case 'Tm':
        tlm = [num(6), num(5), num(4), num(3), num(2), num(1)]
        tm = tlm
        break
      case 'Td':
        nextLine(num(2), num(1))
        break
      case 'TD':
        leading = -num(1)
        nextLine(num(2), num(1))
        break
      case 'T*':
        nextLine(0, -leading)
        break
      case 'Tj':
      case "'": {
        if (tok.v === "'") nextLine(0, -leading)
        const str = args[args.length - 1]
        if (str && str.t === 'str') show([str])
        break
      }
      case '"': {
        tw = num(3)
        tc = num(2)
        nextLine(0, -leading)
        const str = args[args.length - 1]
        if (str && str.t === 'str') show([str])
        break
      }
      case 'TJ': {
        const a = args[args.length - 1]
        if (a && a.t === 'arr') show(a.v)
        break
      }
    }
    args.length = 0
  }
  return runs
}

/** 同じ高さ（2pt 以内）の文字を1行に。上の行から、左から */
function linesOf(runs: Run[], page: number): PdfLine[] {
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x || a.seq - b.seq)
  const lines: Array<{ y: number; runs: Run[] }> = []
  for (const r of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - r.y) <= 2) last.runs.push(r)
    else lines.push({ y: r.y, runs: [r] })
  }
  return lines.map((l) => ({
    page,
    y: Math.round(l.y * 10) / 10,
    tokens: l.runs.sort((a, b) => a.x - b.x || a.seq - b.seq).flatMap((r) => r.tokens),
  }))
}

/** PDF のバイト列 → ページごと・行ごとの文字 */
export async function extractPdfLines(input: Uint8Array | ArrayBuffer): Promise<PdfLine[]> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const bin = toBinary(bytes)
  if (!bin.startsWith('%PDF-')) throw new Error('PDF ではないようです')
  if (/\/Encrypt\s/.test(bin)) throw new Error('鍵のかかった PDF は読めません')
  const objects = readObjects(bin, bytes)
  if ([...objects.values()].some((o) => /\/Type\s*\/ObjStm/.test(o.dict))) throw new Error('この形の PDF（オブジェクトストリーム）は読めません')

  // ページの順（/Root → /Pages → /Kids をたどる）
  const pages: number[] = []
  const catalog = [...objects.entries()].find(([, o]) => /\/Type\s*\/Catalog\b/.test(o.dict))
  const walk = (num: number | null, depth = 0) => {
    if (num === null || depth > 20) return
    const o = objects.get(num)
    if (!o) return
    if (/\/Type\s*\/Pages\b/.test(o.dict)) {
      const kids = dictValue(o.dict, 'Kids') ?? ''
      for (const k of kids.matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(k[1]), depth + 1)
    } else if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push(num)
  }
  walk(catalog ? ref(dictValue(catalog[1].dict, 'Pages')) : null)
  if (pages.length === 0) {
    for (const [num, o] of objects) if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push(num)
  }

  const fontCache = new Map<number, FontMap>()
  const loadFont = async (num: number): Promise<FontMap | undefined> => {
    if (fontCache.has(num)) return fontCache.get(num)
    const f = objects.get(num)
    if (!f) return undefined
    const tu = ref(dictValue(f.dict, 'ToUnicode'))
    const cmapText = tu !== null ? toBinary(await streamData(objects.get(tu))) : ''
    const type0 = /\/Subtype\s*\/Type0\b/.test(f.dict)
    const twoBytes = type0 || /begincodespacerange\s*<[0-9A-Fa-f]{4}>/.test(cmapText)
    // 字の幅：CID フォント（Type0）は子のフォントの /W と /DW、ふつうのフォントは /Widths と /FirstChar
    let widths = new Map<number, number>()
    let dw = type0 ? 1000 : 500
    if (type0) {
      const descRaw = dictValue(f.dict, 'DescendantFonts') ?? ''
      const descRef = ref(descRaw.replace(/^\[\s*/, ''))
      const desc = descRef !== null ? (objects.get(descRef)?.dict ?? '') : descRaw
      const dwv = Number(dictValue(desc, 'DW'))
      if (Number.isFinite(dwv) && dwv > 0) dw = dwv
      let wRaw = dictValue(desc, 'W') ?? ''
      const wRef = ref(wRaw)
      if (wRef !== null) wRaw = objects.get(wRef)?.dict ?? ''
      if (wRaw) widths = parseCidWidths(wRaw)
    } else {
      const first = Number(dictValue(f.dict, 'FirstChar') ?? 0)
      let wRaw = dictValue(f.dict, 'Widths') ?? ''
      const wRef = ref(wRaw)
      if (wRef !== null) wRaw = objects.get(wRef)?.dict ?? ''
      ;(wRaw.match(/[-\d.]+/g) ?? []).forEach((v, k) => widths.set(first + k, Number(v)))
    }
    const fm: FontMap = { bytes: twoBytes ? 2 : 1, map: cmapText ? parseToUnicode(cmapText) : new Map(), widths, dw }
    if (!cmapText && !type0) for (let c = 32; c < 127; c += 1) fm.map.set(c, String.fromCharCode(c))
    fontCache.set(num, fm)
    return fm
  }

  const lines: PdfLine[] = []
  for (let p = 0; p < pages.length; p += 1) {
    const page = objects.get(pages[p])!
    let resDict = dictValue(page.dict, 'Resources') ?? ''
    const resRef = ref(resDict)
    if (resRef !== null) resDict = objects.get(resRef)?.dict ?? ''
    let fontDict = dictValue(resDict, 'Font') ?? ''
    const fontRef = ref(fontDict)
    if (fontRef !== null) fontDict = objects.get(fontRef)?.dict ?? ''
    const fonts = new Map<string, FontMap>()
    for (const m of fontDict.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
      const fm = await loadFont(Number(m[2]))
      if (fm) fonts.set(m[1], fm)
    }
    const contents = dictValue(page.dict, 'Contents') ?? ''
    const parts: string[] = []
    for (const m of contents.matchAll(/(\d+)\s+\d+\s+R/g)) parts.push(toBinary(await streamData(objects.get(Number(m[1])))))
    lines.push(...linesOf(runsOfPage(parts.join('\n'), fonts), p + 1))
  }
  return lines
}
