'use client'

import { Geometry3DFigureType, GeometryMarkType } from '@/types'
import ToolbarSection from './ToolbarSection'

// Tipos de herramientas extendidos
export type DrawingTool = 'pen' | 'eraser' | 'select' | 'pan'
export type PenMode = 'free' | 'line' | 'arrow' | 'curveArrow'
export type Geometry2DTool = 'move' | 'segment' | 'scale' | 'angle' | 'mark' | 'area'
export type Geometry2DFigure = 'triangle' | 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'trapezoid' | 'circle'
export type Geometry3DTool = 'rotate' | 'move3d' | 'scale3d' | 'point' | 'segment3d' | 'area3d' | 'angle3d'

interface WhiteboardToolbarExpandedProps {
  // Herramientas de dibujo
  currentColor: string
  onColorChange: (color: string) => void
  currentSize: number
  onSizeChange: (size: number) => void
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  penMode: PenMode
  onPenModeChange: (mode: PenMode) => void
  
  // Geometría 2D
  geometry2DTool: Geometry2DTool
  onGeometry2DToolChange: (tool: Geometry2DTool) => void
  onAddGeometry2DFigure: (figure: Geometry2DFigure) => void
  geometry2DMarkType: GeometryMarkType
  onGeometry2DMarkTypeChange: (type: GeometryMarkType) => void
  areaColor: string
  onAreaColorChange: (color: string) => void
  
  // Geometría 3D
  geometry3DTool: Geometry3DTool
  onGeometry3DToolChange: (tool: Geometry3DTool) => void
  onAddGeometry3DFigure: (figure: Geometry3DFigureType) => void
  geometry3DColor: string
  onGeometry3DColorChange: (color: string) => void
  
  // Historial y acciones
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onExport: () => void
  onFullscreen: () => void
  onSave: () => void
  isSaving: boolean
  
  // Texto y fórmulas
  onAddText: () => void
  onAddFormula: () => void
}

