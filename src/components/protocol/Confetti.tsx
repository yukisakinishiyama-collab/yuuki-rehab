'use client'

import { useEffect, useState } from 'react'

interface Piece {
  id: number
  x: number
  color: string
  size: number
  delay: number
  duration: number
}

const COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#10b981']

export default function Confetti() {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    const generated = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 8 + 6,
      delay: Math.random() * 1.5,
      duration: Math.random() * 1.5 + 1.5,
    }))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPieces(generated)
    const t = setTimeout(() => setPieces([]), 3500)
    return () => clearTimeout(t)
  }, [])

  if (pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute top-0 animate-confetti rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
