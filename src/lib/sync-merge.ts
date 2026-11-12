// ──────────────────────────────────────────────
// カルテの同期：差分の取り方と重ね方（端末・サーバーの両方から使う純粋な関数）
//
// 以前は「端末の localStorage をまるごと送って、クラウドをまるごと置きかえる」だけだったので、
// 2台で同時に使うと、あとから送った端末の古い内容で、もう1台の記録が消えることがあった。
//
// いまは「前回そろえたときの形（base）」と今の端末の中身を比べて、変わったところだけを送る。
// - 配列で、どの要素にも id がある値（SOAP・メモ・評価など）… 1件ずつ（id ごと）に足す・置きかえる・消す
// - それ以外の値 … 値ごと置きかえる
// サーバーは、届いた差分をクラウドの今の中身に重ねる。別の端末が同じ時間に別の患者さんの記録を書いても消えない。
// ──────────────────────────────────────────────

/** 1つの値（localStorage の1キー）の「前回そろえたときの形」 */
export type BaseEntry =
  | { kind: 'arr'; ids: Record<string, string> } // id → 中身の指紋
  | { kind: 'raw'; hash: string }

export type BaseMap = Record<string, BaseEntry>

/** 1つのキーへの変更 */
export type KeyOp =
  | { key: string; type: 'merge'; upserts: Array<Record<string, unknown>>; deletes: string[] }
  | { key: string; type: 'replace'; value: string }
  | { key: string; type: 'remove' }

/** 文字列の指紋（FNV-1a 32bit を2本。偶然の一致はまず起きない） */
export function fingerprint(text: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193 ^ text.length
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0
    h2 = (h2 ^ (h2 >>> 13)) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

type IdRecord = Record<string, unknown> & { id: string }

/** id つきの配列なら、その配列を返す。そうでなければ null（値ごと扱う） */
export function asIdArray(raw: string | null | undefined): IdRecord[] | null {
  if (raw == null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const seen = new Set<string>()
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const id = (item as { id?: unknown }).id
    if (typeof id !== 'string' || !id || seen.has(id)) return null
    seen.add(id)
  }
  return parsed as IdRecord[]
}

/** 今の値から「そろえたときの形」を作る */
export function baseOf(raw: string): BaseEntry {
  const arr = asIdArray(raw)
  if (arr) {
    const ids: Record<string, string> = {}
    for (const item of arr) ids[item.id] = fingerprint(JSON.stringify(item))
    return { kind: 'arr', ids }
  }
  return { kind: 'raw', hash: fingerprint(raw) }
}

export function baseMapOf(data: Record<string, string>): BaseMap {
  const out: BaseMap = {}
  for (const [key, raw] of Object.entries(data)) out[key] = baseOf(raw)
  return out
}

/**
 * 1つのキーについて、そろえたとき（base）から今の値（local）までの変更を作る。変わっていなければ null。
 * local が null … 端末から消えた
 */
export function diffKey(key: string, local: string | null, base: BaseEntry | undefined): KeyOp | null {
  if (local == null) return base ? { key, type: 'remove' } : null
  const arr = asIdArray(local)
  if (arr && base?.kind === 'arr') {
    const upserts: IdRecord[] = []
    const now = new Set<string>()
    for (const item of arr) {
      now.add(item.id)
      if (base.ids[item.id] !== fingerprint(JSON.stringify(item))) upserts.push(item)
    }
    const deletes = Object.keys(base.ids).filter((id) => !now.has(id))
    return upserts.length || deletes.length ? { key, type: 'merge', upserts, deletes } : null
  }
  if (arr && !base) {
    // 前回そろえたときに無かったキー：1件ずつ足す（クラウド側に同じキーが先にできていても消さない）
    // 空の配列は送らない（別の端末が同じキーに記録を入れていたら、空で上書きして消してしまうため）
    return arr.length ? { key, type: 'merge', upserts: arr, deletes: [] } : null
  }
  if (base?.kind === 'raw' && base.hash === fingerprint(local)) return null
  if (base?.kind === 'arr' && !arr) return { key, type: 'replace', value: local }
  return { key, type: 'replace', value: local }
}

/** 端末の全キーと base を比べて、送る変更の一覧を作る */
export function diffAll(local: Record<string, string>, base: BaseMap): KeyOp[] {
  const ops: KeyOp[] = []
  const keys = new Set([...Object.keys(local), ...Object.keys(base)])
  for (const key of keys) {
    const op = diffKey(key, key in local ? local[key] : null, base[key])
    if (op) ops.push(op)
  }
  return ops
}

/**
 * 1つの値に変更を重ねる。current は重ねる先（クラウドの今の値など。無ければ null）。
 * 戻り値 null … そのキーを消す
 */
export function applyOp(current: string | null, op: KeyOp): string | null {
  if (op.type === 'remove') return null
  if (op.type === 'replace') return op.value
  const arr = current == null ? [] : asIdArray(current)
  if (arr == null) {
    // 重ねる先が id つきの配列でない（壊れている・形が違う）ときは、届いた分だけで作る
    return JSON.stringify(op.upserts)
  }
  const deleted = new Set(op.deletes)
  const replace = new Map(op.upserts.map((u) => [String(u.id), u]))
  const out: Array<Record<string, unknown>> = []
  for (const item of arr) {
    if (deleted.has(item.id)) continue
    const next = replace.get(item.id)
    if (next) {
      out.push(next)
      replace.delete(item.id)
    } else {
      out.push(item)
    }
  }
  for (const item of op.upserts) if (replace.has(String(item.id))) out.push(item)
  return JSON.stringify(out)
}

/** 全体に変更を重ねる（元の値は変えない） */
export function applyOps(data: Record<string, string>, ops: KeyOp[]): Record<string, string> {
  const out = { ...data }
  for (const op of ops) {
    const next = applyOp(op.key in out ? out[op.key] : null, op)
    if (next == null) delete out[op.key]
    else out[op.key] = next
  }
  return out
}

/** 届いた変更の形を確かめる（サーバーで使う）。おかしなものは null */
export function sanitizeOps(input: unknown): KeyOp[] | null {
  if (!Array.isArray(input) || input.length > 500) return null
  const ops: KeyOp[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null
    const op = raw as Record<string, unknown>
    const key = op.key
    if (typeof key !== 'string' || !key || key.length > 200) return null
    if (op.type === 'remove') ops.push({ key, type: 'remove' })
    else if (op.type === 'replace' && typeof op.value === 'string') ops.push({ key, type: 'replace', value: op.value })
    else if (op.type === 'merge' && Array.isArray(op.upserts) && Array.isArray(op.deletes)) {
      const upserts = op.upserts as unknown[]
      const deletes = op.deletes as unknown[]
      if (!upserts.every((u) => u && typeof u === 'object' && !Array.isArray(u) && typeof (u as { id?: unknown }).id === 'string')) return null
      if (!deletes.every((d) => typeof d === 'string')) return null
      ops.push({ key, type: 'merge', upserts: upserts as Array<Record<string, unknown>>, deletes: deletes as string[] })
    } else return null
  }
  return ops
}
