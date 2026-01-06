'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import anime from 'animejs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface BillingSummary {
  overdue: number
  upcoming: number
  pendingAmount: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null)

  useEffect(() => {
    anime({
      targets: '.quick-action-card',
      scale: [0.9, 1],
      opacity: [0, 1],
      delay: anime.stagger(100),
      duration: 500,
      easing: 'easeOutQuart'
    })

    // Cargar resumen de cobranza
    loadBillingSummary()
  }, [])

  const loadBillingSummary = async () => {
    try {
      const response = await fetch('/api/invoices?summary=true')
      if (response.ok) {
        const data = await response.json()
        setBillingSummary(data)
      }
    } catch (error) {
      console.error('Error loading billing summary:', error)
    }
  }

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

              {/* Nuevo: Cobranza */}
              <button
                onClick={() => router.push('/admin/billing')}
                className="quick-action-card group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative"
              >
                {/* Badge de alertas */}
                {billingSummary && (billingSummary.overdue > 0 || billingSummary.upcoming > 0) && (
                  <div className="absolute -top-2 -right-2 flex gap-1">
                    {billingSummary.overdue > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                        {billingSummary.overdue} vencidas
                      </span>
                    )}
                    {billingSummary.upcoming > 0 && (
                      <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {billingSummary.upcoming} por vencer
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary-900 mb-2">
                      Cobranza
                    </h3>
                    <p className="text-sm text-secondary-600">
                      Gestionar pagos y cuotas
                    </p>
                    {billingSummary && billingSummary.pendingAmount > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-1">
                        S/ {billingSummary.pendingAmount.toFixed(2)} pendiente
                      </p>
                    )}
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
