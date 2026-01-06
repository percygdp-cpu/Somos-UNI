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

// Colores de fondo de pizarra
const BG_COLORS = [
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Crema', value: '#fefce8' },
  { name: 'Verde pizarra', value: '#134e4a' },
  { name: 'Negro pizarra', value: '#1e1e1e' },
  { name: 'Azul oscuro', value: '#1e3a5f' },
  { name: 'Gris claro', value: '#f3f4f6' },
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
  const [penMode, setPenMode] = useState<'free' | 'line' | 'arrow' | 'curveArrow'>('free')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Edición inline de texto (sin modal)
  const [inlineEditingTextId, setInlineEditingTextId] = useState<string | null>(null)
  const [inlineTextValue, setInlineTextValue] = useState('')
  const [newTextPosition, setNewTextPosition] = useState<{ x: number; y: number } | null>(null)
  const [textFontSize, setTextFontSize] = useState(24)
  const [textFontFamily, setTextFontFamily] = useState('Arial')
  const [textBold, setTextBold] = useState(false)
  const [textItalic, setTextItalic] = useState(false)
  const [textUnderline, setTextUnderline] = useState(false)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left')
  const [textBgColor, setTextBgColor] = useState('transparent')
  const inlineTextRef = useRef<HTMLTextAreaElement>(null)

  // Barra de fórmulas (sin modal)
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
        if (selectedElements.length > 0 && !inlineEditingTextId && !showFormulaBar) {
          e.preventDefault()
          deleteSelectedElements()
        }
      }
      // Escape para deseleccionar o cerrar edición inline
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
  }, [content, title, selectedElements, currentTool, inlineEditingTextId, showFormulaBar])

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

  // Manejar agregar/editar texto (inline, sin modal)
  const handleAddText = () => {
    // Activar modo texto - el texto se creará donde haga clic el usuario
    setCurrentTool('text')
  }

  // Crear nuevo texto al hacer clic en el canvas en modo texto
  const handleCanvasClickForText = (e: React.MouseEvent) => {
    if (currentTool !== 'text') return
    
    const container = canvasContainerRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Crear nuevo texto vacío en esta posición
    const newId = `text-${Date.now()}`
    const newTextBox: WhiteboardTextBox = {
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
    
    setContent(prev => ({
      ...prev,
      textBoxes: [...(prev.textBoxes || []), newTextBox]
    }))
    
    // Activar edición inline inmediatamente
    setInlineEditingTextId(newId)
    setInlineTextValue('')
    setNewTextPosition({ x, y })
    
    // Enfocar el textarea después de renderizar
    setTimeout(() => inlineTextRef.current?.focus(), 0)
  }

  // Iniciar edición de texto existente
  const startEditingText = (textBox: WhiteboardTextBox) => {
    setInlineEditingTextId(textBox.id)
    setInlineTextValue(textBox.text)
    setTextFontSize(textBox.fontSize)
    setTextFontFamily(textBox.fontFamily || 'Arial')
    setTextBold(textBox.bold || false)
    setTextItalic(textBox.italic || false)
    setTextUnderline(textBox.underline || false)
    setTextAlign(textBox.align || 'left')
    setTextBgColor(textBox.backgroundColor || 'transparent')
    setCurrentColor(textBox.color)
    setTimeout(() => inlineTextRef.current?.focus(), 0)
  }

  // Guardar texto inline
  const saveInlineText = () => {
    if (!inlineEditingTextId) return
    
    // Si el texto está vacío, eliminar el elemento
    if (!inlineTextValue.trim()) {
      setContent(prev => ({
        ...prev,
        textBoxes: (prev.textBoxes || []).filter(t => t.id !== inlineEditingTextId)
      }))
    } else {
      // Actualizar el texto existente
      setContent(prev => ({
        ...prev,
        textBoxes: (prev.textBoxes || []).map(t =>
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
      }))
    }
    
    setInlineEditingTextId(null)
    setInlineTextValue('')
    setNewTextPosition(null)
  }

  // Actualizar texto mientras se edita (para sincronizar tamaño del textarea)
  const updateInlineTextStyle = (updates: Partial<WhiteboardTextBox>) => {
    if (!inlineEditingTextId) return
    
    if (updates.fontSize !== undefined) setTextFontSize(updates.fontSize)
    if (updates.fontFamily !== undefined) setTextFontFamily(updates.fontFamily)
    if (updates.bold !== undefined) setTextBold(updates.bold)
    if (updates.italic !== undefined) setTextItalic(updates.italic)
    if (updates.underline !== undefined) setTextUnderline(updates.underline)
    if (updates.align !== undefined) setTextAlign(updates.align as 'left' | 'center' | 'right')
    if (updates.backgroundColor !== undefined) setTextBgColor(updates.backgroundColor)
    if (updates.color !== undefined) setCurrentColor(updates.color)
  }

  // Manejar agregar/editar fórmula (barra inferior)
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

  // Insertar fórmula rápida (añade al input actual)
  const insertFormulaSnippet = (snippet: string) => {
    const newValue = formulaInput + snippet
    handleFormulaChange(newValue)
    formulaInputRef.current?.focus()
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
      x: existingFormula?.x || formulaPosition.x,
      y: existingFormula?.y || formulaPosition.y,
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

  // Editar fórmula existente (cargar en barra inferior)
  const startEditingFormula = (formula: WhiteboardFormula) => {
    setFormulaInput(formula.latex)
    handleFormulaChange(formula.latex)
    setFormulaScale(formula.scale)
    setEditingFormulaId(formula.id)
    setFormulaPosition({ x: formula.x, y: formula.y })
    setShowFormulaBar(true)
    setTimeout(() => formulaInputRef.current?.focus(), 100)
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
              
              {/* Lápiz con tamaño y modo */}
              <div className="relative pen-dropdown">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentTool('pen')
                    setShowPenSizes(!showPenSizes)
                    setShowEraserSizes(false)
                  }}
                  className={`p-2 rounded-lg transition-all flex items-center gap-1 ${currentTool === 'pen' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title={`Lápiz - ${penMode === 'free' ? 'Libre' : penMode === 'line' ? 'Línea' : penMode === 'arrow' ? 'Flecha' : 'Curva'}`}
                >
                  {penMode === 'free' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  ) : penMode === 'line' ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="5" y1="19" x2="19" y2="5" strokeWidth={2} strokeLinecap="round"/>
                    </svg>
                  ) : penMode === 'arrow' ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="5" y1="19" x2="19" y2="5" strokeWidth={2} strokeLinecap="round"/>
                      <polyline points="12,5 19,5 19,12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M5 19 Q 12 5, 19 5" strokeWidth={2} strokeLinecap="round" fill="none"/>
                      <polyline points="15,3 19,5 17,9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPenSizes && currentTool === 'pen' && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-3 z-20 w-56">
                    {/* Modos de trazo */}
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-2 font-medium">Tipo de trazo</div>
                      <div className="grid grid-cols-4 gap-1">
                        <button
                          onClick={() => { setPenMode('free'); }}
                          className={`flex flex-col items-center justify-center p-2 rounded transition-all ${
                            penMode === 'free' ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'
                          }`}
                          title="Libre"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <span className="text-[10px] mt-1">Libre</span>
                        </button>
                        <button
                          onClick={() => { setPenMode('line'); }}
                          className={`flex flex-col items-center justify-center p-2 rounded transition-all ${
                            penMode === 'line' ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'
                          }`}
                          title="Línea recta"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="5" y1="19" x2="19" y2="5" strokeWidth={2} strokeLinecap="round"/>
                          </svg>
                          <span className="text-[10px] mt-1">Línea</span>
                        </button>
                        <button
                          onClick={() => { setPenMode('arrow'); }}
                          className={`flex flex-col items-center justify-center p-2 rounded transition-all ${
                            penMode === 'arrow' ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'
                          }`}
                          title="Flecha recta"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="5" y1="19" x2="19" y2="5" strokeWidth={2} strokeLinecap="round"/>
                            <polyline points="12,5 19,5 19,12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-[10px] mt-1">Flecha</span>
                        </button>
                        <button
                          onClick={() => { setPenMode('curveArrow'); }}
                          className={`flex flex-col items-center justify-center p-2 rounded transition-all ${
                            penMode === 'curveArrow' ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'
                          }`}
                          title="Flecha curva"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M5 19 Q 12 5, 19 5" strokeWidth={2} strokeLinecap="round" fill="none"/>
                            <polyline points="15,3 19,5 17,9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-[10px] mt-1">Curva</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Grosor */}
                    <div className="border-t border-gray-100 pt-3">
                      <div className="text-xs text-gray-500 mb-2 font-medium">Grosor</div>
                      <div className="flex flex-wrap items-center gap-1">
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
                    </div>
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

            {/* Selector de color de fondo */}
            <div className="flex items-center gap-2 px-2 border-r border-gray-200">
              <span className="text-xs text-gray-500">Fondo:</span>
              <div className="flex items-center gap-1">
                {BG_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setBgColor(color.value)}
                    className={`w-6 h-6 rounded border-2 transition-all ${
                      bgColor === color.value
                        ? 'border-primary-500 scale-110 ring-2 ring-primary-200'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

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
            onClick={handleCanvasClickForText}
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
              penMode={penMode}
              bgColor={bgColor}
              onHistoryChange={handleHistoryChange}
            />
            
            {/* Renderizar textos sobre el canvas */}
            {(content.textBoxes || []).map(textBox => {
              const isSelected = isElementSelected('text', textBox.id)
              const isEditing = inlineEditingTextId === textBox.id
              
              // Si está en modo edición, mostrar textarea
              if (isEditing) {
                return (
                  <div
                    key={textBox.id}
                    className="absolute z-20"
                    style={{
                      left: textBox.x,
                      top: textBox.y,
                    }}
                  >
                    {/* Barra de formato flotante */}
                    <div 
                      className="absolute -top-12 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 flex items-center gap-1 z-30"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {/* Negrita, Cursiva, Subrayado */}
                      <button
                        onClick={() => updateInlineTextStyle({ bold: !textBold })}
                        className={`w-7 h-7 rounded flex items-center justify-center font-bold text-sm transition-all ${textBold ? 'bg-primary-500 text-white' : 'hover:bg-gray-100'}`}
                        title="Negrita"
                      >
                        B
                      </button>
                      <button
                        onClick={() => updateInlineTextStyle({ italic: !textItalic })}
                        className={`w-7 h-7 rounded flex items-center justify-center italic text-sm transition-all ${textItalic ? 'bg-primary-500 text-white' : 'hover:bg-gray-100'}`}
                        title="Cursiva"
                      >
                        I
                      </button>
                      <button
                        onClick={() => updateInlineTextStyle({ underline: !textUnderline })}
                        className={`w-7 h-7 rounded flex items-center justify-center underline text-sm transition-all ${textUnderline ? 'bg-primary-500 text-white' : 'hover:bg-gray-100'}`}
                        title="Subrayado"
                      >
                        U
                      </button>
                      
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      
                      {/* Fuente */}
                      <select
                        value={textFontFamily}
                        onChange={(e) => updateInlineTextStyle({ fontFamily: e.target.value })}
                        className="h-7 px-1 text-xs border border-gray-200 rounded bg-white"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <option value="Arial">Arial</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Times New Roman">Times</option>
                        <option value="Courier New">Courier</option>
                        <option value="Verdana">Verdana</option>
                      </select>
                      
                      {/* Tamaño */}
                      <select
                        value={textFontSize}
                        onChange={(e) => updateInlineTextStyle({ fontSize: Number(e.target.value) })}
                        className="h-7 px-1 text-xs border border-gray-200 rounded bg-white w-14"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {[12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72].map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                      
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      
                      {/* Color */}
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => updateInlineTextStyle({ color: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer border border-gray-200"
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      
                      {/* Fondo */}
                      <input
                        type="color"
                        value={textBgColor === 'transparent' ? '#ffffff' : textBgColor}
                        onChange={(e) => updateInlineTextStyle({ backgroundColor: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer border border-gray-200"
                        title="Color de fondo"
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => updateInlineTextStyle({ backgroundColor: 'transparent' })}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${textBgColor === 'transparent' ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'}`}
                        title="Sin fondo"
                      >
                        ∅
                      </button>
                      
                      <div className="w-px h-5 bg-gray-300 mx-1" />
                      
                      {/* Confirmar */}
                      <button
                        onClick={saveInlineText}
                        className="w-7 h-7 rounded flex items-center justify-center bg-primary-500 text-white hover:bg-primary-600 transition-all"
                        title="Listo (Esc para cancelar)"
                      >
                        ✓
                      </button>
                    </div>
                    
                    {/* Textarea editable */}
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
                      className="resize-none border-2 border-primary-500 rounded px-2 py-1 outline-none bg-white/90"
                      style={{
                        fontSize: textFontSize,
                        color: currentColor,
                        fontFamily: textFontFamily,
                        fontWeight: textBold ? 'bold' : 'normal',
                        fontStyle: textItalic ? 'italic' : 'normal',
                        textDecoration: textUnderline ? 'underline' : 'none',
                        textAlign: textAlign,
                        backgroundColor: textBgColor !== 'transparent' ? textBgColor : 'white',
                        minWidth: '150px',
                        minHeight: '40px',
                      }}
                      placeholder="Escribe aquí..."
                      autoFocus
                    />
                  </div>
                )
              }
              
              // Modo normal (no edición)
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
                    startEditingText(textBox)
                  }}
                  title="Clic para seleccionar • Arrastrar para mover • Doble clic para editar"
                >
                  {textBox.text || '(vacío)'}
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
                    startEditingFormula(formula)
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

        {/* Barra inferior de fórmulas LaTeX */}
        {showFormulaBar && (
          <div className="bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
            <div className="max-w-7xl mx-auto p-3 flex flex-col lg:flex-row items-center gap-3">
              {/* Icono fx e input */}
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

              {/* Botones rápidos de fórmulas */}
              <div className="w-full lg:w-auto flex-grow flex items-center justify-start overflow-x-auto py-1 gap-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider shrink-0 mr-1 hidden xl:block">Comunes</span>
                <div className="flex gap-1.5 shrink-0">
                  {[
                    { label: 'x²', latex: 'x^{2}', title: 'Al cuadrado' },
                    { label: 'x³', latex: 'x^{3}', title: 'Al cubo' },
                    { label: '\\frac{a}{b}', latex: '\\frac{a}{b}', title: 'Fracción' },
                    { label: '\\sqrt{x}', latex: '\\sqrt{x}', title: 'Raíz cuadrada' },
                    { label: '\\sum', latex: '\\sum_{i=1}^{n}', title: 'Sumatoria' },
                    { label: '\\int', latex: '\\int_{a}^{b}', title: 'Integral' },
                    { label: '\\pi', latex: '\\pi', title: 'Pi' },
                    { label: '\\infty', latex: '\\infty', title: 'Infinito' },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={() => insertFormulaSnippet(item.latex)}
                      className="inline-flex items-center justify-center h-9 min-w-[36px] px-2 text-sm font-medium font-mono text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded hover:border-gray-300 transition-all"
                      title={item.title}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-6 bg-gray-300 mx-1 shrink-0" />

                {/* Preview */}
                <div className="flex-1 min-h-[40px] min-w-[120px] max-w-xs flex items-center bg-gray-50 rounded-lg px-4 border border-gray-200 overflow-hidden">
                  {formulaPreview ? (
                    <div 
                      className="transform scale-75 origin-left"
                      dangerouslySetInnerHTML={{ __html: formulaPreview }} 
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">Vista previa...</span>
                  )}
                </div>

                {/* Control de tamaño */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500">{formulaScale.toFixed(1)}x</span>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={formulaScale}
                    onChange={(e) => setFormulaScale(Number(e.target.value))}
                    className="w-20"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="w-full lg:w-auto flex items-center justify-end gap-2 shrink-0 border-t lg:border-t-0 border-gray-100 pt-2 lg:pt-0">
                {editingFormulaId && (
                  <button
                    onClick={() => {
                      setContent(prev => ({
                        ...prev,
                        formulas: (prev.formulas || []).filter(f => f.id !== editingFormulaId)
                      }))
                      handleCancelFormula()
                    }}
                    className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  onClick={handleCancelFormula}
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveFormula}
                  disabled={!formulaInput.trim() || !!formulaError}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-md shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{editingFormulaId ? 'Guardar' : 'Insertar'}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
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
