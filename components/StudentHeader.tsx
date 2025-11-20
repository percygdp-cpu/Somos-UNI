'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function StudentHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [showDropdown, setShowDropdown] = useState(false)

  return (
    <header className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-sm border-b border-gray-200">
      <div className="container mx-auto flex items-center p-4">
        <button 
          onClick={() => router.push('/student/courses')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Image src="/icon.png" alt="Somos UNI" width={40} height={40} className="object-contain" />
          <h1 className="text-xl font-bold leading-tight tracking-tight text-secondary-900">
            Somos UNI
          </h1>
        </button>
        <div className="flex-1"></div>
        <div className="flex items-center gap-4">
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
                      router.push('/student/account')
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-gray-100 transition-colors"
                  >
                    <span>Ver Perfil</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      logout()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
