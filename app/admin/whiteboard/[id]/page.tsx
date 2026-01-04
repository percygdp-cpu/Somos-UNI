'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import WhiteboardCanvas, { WhiteboardCanvasRef } from '@/components/whiteboard/WhiteboardCanvas'
import { WhiteboardContent, WhiteboardFormula, WhiteboardTextBox } from '@/types'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

// Colores disponibles
const COLORS = [
  { name: 'Negro', value: '#000000' },
  { name: 'Rojo', value: '#ef4444' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Naranja', value: '#f97316' },
  { name: 'Morado', value: '#a855f7' },
]

// Grosores
const SIZES = [
  { name: 'Muy fino', value: 2 },
  { name: 'Fino', value: 4 },
  { name: 'Medio', value: 8 },
  { name: 'Grueso', value: 16 },
  { name: 'Muy grueso', value: 24 },
  { name: 'Extra grueso', value: 32 },
]

export default function WhiteboardEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const canvasRef = useRef<WhiteboardCanvasRef>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState<WhiteboardContent>({ strokes: [], formulas: [] })
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Herramientas
  const [currentColor, setCurrentColor] = useState('#000000')
  const [currentSize, setCurrentSize] = useState(8)
  const [currentTool, setCurrentTool] = useState<'select' | 'pen' | 'eraser' | 'text' | 'formula'>('pen')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Modal de texto
  const [showTextModal, setShowTextModal] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textFontSize, setTextFontSize] = useState(24)
  const [textFontFamily, setTextFontFamily] = useState('Arial')
  const [textBold, setTextBold] = useState(false)
  const [textItalic, setTextItalic] = useState(false)
  const [textUnderline, setTextUnderline] = useState(false)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left')
  const [textBgColor, setTextBgColor] = useState('transparent')
  const [editingTextId, setEditingTextId] = useState<string | null>(null)

  // Modal de fórmula
  const [showFormulaModal, setShowFormulaModal] = useState(false)
  const [formulaInput, setFormulaInput] = useState('')
  const [formulaPreview, setFormulaPreview] = useState('')
  const [formulaError, setFormulaError] = useState('')
  const [formulaScale, setFormulaScale] = useState(1.5)
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null)

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Dropdowns de herramientas
  const [showPenSizes, setShowPenSizes] = useState(false)
  const [showEraserSizes, setShowEraserSizes] = useState(false)

  // Drag para mover elementos
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Selección múltiple (puede incluir strokes, text, formula)
  const [selectedElements, setSelectedElements] = useState<Array<{ type: 'stroke' | 'text' | 'formula'; id: string }>>([])
  // Ref sincrónico para acceso inmediato en handlers de drag
  const selectedElementsRef = useRef<Array<{ type: 'stroke' | 'text' | 'formula'; id: string }>>([])
  
  // Mantener ref sincronizado con state
  useEffect(() => {
    selectedElementsRef.current = selectedElements
  }, [selectedElements])

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.pen-dropdown') && !target.closest('.eraser-dropdown')) {
        setShowPenSizes(false)
        setShowEraserSizes(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const [resizing, setResizing] = useState<{ corner: string; startX: number; startY: number; startScale: number } | null>(null)

  // Para selección por área (marquee)
  const [selectingArea, setSelectingArea] = useState(false)
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null)

  // Cargar pizarra
  useEffect(() => {
    const fetchWhiteboard = async () => {
      if (!params.id || params.id === 'new') {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/whiteboard?id=${params.id}`)
        if (response.ok) {
          const data = await response.json()
          setTitle(data.title)
          setContent(data.content || { strokes: [], formulas: [] })
        } else {
          router.push('/admin/whiteboard')
        }
      } catch (error) {
        console.error('Error fetching whiteboard:', error)
        router.push('/admin/whiteboard')
      } finally {
        setLoading(false)
      }
    }

    fetchWhiteboard()
  }, [params.id, router])

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete para eliminar seleccionados
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElements.length > 0 && !showTextModal && !showFormulaModal) {
          e.preventDefault()
          deleteSelectedElements()
        }
      }
      // Escape para deseleccionar
      if (e.key === 'Escape') {
        setSelectedElements([])
      }
      // Ctrl+A para seleccionar todo
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && currentTool === 'select') {
        e.preventDefault()
        selectAll()
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          if (e.shiftKey) {
            canvasRef.current?.redo()
          } else {
            canvasRef.current?.undo()
          }
        } else if (e.key === 'y') {
          e.preventDefault()
          canvasRef.current?.redo()
        } else if (e.key === 's') {
          e.preventDefault()
          handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title, selectedElements, currentTool, showTextModal, showFormulaModal])

  // Detectar cambios de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Funciones de selección
  const isElementSelected = (type: 'stroke' | 'text' | 'formula', id: string) => {
    return selectedElements.some(el => el.type === type && el.id === id)
  }

  const toggleSelection = (type: 'stroke' | 'text' | 'formula', id: string, addToSelection: boolean) => {
    if (addToSelection) {
      // Shift+clic: añadir/quitar de selección
      if (isElementSelected(type, id)) {
        setSelectedElements(prev => prev.filter(el => !(el.type === type && el.id === id)))
      } else {
        setSelectedElements(prev => [...prev, { type, id }])
      }
    } else {
      // Clic normal: seleccionar solo este
      setSelectedElements([{ type, id }])
    }
  }

  const selectAll = () => {
    const all: Array<{ type: 'stroke' | 'text' | 'formula'; id: string }> = []
    content.strokes.forEach(s => all.push({ type: 'stroke', id: s.id }))
    ;(content.textBoxes || []).forEach(t => all.push({ type: 'text', id: t.id }))
    ;(content.formulas || []).forEach(f => all.push({ type: 'formula', id: f.id }))
    setSelectedElements(all)
  }

  const deleteSelectedElements = () => {
    setContent(prev => ({
      strokes: prev.strokes.filter(s => !isElementSelected('stroke', s.id)),
      textBoxes: (prev.textBoxes || []).filter(t => !isElementSelected('text', t.id)),
      formulas: (prev.formulas || []).filter(f => !isElementSelected('formula', f.id)),
    }))
    setSelectedElements([])
  }

  // Detectar clic en trazo (hit detection)
  const getStrokeAtPoint = (x: number, y: number): string | null => {
    // Revisar trazos de atrás hacia adelante (último dibujado primero)
    for (let i = content.strokes.length - 1; i >= 0; i--) {
      const stroke = content.strokes[i]
      for (const point of stroke.points) {
        const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2))
        if (distance < stroke.size + 5) { // margen de tolerancia
          return stroke.id
        }
      }
    }
    return null
  }

  const handleHistoryChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo)
    setCanRedo(redo)
  }, [])

  const handleSave = async () => {
    if (!params.id || !user) return

    setIsSaving(true)
    try {
      // Generar thumbnail
      const thumbnail = canvasRef.current?.exportImage() || undefined

      const response = await fetch('/api/whiteboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: params.id,
          title,
          content,
          thumbnail
        })
      })

      if (response.ok) {
        setLastSaved(new Date())
      }
    } catch (error) {
      console.error('Error saving whiteboard:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = () => {
    const dataUrl = canvasRef.current?.exportImage()
    if (!dataUrl) return

    const link = document.createElement('a')
    link.download = `${title || 'pizarra'}.png`
    link.href = dataUrl
    link.click()
  }

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  // Manejar agregar/editar texto
  const handleAddText = () => {
    setTextInput('')
    setTextFontSize(24)
    setTextFontFamily('Arial')
    setTextBold(false)
    setTextItalic(false)
    setTextUnderline(false)
    setTextAlign('left')
    setTextBgColor('transparent')
    setEditingTextId(null)
    setShowTextModal(true)
  }

  const handleSaveText = () => {
    if (!textInput.trim()) return

    // Mantener posición si estamos editando
    const existingText = editingTextId 
      ? (content.textBoxes || []).find(t => t.id === editingTextId)
      : null

    const newTextBox: WhiteboardTextBox = {
      id: editingTextId || `text-${Date.now()}`,
      text: textInput,
      x: existingText?.x || 100,
      y: existingText?.y || 100,
      fontSize: textFontSize,
      color: currentColor,
      fontFamily: textFontFamily,
      bold: textBold,
      italic: textItalic,
      underline: textUnderline,
      align: textAlign,
      backgroundColor: textBgColor !== 'transparent' ? textBgColor : undefined,
    }

    if (editingTextId) {
      // Editar existente
      setContent(prev => ({
        ...prev,
        textBoxes: (prev.textBoxes || []).map(t => 
          t.id === editingTextId ? newTextBox : t
        )
      }))
    } else {
      // Agregar nuevo
      setContent(prev => ({
        ...prev,
        textBoxes: [...(prev.textBoxes || []), newTextBox]
      }))
    }

    setShowTextModal(false)
    setTextInput('')
    setEditingTextId(null)
  }

  // Manejar agregar/editar fórmula
  const handleAddFormula = () => {
    setFormulaInput('')
    setFormulaPreview('')
    setFormulaError('')
    setFormulaScale(1.5)
    setEditingFormulaId(null)
    setShowFormulaModal(true)
  }

  const handleFormulaChange = (latex: string) => {
    setFormulaInput(latex)
    try {
      const html = katex.renderToString(latex, { throwOnError: true, displayMode: true })
      setFormulaPreview(html)
      setFormulaError('')
    } catch (err) {
      setFormulaError('Fórmula inválida')
      setFormulaPreview('')
    }
  }

  const handleSaveFormula = () => {
    if (!formulaInput.trim() || formulaError) return

    // Si estamos editando, mantener la posición original
    const existingFormula = editingFormulaId 
      ? (content.formulas || []).find(f => f.id === editingFormulaId)
      : null

    const newFormula: WhiteboardFormula = {
      id: editingFormulaId || `formula-${Date.now()}`,
      latex: formulaInput,
      x: existingFormula?.x || 100,
      y: existingFormula?.y || 200,
      scale: formulaScale,
    }

    if (editingFormulaId) {
      setContent(prev => ({
        ...prev,
        formulas: (prev.formulas || []).map(f => 
          f.id === editingFormulaId ? newFormula : f
        )
      }))
    } else {
      setContent(prev => ({
        ...prev,
        formulas: [...(prev.formulas || []), newFormula]
      }))
    }

    setShowFormulaModal(false)
    setFormulaInput('')
    setEditingFormulaId(null)
  }

  // Funciones para arrastrar elementos (múltiples)
  const handleDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    type: 'stroke' | 'text' | 'formula',
    id: string
  ) => {
    e.stopPropagation()
    // NO usar preventDefault aquí para permitir doble clic
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const isShift = 'shiftKey' in e ? e.shiftKey : false
    
    const container = canvasContainerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const startPos = {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
    
    // Lógica de selección profesional:
    // 1. Si el elemento YA está seleccionado → iniciar arrastre de TODOS los seleccionados
    // 2. Si NO está seleccionado + Shift → añadir a selección e iniciar arrastre
    // 3. Si NO está seleccionado sin Shift → seleccionar SOLO este e iniciar arrastre
    
    let newSelection: Array<{ type: 'stroke' | 'text' | 'formula'; id: string }>
    
    if (isElementSelected(type, id)) {
      // Caso 1: Ya seleccionado, mantener selección actual
      newSelection = selectedElements
    } else if (isShift) {
      // Caso 2: Añadir a la selección existente
      newSelection = [...selectedElements, { type, id }]
    } else {
      // Caso 3: Seleccionar solo este elemento
      newSelection = [{ type, id }]
    }
    
    // Actualizar tanto state como ref inmediatamente
    setSelectedElements(newSelection)
    selectedElementsRef.current = newSelection
    setDragStart(startPos)
    setDragging(true)
  }

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    const container = canvasContainerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const currentX = clientX - rect.left
    const currentY = clientY - rect.top

    // Selección por área (marquee)
    if (selectingArea && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, endX: currentX, endY: currentY } : null)
      return
    }
    
    // Mover elementos seleccionados (usar ref para acceso sincrónico)
    const currentSelection = selectedElementsRef.current
    if (!dragging || currentSelection.length === 0) return
    e.preventDefault()
    
    const deltaX = currentX - dragStart.x
    const deltaY = currentY - dragStart.y
    
    if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) return
    
    // Helper local para verificar selección usando el ref
    const isSelected = (type: 'stroke' | 'text' | 'formula', id: string) => 
      currentSelection.some(el => el.type === type && el.id === id)
    
    setContent(prev => ({
      strokes: prev.strokes.map(s => 
        isSelected('stroke', s.id) 
          ? { ...s, points: s.points.map(p => ({ ...p, x: p.x + deltaX, y: p.y + deltaY })) }
          : s
      ),
      textBoxes: (prev.textBoxes || []).map(t =>
        isSelected('text', t.id) ? { ...t, x: t.x + deltaX, y: t.y + deltaY } : t
      ),
      formulas: (prev.formulas || []).map(f =>
        isSelected('formula', f.id) ? { ...f, x: f.x + deltaX, y: f.y + deltaY } : f
      ),
    }))
    
    setDragStart({ x: currentX, y: currentY })
  }

  const handleDragEnd = () => {
    // Finalizar selección por área
    if (selectingArea && selectionBox) {
      const minX = Math.min(selectionBox.startX, selectionBox.endX)
      const maxX = Math.max(selectionBox.startX, selectionBox.endX)
      const minY = Math.min(selectionBox.startY, selectionBox.endY)
      const maxY = Math.max(selectionBox.startY, selectionBox.endY)
      
      const newSelection: Array<{ type: 'stroke' | 'text' | 'formula'; id: string }> = []
      
      // Seleccionar trazos que intersecten
      content.strokes.forEach(stroke => {
        for (const point of stroke.points) {
          if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
            newSelection.push({ type: 'stroke', id: stroke.id })
            break
          }
        }
      })
      
      // Seleccionar textos que intersecten
      ;(content.textBoxes || []).forEach(text => {
        if (text.x >= minX && text.x <= maxX && text.y >= minY && text.y <= maxY) {
          newSelection.push({ type: 'text', id: text.id })
        }
      })
      
      // Seleccionar fórmulas que intersecten
      ;(content.formulas || []).forEach(formula => {
        if (formula.x >= minX && formula.x <= maxX && formula.y >= minY && formula.y <= maxY) {
          newSelection.push({ type: 'formula', id: formula.id })
        }
      })
      
      // Actualizar tanto state como ref
      setSelectedElements(newSelection)
      selectedElementsRef.current = newSelection
      setSelectingArea(false)
      setSelectionBox(null)
    }
    
    setDragging(false)
  }

  // Clic en canvas para seleccionar trazos o iniciar selección por área
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (currentTool !== 'select') return
    
    const container = canvasContainerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Verificar si clic en un trazo
    const strokeId = getStrokeAtPoint(x, y)
    if (strokeId) {
      // Aplicar la misma lógica profesional que en handleDragStart
      let newSelection: Array<{ type: 'stroke' | 'text' | 'formula'; id: string }>
      
      if (isElementSelected('stroke', strokeId)) {
        // Ya seleccionado, mantener selección actual
        newSelection = selectedElements
      } else if (e.shiftKey) {
        // Añadir a la selección existente
        newSelection = [...selectedElements, { type: 'stroke', id: strokeId }]
      } else {
        // Seleccionar solo este trazo
        newSelection = [{ type: 'stroke', id: strokeId }]
      }
      
      // Actualizar tanto state como ref inmediatamente
      setSelectedElements(newSelection)
      selectedElementsRef.current = newSelection
      setDragStart({ x, y })
      setDragging(true)
    } else {
      // Iniciar selección por área (solo si no hay nada debajo)
      if (!e.shiftKey) {
        setSelectedElements([])
        selectedElementsRef.current = []
      }
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y })
      setSelectingArea(true)
    }
  }

  // Funciones para redimensionar
  const handleResizeStart = (
    e: React.MouseEvent | React.TouchEvent,
    corner: string,
    currentScale: number
  ) => {
    e.stopPropagation()
    e.preventDefault()
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    setResizing({
      corner,
      startX: clientX,
      startY: clientY,
      startScale: currentScale
    })
  }

  const handleResizeMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!resizing || selectedElements.length !== 1) return
    e.preventDefault()
    
    const selected = selectedElements[0]
    if (selected.type === 'stroke') return // No redimensionar trazos
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    // Calcular delta desde el inicio
    const deltaX = clientX - resizing.startX
    const deltaY = clientY - resizing.startY
    
    // Usar el mayor delta para escalar proporcionalmente
    const delta = Math.max(deltaX, deltaY)
    const scaleFactor = delta / 100 // 100px = 1x de escala
    
    const newScale = Math.max(0.5, Math.min(4, resizing.startScale + scaleFactor))
    
    if (selected.type === 'text') {
      // Para texto, ajustar fontSize
      const baseSize = 24
      const newFontSize = Math.round(baseSize * newScale)
      setContent(prev => ({
        ...prev,
        textBoxes: (prev.textBoxes || []).map(t =>
          t.id === selected.id ? { ...t, fontSize: Math.max(12, Math.min(96, newFontSize)) } : t
        )
      }))
    } else if (selected.type === 'formula') {
      // Para fórmulas, ajustar scale
      setContent(prev => ({
        ...prev,
        formulas: (prev.formulas || []).map(f =>
          f.id === selected.id ? { ...f, scale: newScale } : f
        )
      }))
    }
  }

  const handleResizeEnd = () => {
    setResizing(null)
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <svg className="w-10 h-10 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div
        ref={containerRef}
        className={`min-h-screen flex flex-col ${isFullscreen ? 'bg-white' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}
      >
        {!isFullscreen && <AdminHeader />}

        <div className="flex-1 container mx-auto px-4 py-4 flex flex-col gap-4" style={{ minHeight: 'calc(100vh - 100px)' }}>
          {/* Header con título y acciones */}
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => router.push('/admin/whiteboard')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              title="Volver"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la pizarra..."
              className="flex-1 min-w-[200px] text-xl font-semibold bg-transparent border-b-2 border-transparent focus:border-primary-500 outline-none px-2 py-1"
            />
            {lastSaved && (
              <span className="text-xs text-gray-400">
                Guardado: {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {/* Toolbar simplificada */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
            {/* Herramientas de dibujo */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => { setCurrentTool('select'); setSelectedElements([]); }}
                className={`p-2 rounded-lg transition-all ${currentTool === 'select' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title="Seleccionar (mover y redimensionar elementos)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </button>
              
              {/* Lápiz con tamaño */}
              <div className="relative pen-dropdown">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentTool('pen')
                    setShowPenSizes(!showPenSizes)
                    setShowEraserSizes(false)
                  }}
                  className={`p-2 rounded-lg transition-all flex items-center gap-1 ${currentTool === 'pen' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Lápiz"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPenSizes && currentTool === 'pen' && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-2 z-20 flex flex-wrap items-center gap-1 w-48">
                    {SIZES.map(size => (
                      <button
                        key={size.value}
                        onClick={() => {
                          setCurrentSize(size.value)
                          setShowPenSizes(false)
                        }}
                        className={`flex items-center justify-center w-7 h-7 rounded transition-all ${
                          currentSize === size.value ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'
                        }`}
                        title={size.name}
                      >
                        <span 
                          className="rounded-full"
                          style={{ 
                            width: Math.min(size.value/1.5, 18), 
                            height: Math.min(size.value/1.5, 18),
                            backgroundColor: currentColor 
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Borrador con tamaño */}
              <div className="relative eraser-dropdown">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentTool('eraser')
                    setShowEraserSizes(!showEraserSizes)
                    setShowPenSizes(false)
                  }}
                  className={`p-2 rounded-lg transition-all flex items-center gap-1 ${currentTool === 'eraser' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Borrador"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20H7L3 16c-.6-.6-.6-1.5 0-2.1l10-10c.6-.6 1.5-.6 2.1 0l6 6c.6.6.6 1.5 0 2.1L13 20" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 11l7 7" />
                  </svg>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showEraserSizes && currentTool === 'eraser' && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-2 z-20 flex flex-wrap items-center gap-1 w-48">
                    {SIZES.map(size => (
                      <button
                        key={size.value}
                        onClick={() => {
                          setCurrentSize(size.value)
                          setShowEraserSizes(false)
                        }}
                        className={`flex items-center justify-center w-7 h-7 rounded transition-all ${
                          currentSize === size.value ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'
                        }`}
                        title={size.name}
                      >
                        <span 
                          className="rounded-full bg-gray-400"
                          style={{ 
                            width: Math.min(size.value/1.5, 18), 
                            height: Math.min(size.value/1.5, 18),
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="w-px h-8 bg-gray-300" />

            {/* Texto y Fórmulas */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={handleAddText}
                className="p-2 rounded-lg transition-all hover:bg-gray-200"
                title="Agregar texto"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <text x="7" y="18" fontSize="18" fontWeight="bold">T</text>
                </svg>
              </button>
              <button
                onClick={handleAddFormula}
                className="p-2 rounded-lg transition-all hover:bg-gray-200"
                title="Agregar fórmula matemática"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <text x="4" y="17" fontSize="14" fontWeight="bold" fontStyle="italic">fx</text>
                </svg>
              </button>
            </div>

            <div className="w-px h-8 bg-gray-300" />

            {/* Colores (solo visible cuando herramienta es pen) */}
            {currentTool === 'pen' && (
              <div className="flex items-center gap-2">
                {COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setCurrentColor(color.value)}
                    className={`w-7 h-7 rounded-full transition-all border-2 ${
                      currentColor === color.value 
                        ? 'border-primary-500 scale-110 shadow-md' 
                        : 'border-gray-200 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            )}

            {/* Colores siempre visibles pero colapsados cuando no es pen */}
            {currentTool !== 'pen' && (
              <div className="flex items-center gap-1">
                <div 
                  className="w-7 h-7 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: currentColor }}
                  title={`Color actual: ${currentColor}`}
                />
              </div>
            )}

            <div className="w-px h-8 bg-gray-300" />

            {/* Acciones */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => canvasRef.current?.undo()}
                disabled={!canUndo}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
                title="Deshacer (Ctrl+Z)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={() => canvasRef.current?.redo()}
                disabled={!canRedo}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
                title="Rehacer (Ctrl+Y)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
              <button
                onClick={() => canvasRef.current?.clear()}
                className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-all"
                title="Limpiar todo (nueva página)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v4M10 13h4" transform="rotate(45 12 13)" />
                </svg>
              </button>
            </div>

            {/* Indicador de selección */}
            {selectedElements.length > 0 && (
              <>
                <div className="w-px h-8 bg-gray-300" />
                <div className="flex items-center gap-2 bg-primary-50 px-3 py-1 rounded-lg">
                  <span className="text-sm text-primary-700 font-medium">
                    {selectedElements.length} seleccionado{selectedElements.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={deleteSelectedElements}
                    className="p-1 rounded hover:bg-red-100 text-red-500 transition-all"
                    title="Eliminar seleccionados (Delete)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setSelectedElements([])}
                    className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-all"
                    title="Deseleccionar (Escape)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2z" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            <div className="flex-1" />

            {/* Botones especiales */}
            <button
              onClick={handleExport}
              className="p-2 rounded-lg hover:bg-gray-100 transition-all"
              title="Exportar como imagen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={handleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-100 transition-all"
              title="Pantalla completa"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>

          {/* Canvas (ocupa todo el espacio restante) */}
          <div 
            ref={canvasContainerRef}
            className="flex-1 relative" 
            style={{ minHeight: '500px' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={(e) => { handleDragMove(e); handleResizeMove(e); }}
            onMouseUp={() => { handleDragEnd(); handleResizeEnd(); }}
            onMouseLeave={() => { handleDragEnd(); handleResizeEnd(); }}
            onTouchMove={(e) => { handleDragMove(e); handleResizeMove(e); }}
            onTouchEnd={() => { handleDragEnd(); handleResizeEnd(); }}
          >
            <WhiteboardCanvas
              ref={canvasRef}
              content={content}
              onContentChange={setContent}
              currentColor={currentColor}
              currentSize={currentSize}
              currentTool={currentTool}
              onHistoryChange={handleHistoryChange}
            />
            
            {/* Renderizar textos sobre el canvas */}
            {(content.textBoxes || []).map(textBox => {
              const isSelected = isElementSelected('text', textBox.id)
              return (
                <div
                  key={textBox.id}
                  className={`absolute select-none rounded px-2 py-1 ${
                    isSelected
                      ? 'ring-2 ring-primary-500 z-10'
                      : 'cursor-grab hover:ring-2 hover:ring-primary-300'
                  }`}
                  style={{
                    left: textBox.x,
                    top: textBox.y,
                    fontSize: textBox.fontSize,
                    color: textBox.color,
                    fontFamily: textBox.fontFamily || 'Arial, sans-serif',
                    fontWeight: textBox.bold ? 'bold' : 'normal',
                    fontStyle: textBox.italic ? 'italic' : 'normal',
                    textDecoration: textBox.underline ? 'underline' : 'none',
                    textAlign: textBox.align || 'left',
                    backgroundColor: textBox.backgroundColor || 'transparent',
                    cursor: isSelected ? 'grab' : 'pointer',
                    whiteSpace: 'pre-wrap',
                    minWidth: '20px',
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    if (!(e.target as HTMLElement).classList.contains('resize-handle')) {
                      handleDragStart(e, 'text', textBox.id)
                    }
                  }}
                  onTouchStart={(e) => {
                    if (!(e.target as HTMLElement).classList.contains('resize-handle')) {
                      handleDragStart(e, 'text', textBox.id)
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    // Cargar todos los valores del texto
                    setTextInput(textBox.text)
                    setTextFontSize(textBox.fontSize)
                    setTextFontFamily(textBox.fontFamily || 'Arial')
                    setTextBold(textBox.bold || false)
                    setTextItalic(textBox.italic || false)
                    setTextUnderline(textBox.underline || false)
                    setTextAlign(textBox.align || 'left')
                    setTextBgColor(textBox.backgroundColor || 'transparent')
                    setCurrentColor(textBox.color)
                    setEditingTextId(textBox.id)
                    setShowTextModal(true)
                  }}
                  title="Clic para seleccionar • Arrastrar para mover • Doble clic para editar"
                >
                  {textBox.text}
                  {/* Handles de redimensionamiento */}
                  {isSelected && (
                    <>
                      <div
                        className="resize-handle absolute -right-2 -bottom-2 w-4 h-4 bg-primary-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
                        onMouseDown={(e) => handleResizeStart(e, 'se', textBox.fontSize / 24)}
                        onTouchStart={(e) => handleResizeStart(e, 'se', textBox.fontSize / 24)}
                      />
                      <div
                        className="resize-handle absolute -left-2 -bottom-2 w-4 h-4 bg-primary-500 rounded-full cursor-sw-resize border-2 border-white shadow-md"
                        onMouseDown={(e) => handleResizeStart(e, 'sw', textBox.fontSize / 24)}
                        onTouchStart={(e) => handleResizeStart(e, 'sw', textBox.fontSize / 24)}
                      />
                      <div
                        className="resize-handle absolute -right-2 -top-2 w-4 h-4 bg-primary-500 rounded-full cursor-ne-resize border-2 border-white shadow-md"
                        onMouseDown={(e) => handleResizeStart(e, 'ne', textBox.fontSize / 24)}
                        onTouchStart={(e) => handleResizeStart(e, 'ne', textBox.fontSize / 24)}
                      />
                      <div
                        className="resize-handle absolute -left-2 -top-2 w-4 h-4 bg-primary-500 rounded-full cursor-nw-resize border-2 border-white shadow-md"
                        onMouseDown={(e) => handleResizeStart(e, 'nw', textBox.fontSize / 24)}
                        onTouchStart={(e) => handleResizeStart(e, 'nw', textBox.fontSize / 24)}
                      />
                    </>
                  )}
                </div>
              )
            })}

            {/* Renderizar fórmulas sobre el canvas */}
            {(content.formulas || []).map(formula => {
              const isSelected = isElementSelected('formula', formula.id)
              return (
                <div
                  key={formula.id}
                  className={`absolute select-none rounded p-1 ${
                    isSelected
                      ? 'ring-2 ring-primary-500 z-10'
                      : 'cursor-grab hover:ring-2 hover:ring-primary-300'
                  }`}
                  style={{
                    left: formula.x,
                    top: formula.y,
                    transform: `scale(${formula.scale})`,
                    transformOrigin: 'top left',
                    cursor: isSelected ? 'grab' : 'pointer',
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    if (!(e.target as HTMLElement).classList.contains('resize-handle')) {
                      handleDragStart(e, 'formula', formula.id)
                    }
                  }}
                  onTouchStart={(e) => {
                    if (!(e.target as HTMLElement).classList.contains('resize-handle')) {
                      handleDragStart(e, 'formula', formula.id)
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setFormulaInput(formula.latex)
                    handleFormulaChange(formula.latex)
                    setFormulaScale(formula.scale)
                    setEditingFormulaId(formula.id)
                    setShowFormulaModal(true)
                  }}
                  title="Clic para seleccionar • Arrastrar para mover • Doble clic para editar"
                >
                  <div dangerouslySetInnerHTML={{
                    __html: katex.renderToString(formula.latex, { throwOnError: false, displayMode: true })
                  }} />
                  {/* Handles de redimensionamiento */}
                  {isSelected && (
                    <>
                      <div
                        className="resize-handle absolute -right-2 -bottom-2 w-4 h-4 bg-primary-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
                        style={{ transform: `scale(${1/formula.scale})` }}
                        onMouseDown={(e) => handleResizeStart(e, 'se', formula.scale)}
                        onTouchStart={(e) => handleResizeStart(e, 'se', formula.scale)}
                      />
                      <div
                        className="resize-handle absolute -left-2 -bottom-2 w-4 h-4 bg-primary-500 rounded-full cursor-sw-resize border-2 border-white shadow-md"
                        style={{ transform: `scale(${1/formula.scale})` }}
                        onMouseDown={(e) => handleResizeStart(e, 'sw', formula.scale)}
                        onTouchStart={(e) => handleResizeStart(e, 'sw', formula.scale)}
                      />
                      <div
                        className="resize-handle absolute -right-2 -top-2 w-4 h-4 bg-primary-500 rounded-full cursor-ne-resize border-2 border-white shadow-md"
                        style={{ transform: `scale(${1/formula.scale})` }}
                        onMouseDown={(e) => handleResizeStart(e, 'ne', formula.scale)}
                        onTouchStart={(e) => handleResizeStart(e, 'ne', formula.scale)}
                      />
                      <div
                        className="resize-handle absolute -left-2 -top-2 w-4 h-4 bg-primary-500 rounded-full cursor-nw-resize border-2 border-white shadow-md"
                        style={{ transform: `scale(${1/formula.scale})` }}
                        onMouseDown={(e) => handleResizeStart(e, 'nw', formula.scale)}
                        onTouchStart={(e) => handleResizeStart(e, 'nw', formula.scale)}
                      />
                    </>
                  )}
                </div>
              )
            })}

            {/* Recuadro de selección (marquee) */}
            {selectionBox && (
              <div
                className="absolute border-2 border-primary-500 bg-primary-500/10 pointer-events-none z-30"
                style={{
                  left: Math.min(selectionBox.startX, selectionBox.endX),
                  top: Math.min(selectionBox.startY, selectionBox.endY),
                  width: Math.abs(selectionBox.endX - selectionBox.startX),
                  height: Math.abs(selectionBox.endY - selectionBox.startY),
                }}
              />
            )}

            {/* Indicadores visuales para trazos seleccionados */}
            {selectedElements.filter(el => el.type === 'stroke').map(selected => {
              const stroke = content.strokes.find(s => s.id === selected.id)
              if (!stroke || stroke.points.length === 0) return null
              
              const minX = Math.min(...stroke.points.map(p => p.x)) - stroke.size
              const maxX = Math.max(...stroke.points.map(p => p.x)) + stroke.size
              const minY = Math.min(...stroke.points.map(p => p.y)) - stroke.size
              const maxY = Math.max(...stroke.points.map(p => p.y)) + stroke.size
              
              return (
                <div
                  key={`stroke-selection-${stroke.id}`}
                  className="absolute border-2 border-primary-500 border-dashed pointer-events-none z-5 rounded-lg bg-primary-500/5"
                  style={{
                    left: minX,
                    top: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Modal Texto */}
        {showTextModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="6" y="17" fontSize="16" fontWeight="bold">T</text>
                  </svg>
                  {editingTextId ? 'Editar' : 'Agregar'} Texto
                </h3>
                <button
                  onClick={() => setShowTextModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Área de texto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Texto</label>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Escribe aquí..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                    rows={3}
                    autoFocus
                  />
                </div>

                {/* Barra de formato estilo editor */}
                <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-100 rounded-lg">
                  {/* Negrita, Cursiva, Subrayado */}
                  <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
                    <button
                      onClick={() => setTextBold(!textBold)}
                      className={`w-8 h-8 rounded flex items-center justify-center font-bold transition-all ${textBold ? 'bg-primary-500 text-white' : 'hover:bg-gray-200'}`}
                      title="Negrita"
                    >
                      B
                    </button>
                    <button
                      onClick={() => setTextItalic(!textItalic)}
                      className={`w-8 h-8 rounded flex items-center justify-center italic transition-all ${textItalic ? 'bg-primary-500 text-white' : 'hover:bg-gray-200'}`}
                      title="Cursiva"
                    >
                      I
                    </button>
                    <button
                      onClick={() => setTextUnderline(!textUnderline)}
                      className={`w-8 h-8 rounded flex items-center justify-center underline transition-all ${textUnderline ? 'bg-primary-500 text-white' : 'hover:bg-gray-200'}`}
                      title="Subrayado"
                    >
                      U
                    </button>
                  </div>

                  {/* Alineación */}
                  <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
                    <button
                      onClick={() => setTextAlign('left')}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-all ${textAlign === 'left' ? 'bg-primary-500 text-white' : 'hover:bg-gray-200'}`}
                      title="Alinear izquierda"
                    >
                      ≡
                    </button>
                    <button
                      onClick={() => setTextAlign('center')}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-all ${textAlign === 'center' ? 'bg-primary-500 text-white' : 'hover:bg-gray-200'}`}
                      title="Centrar"
                    >
                      ≡
                    </button>
                    <button
                      onClick={() => setTextAlign('right')}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-all ${textAlign === 'right' ? 'bg-primary-500 text-white' : 'hover:bg-gray-200'}`}
                      title="Alinear derecha"
                    >
                      ≡
                    </button>
                  </div>

                  {/* Fuente */}
                  <select
                    value={textFontFamily}
                    onChange={(e) => setTextFontFamily(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                    <option value="Impact">Impact</option>
                  </select>

                  {/* Tamaño */}
                  <select
                    value={textFontSize}
                    onChange={(e) => setTextFontSize(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm bg-white w-20"
                  >
                    {[12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72].map(size => (
                      <option key={size} value={size}>{size}px</option>
                    ))}
                  </select>
                </div>

                {/* Colores */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Color texto:</label>
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => setCurrentColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Fondo:</label>
                    <input
                      type="color"
                      value={textBgColor === 'transparent' ? '#ffffff' : textBgColor}
                      onChange={(e) => setTextBgColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    />
                    <button
                      onClick={() => setTextBgColor('transparent')}
                      className={`px-2 py-1 text-xs rounded ${textBgColor === 'transparent' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      Sin fondo
                    </button>
                  </div>
                </div>

                {/* Vista previa */}
                <div className="bg-gray-50 rounded-lg p-4 min-h-[80px] border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                  <p 
                    style={{ 
                      fontSize: textFontSize, 
                      color: currentColor,
                      fontFamily: textFontFamily,
                      fontWeight: textBold ? 'bold' : 'normal',
                      fontStyle: textItalic ? 'italic' : 'normal',
                      textDecoration: textUnderline ? 'underline' : 'none',
                      textAlign: textAlign,
                      backgroundColor: textBgColor,
                      padding: textBgColor !== 'transparent' ? '4px 8px' : 0,
                      borderRadius: '4px',
                      display: 'inline-block',
                    }}
                  >
                    {textInput || 'Vista previa...'}
                  </p>
                </div>

                {/* Botones */}
                <div className="flex gap-2">
                  {editingTextId && (
                    <button
                      onClick={() => {
                        setContent(prev => ({
                          ...prev,
                          textBoxes: (prev.textBoxes || []).filter(t => t.id !== editingTextId)
                        }))
                        setShowTextModal(false)
                      }}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  )}
                  <button
                    onClick={() => setShowTextModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveText}
                    disabled={!textInput.trim()}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
                  >
                    {editingTextId ? 'Guardar Cambios' : 'Agregar Texto'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Fórmula */}
        {showFormulaModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="4" y="17" fontSize="14" fontWeight="bold" fontStyle="italic">fx</text>
                  </svg>
                  {editingFormulaId ? 'Editar' : 'Agregar'} Fórmula
                </h3>
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fórmula LaTeX</label>
                  <input
                    type="text"
                    value={formulaInput}
                    onChange={(e) => handleFormulaChange(e.target.value)}
                    placeholder="Ejemplo: x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                    autoFocus
                  />
                  {formulaError && (
                    <p className="text-red-500 text-sm mt-1">{formulaError}</p>
                  )}
                </div>

                {/* Control de tamaño */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño: {formulaScale.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={formulaScale}
                    onChange={(e) => setFormulaScale(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Pequeño</span>
                    <span>Grande</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 min-h-[100px] flex items-center justify-center overflow-auto">
                  {formulaPreview ? (
                    <div style={{ transform: `scale(${formulaScale})`, transformOrigin: 'center' }} dangerouslySetInnerHTML={{ __html: formulaPreview }} />
                  ) : (
                    <p className="text-gray-400">Vista previa de la fórmula...</p>
                  )}
                </div>

                {/* Atajos de fórmulas comunes */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">Fórmulas comunes (clic para insertar):</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Fracción', latex: '\\frac{a}{b}' },
                      { label: 'Raíz', latex: '\\sqrt{x}' },
                      { label: 'Potencia', latex: 'x^{2}' },
                      { label: 'Subíndice', latex: 'x_{i}' },
                      { label: 'Sumatoria', latex: '\\sum_{i=1}^{n} x_i' },
                      { label: 'Integral', latex: '\\int_{a}^{b} f(x)dx' },
                      { label: 'Pi', latex: '\\pi' },
                      { label: 'Infinito', latex: '\\infty' },
                      { label: 'Mayor igual', latex: '\\geq' },
                      { label: 'Menor igual', latex: '\\leq' },
                      { label: 'Diferente', latex: '\\neq' },
                      { label: 'Aprox', latex: '\\approx' },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => handleFormulaChange(formulaInput + item.latex)}
                        className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-all"
                        title={item.latex}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  {editingFormulaId && (
                    <button
                      onClick={() => {
                        setContent(prev => ({
                          ...prev,
                          formulas: (prev.formulas || []).filter(f => f.id !== editingFormulaId)
                        }))
                        setShowFormulaModal(false)
                      }}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
                    >
                      Eliminar
                    </button>
                  )}
                  <button
                    onClick={() => setShowFormulaModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveFormula}
                    disabled={!formulaInput.trim() || !!formulaError}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
                  >
                    {editingFormulaId ? 'Guardar Cambios' : 'Agregar Fórmula'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Barra flotante en fullscreen */}
        {isFullscreen && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full shadow-lg px-6 py-3 flex items-center gap-3">
            {/* Herramientas */}
            <button
              onClick={() => setCurrentTool('pen')}
              className={`p-2 rounded-full ${currentTool === 'pen' ? 'bg-primary-100' : 'hover:bg-gray-100'}`}
              title="Lápiz"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentTool('eraser')}
              className={`p-2 rounded-full ${currentTool === 'eraser' ? 'bg-primary-100' : 'hover:bg-gray-100'}`}
              title="Borrador"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20H7L3 16c-.6-.6-.6-1.5 0-2.1l10-10c.6-.6 1.5-.6 2.1 0l6 6c.6.6.6 1.5 0 2.1L13 20" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 11l7 7" />
              </svg>
            </button>
            
            <div className="w-px h-8 bg-gray-300" />
            
            {/* Colores */}
            {COLORS.slice(0, 5).map(color => (
              <button
                key={color.value}
                onClick={() => setCurrentColor(color.value)}
                className={`w-7 h-7 rounded-full transition-all ${
                  currentColor === color.value ? 'ring-2 ring-offset-2 ring-primary-500' : ''
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
            
            <div className="w-px h-8 bg-gray-300" />
            
            {/* Tamaños */}
            {SIZES.slice(0, 3).map(size => (
              <button
                key={size.value}
                onClick={() => setCurrentSize(size.value)}
                className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
                  currentSize === size.value ? 'bg-primary-100' : 'hover:bg-gray-100'
                }`}
                title={size.name}
              >
                <span 
                  className="rounded-full"
                  style={{ 
                    width: Math.min(size.value/2, 10), 
                    height: Math.min(size.value/2, 10),
                    backgroundColor: currentTool === 'eraser' ? '#9ca3af' : currentColor 
                  }}
                />
              </button>
            ))}
            
            <div className="w-px h-8 bg-gray-300" />
            
            {/* Acciones */}
            <button
              onClick={() => canvasRef.current?.undo()}
              disabled={!canUndo}
              className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
              title="Deshacer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              onClick={() => canvasRef.current?.redo()}
              disabled={!canRedo}
              className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
            </button>
            <button
              onClick={() => canvasRef.current?.clear()}
              className="p-2 rounded-full hover:bg-red-100 text-red-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            
            <div className="w-px h-8 bg-gray-300" />
            
            <button
              onClick={handleFullscreen}
              className="p-2 rounded-full hover:bg-gray-100"
              title="Salir"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
