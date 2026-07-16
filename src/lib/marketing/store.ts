/**
 * マーケティングハブ 永続化ストア（Phase 1: localStorage）
 *
 * rehab-store.ts と同じ流儀。Phase 3でDB移行するため、
 * このモジュールの関数シグネチャを外部契約として維持する。
 */
import type { AuditLogEntry, ClinicProfile, ContentProject, ContentVariant, PostStatus, Reference } from './types'
import { DEFAULT_CLINIC_PROFILE } from './clinic'

const KEYS = {
  projects: 'yuuki_mk_projects',
  profile: 'yuuki_mk_clinic_profile',
  audit: 'yuuki_mk_audit_log',
  references: 'yuuki_mk_references',
} as const

const isBrowser = () => typeof window !== 'undefined'

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

// ── 院プロフィール ──────────────────────────────────────────────

export function loadClinicProfile(): ClinicProfile {
  return { ...DEFAULT_CLINIC_PROFILE, ...read<Partial<ClinicProfile>>(KEYS.profile, {}) }
}

export function saveClinicProfile(profile: ClinicProfile) {
  write(KEYS.profile, profile)
  appendAudit('基本情報を更新', 'clinic_profile')
}

// ── 投稿プロジェクト ────────────────────────────────────────────

export function loadProjects(): ContentProject[] {
  return read<ContentProject[]>(KEYS.projects, [])
}

export function saveProject(project: ContentProject) {
  const projects = loadProjects()
  const index = projects.findIndex((p) => p.id === project.id)
  project.updatedAt = new Date().toISOString()
  if (index >= 0) projects[index] = project
  else projects.unshift(project)
  write(KEYS.projects, projects)
}

export function deleteProject(id: string) {
  write(
    KEYS.projects,
    loadProjects().filter((p) => p.id !== id),
  )
  appendAudit('プロジェクトを削除', id)
}

export function findProject(id: string): ContentProject | undefined {
  return loadProjects().find((p) => p.id === id)
}

/**
 * バリアントのステータスを変更する。
 * 公開系ステータスへの遷移は表現チェックと承認順序をここで強制する（指示書12章）。
 */
export function transitionVariant(
  projectId: string,
  variantId: string,
  next: PostStatus,
  options?: { scheduledAt?: string; overrideReason?: string; publishedUrl?: string },
): { ok: boolean; message?: string } {
  const project = findProject(projectId)
  if (!project) return { ok: false, message: 'プロジェクトが見つかりません' }
  const variant = project.variants.find((v) => v.id === variantId)
  if (!variant) return { ok: false, message: '対象の媒体がありません' }

  if (variant.compliance.status === 'blocked' && !variant.compliance.overrideReason) {
    if (next === 'approved' || next === 'scheduled' || next === 'published') {
      if (!options?.overrideReason) {
        return { ok: false, message: '公開禁止の表現があります。修正するか、理由を入力して解除してください。' }
      }
      variant.compliance.overrideReason = options.overrideReason
      appendAudit('公開禁止を解除', `${projectId}/${variantId}`, options.overrideReason)
    }
  }

  if (next === 'scheduled') {
    if (variant.status !== 'approved' && variant.status !== 'scheduled') {
      return { ok: false, message: '予約は承認済みの投稿のみ可能です' }
    }
    if (!options?.scheduledAt) return { ok: false, message: '予約日時を指定してください' }
    variant.scheduledAt = options.scheduledAt
  }

  if (next === 'published') {
    if (variant.status !== 'approved' && variant.status !== 'scheduled') {
      return { ok: false, message: '公開は承認済みの投稿のみ可能です' }
    }
    variant.publishedAt = new Date().toISOString()
    if (options?.publishedUrl) variant.publishedUrl = options.publishedUrl
  }

  variant.status = next
  saveProject(project)
  appendAudit(`ステータス変更: ${next}`, `${projectId}/${variantId}`)
  return { ok: true }
}

/** 本文を編集したら必ず再チェック前提の下書きに戻す */
export function updateVariantContent(projectId: string, variantId: string, updater: (v: ContentVariant) => void) {
  const project = findProject(projectId)
  if (!project) return
  const variant = project.variants.find((v) => v.id === variantId)
  if (!variant) return
  updater(variant)
  variant.editedAt = new Date().toISOString()
  if (variant.status !== 'draft') variant.status = 'draft'
  saveProject(project)
}

// ── 参考資料ライブラリ（指示書9章） ──────────────────────────────

export function loadReferences(): Reference[] {
  return read<Reference[]>(KEYS.references, [])
}

export function saveReference(reference: Reference) {
  const references = loadReferences()
  const index = references.findIndex((r) => r.id === reference.id)
  if (index >= 0) references[index] = reference
  else references.unshift(reference)
  write(KEYS.references, references)
  appendAudit(reference.approved ? '参考資料を承認' : '参考資料を保存', reference.title.slice(0, 40))
}

export function deleteReference(id: string) {
  write(
    KEYS.references,
    loadReferences().filter((r) => r.id !== id),
  )
  appendAudit('参考資料を削除', id)
}

// ── 監査ログ ───────────────────────────────────────────────────

export function appendAudit(action: string, target: string, detail?: string) {
  const log = read<AuditLogEntry[]>(KEYS.audit, [])
  log.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: 'staff', // Phase 2でユーザー管理導入後に実ユーザー名へ
    action,
    target,
    detail,
  })
  write(KEYS.audit, log.slice(0, 500))
}

export function loadAuditLog(): AuditLogEntry[] {
  return read<AuditLogEntry[]>(KEYS.audit, [])
}
