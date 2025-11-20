'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import anime from 'animejs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminDashboard() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    anime({
      targets: '.quick-action-card',
      scale: [0.9, 1],
      opacity: [0, 1],
      delay: anime.stagger(100),
      duration: 500,
      easing: 'easeOutQuart'
    })
  }, [])

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
        <AdminHeader />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-5xl">
            {/* Bienvenida */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-secondary-900 mb-3">
                ¡Hola, {user?.username}!
              </h1>
              <p className="text-lg text-secondary-600">
                ¿Qué deseas hacer hoy?
              </p>
            </div>

            {/* Acciones Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => router.push('/admin/users?tab=students')}
                className="quick-action-card group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary-900 mb-2">
                      Estudiantes
                    </h3>
                    <p className="text-sm text-secondary-600">
                      Gestionar usuarios y permisos
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/users?tab=courses')}
                className="quick-action-card group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
                      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary-900 mb-2">
                      Cursos
                    </h3>
                    <p className="text-sm text-secondary-600">
                      Crear y administrar contenido
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/analytics')}
                className="quick-action-card group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary-900 mb-2">
                      Analytics
                    </h3>
                    <p className="text-sm text-secondary-600">
                      Ver estadísticas y reportes
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
