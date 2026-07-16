/**
 * LINE顧客のサーバー側永続化
 *
 * - Supabase設定時（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）: Postgresに保存（本番用）
 * - 未設定時: JSONファイル保存（ローカル開発用。サーバーレスでは/tmp暫定）
 * どちらも同じ非同期インターフェースで提供し、呼び出し側は保存先を意識しない。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createSupabaseServer } from '@/lib/supabase-server'
import type { LineChatMessage, LineContact } from './line-types'

const TABLE = 'marketing_line_contacts'

// ── ファイルフォールバック ──────────────────────────────────────

interface LineDb {
  contacts: Record<string, LineContact>
}

function dbPath(): string {
  const local = path.join(process.cwd(), '.data')
  try {
    fs.mkdirSync(local, { recursive: true })
    return path.join(local, 'marketing-line.json')
  } catch {
    return path.join('/tmp', 'marketing-line.json')
  }
}

function fileLoad(): LineDb {
  try {
    return JSON.parse(fs.readFileSync(dbPath(), 'utf-8')) as LineDb
  } catch {
    return { contacts: {} }
  }
}

function fileSave(db: LineDb) {
  fs.writeFileSync(dbPath(), JSON.stringify(db, null, 2))
}

// ── 共通 ────────────────────────────────────────────────────────

function newContact(userId: string, displayName?: string): LineContact {
  const now = new Date().toISOString()
  return {
    userId,
    displayName: displayName || `ユーザー${userId.slice(-4)}`,
    followedAt: now,
    lastActiveAt: now,
    step: 'idle',
    tags: [],
    handoff: false,
    reserved: false,
    optedOut: false,
    memo: '',
    campaign: 'first_visit',
    messages: [],
  }
}

export async function getContact(userId: string, displayName?: string): Promise<LineContact> {
  const supabase = createSupabaseServer()
  if (supabase) {
    const { data } = await supabase.from(TABLE).select('data').eq('user_id', userId).maybeSingle()
    if (data?.data) return data.data as LineContact
    return newContact(userId, displayName)
  }
  return fileLoad().contacts[userId] ?? newContact(userId, displayName)
}

export async function saveContact(contact: LineContact, newMessages: LineChatMessage[] = []): Promise<void> {
  contact.lastActiveAt = new Date().toISOString()
  contact.messages = [...contact.messages, ...newMessages].slice(-200)

  const supabase = createSupabaseServer()
  if (supabase) {
    await supabase.from(TABLE).upsert({ user_id: contact.userId, data: contact })
    return
  }
  const db = fileLoad()
  db.contacts[contact.userId] = contact
  fileSave(db)
}

export async function listContacts(): Promise<LineContact[]> {
  const supabase = createSupabaseServer()
  if (supabase) {
    const { data } = await supabase.from(TABLE).select('data').limit(1000)
    const contacts = (data ?? []).map((row) => row.data as LineContact)
    return contacts.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
  }
  return Object.values(fileLoad().contacts).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
}

export async function patchContact(
  userId: string,
  patch: Partial<Pick<LineContact, 'tags' | 'handoff' | 'memo' | 'needsAttention' | 'reserved' | 'optedOut'>>,
): Promise<LineContact | null> {
  const supabase = createSupabaseServer()
  if (supabase) {
    const { data } = await supabase.from(TABLE).select('data').eq('user_id', userId).maybeSingle()
    if (!data?.data) return null
    const contact = data.data as LineContact
    Object.assign(contact, patch)
    if (patch.handoff === false) contact.step = 'idle'
    await supabase.from(TABLE).upsert({ user_id: userId, data: contact })
    return contact
  }

  const db = fileLoad()
  const contact = db.contacts[userId]
  if (!contact) return null
  Object.assign(contact, patch)
  if (patch.handoff === false) contact.step = 'idle' // 対応終了→自動応答再開
  db.contacts[userId] = contact
  fileSave(db)
  return contact
}
