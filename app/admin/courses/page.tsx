'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function CourseManagementPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirigir a la nueva ubicación con el tab de courses
    router.replace('/admin/users?tab=courses')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
    </div>
  )
}
