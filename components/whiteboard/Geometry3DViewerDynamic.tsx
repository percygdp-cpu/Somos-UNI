'use client'

import { Geometry3DObject } from '@/types'
import dynamic from 'next/dynamic'

// Componente de carga mientras se importa Three.js
const LoadingViewer = () => (
  <div className="absolute border-2 border-dashed border-purple-400 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center"
    style={{ width: 300, height: 300 }}
  >
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
      <p className="text-sm text-gray-500">Cargando visor 3D...</p>
    </div>
  </div>
)

// Importar Geometry3DViewer dinámicamente (sin SSR porque usa Three.js)
const Geometry3DViewer = dynamic(
  () => import('./Geometry3DViewer'),
  {
    ssr: false,
    loading: () => <LoadingViewer />
  }
)

interface Geometry3DViewerDynamicProps {
  object: Geometry3DObject
  onObjectChange: (object: Geometry3DObject) => void
  tool: 'rotate' | 'move3d' | 'scale3d' | 'point' | 'segment3d' | 'area3d' | 'angle3d'
  selectedColor: string
  onRemove?: () => void
}

export default function Geometry3DViewerDynamic(props: Geometry3DViewerDynamicProps) {
  return <Geometry3DViewer {...props} />
}

// Re-exportar la función de creación (esta no necesita Three.js)
export { createGeometry3DObject } from './Geometry3DViewer'
