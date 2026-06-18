import SportsPerformanceViewer from '@/components/rehab/SportsPerformanceViewer'

export const metadata = { title: 'スポーツパフォーマンス解析 | YUUKI REHAB' }

export default function SportsPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">スポーツパフォーマンス解析</h1>
        <p className="text-sm text-gray-500 mt-1">
          動画をアップロードして最大6人を同時追跡。スピード・ジャンプ・左右差・疲労を自動計測します。
        </p>
        {/* 使用モデル情報 */}
        <div className="flex flex-wrap gap-3 mt-3">
          {[
            { label: '追跡モデル', value: 'MediaPipe Heavy（最高精度）' },
            { label: '同時追跡', value: '最大 6 人' },
            { label: 'アクセラレーター', value: 'GPU 優先 / CPU フォールバック' },
          ].map(({ label, value }) => (
            <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
              <span className="text-gray-400">{label}:</span>
              <span className="font-medium">{value}</span>
            </span>
          ))}
        </div>
      </div>

      <SportsPerformanceViewer />
    </div>
  )
}
