'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MOCK_USERS } from '@/lib/rehab-data'
import { login } from '@/lib/rehab-store'
import { ROLE_LABELS } from '@/types/rehab'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!selectedUserId) {
      setError('担当者を選択してください')
      return
    }
    if (!password) {
      setError('パスワードを入力してください')
      return
    }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 400))
    const ok = login(selectedUserId, password)
    if (!ok) {
      setError('パスワードが正しくありません')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">担当者</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
        >
          <option value="">-- 選択してください --</option>
          {MOCK_USERS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}（{ROLE_LABELS[u.role]}・{u.department}）
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">パスワード</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワードを入力"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          医療スタッフ: <code className="bg-gray-100 px-1 rounded">rehab2026</code>
          ダンス専門家: <code className="bg-gray-100 px-1 rounded">dance2026</code>
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#0d9488] hover:bg-[#0b8276] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <LogIn className="w-4 h-4" />
        )}
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  )
}
