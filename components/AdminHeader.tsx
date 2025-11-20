'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function AdminHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [showDropdown, setShowDropdown] = useState(false)

  return (
    <header className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-sm border-b border-gray-200">
      <div className="container mx-auto flex items-center p-4">
        <button 
          onClick={() => router.push('/admin/dashboard')}
          className="flex items-center gap-3 cursor-pointer"
        >
          <Image src="/icon.png" alt="Somos UNI" width={40} height={40} className="object-contain" />
          <h1 className="text-xl font-bold leading-tight tracking-tight text-secondary-900">
            Somos UNI - Admin
          </h1>
        </button>
        <div className="flex-1"></div>
        <nav className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/users')}
            className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
          >
            Gestión
          </button>
          <button
            onClick={() => router.push('/admin/analytics')}
            className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
          >
            Analytics
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-gradient-to-br from-primary-400 to-primary-600 hover:from-primary-500 hover:to-primary-700 transition-all"
              title="Mi Cuenta"
            >
              <span className="text-white text-lg font-bold">
                {user?.username.charAt(0).toUpperCase()}
              </span>
            </button>
            
            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      logout()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <span>🚪</span>
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
