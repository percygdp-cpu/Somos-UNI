'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function WhiteboardEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  useEffect(() => {
    // Redirigir a la vista multi con el ID de la pizarra
    if (id && id !== 'new') {
      router.replace(`/admin/whiteboard/multi?id=${id}`)
    } else {
      // Si es nueva, ir a multi sin ID
      router.replace('/admin/whiteboard/multi')
    }
  }, [id, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <svg className="w-10 h-10 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-gray-500">Redirigiendo...</span>
      </div>
    </div>
  )
}
