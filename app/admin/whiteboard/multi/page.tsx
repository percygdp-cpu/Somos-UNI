'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import WhiteboardCanvas, { WhiteboardCanvasRef } from '@/components/whiteboard/WhiteboardCanvas'
import { WhiteboardContent, WhiteboardFormula } from '@/types'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useRouter } from 'next/navigation'
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

// Colores de cuadrantes
const QUADRANT_COLORS = [
  { name: 'Cuadrante I', color: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Cuadrante II', color: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Cuadrante III', color: '#22c55e', bg: 'bg-emerald-500' },
  { name: 'Cuadrante IV', color: '#f59e0b', bg: 'bg-amber-500' },
]

interface QuadrantData {
  id: string | null
  title: string
  content: WhiteboardContent
  isDirty: boolean
}

interface WhiteboardListItem {
  id: string
  title: string
  updatedAt: string
}

type ViewMode = '1' | '2h' | '2v' | '4'

const LOCAL_STORAGE_KEY = 'whiteboard-multi-config'

export default function WhiteboardMultiPage() {
  const router = useRouter()
  const { user } = useAuth()

  // Estado de carga inicial
  const [loading, setLoading] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Modo de vista
  const [viewMode, setViewMode] = useState<ViewMode>('4')
  const [activeQuadrant, setActiveQuadrant] = useState(0)
  
  // Cuadrantes
  const [quadrants, setQuadrants] = useState<QuadrantData[]>([
    { id: null, title: 'Pizarra 1', content: { strokes: [], formulas: [] }, isDirty: false },
    { id: null, title: 'Pizarra 2', content: { strokes: [], formulas: [] }, isDirty: false },
    { id: null, title: 'Pizarra 3', content: { strokes: [], formulas: [] }, isDirty: false },
    { id: null, title: 'Pizarra 4', content: { strokes: [], formulas: [] }, isDirty: false },
  ])

  // Lista de pizarras disponibles
  const [whiteboardList, setWhiteboardList] = useState<WhiteboardListItem[]>([])
  const [showWhiteboardSelector, setShowWhiteboardSelector] = useState<number | null>(null)

  // Herramientas (compartidas entre cuadrantes)
  const [currentColor, setCurrentColor] = useState('#000000')
  const [currentSize, setCurrentSize] = useState(8)
  const [currentTool, setCurrentTool] = useState<'select' | 'pen' | 'eraser' | 'text' | 'formula'>('pen')
  
  // Refs para cada canvas
  const canvasRefs = useRef<(WhiteboardCanvasRef | null)[]>([null, null, null, null])
  const canvasContainerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])

  // Estado de guardado
  const [savingQuadrant, setSavingQuadrant] = useState<number | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const quadrantsRef = useRef(quadrants)

  // Mantener quadrantsRef sincronizado
  useEffect(() => { quadrantsRef.current = quadrants }, [quadrants])

  // Edición inline de texto
  const [inlineEditingTextId, setInlineEditingTextId] = useState<string | null>(null)
  const [inlineTextValue, setInlineTextValue] = useState('')
  const [textFontSize, setTextFontSize] = useState(24)
  const [textFontFamily, setTextFontFamily] = useState('Arial')
  const [textBold, setTextBold] = useState(false)
  const [textItalic, setTextItalic] = useState(false)
  const [textUnderline, setTextUnderline] = useState(false)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left')
  const [textBgColor, setTextBgColor] = useState('transparent')
  const inlineTextRef = useRef<HTMLTextAreaElement>(null)

  // Barra de fórmulas
  const [showFormulaBar, setShowFormulaBar] = useState(false)
  const [formulaInput, setFormulaInput] = useState('')
  const [formulaPreview, setFormulaPreview] = useState('')
  const [formulaError, setFormulaError] = useState('')
  const [formulaScale, setFormulaScale] = useState(1.5)
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null)
  const [formulaPosition, setFormulaPosition] = useState<{ x: number; y: number }>({ x: 100, y: 200 })
  const formulaInputRef = useRef<HTMLInputElement>(null)

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Dropdowns
  const [showPenSizes, setShowPenSizes] = useState(false)
  const [showEraserSizes, setShowEraserSizes] = useState(false)

  // Selección de elementos
  const [selectedElements, setSelectedElements] = useState<Array<{ type: 'stroke' | 'text' | 'formula'; id: string }>>([])
  const selectedElementsRef = useRef<Array<{ type: 'stroke' | 'text' | 'formula'; id: string }>>([])
  
  // Drag para mover elementos
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Selección por área (marquee)
  const [selectingArea, setSelectingArea] = useState(false)
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null)

  // Redimensionamiento
  const [resizing, setResizing] = useState<{ corner: string; startX: number; startY: number; startScale: number } | null>(null)

  // Modal para crear nueva pizarra con nombre
  const [showCreateModal, setShowCreateModal] = useState<number | null>(null)
  const [newBoardName, setNewBoardName] = useState('')
  const createInputRef = useRef<HTMLInputElement>(null)

  // Mantener ref sincronizado con state
  useEffect(() => {
    selectedElementsRef.current = selectedElements
  }, [selectedElements])

  // Funciones de selección
  const isElementSelected = (type: 'stroke' | 'text' | 'formula', id: string) => {
    return selectedElements.some(el => el.type === type && el.id === id)
  }

  const toggleSelection = (type: 'stroke' | 'text' | 'formula', id: string, addToSelection: boolean) => {
    if (addToSelection) {
      if (isElementSelected(type, id)) {
        setSelectedElements(prev => prev.filter(el => !(el.type === type && el.id === id)))
      } else {
        setSelectedElements(prev => [...prev, { type, id }])
      }
    } else {
      setSelectedElements([{ type, id }])
    }
  }

  const selectAll = () => {
    const quadrantContent = quadrants[activeQuadrant].content
    const all: Array<{ type: 'stroke' | 'text' | 'formula'; id: string }> = []
    quadrantContent.strokes.forEach(s => all.push({ type: 'stroke', id: s.id }))
    ;(quadrantContent.textBoxes || []).forEach(t => all.push({ type: 'text', id: t.id }))
    ;(quadrantContent.formulas || []).forEach(f => all.push({ type: 'formula', id: f.id }))
    setSelectedElements(all)
  }

  const deleteSelectedElements = () => {
    const quadrantContent = quadrants[activeQuadrant].content
    const newContent = {
      strokes: quadrantContent.strokes.filter(s => !isElementSelected('stroke', s.id)),
      textBoxes: (quadrantContent.textBoxes || []).filter(t => !isElementSelected('text', t.id)),
      formulas: (quadrantContent.formulas || []).filter(f => !isElementSelected('formula', f.id)),
    }
    updateQuadrantContent(activeQuadrant, newContent)
    setSelectedElements([])
  }

  // Mover elementos seleccionados
  const moveSelectedElements = (deltaX: number, deltaY: number) => {
    const quadrantContent = quadrants[activeQuadrant].content
    const newContent = {
      strokes: quadrantContent.strokes.map(s => {
        if (isElementSelected('stroke', s.id)) {
          return {
            ...s,
            points: s.points.map(p => ({ ...p, x: p.x + deltaX, y: p.y + deltaY }))
          }
        }
        return s
      }),
      textBoxes: (quadrantContent.textBoxes || []).map(t => {
        if (isElementSelected('text', t.id)) {
          return { ...t, x: t.x + deltaX, y: t.y + deltaY }
        }
        return t
      }),
      formulas: (quadrantContent.formulas || []).map(f => {
        if (isElementSelected('formula', f.id)) {
          return { ...f, x: f.x + deltaX, y: f.y + deltaY }
        }
        return f
      }),
    }
    updateQuadrantContent(activeQuadrant, newContent)
  }

  // Handlers de drag
  const handleDragStart = (e: React.MouseEvent, type: 'stroke' | 'text' | 'formula', id: string) => {
    if (currentTool !== 'select') return
    e.stopPropagation()
    
    // Lógica profesional de selección
    let newSelection: Array<{ type: 'stroke' | 'text' | 'formula'; id: string }>
    
    if (isElementSelected(type, id)) {
      // Ya seleccionado, mantener selección actual
      newSelection = selectedElements
    } else if (e.shiftKey) {
      // Añadir a la selección existente
      newSelection = [...selectedElements, { type, id }]
    } else {
      // Seleccionar solo este elemento
      newSelection = [{ type, id }]
    }
    
    // Actualizar tanto state como ref inmediatamente
    setSelectedElements(newSelection)
    selectedElementsRef.current = newSelection
    setDragStart({ x: e.clientX, y: e.clientY })
    setDragging(true)
  }

  const handleDragMove = (e: React.MouseEvent) => {
    const container = canvasContainerRefs.current[activeQuadrant]
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    // Redimensionamiento
    if (resizing && selectedElements.length === 1) {
      e.preventDefault()
      const selected = selectedElements[0]
      if (selected.type === 'stroke') return
      
      const deltaX = e.clientX - resizing.startX
      const deltaY = e.clientY - resizing.startY
      const delta = Math.max(deltaX, deltaY)
      const scaleFactor = delta / 100
      const newScale = Math.max(0.5, Math.min(4, resizing.startScale + scaleFactor))
      
      const quadrantContent = quadrants[activeQuadrant].content
      
      if (selected.type === 'text') {
        const baseSize = 24
        const newFontSize = Math.round(baseSize * newScale)
        updateQuadrantContent(activeQuadrant, {
          ...quadrantContent,
          textBoxes: (quadrantContent.textBoxes || []).map(t =>
            t.id === selected.id ? { ...t, fontSize: Math.max(12, Math.min(96, newFontSize)) } : t
          )
        })
      } else if (selected.type === 'formula') {
        updateQuadrantContent(activeQuadrant, {
          ...quadrantContent,
          formulas: (quadrantContent.formulas || []).map(f =>
            f.id === selected.id ? { ...f, scale: newScale } : f
          )
        })
      }
      return
    }

    // Selección por área (marquee)
    if (selectingArea && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, endX: currentX, endY: currentY } : null)
      return
    }
    
    // Mover elementos seleccionados
    const currentSelection = selectedElementsRef.current
    if (!dragging || currentSelection.length === 0 || currentTool !== 'select') return
    
    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y
    
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      moveSelectedElements(deltaX, deltaY)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleDragEnd = () => {
    // Finalizar selección por área
    if (selectingArea && selectionBox) {
      const minX = Math.min(selectionBox.startX, selectionBox.endX)
      const maxX = Math.max(selectionBox.startX, selectionBox.endX)
      const minY = Math.min(selectionBox.startY, selectionBox.endY)
      const maxY = Math.max(selectionBox.startY, selectionBox.endY)
      
      const quadrantContent = quadrants[activeQuadrant].content
      const newSelection: Array<{ type: 'stroke' | 'text' | 'formula'; id: string }> = []
      
      // Seleccionar trazos que intersecten
      quadrantContent.strokes.forEach(stroke => {
        for (const point of stroke.points) {
          if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
            newSelection.push({ type: 'stroke', id: stroke.id })
            break
          }
        }
      })
      
      // Seleccionar textos que intersecten
      ;(quadrantContent.textBoxes || []).forEach(text => {
        if (text.x >= minX && text.x <= maxX && text.y >= minY && text.y <= maxY) {
          newSelection.push({ type: 'text', id: text.id })
        }
      })
      
      // Seleccionar fórmulas que intersecten
      ;(quadrantContent.formulas || []).forEach(formula => {
        if (formula.x >= minX && formula.x <= maxX && formula.y >= minY && formula.y <= maxY) {
          newSelection.push({ type: 'formula', id: formula.id })
        }
      })
      
      setSelectedElements(newSelection)
      selectedElementsRef.current = newSelection
      setSelectingArea(false)
      setSelectionBox(null)
    }
    
    setDragging(false)
    setResizing(null)
  }

  // Iniciar selección por área en el canvas
  const handleCanvasMouseDown = (e: React.MouseEvent, quadrantIndex: number) => {
    if (currentTool !== 'select') return
    if (activeQuadrant !== quadrantIndex) return
    
    // Solo iniciar selección por área si el clic fue directamente en el contenedor o el canvas
    const target = e.target as HTMLElement
    const container = canvasContainerRefs.current[quadrantIndex]
    if (!container) return
    
    // Verificar que el clic no fue en un elemento seleccionable (texto, fórmula, handle)
    const clickedElement = target.closest('[data-selectable]')
    if (clickedElement) return
    
    // Si el clic fue en el canvas (no en un elemento), iniciar selección por área
    const isCanvas = target.tagName === 'CANVAS' || target === container || target.closest('.absolute.inset-0')
    if (!isCanvas) return
    
    e.preventDefault()
    
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Iniciar selección por área (solo si clic en área vacía)
    if (!e.shiftKey) {
      setSelectedElements([])
      selectedElementsRef.current = []
    }
    setSelectionBox({ startX: x, startY: y, endX: x, endY: y })
    setSelectingArea(true)
  }

  // Funciones para redimensionar
  const handleResizeStart = (
    e: React.MouseEvent,
    currentScale: number
  ) => {
    e.stopPropagation()
    e.preventDefault()
    
    setResizing({
      corner: 'se',
      startX: e.clientX,
      startY: e.clientY,
      startScale: currentScale
    })
  }

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete para eliminar seleccionados
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElements.length > 0 && !inlineEditingTextId && !showFormulaBar) {
          e.preventDefault()
          deleteSelectedElements()
        }
      }
      // Escape para deseleccionar o cerrar edición
      if (e.key === 'Escape') {
        if (inlineEditingTextId) {
          saveInlineText()
        } else if (showFormulaBar) {
          handleCancelFormula()
        } else {
          setSelectedElements([])
        }
      }
      // Ctrl+A para seleccionar todo
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && currentTool === 'select') {
        e.preventDefault()
        selectAll()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElements, currentTool, inlineEditingTextId, showFormulaBar, activeQuadrant, quadrants])

  // Función para cargar una pizarra en un cuadrante (definida antes del useEffect)
  const loadWhiteboardById = async (quadrantIndex: number, whiteboardId: string) => {
    try {
      const response = await fetch(`/api/whiteboard?id=${whiteboardId}`)
      if (response.ok) {
        const data = await response.json()
        setQuadrants(prev => prev.map((q, i) => 
          i === quadrantIndex 
            ? { id: whiteboardId, title: data.title, content: data.content || { strokes: [], formulas: [] }, isDirty: false }
            : q
        ))
      }
    } catch (error) {
      console.error('Error loading whiteboard:', error)
    }
  }

  // Cargar configuración desde localStorage
  useEffect(() => {
    const initializeFromStorage = async () => {
      const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY)
      
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig)
          if (config.viewMode) setViewMode(config.viewMode)
          if (config.activeQuadrant !== undefined) setActiveQuadrant(config.activeQuadrant)
          // Cargar IDs de pizarras guardadas en cada cuadrante
          if (config.quadrantIds) {
            const loadPromises = config.quadrantIds.map((id: string | null, index: number) => {
              if (id) {
                return loadWhiteboardById(index, id)
              }
              return Promise.resolve()
            })
            await Promise.all(loadPromises)
          }
        } catch (e) {
          console.error('Error loading config:', e)
        }
      }
      // No crear automáticamente - el usuario decide cuándo crear cada pizarra
      
      // Cargar lista de pizarras
      await fetchWhiteboardList()
      setLoading(false)
      setInitialLoadDone(true)
    }
    
    if (user?.id) {
      initializeFromStorage()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Guardar configuración en localStorage (solo después de la carga inicial)
  useEffect(() => {
    if (!initialLoadDone) return
    const config = {
      viewMode,
      activeQuadrant,
      quadrantIds: quadrants.map(q => q.id),
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config))
  }, [viewMode, activeQuadrant, quadrants, initialLoadDone])

  // Fetch lista de pizarras
  const fetchWhiteboardList = async () => {
    try {
      const response = await fetch('/api/whiteboard')
      if (response.ok) {
        const data = await response.json()
        setWhiteboardList(data)
      }
    } catch (error) {
      console.error('Error fetching whiteboards:', error)
    }
  }

  // Cargar una pizarra en un cuadrante
  const loadWhiteboardIntoQuadrant = async (quadrantIndex: number, whiteboardId: string) => {
    try {
      const response = await fetch(`/api/whiteboard?id=${whiteboardId}`)
      if (response.ok) {
        const data = await response.json()
        setQuadrants(prev => prev.map((q, i) => 
          i === quadrantIndex 
            ? { id: whiteboardId, title: data.title, content: data.content || { strokes: [], formulas: [] }, isDirty: false }
            : q
        ))
      }
    } catch (error) {
      console.error('Error loading whiteboard:', error)
    }
    setShowWhiteboardSelector(null)
  }

  // Crear nueva pizarra en un cuadrante con nombre personalizado
  const createNewInQuadrant = async (quadrantIndex: number, customName?: string): Promise<string | null> => {
    const title = customName || `Pizarra ${quadrantIndex + 1}`
    try {
      const response = await fetch('/api/whiteboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: { strokes: [], formulas: [] },
          createdBy: user?.id,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setQuadrants(prev => prev.map((q, i) => 
          i === quadrantIndex 
            ? { id: data.id, title: data.title || title, content: { strokes: [], formulas: [] }, isDirty: false }
            : q
        ))
        fetchWhiteboardList()
        return data.id
      }
    } catch (error) {
      console.error('Error creating whiteboard:', error)
    }
    setShowWhiteboardSelector(null)
    return null
  }

  // Manejar creación desde el modal
  const handleCreateFromModal = async () => {
    if (showCreateModal === null) return
    const name = newBoardName.trim() || `Pizarra ${showCreateModal + 1}`
    await createNewInQuadrant(showCreateModal, name)
    setShowCreateModal(null)
    setNewBoardName('')
  }

  // Vaciar cuadrante
  const clearQuadrant = (quadrantIndex: number) => {
    setQuadrants(prev => prev.map((q, i) => 
      i === quadrantIndex 
        ? { id: null, title: `Pizarra ${quadrantIndex + 1}`, content: { strokes: [], formulas: [] }, isDirty: false }
        : q
    ))
    setShowWhiteboardSelector(null)
  }

  // Actualizar contenido de un cuadrante
  const updateQuadrantContent = (quadrantIndex: number, content: WhiteboardContent) => {
    setQuadrants(prev => prev.map((q, i) => 
      i === quadrantIndex 
        ? { ...q, content, isDirty: true }
        : q
    ))
  }

  // Guardar cuadrante (memoizado)
  const saveQuadrant = useCallback(async (quadrantIndex: number) => {
    const quadrant = quadrantsRef.current[quadrantIndex]
    if (!quadrant.id || !quadrant.isDirty) return

    setSaveStatus('saving')
    setSavingQuadrant(quadrantIndex)
    try {
      const response = await fetch('/api/whiteboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quadrant.id,
          title: quadrant.title,
          content: quadrant.content,
        }),
      })
      if (response.ok) {
        setQuadrants(prev => prev.map((q, i) => 
          i === quadrantIndex ? { ...q, isDirty: false } : q
        ))
        setLastSaved(new Date())
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Error saving quadrant:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
    setSavingQuadrant(null)
  }, [])

  // Guardar todos los cuadrantes con cambios
  const saveAllDirty = useCallback(() => {
    quadrantsRef.current.forEach((q, i) => {
      if (q.isDirty && q.id) {
        saveQuadrant(i)
      }
    })
  }, [saveQuadrant])

  // Guardado automático con debounce de 2 segundos
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Solo si hay cambios sin guardar
    const hasUnsaved = quadrants.some(q => q.isDirty && q.id)
    if (!hasUnsaved) return

    // Debounce: guardar 2s después del último cambio
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveAllDirty()
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [quadrants, saveAllDirty])

  // Respaldo: intervalo de 15 segundos para guardar
  useEffect(() => {
    const interval = setInterval(() => {
      saveAllDirty()
    }, 15000)

    return () => clearInterval(interval)
  }, [saveAllDirty])

  // Guardar al salir de la página
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnsavedChanges = quadrants.some(q => q.isDirty)
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [quadrants])

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.pen-dropdown') && !target.closest('.eraser-dropdown')) {
        setShowPenSizes(false)
        setShowEraserSizes(false)
      }
      if (!target.closest('.whiteboard-selector')) {
        setShowWhiteboardSelector(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Detectar cambios de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

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

  // Crear nuevo texto al hacer clic en el canvas en modo texto
  const handleCanvasClickForText = (e: React.MouseEvent, quadrantIndex: number) => {
    if (currentTool !== 'text') return
    if (activeQuadrant !== quadrantIndex) return
    
    const container = canvasContainerRefs.current[quadrantIndex]
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Crear nuevo texto vacío en esta posición
    const newId = `text-${Date.now()}`
    const newTextBox = {
      id: newId,
      text: '',
      x,
      y,
      fontSize: textFontSize,
      color: currentColor,
      fontFamily: textFontFamily,
      bold: textBold,
      italic: textItalic,
      underline: textUnderline,
      align: textAlign,
      backgroundColor: textBgColor !== 'transparent' ? textBgColor : undefined,
    }
    
    const quadrantContent = quadrants[quadrantIndex].content
    updateQuadrantContent(quadrantIndex, {
      ...quadrantContent,
      textBoxes: [...(quadrantContent.textBoxes || []), newTextBox]
    })
    
    // Activar edición inline inmediatamente
    setInlineEditingTextId(newId)
    setInlineTextValue('')
    
    // Enfocar el textarea después de renderizar
    setTimeout(() => inlineTextRef.current?.focus(), 0)
  }

  // Guardar texto inline
  const saveInlineText = () => {
    if (!inlineEditingTextId) return
    
    const quadrantContent = quadrants[activeQuadrant].content
    
    // Si el texto está vacío, eliminar el elemento
    if (!inlineTextValue.trim()) {
      updateQuadrantContent(activeQuadrant, {
        ...quadrantContent,
        textBoxes: (quadrantContent.textBoxes || []).filter(t => t.id !== inlineEditingTextId)
      })
    } else {
      // Actualizar el texto existente
      updateQuadrantContent(activeQuadrant, {
        ...quadrantContent,
        textBoxes: (quadrantContent.textBoxes || []).map(t =>
          t.id === inlineEditingTextId
            ? {
                ...t,
                text: inlineTextValue,
                fontSize: textFontSize,
                color: currentColor,
                fontFamily: textFontFamily,
                bold: textBold,
                italic: textItalic,
                underline: textUnderline,
                align: textAlign,
                backgroundColor: textBgColor !== 'transparent' ? textBgColor : undefined,
              }
            : t
        )
      })
    }
    
    setInlineEditingTextId(null)
    setInlineTextValue('')
  }

  // Iniciar edición de texto existente
  const startEditingText = (textBox: { id: string; text: string; fontSize: number; color: string; fontFamily?: string; bold?: boolean; italic?: boolean; underline?: boolean; align?: string; backgroundColor?: string }) => {
    setInlineEditingTextId(textBox.id)
    setInlineTextValue(textBox.text)
    setTextFontSize(textBox.fontSize)
    setTextFontFamily(textBox.fontFamily || 'Arial')
    setTextBold(textBox.bold || false)
    setTextItalic(textBox.italic || false)
    setTextUnderline(textBox.underline || false)
    setTextAlign((textBox.align as 'left' | 'center' | 'right') || 'left')
    setTextBgColor(textBox.backgroundColor || 'transparent')
    setCurrentColor(textBox.color)
    setTimeout(() => inlineTextRef.current?.focus(), 0)
  }

  // Editar fórmula existente
  const startEditingFormula = (formula: WhiteboardFormula) => {
    setFormulaInput(formula.latex)
    setFormulaScale(formula.scale)
    setEditingFormulaId(formula.id)
    setFormulaPosition({ x: formula.x, y: formula.y })
    handleFormulaChange(formula.latex)
    setShowFormulaBar(true)
    setCurrentTool('formula')
    setTimeout(() => formulaInputRef.current?.focus(), 100)
  }

  // Funciones de fórmulas
  const handleAddFormula = () => {
    setFormulaInput('')
    setFormulaPreview('')
    setFormulaError('')
    setFormulaScale(1.5)
    setEditingFormulaId(null)
    setFormulaPosition({ x: 100, y: 200 })
    setShowFormulaBar(true)
    setCurrentTool('formula')
    setTimeout(() => formulaInputRef.current?.focus(), 100)
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

  const insertFormulaSnippet = (snippet: string) => {
    const newValue = formulaInput + snippet
    handleFormulaChange(newValue)
    formulaInputRef.current?.focus()
  }

  const handleSaveFormula = () => {
    if (!formulaInput.trim() || formulaError) return

    const quadrantContent = quadrants[activeQuadrant].content
    const existingFormula = editingFormulaId 
      ? (quadrantContent.formulas || []).find(f => f.id === editingFormulaId)
      : null

    const newFormula: WhiteboardFormula = {
      id: editingFormulaId || `formula-${Date.now()}`,
      latex: formulaInput,
      x: existingFormula?.x || formulaPosition.x,
      y: existingFormula?.y || formulaPosition.y,
      scale: formulaScale,
    }

    const newContent: WhiteboardContent = {
      ...quadrantContent,
      formulas: editingFormulaId
        ? (quadrantContent.formulas || []).map(f => f.id === editingFormulaId ? newFormula : f)
        : [...(quadrantContent.formulas || []), newFormula],
    }

    updateQuadrantContent(activeQuadrant, newContent)
    setShowFormulaBar(false)
    setFormulaInput('')
    setEditingFormulaId(null)
    setCurrentTool('pen')
  }

  const handleCancelFormula = () => {
    setShowFormulaBar(false)
    setFormulaInput('')
    setEditingFormulaId(null)
    setCurrentTool('pen')
  }

  // Determinar cuántos cuadrantes mostrar según el modo
  // Siempre usa índices consecutivos: 0, 1, 2, 3
  const getVisibleQuadrants = () => {
    switch (viewMode) {
      case '1': return [0]
      case '2h': return [0, 1]
      case '2v': return [0, 1]
      case '4': return [0, 1, 2, 3]
      default: return [0, 1, 2, 3]
    }
  }

  // Grid class según modo
  const getGridClass = () => {
    switch (viewMode) {
      case '1': return 'grid-cols-1 grid-rows-1'
      case '2h': return 'grid-cols-2 grid-rows-1'
      case '2v': return 'grid-cols-1 grid-rows-2'
      case '4': return 'grid-cols-2 grid-rows-2'
      default: return 'grid-cols-2 grid-rows-2'
    }
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div
        ref={containerRef}
        className={`min-h-screen flex flex-col ${isFullscreen ? 'bg-white' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}
      >
        {!isFullscreen && <AdminHeader />}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <svg className="w-10 h-10 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-500">Cargando pizarras...</span>
            </div>
          </div>
        ) : (
        <div className="flex-1 flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap">
              {/* Volver */}
              <button
                onClick={() => router.push('/admin/whiteboard')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                title="Volver"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Herramientas */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setCurrentTool('select')}
                  className={`p-2 rounded ${currentTool === 'select' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Seleccionar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </button>
                
                {/* Lápiz */}
                <div className="relative pen-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentTool('pen')
                      setShowPenSizes(!showPenSizes)
                      setShowEraserSizes(false)
                    }}
                    className={`p-2 rounded flex items-center gap-1 ${currentTool === 'pen' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
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

                {/* Borrador */}
                <div className="relative eraser-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentTool('eraser')
                      setShowEraserSizes(!showEraserSizes)
                      setShowPenSizes(false)
                    }}
                    className={`p-2 rounded flex items-center gap-1 ${currentTool === 'eraser' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
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
                  onClick={() => setCurrentTool('text')}
                  className={`p-2 rounded ${currentTool === 'text' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Agregar texto"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="7" y="18" fontSize="18" fontWeight="bold">T</text>
                  </svg>
                </button>
                <button
                  onClick={handleAddFormula}
                  className={`p-2 rounded ${currentTool === 'formula' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Agregar fórmula"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="4" y="17" fontSize="14" fontWeight="bold" fontStyle="italic">fx</text>
                  </svg>
                </button>
              </div>

              <div className="w-px h-8 bg-gray-300 mx-2" />

              {/* Selector de modo de vista (Multi-pizarra) */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('1')}
                  className={`p-2 rounded ${viewMode === '1' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="1 pizarra"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('2h')}
                  className={`p-2 rounded ${viewMode === '2h' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="2 pizarras horizontales"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="8" height="18" rx="1" />
                    <rect x="13" y="3" width="8" height="18" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('2v')}
                  className={`p-2 rounded ${viewMode === '2v' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="2 pizarras verticales"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="8" rx="1" />
                    <rect x="3" y="13" width="18" height="8" rx="1" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('4')}
                  className={`p-2 rounded ${viewMode === '4' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="4 pizarras"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="8" height="8" rx="1" />
                    <rect x="13" y="3" width="8" height="8" rx="1" />
                    <rect x="3" y="13" width="8" height="8" rx="1" />
                    <rect x="13" y="13" width="8" height="8" rx="1" />
                  </svg>
                </button>
              </div>

              <div className="w-px h-8 bg-gray-300" />

              {/* Colores */}
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

              <div className="flex-1" />

              {/* Indicador de guardado profesional */}
              <div className="flex items-center gap-3 text-sm">
                {/* Estado del guardado */}
                <div className="flex items-center gap-2 min-w-[120px] justify-end">
                  {saveStatus === 'saving' && (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-1 text-green-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Guardado
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="flex items-center gap-1 text-red-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Error
                    </span>
                  )}
                  {saveStatus === 'idle' && quadrants.some(q => q.isDirty) && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Sin guardar
                    </span>
                  )}
                </div>

                {/* Botón de guardar manual */}
                {quadrants.some(q => q.isDirty && q.id) && (
                  <button
                    onClick={saveAllDirty}
                    disabled={saveStatus === 'saving'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Guardar
                  </button>
                )}
              </div>

              {/* Fullscreen */}
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
          </div>

          {/* Área de cuadrantes */}
          <div className={`flex-1 grid ${getGridClass()} gap-1 p-2 bg-gray-200`}>
            {getVisibleQuadrants().map(quadrantIndex => (
              <div
                key={quadrantIndex}
                className={`relative bg-white rounded-lg overflow-hidden transition-all ${
                  activeQuadrant === quadrantIndex 
                    ? 'ring-4 ring-primary-500 shadow-lg' 
                    : 'ring-1 ring-gray-300 hover:ring-2 hover:ring-gray-400'
                }`}
                onClick={() => {
                  if (activeQuadrant !== quadrantIndex) {
                    setSelectedElements([]) // Limpiar selección al cambiar de cuadrante
                    setActiveQuadrant(quadrantIndex)
                  }
                }}
              >
                {/* Etiqueta del cuadrante */}
                <div className="absolute top-2 left-2 z-10">
                  <div className="whiteboard-selector relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowWhiteboardSelector(showWhiteboardSelector === quadrantIndex ? null : quadrantIndex)
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 shadow-sm border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      <span className={`w-2 h-2 rounded-full ${QUADRANT_COLORS[quadrantIndex].bg}`} />
                      {quadrants[quadrantIndex].title || QUADRANT_COLORS[quadrantIndex].name}
                      {quadrants[quadrantIndex].isDirty && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      )}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown selector de pizarra */}
                    {showWhiteboardSelector === quadrantIndex && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            createNewInQuadrant(quadrantIndex)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Nueva pizarra
                        </button>
                        {quadrants[quadrantIndex].id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              clearQuadrant(quadrantIndex)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Vaciar cuadrante
                          </button>
                        )}
                        <div className="border-t border-gray-100 my-1" />
                        <div className="px-3 py-1 text-xs text-gray-400 uppercase">Pizarras guardadas</div>
                        <div className="max-h-48 overflow-y-auto">
                          {whiteboardList.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-400">No hay pizarras</div>
                          ) : (
                            whiteboardList.map(wb => (
                              <button
                                key={wb.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  loadWhiteboardIntoQuadrant(quadrantIndex, wb.id)
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                  quadrants[quadrantIndex].id === wb.id ? 'bg-primary-50 text-primary-700' : ''
                                }`}
                              >
                                {wb.title || 'Sin título'}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Canvas del cuadrante - Solo si hay pizarra creada */}
                {quadrants[quadrantIndex].id ? (
                  <div
                    ref={el => { canvasContainerRefs.current[quadrantIndex] = el }}
                    className="absolute inset-0"
                    style={{ pointerEvents: activeQuadrant === quadrantIndex ? 'auto' : 'none' }}
                    onMouseDown={(e) => {
                      if (currentTool === 'select') {
                        handleCanvasMouseDown(e, quadrantIndex)
                      }
                    }}
                    onClick={(e) => {
                      if (currentTool === 'text') {
                        handleCanvasClickForText(e, quadrantIndex)
                      }
                    }}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                  >
                    <WhiteboardCanvas
                    ref={el => { canvasRefs.current[quadrantIndex] = el }}
                    content={quadrants[quadrantIndex].content}
                    onContentChange={(content) => updateQuadrantContent(quadrantIndex, content)}
                    currentColor={currentColor}
                    currentSize={currentSize}
                    currentTool={currentTool}
                    onHistoryChange={() => {}}
                  />

                  {/* Rectángulo de selección por área */}
                  {selectingArea && selectionBox && activeQuadrant === quadrantIndex && (
                    <div
                      className="absolute border-2 border-primary-500 bg-primary-100/30 pointer-events-none"
                      style={{
                        left: Math.min(selectionBox.startX, selectionBox.endX),
                        top: Math.min(selectionBox.startY, selectionBox.endY),
                        width: Math.abs(selectionBox.endX - selectionBox.startX),
                        height: Math.abs(selectionBox.endY - selectionBox.startY),
                      }}
                    />
                  )}

                  {/* Textos */}
                  {(quadrants[quadrantIndex].content.textBoxes || []).map(textBox => (
                    inlineEditingTextId === textBox.id ? (
                      <div
                        key={textBox.id}
                        className="absolute"
                        style={{
                          left: textBox.x,
                          top: textBox.y,
                          zIndex: 20,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <textarea
                          ref={inlineTextRef}
                          value={inlineTextValue}
                          onChange={(e) => setInlineTextValue(e.target.value)}
                          onBlur={saveInlineText}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              saveInlineText()
                            }
                          }}
                          className="bg-transparent border-2 border-primary-400 rounded outline-none resize-none p-1"
                          style={{
                            fontSize: textFontSize,
                            color: currentColor,
                            fontFamily: textFontFamily,
                            fontWeight: textBold ? 'bold' : 'normal',
                            fontStyle: textItalic ? 'italic' : 'normal',
                            textDecoration: textUnderline ? 'underline' : 'none',
                            textAlign: textAlign,
                            backgroundColor: textBgColor !== 'transparent' ? textBgColor : 'rgba(255,255,255,0.9)',
                            minWidth: '100px',
                            minHeight: '30px',
                          }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div
                        key={textBox.id}
                        data-selectable="text"
                        className={`absolute select-none rounded px-2 py-1 transition-all ${
                          currentTool === 'select' 
                            ? isElementSelected('text', textBox.id)
                              ? 'ring-2 ring-primary-500 cursor-move'
                              : 'cursor-pointer hover:ring-2 hover:ring-primary-300'
                            : 'cursor-pointer hover:ring-2 hover:ring-primary-300'
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
                          whiteSpace: 'pre-wrap',
                          minWidth: '20px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (currentTool === 'select') {
                            toggleSelection('text', textBox.id, e.shiftKey)
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          startEditingText(textBox)
                        }}
                        onMouseDown={(e) => handleDragStart(e, 'text', textBox.id)}
                      >
                        {textBox.text || '(vacío)'}
                        {/* Handle de redimensionar */}
                        {currentTool === 'select' && isElementSelected('text', textBox.id) && selectedElements.length === 1 && (
                          <div
                            className="absolute -right-2 -bottom-2 w-4 h-4 bg-primary-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              handleResizeStart(e, textBox.fontSize / 24)
                            }}
                          />
                        )}
                      </div>
                    )
                  ))}

                  {/* Fórmulas */}
                  {(quadrants[quadrantIndex].content.formulas || []).map(formula => (
                    <div
                      key={formula.id}
                      data-selectable="formula"
                      className={`absolute select-none rounded p-1 transition-all ${
                        currentTool === 'select'
                          ? isElementSelected('formula', formula.id)
                            ? 'ring-2 ring-primary-500 cursor-move'
                            : 'cursor-pointer hover:ring-2 hover:ring-primary-300'
                          : 'cursor-pointer hover:ring-2 hover:ring-primary-300'
                      }`}
                      style={{
                        left: formula.x,
                        top: formula.y,
                        transform: `scale(${formula.scale})`,
                        transformOrigin: 'top left',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (currentTool === 'select') {
                          toggleSelection('formula', formula.id, e.shiftKey)
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        startEditingFormula(formula)
                      }}
                      onMouseDown={(e) => handleDragStart(e, 'formula', formula.id)}
                    >
                      <div dangerouslySetInnerHTML={{
                        __html: katex.renderToString(formula.latex, { throwOnError: false, displayMode: true })
                      }} />
                      {/* Handle de redimensionar */}
                      {currentTool === 'select' && isElementSelected('formula', formula.id) && selectedElements.length === 1 && (
                        <div
                          className="absolute -right-2 -bottom-2 w-4 h-4 bg-primary-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
                          style={{ transform: `scale(${1/formula.scale})` }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleResizeStart(e, formula.scale)
                          }}
                        />
                      )}
                    </div>
                  ))}
                  </div>
                ) : (
                  /* Cuadrante vacío - Mostrar botón para agregar pizarra */
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setNewBoardName('')
                        setShowCreateModal(quadrantIndex)
                        setTimeout(() => createInputRef.current?.focus(), 100)
                      }}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-full bg-gray-200 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
                        <svg className="w-8 h-8 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <span className="text-lg font-medium text-gray-500 group-hover:text-primary-600 transition-colors">
                        Agregar Pizarra {quadrantIndex + 1}
                      </span>
                      <span className="text-sm text-gray-400">
                        Haz clic para crear una nueva pizarra
                      </span>
                    </button>
                  </div>
                )}

                {/* Overlay para cuadrantes inactivos - solo para hacer clic y activar */}
                {activeQuadrant !== quadrantIndex && quadrants[quadrantIndex].id && (
                  <div 
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => setActiveQuadrant(quadrantIndex)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Barra inferior de fórmulas */}
          {showFormulaBar && (
            <div className="bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
              <div className="max-w-7xl mx-auto p-3 flex flex-col lg:flex-row items-center gap-3">
                <div className="w-full lg:w-1/3 flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-600 shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <text x="4" y="17" fontSize="14" fontWeight="bold" fontStyle="italic">fx</text>
                    </svg>
                  </div>
                  <div className="w-full relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none font-mono text-sm">$$</div>
                    <input
                      ref={formulaInputRef}
                      type="text"
                      value={formulaInput}
                      onChange={(e) => handleFormulaChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !formulaError && formulaInput.trim()) {
                          handleSaveFormula()
                        }
                      }}
                      placeholder="\frac{-b \pm \sqrt{b^2-4ac}}{2a}"
                      className={`w-full pl-9 pr-3 py-2 border rounded-lg font-mono text-sm shadow-sm transition-all focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        formulaError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>

                <div className="hidden lg:block w-px h-8 bg-gray-200 mx-2" />

                <div className="w-full lg:w-auto flex-grow flex items-center justify-start overflow-x-auto py-1 gap-2">
                  <div className="flex gap-1.5 shrink-0">
                    {[
                      { label: 'x²', latex: 'x^{2}' },
                      { label: 'x³', latex: 'x^{3}' },
                      { label: '\\frac{a}{b}', latex: '\\frac{a}{b}' },
                      { label: '\\sqrt{x}', latex: '\\sqrt{x}' },
                      { label: '\\sum', latex: '\\sum_{i=1}^{n}' },
                      { label: '\\int', latex: '\\int_{a}^{b}' },
                      { label: '\\pi', latex: '\\pi' },
                      { label: '\\infty', latex: '\\infty' },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => insertFormulaSnippet(item.latex)}
                        className="inline-flex items-center justify-center h-9 min-w-[36px] px-2 text-sm font-medium font-mono text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded hover:border-gray-300 transition-all"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="w-px h-6 bg-gray-300 mx-1 shrink-0" />

                  <div className="flex-1 min-h-[40px] min-w-[120px] max-w-xs flex items-center bg-gray-50 rounded-lg px-4 border border-gray-200 overflow-hidden">
                    {formulaPreview ? (
                      <div className="transform scale-75 origin-left" dangerouslySetInnerHTML={{ __html: formulaPreview }} />
                    ) : (
                      <span className="text-gray-400 text-sm">Vista previa...</span>
                    )}
                  </div>
                </div>

                <div className="w-full lg:w-auto flex items-center justify-end gap-2 shrink-0">
                  <button
                    onClick={handleCancelFormula}
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveFormula}
                    disabled={!formulaInput.trim() || !!formulaError}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    Insertar
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal para crear nueva pizarra con nombre */}
          {showCreateModal !== null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(null)}>
              <div 
                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Crear Pizarra {showCreateModal + 1}
                </h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Nombre de la pizarra
                  </label>
                  <input
                    ref={createInputRef}
                    type="text"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateFromModal()
                      } else if (e.key === 'Escape') {
                        setShowCreateModal(null)
                      }
                    }}
                    placeholder={`Pizarra ${showCreateModal + 1}`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowCreateModal(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateFromModal}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Crear Pizarra
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
