'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function StudentHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

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
        
        {/* Botón de menú móvil */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Menú"
        >
          {showMobileMenu ? (
            <svg className="w-6 h-6 text-secondary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-secondary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Navegación principal - Desktop */}
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

      {/* Menú móvil desplegable */}
      {showMobileMenu && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-10 md:hidden" 
            onClick={() => setShowMobileMenu(false)}
          />
          <nav className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-20">
            <div className="container mx-auto py-2">
              {/* Info del usuario */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="flex items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-gradient-to-br from-primary-400 to-primary-600">
                  <span className="text-white text-lg font-bold">
                    {user?.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-secondary-900">{user?.username}</p>
                  <p className="text-xs text-secondary-500">Estudiante</p>
                </div>
              </div>

              {/* Enlaces de navegación */}
              <button
                onClick={() => {
                  setShowMobileMenu(false)
                  router.push('/student/courses')
                }}
                className="w-full text-left px-4 py-3 text-sm text-secondary-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <svg className="w-5 h-5 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Cursos</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false)
                  router.push('/student/panel')
                }}
                className="w-full text-left px-4 py-3 text-sm text-secondary-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <svg className="w-5 h-5 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Panel de Seguimiento</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false)
                  router.push('/student/account')
                }}
                className="w-full text-left px-4 py-3 text-sm text-secondary-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <svg className="w-5 h-5 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Ver Perfil</span>
              </button>
              
              <div className="border-t border-gray-100 my-1"></div>
              
              <button
                onClick={() => {
                  setShowMobileMenu(false)
                  logout()
                }}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
