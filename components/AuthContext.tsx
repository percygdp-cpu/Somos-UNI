'use client'

import { AuthContextType, User } from '@/types'
import { useRouter } from 'next/navigation'
import React, { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Verificar el status del usuario periódicamente
  useEffect(() => {
    if (!user) return

    const checkUserStatus = async () => {
      try {
        const response = await fetch('/api/users')
        if (!response.ok) return

        const users = await response.json()
        const currentUser = users.find((u: any) => u.id.toString() === user.id)

        // Si el usuario fue cesado o eliminado, cerrar sesión
        if (!currentUser || currentUser.status !== 'active') {
          logout()
        }
      } catch (error) {
        console.error('Error checking user status:', error)
      }
    }

    // Verificar cada 30 segundos
    const interval = setInterval(checkUserStatus, 30000)
    
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    const token = localStorage.getItem('auth-token')
    const userData = localStorage.getItem('user-data')
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      } catch (error) {
        console.error('Error parsing user data:', error)
        localStorage.removeItem('auth-token')
        localStorage.removeItem('user-data')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Normalizar username a minúsculas para comparación case-insensitive
      const normalizedUsername = username.toLowerCase().trim()
      
      // Obtener usuarios de la base de datos
      const response = await fetch('/api/users')
      if (!response.ok) {
        console.error('Error al obtener usuarios')
        return false
      }

      const users = await response.json()
      const user = users.find((u: any) => 
        u.username.toLowerCase() === normalizedUsername && 
        u.password === password && 
        u.status === 'active'
      )
      
      if (user) {
        // Convertir el usuario de la DB al formato User
        const userData: User = {
          id: user.id.toString(),
          name: user.name || user.fullName || '',
          username: user.username,
          password: user.password,
          role: user.role,
          status: user.status,
          email: user.email || '',
          fullName: user.name || user.fullName || '',
          createdAt: new Date(user.created_at || user.createdAt),
          updatedAt: new Date(user.updated_at || user.updatedAt)
        }
        
        const token = 'jwt-token-' + user.id
        localStorage.setItem('auth-token', token)
        localStorage.setItem('user-data', JSON.stringify(userData))
        setUser(userData)
        
        // Redirigir según el rol
        if (userData.role === 'admin') {
          router.push('/admin/dashboard')
        } else {
          router.push('/student/courses')
        }
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('auth-token')
    localStorage.removeItem('user-data')
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}