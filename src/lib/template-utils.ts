// ──────────────────────────────────────────────
// 定型文カテゴリ ユーティリティ
// ──────────────────────────────────────────────
import type { TemplateCategory } from '@/types/templates'

// {name} プレースホルダーを患者氏名などに置き換える
export function resolveTemplateCategories(categories: TemplateCategory[], name: string): TemplateCategory[] {
  return categories.map(c => ({ ...c, templates: c.templates.map(t => t.replaceAll('{name}', name)) }))
}
