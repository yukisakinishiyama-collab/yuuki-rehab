import type { User } from '@/types/rehab'

/** 院内の端末で使うユーザー（院内専用のため、未ログインなら自動でこのユーザーになる） */
export const MOCK_USERS: User[] = [
  {
    id: 'user-001',
    name: '西山 勇来',
    role: 'admin',
    department: 'リハビリテーション科',
    email: 'nishiyama@rehab.example.com',
  },
]
