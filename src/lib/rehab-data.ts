import type { User, RehabCase, VideoComment, EvaluationResult } from '@/types/rehab'

export const MOCK_USERS: User[] = [
  {
    id: 'user-001',
    name: '西山 勇来',
    role: 'admin',
    department: 'リハビリテーション科',
    email: 'nishiyama@rehab.example.com',
  },
]

// 患者情報は症例管理から登録してください
export const MOCK_CASES: RehabCase[] = []

export const MOCK_COMMENTS: VideoComment[] = []

export const MOCK_EVALUATIONS: EvaluationResult[] = []
