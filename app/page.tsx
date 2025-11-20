'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

export default function HomePage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Si hay usuario autenticado, redirigir según su rol
        if (user.role === 'admin') {
          router.push('/admin/dashboard')
        } else {
          router.push('/student/courses')
        }
      } else {
        // Si no hay usuario, ir a login
        router.push('/login')
      }
    }
  }, [user, loading, router])

  // Mostrar loading mientras se determina el estado
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
    </div>
  )
}