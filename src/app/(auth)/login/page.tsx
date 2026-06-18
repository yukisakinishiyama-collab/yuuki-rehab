import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import QRAutoLogin from '@/components/rehab/QRAutoLogin'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ qr?: string }>
}) {
  const params = await searchParams
  if (!params.qr) {
    redirect('/dashboard')
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d1f33] via-[#1a3a5c] to-[#0d2b2a] flex flex-col items-center justify-center px-4">
      <Suspense>
        <QRAutoLogin />
      </Suspense>
    </div>
  )
}
