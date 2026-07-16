/**
 * 医療広告ガイドライン表現チェック
 *
 * tools/sns-automation/lib/rules.mjs から移植（元CLIは残置・ルールはここが正）。
 * NG=blocked（管理者が理由付きで解除しない限り公開不可）、注意=review。
 */
import type { ComplianceFinding, ComplianceResult } from './types'

interface Rule {
  pattern: RegExp
  reason: string
  suggestion: string
}

/** NGレベル: 公開前に必ず修正すべき表現 */
export const NG_RULES: Rule[] = [
  { pattern: /完全(に)?治(癒|り|る)/g, reason: '治癒の保証（虚偽・誇大広告）', suggestion: '「改善を目指す」「回復をサポートする」' },
  { pattern: /必ず(治|良くな|改善)/g, reason: '効果の保証', suggestion: '「改善が期待できる」「〜を目指す」' },
  { pattern: /絶対(に)?(治|良くな|効)/g, reason: '効果の保証', suggestion: '「状態に合わせた施術を行う」' },
  { pattern: /(1|一)回で(治|改善|効果)/g, reason: '施術回数と効果の断定', suggestion: '「経過を見ながら通院計画をご提案」' },
  { pattern: /(日本|地域|下関)(一|No\.?1|ナンバーワン)/gi, reason: '比較優良広告', suggestion: '客観的事実（開業年数・資格等）のみ記載' },
  { pattern: /どこよりも/g, reason: '比較優良広告', suggestion: '削除、または自院の特徴の説明に変更' },
  { pattern: /最(高|先端|新)の(技術|治療|施術)/g, reason: '最上級表現（誇大広告）', suggestion: '「エビデンスに基づいた施術」' },
  { pattern: /奇跡/g, reason: '誇大広告', suggestion: '削除' },
  { pattern: /副作用は(一切)?(あり|ござい)ません/g, reason: 'リスクの否定（虚偽広告）', suggestion: 'リスク・注意点も併記する' },
  { pattern: /誰でも(治|効果|改善)/g, reason: '効果の保証', suggestion: '「状態に合わせてご提案します」' },
  { pattern: /治療効果を保証/g, reason: '効果の保証', suggestion: '削除' },
  { pattern: /満足度\s*\d+\s*[%％]/g, reason: '体験談・満足度の広告利用は原則不可', suggestion: '削除、または調査主体等の根拠を明示' },
  { pattern: /(芸能人|有名人|プロ選手)(も)?(多数)?(来院|愛用|推薦)/g, reason: '著名人の来院実績による誘引', suggestion: '削除' },
  { pattern: /永久に|二度と(痛|再発)/g, reason: '効果の永続性の保証', suggestion: '「再発予防を目指したケアを行う」' },
  { pattern: /(がん|癌|腫瘍)(が|も)(治|消え)/g, reason: '重大疾病の治癒標榜（違法）', suggestion: '削除。医科受診を促す記載に変更' },
  { pattern: /(他|病)院(では|より)(治らない|優れ|劣)/g, reason: '他院の否定・比較優良広告', suggestion: '削除' },
  { pattern: /無痛/g, reason: '痛みの不在の断定', suggestion: '「痛みに配慮した施術」' },
]

/** 注意レベル: 文脈によっては問題になりうるグレー表現 */
export const WARN_RULES: Rule[] = [
  { pattern: /痛みが(消え|なくな)(る|ます|ります)/g, reason: '効果の断定に読まれる可能性', suggestion: '「痛みの軽減を目指す」' },
  { pattern: /即効/g, reason: '効果の即時性の強調', suggestion: '「早期の改善を目指す」' },
  { pattern: /(治した|治します)/g, reason: '治癒の断定', suggestion: '「施術・サポートを行った」' },
  { pattern: /根本(治療|改善|から治)/g, reason: '根本治療の標榜は根拠説明が必要', suggestion: '「原因の評価に基づく施術」' },
]

/** テキスト1件をチェックして所見リストを返す */
export function findViolations(text: string): ComplianceFinding[] {
  const findings: ComplianceFinding[] = []
  const source = String(text ?? '')
  for (const rule of NG_RULES) {
    rule.pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rule.pattern.exec(source)) !== null) {
      findings.push({ level: 'NG', match: m[0], reason: rule.reason, suggestion: rule.suggestion })
    }
  }
  for (const rule of WARN_RULES) {
    rule.pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rule.pattern.exec(source)) !== null) {
      findings.push({ level: '注意', match: m[0], reason: rule.reason, suggestion: rule.suggestion })
    }
  }
  return findings
}

/** 生成コンテンツ全体（本文・スライド・ハッシュタグ等）をまとめてチェックする */
export function checkContent(parts: Array<string | undefined>, extraBanned?: string): ComplianceResult {
  const text = parts.filter(Boolean).join('\n')
  const findings = findViolations(text)

  // 院独自の禁止ワード（設定画面で管理。カンマ・改行区切り）
  if (extraBanned) {
    extraBanned
      .split(/[,、\n]/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
      .forEach((word) => {
        if (text.includes(word)) {
          findings.push({ level: 'NG', match: word, reason: '院の禁止ワード', suggestion: '設定画面の投稿ルールを確認' })
        }
      })
  }

  const hasNg = findings.some((f) => f.level === 'NG')
  const status = hasNg ? 'blocked' : findings.length > 0 ? 'review' : 'pass'
  return { status, findings, checkedAt: new Date().toISOString() }
}
