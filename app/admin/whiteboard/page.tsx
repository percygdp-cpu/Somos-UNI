'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import anime from 'animejs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface WhiteboardItem {
  id: string
  title: string
  thumbnail?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export default function WhiteboardListPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [whiteboards, setWhiteboards] = useState<WhiteboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchWhiteboards()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    anime({
      targets: '.whiteboard-card',
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(100),
      easing: 'easeOutQuad',
      duration: 500
    })
  }, [whiteboards])

  const fetchWhiteboards = async () => {
    try {
      const response = await fetch(`/api/whiteboard?userId=${user?.id}`)
      if (response.ok) {
        const data = await response.json()
        setWhiteboards(data)
      }
    } catch (error) {
      console.error('Error fetching whiteboards:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = async () => {
    if (!newTitle.trim() || !user) return

    setCreating(true)
    try {
      const response = await fetch('/api/whiteboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          createdBy: user.id,
          content: { strokes: [], formulas: [] }
        })
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/admin/whiteboard/${data.id}`)
      }
    } catch (error) {
      console.error('Error creating whiteboard:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta pizarra?')) return

    setDeleting(id)
    try {
      const response = await fetch(`/api/whiteboard?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setWhiteboards(prev => prev.filter(w => w.id !== id))
      }
    } catch (error) {
      console.error('Error deleting whiteboard:', error)
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
        <AdminHeader />
        
        <div className="flex-1 container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🎨 Pizarras Digitales</h1>
              <p className="text-gray-600 mt-1">Crea y gestiona tus pizarras para proyectar en clase</p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Pizarra
            </button>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="w-10 h-10 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : whiteboards.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No tienes pizarras aún</h3>
              <p className="text-gray-500 mb-6">Crea tu primera pizarra para empezar a proyectar en clase</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear Primera Pizarra
              </button>
            </div>
          ) : (
            /* Grid de pizarras */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {whiteboards.map(whiteboard => (
                <div
                  key={whiteboard.id}
                  className="whiteboard-card bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden group"
                >
                  {/* Thumbnail */}
                  <div
                    onClick={() => router.push(`/admin/whiteboard/${whiteboard.id}`)}
                    className="aspect-video bg-gray-100 flex items-center justify-center cursor-pointer relative overflow-hidden"
                  >
                    {whiteboard.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={whiteboard.thumbnail}
                        alt={whiteboard.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-gray-700 transition-all">
                        Abrir
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 truncate">{whiteboard.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Actualizado: {formatDate(whiteboard.updatedAt)}
                    </p>
                    <div className="flex items-center justify-end mt-3 gap-2">
                      <button
                        onClick={() => router.push(`/admin/whiteboard/${whiteboard.id}`)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                        title="Editar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(whiteboard.id)}
                        disabled={deleting === whiteboard.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deleting === whiteboard.id ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Nueva Pizarra */}
        {showNewModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Nueva Pizarra</h2>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Nombre de la pizarra..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowNewModal(false)
                    setNewTitle('')
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateNew}
                  disabled={!newTitle.trim() || creating}
                  className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creando...
                    </>
                  ) : (
                    'Crear'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
