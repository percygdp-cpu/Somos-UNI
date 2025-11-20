'use client'

import React from 'react'
import { useAuth } from './AuthContext'
import { useRouter } from 'next/navigation'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ('student' | 'admin')[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles = ['student', 'admin'] 
}) => {
  const { user, loading } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  if (!allowedRoles.includes(user.role)) {
    router.push(user.role === 'admin' ? '/admin/dashboard' : '/student/courses')
    return null
  }

  return <>{children}</>
}