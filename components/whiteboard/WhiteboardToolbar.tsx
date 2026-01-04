'use client'


interface WhiteboardToolbarProps {
  currentColor: string
  onColorChange: (color: string) => void
  currentSize: number
  onSizeChange: (size: number) => void
  currentTool: 'pen' | 'eraser'
  onToolChange: (tool: 'pen' | 'eraser') => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onExport: () => void
  onFullscreen: () => void
  onSave: () => void
  isSaving: boolean
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

export default function WhiteboardToolbar({
  currentColor,
  onColorChange,
  currentSize,
  onSizeChange,
  currentTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onFullscreen,
  onSave,
  isSaving
}: WhiteboardToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Herramientas */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
        <button
          onClick={() => onToolChange('pen')}
          className={`p-2 rounded-lg transition-all ${
            currentTool === 'pen'
              ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="Lápiz"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => onToolChange('eraser')}
          className={`p-2 rounded-lg transition-all ${
            currentTool === 'eraser'
              ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="Borrador"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Colores */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
        {COLORS.map(color => (
          <button
            key={color.value}
            onClick={() => onColorChange(color.value)}
            className={`w-7 h-7 rounded-full transition-all ${
              currentColor === color.value
                ? 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                : 'hover:scale-110'
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>

      {/* Tamaño */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
        {SIZES.map(size => (
          <button
            key={size.value}
            onClick={() => onSizeChange(size.value)}
            className={`p-2 rounded-lg transition-all flex items-center justify-center ${
              currentSize === size.value
                ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={size.name}
          >
            <div
              className="rounded-full bg-current"
              style={{ width: size.value, height: size.value }}
            />
          </button>
        ))}
      </div>

      {/* Deshacer/Rehacer */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-all ${
            canUndo
              ? 'hover:bg-gray-100 text-gray-600'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Deshacer (Ctrl+Z)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-all ${
            canRedo
              ? 'hover:bg-gray-100 text-gray-600'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Rehacer (Ctrl+Y)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
      </div>

      {/* Limpiar */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
        <button
          onClick={onClear}
          className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-all"
          title="Limpiar todo"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={onExport}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-all"
          title="Exportar como imagen"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button
          onClick={onFullscreen}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-all"
          title="Pantalla completa"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            isSaving
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
          title="Guardar pizarra"
        >
          {isSaving ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>Guardar</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