const COLORS = [
  { name: 'Negro', value: '#000000' },
  { name: 'Rojo', value: '#ef4444' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Naranja', value: '#f97316' },
  { name: 'Morado', value: '#a855f7' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Amarillo', value: '#eab308' },
]

const SIZES = [
  { name: 'Fino', value: 4 },
  { name: 'Medio', value: 8 },
  { name: 'Grueso', value: 16 },
  { name: 'Extra', value: 24 },
]

const AREA_COLORS = [
  { name: 'Rosa', value: 'rgba(255, 209, 220, 0.5)' },
  { name: 'Verde', value: 'rgba(224, 251, 226, 0.5)' },
  { name: 'Lila', value: 'rgba(230, 230, 250, 0.5)' },
  { name: 'Cyan', value: 'rgba(178, 235, 242, 0.5)' },
  { name: 'Amarillo', value: 'rgba(255, 249, 227, 0.5)' },
  { name: 'Naranja', value: 'rgba(255, 218, 185, 0.5)' },
]

const GEOMETRY_2D_FIGURES: { icon: string; type: Geometry2DFigure; name: string }[] = [
  { icon: '△', type: 'triangle', name: 'Triángulo' },
  { icon: '□', type: 'square', name: 'Cuadrado' },
  { icon: '▭', type: 'rectangle', name: 'Rectángulo' },
  { icon: '◇', type: 'rhombus', name: 'Rombo' },
  { icon: '▱', type: 'parallelogram', name: 'Romboide' },
  { icon: '⏢', type: 'trapezoid', name: 'Trapecio' },
  { icon: '○', type: 'circle', name: 'Círculo' },
]

const GEOMETRY_3D_FIGURES: { icon: string; type: Geometry3DFigureType; name: string }[] = [
  { icon: '⬜', type: 'cube', name: 'Cubo' },
  { icon: '🔺', type: 'tetrahedron', name: 'Tetraedro' },
  { icon: '🔻', type: 'cone', name: 'Cono' },
  { icon: '⚪', type: 'sphere', name: 'Esfera' },
  { icon: '▲', type: 'pyramid', name: 'Pirámide' },
  { icon: '⬭', type: 'cylinder', name: 'Cilindro' },
  { icon: '▬', type: 'prism', name: 'Prisma' },
]

const MARK_TYPES: { icon: string; type: GeometryMarkType; name: string }[] = [
  { icon: '║', type: 'lines', name: 'Rayas dobles' },
  { icon: '●', type: 'circle', name: 'Punto central' },
  { icon: '━', type: 'thick', name: 'Línea gruesa' },
  { icon: '〰', type: 'zigzag', name: 'Zigzag' },
]

export default function WhiteboardToolbarExpanded({
  currentColor,
  onColorChange,
  currentSize,
  onSizeChange,
  currentTool,
  onToolChange,
  penMode,
  onPenModeChange,
  geometry2DTool,
  onGeometry2DToolChange,
  onAddGeometry2DFigure,
  geometry2DMarkType,
  onGeometry2DMarkTypeChange,
  areaColor,
  onAreaColorChange,
  geometry3DTool,
  onGeometry3DToolChange,
  onAddGeometry3DFigure,
  geometry3DColor,
  onGeometry3DColorChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onFullscreen,
  onSave,
  isSaving,
  onAddText,
  onAddFormula,
}: WhiteboardToolbarExpandedProps) {
  
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
      
      {/* Sección: Dibujo */}
      <ToolbarSection
        title="Dibujo"
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
        defaultOpen={true}
      >
        <div className="flex flex-col gap-3">
          {/* Herramientas principales */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onToolChange('pen'); onPenModeChange('free'); }}
              className={`p-2 rounded-lg transition-all ${currentTool === 'pen' && penMode === 'free' ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Lápiz libre"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button
              onClick={() => { onToolChange('pen'); onPenModeChange('line'); }}
              className={`p-2 rounded-lg transition-all ${currentTool === 'pen' && penMode === 'line' ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Línea recta"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" strokeWidth={2} strokeLinecap="round"/></svg>
            </button>
            <button
              onClick={() => { onToolChange('pen'); onPenModeChange('arrow'); }}
              className={`p-2 rounded-lg transition-all ${currentTool === 'pen' && penMode === 'arrow' ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Flecha recta"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="4" y1="20" x2="18" y2="6" strokeWidth={2} strokeLinecap="round"/><polyline points="10 4 20 4 20 14" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button
              onClick={() => { onToolChange('pen'); onPenModeChange('curveArrow'); }}
              className={`p-2 rounded-lg transition-all ${currentTool === 'pen' && penMode === 'curveArrow' ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Flecha curva"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6 Q4 18, 16 18" strokeWidth={2} strokeLinecap="round"/><path d="M12 14 L16 18 L12 22" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button
              onClick={() => onToolChange('eraser')}
              className={`p-2 rounded-lg transition-all ${currentTool === 'eraser' ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Borrador"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button
              onClick={() => onToolChange('select')}
              className={`p-2 rounded-lg transition-all ${currentTool === 'select' ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Selección"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
            </button>
            <button
              onClick={() => onToolChange('pan')}
              className={`p-2 rounded-lg transition-all ${currentTool === 'pan' ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Mover vista"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
            </button>
          </div>
          
          {/* Colores */}
          <div className="flex items-center gap-1">
            {COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => onColorChange(color.value)}
                className={`w-6 h-6 rounded-full transition-all ${currentColor === color.value ? 'ring-2 ring-offset-1 ring-primary-500 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
          
          {/* Grosor */}
          <div className="flex items-center gap-1">
            {SIZES.map(size => (
              <button
                key={size.value}
                onClick={() => onSizeChange(size.value)}
                className={`p-2 rounded-lg transition-all flex items-center justify-center ${currentSize === size.value ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' : 'hover:bg-gray-100 text-gray-600'}`}
                title={size.name}
              >
                <div className="rounded-full bg-current" style={{ width: size.value, height: size.value }} />
              </button>
            ))}
          </div>
        </div>
      </ToolbarSection>

      {/* Sección: Geometría 2D */}
      <ToolbarSection
        title="Geom 2D"
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="12,2 22,20 2,20" strokeWidth={2} strokeLinejoin="round"/></svg>}
      >
        <div className="flex flex-col gap-3">
          {/* Herramientas de edición */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onGeometry2DToolChange('move')}
              className={`p-2 rounded-lg transition-all ${geometry2DTool === 'move' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Mover puntos"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
            </button>
            <button
              onClick={() => onGeometry2DToolChange('segment')}
              className={`p-2 rounded-lg transition-all ${geometry2DTool === 'segment' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Segmento"
            >
              <span className="text-lg font-bold">•─•</span>
            </button>
            <button
              onClick={() => onGeometry2DToolChange('scale')}
              className={`p-2 rounded-lg transition-all ${geometry2DTool === 'scale' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Escalar figura"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
            <button
              onClick={() => onGeometry2DToolChange('angle')}
              className={`p-2 rounded-lg transition-all ${geometry2DTool === 'angle' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Ángulo"
            >
              <span className="text-lg font-bold">∠</span>
            </button>
            <button
              onClick={() => onGeometry2DToolChange('mark')}
              className={`p-2 rounded-lg transition-all ${geometry2DTool === 'mark' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Marcar igualdad"
            >
              <span className="text-lg font-bold">║</span>
            </button>
            <button
              onClick={() => onGeometry2DToolChange('area')}
              className={`p-2 rounded-lg transition-all ${geometry2DTool === 'area' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Pintar área"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" opacity="0.3"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
            </button>
          </div>
          
          {/* Tipos de marca (visible cuando mark está activo) */}
          {geometry2DTool === 'mark' && (
            <div className="flex items-center gap-1 border-t pt-2">
              {MARK_TYPES.map(mark => (
                <button
                  key={mark.type}
                  onClick={() => onGeometry2DMarkTypeChange(mark.type)}
                  className={`p-2 rounded-lg transition-all ${geometry2DMarkType === mark.type ? 'bg-red-100 text-red-700 ring-2 ring-red-500' : 'hover:bg-gray-100 text-gray-600'}`}
                  title={mark.name}
                >
                  <span className="text-lg">{mark.icon}</span>
                </button>
              ))}
            </div>
          )}
          
          {/* Colores de área (visible cuando area está activo) */}
          {geometry2DTool === 'area' && (
            <div className="flex items-center gap-1 border-t pt-2">
              {AREA_COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => onAreaColorChange(color.value)}
                  className={`w-6 h-6 rounded-full transition-all border-2 ${areaColor === color.value ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : 'hover:scale-110 border-gray-300'}`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          )}
          
          {/* Figuras 2D */}
          <div className="flex items-center gap-1 border-t pt-2">
            {GEOMETRY_2D_FIGURES.map(figure => (
              <button
                key={figure.type}
                onClick={() => onAddGeometry2DFigure(figure.type)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all"
                title={figure.name}
              >
                <span className="text-xl">{figure.icon}</span>
              </button>
            ))}
          </div>
        </div>
      </ToolbarSection>

      {/* Sección: Geometría 3D */}
      <ToolbarSection
        title="Geom 3D"
        icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>}
      >
        <div className="flex flex-col gap-3">
          {/* Herramientas de navegación 3D */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onGeometry3DToolChange('rotate')}
              className={`p-2 rounded-lg transition-all ${geometry3DTool === 'rotate' ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Girar"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button
              onClick={() => onGeometry3DToolChange('move3d')}
              className={`p-2 rounded-lg transition-all ${geometry3DTool === 'move3d' ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Mover"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
            </button>
            <button
              onClick={() => onGeometry3DToolChange('scale3d')}
              className={`p-2 rounded-lg transition-all ${geometry3DTool === 'scale3d' ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Escalar"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
          </div>
          
          {/* Herramientas de construcción 3D */}
          <div className="flex items-center gap-1 border-t pt-2">
            <button
              onClick={() => onGeometry3DToolChange('point')}
              className={`p-2 rounded-lg transition-all ${geometry3DTool === 'point' ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Agregar punto"
            >
              <span className="text-lg font-bold">•</span>
            </button>
            <button
              onClick={() => onGeometry3DToolChange('segment3d')}
              className={`p-2 rounded-lg transition-all ${geometry3DTool === 'segment3d' ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Segmento 3D"
            >
              <span className="text-lg font-bold">•─•</span>
            </button>
            <button
              onClick={() => onGeometry3DToolChange('area3d')}
              className={`p-2 rounded-lg transition-all ${geometry3DTool === 'area3d' ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Área 3D"
            >
              <span className="text-lg font-bold">▲</span>
            </button>
            <button
              onClick={() => onGeometry3DToolChange('angle3d')}
              className={`p-2 rounded-lg transition-all ${geometry3DTool === 'angle3d' ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500' : 'hover:bg-gray-100 text-gray-600'}`}
              title="Ángulo 3D"
            >
              <span className="text-lg font-bold">∠</span>
            </button>
          </div>
          
          {/* Colores 3D */}
          <div className="flex items-center gap-1 border-t pt-2">
            {[{ color: '#f1c40f', name: 'Amarillo' }, { color: '#e74c3c', name: 'Rojo' }, { color: '#2ecc71', name: 'Verde' }].map(c => (
              <button
                key={c.color}
                onClick={() => onGeometry3DColorChange(c.color)}
                className={`w-6 h-6 rounded-full transition-all ${geometry3DColor === c.color ? 'ring-2 ring-offset-1 ring-purple-500 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c.color }}
                title={c.name}
              />
            ))}
          </div>
          
          {/* Figuras 3D */}
          <div className="flex items-center gap-1 border-t pt-2">
            {GEOMETRY_3D_FIGURES.map(figure => (
              <button
                key={figure.type}
                onClick={() => onAddGeometry3DFigure(figure.type)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all"
                title={figure.name}
              >
                <span className="text-xl">{figure.icon}</span>
              </button>
            ))}
          </div>
        </div>
      </ToolbarSection>

      {/* Sección: Texto y Fórmulas */}
      <ToolbarSection
        title="Texto"
        icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onAddText}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all"
            title="Agregar texto"
          >
            <span className="text-lg font-serif font-bold">T</span>
            <span className="text-sm">Texto</span>
          </button>
          <button
            onClick={onAddFormula}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-all"
            title="Agregar fórmula"
          >
            <span className="text-lg font-serif italic">f(x)</span>
            <span className="text-sm">Fórmula</span>
          </button>
        </div>
      </ToolbarSection>

      {/* Separador */}
      <div className="h-8 w-px bg-gray-200 mx-1" />

      {/* Deshacer/Rehacer */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-all ${canUndo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
          title="Deshacer (Ctrl+Z)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-all ${canRedo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
          title="Rehacer (Ctrl+Y)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
        </button>
      </div>

      {/* Limpiar */}
      <button
        onClick={onClear}
        className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-all"
        title="Limpiar todo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>

      {/* Acciones (al final) */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={onExport}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-all"
          title="Exportar como imagen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </button>
        <button
          onClick={onFullscreen}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-all"
          title="Pantalla completa"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isSaving ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
          title="Guardar pizarra"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              <span className="text-sm">Guardando...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              <span className="text-sm">Guardar</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
