'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, initStore } from '@/lib/rehab-store'
import type { User } from '@/types/rehab'

interface Props {
  children: (user: User) => React.ReactNode
}

export default function AuthGuard({ children }: Props) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    initStore()
    const u = getCurrentUser()
    if (!u) {
      router.replace('/login')
    } else {
      setUser(u)
    }
    setChecked(true)
  }, [router])

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
