'use client'

import { useEffect, useState } from 'react'
import { getCurrentUser, initStore } from '@/lib/rehab-store'
import type { User } from '@/types/rehab'

// 院内専用アプリ：未ログインの場合はデフォルトユーザーで自動ログイン
const AUTO_LOGIN_USER: User = {
  id: 'user-001',
  name: '西山 勇来',
  role: 'admin',
  department: 'リハビリテーション科',
  email: 'nishiyama@rehab.example.com',
}

interface Props {
  children: (user: User) => React.ReactNode
}

export default function AuthGuard({ children }: Props) {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    try {
      initStore()
    } catch {
      // initStore が失敗しても続行
    }
    let u: User | null = null
    try {
      u = getCurrentUser()
    } catch {
      // localStorage が読めない場合も続行
    }
    if (!u) {
      // 未ログインなら自動ログイン（院内専用のため）
      try {
        localStorage.setItem('rehabUser', JSON.stringify(AUTO_LOGIN_USER))
      } catch {
        // localStorage が使えない環境でもセッションだけ保持
      }
      u = AUTO_LOGIN_USER
    }
    setUser(u)
    setChecked(true)
  }, [])

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f4f8]">
        <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return <>{children(user)}</>
}
