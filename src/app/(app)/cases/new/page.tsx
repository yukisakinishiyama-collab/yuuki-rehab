import CaseForm from '@/components/rehab/CaseForm'

export default function NewCasePage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">新規症例登録</h1>
      <CaseForm />
    </div>
  )
}
