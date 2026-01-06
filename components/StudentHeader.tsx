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
        {/* Navegación principal */}
        <nav className="hidden md:flex items-center gap-4">
          <button
            onClick={() => router.push('/student/courses')}
            className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
          >
            Cursos
          </button>
          <button
            onClick={() => router.push('/student/panel')}
            className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
          >
            Panel
          </button>
          <button
            onClick={() => router.push('/student/account')}
            className="text-sm text-secondary-600 hover:text-primary-600 transition-colors"
          >
            Perfil
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
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      router.push('/student/account')
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Ver Perfil</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      router.push('/student/panel')
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Panel de Seguimiento</span>
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      logout()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
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
