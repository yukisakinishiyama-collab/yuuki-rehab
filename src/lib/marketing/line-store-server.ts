/**
 * LINE顧客のサーバー側永続化（Phase 2: JSONファイル）
 *
 * Webhookはサーバーで動くため、localStorageではなくファイルに保存する。
 * 開発環境: リポジトリ直下 .data/（gitignore済み）
 * サーバーレス環境: /tmp フォールバック（再起動で消える暫定。Phase 3でSupabaseへ移行）
 */
import fs from 'node:fs'
import path from 'node:path'
import type { LineChatMessage, LineContact } from './line-types'

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

function load(): LineDb {
  try {
    return JSON.parse(fs.readFileSync(dbPath(), 'utf-8')) as LineDb
  } catch {
    return { contacts: {} }
  }
}

function save(db: LineDb) {
  fs.writeFileSync(dbPath(), JSON.stringify(db, null, 2))
}

export function getContact(userId: string, displayName?: string): LineContact {
  const db = load()
  const existing = db.contacts[userId]
  if (existing) return existing
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

export function saveContact(contact: LineContact, newMessages: LineChatMessage[] = []) {
  const db = load()
  contact.lastActiveAt = new Date().toISOString()
  contact.messages = [...contact.messages, ...newMessages].slice(-200)
  db.contacts[contact.userId] = contact
  save(db)
}

export function listContacts(): LineContact[] {
  return Object.values(load().contacts).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
}

export function patchContact(
  userId: string,
  patch: Partial<Pick<LineContact, 'tags' | 'handoff' | 'memo' | 'needsAttention' | 'reserved' | 'optedOut'>>,
): LineContact | null {
  const db = load()
  const contact = db.contacts[userId]
  if (!contact) return null
  Object.assign(contact, patch)
  if (patch.handoff === false) contact.step = 'idle' // 対応終了→自動応答再開
  db.contacts[userId] = contact
  save(db)
  return contact
}
