/**
 * 院内アプリのログインユーザー（院内の端末に保存。患者さんのデータとは別）
 */
export type UserRole = 'admin' | 'pt' | 'doctor' | 'trainer' | 'viewer'

export interface User {
  id: string
  name: string
  role: UserRole
  department: string
  email: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  pt: '理学療法士',
  doctor: '医師',
  trainer: 'トレーナー',
  viewer: '閲覧のみ',
}
