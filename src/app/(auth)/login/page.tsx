import LoginForm from '@/components/rehab/LoginForm'
import { Activity } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#0d2a47] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0d9488] rounded-2xl mb-4 shadow-lg">
            <Activity className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">YUUKI REHAB</h1>
          <p className="text-blue-200 text-sm mt-1">運動器リハビリテーション動画分析</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">ログイン</h2>
          <p className="text-sm text-gray-500 mb-6">担当者を選択し、パスワードを入力してください</p>
          <LoginForm />
        </div>

        <p className="text-center text-blue-300 text-xs mt-6">
          © 2026 YUUKI REHAB — 専門家向け動作分析プラットフォーム
        </p>
      </div>
    </div>
  )
}
