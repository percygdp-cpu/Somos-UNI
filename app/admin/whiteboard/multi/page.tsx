'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import WhiteboardCanvas, { WhiteboardCanvasRef } from '@/components/whiteboard/WhiteboardCanvas'
import { WhiteboardContent, WhiteboardFormula, WhiteboardShape } from '@/types'
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

// Colores de fondo de pizarra
const BG_COLORS = [
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Verde muy claro', value: '#f0fdf4' },
  { name: 'Azul muy claro', value: '#eff6ff' },
  { name: 'Amarillo muy claro', value: '#fffbeb' },
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
  latexContent: string // Contenido LaTeX en tiempo real
  latexFontSize: number // Tamaño de fuente del LaTeX
  bgColor: string // Color de fondo de la pizarra
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
  const [zoomedQuadrant, setZoomedQuadrant] = useState<number | null>(null) // Cuadrante en pantalla completa
  const [originalQuadrantSize, setOriginalQuadrantSize] = useState<{ width: number; height: number } | null>(null)
  const quadrantContainerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])
  
  // Cuadrantes
  const [quadrants, setQuadrants] = useState<QuadrantData[]>([
    { id: null, title: 'Pizarra 1', content: { strokes: [], formulas: [] }, isDirty: false, latexContent: '', latexFontSize: 38, bgColor: '#ffffff' },
    { id: null, title: 'Pizarra 2', content: { strokes: [], formulas: [] }, isDirty: false, latexContent: '', latexFontSize: 38, bgColor: '#ffffff' },
    { id: null, title: 'Pizarra 3', content: { strokes: [], formulas: [] }, isDirty: false, latexContent: '', latexFontSize: 38, bgColor: '#ffffff' },
    { id: null, title: 'Pizarra 4', content: { strokes: [], formulas: [] }, isDirty: false, latexContent: '', latexFontSize: 38, bgColor: '#ffffff' },
  ])

  // Lista de pizarras disponibles
  const [whiteboardList, setWhiteboardList] = useState<WhiteboardListItem[]>([])
  const [showWhiteboardSelector, setShowWhiteboardSelector] = useState<number | null>(null)

  // Herramientas (compartidas entre cuadrantes)
  const [currentColor, setCurrentColor] = useState('#000000')
  const [currentSize, setCurrentSize] = useState(8)
  const [currentTool, setCurrentTool] = useState<'select' | 'pen' | 'eraser' | 'text' | 'formula'>('pen')
  const [penMode, setPenMode] = useState<'free' | 'line' | 'arrow' | 'curveArrow'>('free')
  
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
  const [formulaModoLibre, setFormulaModoLibre] = useState(false) // true = insertar con clic, false = tiempo real
  const [formulaInput, setFormulaInput] = useState('')
  const [formulaPreview, setFormulaPreview] = useState('')
  const [formulaError, setFormulaError] = useState('')
  const [formulaScale, setFormulaScale] = useState(1.5)
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null)
  const [formulaPosition, setFormulaPosition] = useState<{ x: number; y: number }>({ x: 100, y: 200 })
  const [formulaCategory, setFormulaCategory] = useState<'basic' | 'greek-lower' | 'greek-upper' | 'trig' | 'operators' | 'chemistry' | 'shapes-2d' | 'shapes-3d'>('basic')
  const formulaInputRef = useRef<HTMLTextAreaElement>(null)

  // Estado para placement mode (click-to-place)
  const [pendingPlacement, setPendingPlacement] = useState<{
    type: 'formula' | 'shape';
    data: { latex?: string; scale?: number; shapeType?: string; color?: string };
  } | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)

  // Categorías de símbolos para fórmulas
  const FORMULA_CATEGORIES = {
    'basic': [
      { label: 'x²', latex: 'x^{2}' },
      { label: 'xⁿ', latex: 'x^{n}' },
      { label: '√', latex: '\\sqrt{x}' },
      { label: 'ⁿ√', latex: '\\sqrt[n]{x}' },
      { label: 'a/b', latex: '\\frac{a}{b}' },
      { label: 'log', latex: '\\log_{b}' },
      { label: 'π', latex: '\\pi' },
      { label: 'θ', latex: '\\theta' },
      { label: '∞', latex: '\\infty' },
      { label: '∫', latex: '\\int' },
      { label: '≥', latex: '\\geq' },
      { label: '≤', latex: '\\leq' },
      { label: '·', latex: '\\cdot' },
      { label: '÷', latex: '\\div' },
      { label: '°', latex: '^{\\circ}' },
      { label: '(□)', latex: '\\left( x \\right)' },
      { label: '|□|', latex: '\\left| x \\right|' },
      { label: 'f(x)', latex: 'f(x)' },
      { label: 'ln', latex: '\\ln' },
      { label: 'eˣ', latex: 'e^{x}' },
      { label: "f'", latex: "f'(x)" },
      { label: '∂/∂x', latex: '\\frac{\\partial}{\\partial x}' },
      { label: '∫ᵇₐ', latex: '\\int_{a}^{b}' },
      { label: 'lim', latex: '\\lim_{x \\to a}' },
      { label: 'Σ', latex: '\\sum_{i=1}^{n}' },
      { label: 'sin', latex: '\\sin' },
      { label: 'cos', latex: '\\cos' },
      { label: 'tan', latex: '\\tan' },
      { label: 'cot', latex: '\\cot' },
      { label: 'csc', latex: '\\csc' },
      { label: '[₂ₓ₂]', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
      { label: '{=', latex: '\\begin{cases} x+y=0 \\\\ x-y=1 \\end{cases}' },
    ],
    'greek-lower': [
      { label: 'α', latex: '\\alpha' },
      { label: 'β', latex: '\\beta' },
      { label: 'γ', latex: '\\gamma' },
      { label: 'δ', latex: '\\delta' },
      { label: 'ε', latex: '\\epsilon' },
      { label: 'ζ', latex: '\\zeta' },
      { label: 'η', latex: '\\eta' },
      { label: 'θ', latex: '\\theta' },
      { label: 'ι', latex: '\\iota' },
      { label: 'κ', latex: '\\kappa' },
      { label: 'λ', latex: '\\lambda' },
      { label: 'μ', latex: '\\mu' },
      { label: 'ν', latex: '\\nu' },
      { label: 'ξ', latex: '\\xi' },
      { label: 'ο', latex: 'o' },
      { label: 'π', latex: '\\pi' },
      { label: 'ρ', latex: '\\rho' },
      { label: 'σ', latex: '\\sigma' },
      { label: 'τ', latex: '\\tau' },
      { label: 'υ', latex: '\\upsilon' },
      { label: 'φ', latex: '\\phi' },
      { label: 'χ', latex: '\\chi' },
      { label: 'ψ', latex: '\\psi' },
      { label: 'ω', latex: '\\omega' },
    ],
    'greek-upper': [
      { label: 'Α', latex: 'A' },
      { label: 'Β', latex: 'B' },
      { label: 'Γ', latex: '\\Gamma' },
      { label: 'Δ', latex: '\\Delta' },
      { label: 'Ε', latex: 'E' },
      { label: 'Ζ', latex: 'Z' },
      { label: 'Η', latex: 'H' },
      { label: 'Θ', latex: '\\Theta' },
      { label: 'Ι', latex: 'I' },
      { label: 'Κ', latex: 'K' },
      { label: 'Λ', latex: '\\Lambda' },
      { label: 'Μ', latex: 'M' },
      { label: 'Ν', latex: 'N' },
      { label: 'Ξ', latex: '\\Xi' },
      { label: 'Ο', latex: 'O' },
      { label: 'Π', latex: '\\Pi' },
      { label: 'Ρ', latex: 'P' },
      { label: 'Σ', latex: '\\Sigma' },
      { label: 'Τ', latex: 'T' },
      { label: 'Υ', latex: '\\Upsilon' },
      { label: 'Φ', latex: '\\Phi' },
      { label: 'Χ', latex: 'X' },
      { label: 'Ψ', latex: '\\Psi' },
      { label: 'Ω', latex: '\\Omega' },
    ],
    'trig': [
      { label: 'sin', latex: '\\sin' },
      { label: 'cos', latex: '\\cos' },
      { label: 'tan', latex: '\\tan' },
      { label: 'cot', latex: '\\cot' },
      { label: 'sec', latex: '\\sec' },
      { label: 'csc', latex: '\\csc' },
      { label: 'arcsin', latex: '\\arcsin' },
      { label: 'arccos', latex: '\\arccos' },
      { label: 'arctan', latex: '\\arctan' },
      { label: 'sinh', latex: '\\sinh' },
      { label: 'cosh', latex: '\\cosh' },
      { label: 'tanh', latex: '\\tanh' },
      { label: 'sin²', latex: '\\sin^{2}' },
      { label: 'cos²', latex: '\\cos^{2}' },
      { label: 'sin⁻¹', latex: '\\sin^{-1}' },
      { label: 'cos⁻¹', latex: '\\cos^{-1}' },
    ],
    'operators': [
      { label: '≥', latex: '\\geq' },
      { label: '≤', latex: '\\leq' },
      { label: '≠', latex: '\\neq' },
      { label: '≈', latex: '\\approx' },
      { label: '≡', latex: '\\equiv' },
      { label: '∝', latex: '\\propto' },
      { label: '→', latex: '\\to' },
      { label: '⇒', latex: '\\Rightarrow' },
      { label: '⇔', latex: '\\Leftrightarrow' },
      { label: '÷', latex: '\\div' },
      { label: '×', latex: '\\times' },
      { label: '±', latex: '\\pm' },
      { label: '∓', latex: '\\mp' },
      { label: '∈', latex: '\\in' },
      { label: '∉', latex: '\\notin' },
      { label: '⊂', latex: '\\subset' },
      { label: '⊃', latex: '\\supset' },
      { label: '⊆', latex: '\\subseteq' },
      { label: '∪', latex: '\\cup' },
      { label: '∩', latex: '\\cap' },
      { label: '∀', latex: '\\forall' },
      { label: '∃', latex: '\\exists' },
      { label: '∅', latex: '\\emptyset' },
      { label: '∴', latex: '\\therefore' },
    ],
    'chemistry': [
      { label: 'H₂O', latex: 'H_2O' },
      { label: 'CO₂', latex: 'CO_2' },
      { label: 'O₂', latex: 'O_2' },
      { label: 'H₂', latex: 'H_2' },
      { label: 'N₂', latex: 'N_2' },
      { label: 'NaCl', latex: 'NaCl' },
      { label: 'H₂SO₄', latex: 'H_2SO_4' },
      { label: 'NaOH', latex: 'NaOH' },
      { label: 'CH₄', latex: 'CH_4' },
      { label: 'C₆H₁₂O₆', latex: 'C_6H_{12}O_6' },
      { label: 'xₙ', latex: 'x_n' },
      { label: 'aₘₙ', latex: 'a_{mn}' },
      { label: '→', latex: '\\rightarrow' },
      { label: '⇌', latex: '\\rightleftharpoons' },
      { label: 'Δ', latex: '\\Delta' },
      { label: '°C', latex: '^{\\circ}C' },
    ],
  }

  // Fórmulas comunes predefinidas
  const QUICK_FORMULAS = [
    { label: 'Cuadrática', latex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' },
    { label: 'Pitágoras', latex: 'a^2 + b^2 = c^2' },
    { label: 'Área círculo', latex: 'A = \\pi r^2' },
    { label: 'Derivada', latex: '\\frac{d}{dx}f(x)' },
    { label: 'Integral', latex: '\\int_{a}^{b} f(x) dx' },
    { label: 'Límite', latex: '\\lim_{x \\to \\infty}' },
  ]

  // Figuras 2D - SVG paths
  const SHAPES_2D: Record<string, { label: string; viewBox: string; path: string }> = {
    'square': { label: 'Cuadrado', viewBox: '0 0 100 100', path: 'M10 10 H90 V90 H10 Z' },
    'circle': { label: 'Círculo', viewBox: '0 0 100 100', path: 'M50 10 A40 40 0 1 1 49.99 10' },
    'triangle': { label: 'Triángulo', viewBox: '0 0 100 100', path: 'M50 10 L90 90 L10 90 Z' },
    'rectangle': { label: 'Rectángulo', viewBox: '0 0 140 100', path: 'M10 20 H130 V80 H10 Z' },
    'pentagon': { label: 'Pentágono', viewBox: '0 0 100 100', path: 'M50 5 L97 38 L79 92 L21 92 L3 38 Z' },
    'hexagon': { label: 'Hexágono', viewBox: '0 0 100 100', path: 'M25 10 L75 10 L95 50 L75 90 L25 90 L5 50 Z' },
    'trapezoid': { label: 'Trapecio', viewBox: '0 0 140 100', path: 'M30 20 H110 L130 80 H10 Z' },
  }

  // Figuras 3D - Usando archivos SVG de alta calidad
  const SHAPES_3D: Record<string, { label: string; src: string }> = {
    'tetrahedron': { label: 'Tetraedro', src: '/shapes/tetrahedron.svg' },
    'pyramid': { label: 'Pirámide', src: '/shapes/pyramid.svg' },
    'pyramid-hexagonal': { label: 'Pir. Hexagonal', src: '/shapes/pyramid-hexagonal.svg' },
    'cone': { label: 'Cono', src: '/shapes/cone.svg' },
    'cube': { label: 'Cubo', src: '/shapes/cube-2.svg' },
    'cuboid': { label: 'Cuboide', src: '/shapes/cuboid.svg' },
    'prism-triangular': { label: 'Prisma Triang.', src: '/shapes/prism-triangular.svg' },
    'prism-pentagonal': { label: 'Prisma Pent.', src: '/shapes/prism-pentagonal.svg' },
    'prism-hexagonal': { label: 'Prisma Hex.', src: '/shapes/prism-hexagonal.svg' },
    'cylinder': { label: 'Cilindro', src: '/shapes/cylinder.svg' },
    'octahedron': { label: 'Octaedro', src: '/shapes/octahedron.svg' },
    'icosahedron': { label: 'Icosaedro', src: '/shapes/icosahedron.svg' },
    'sphere': { label: 'Esfera', src: '/shapes/sphere.svg' },
  }

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Dropdowns
  const [showPenSizes, setShowPenSizes] = useState(false)
  const [showEraserSizes, setShowEraserSizes] = useState(false)

  // Selección de elementos
  const [selectedElements, setSelectedElements] = useState<Array<{ type: 'stroke' | 'text' | 'formula' | 'shape'; id: string }>>([])
  const selectedElementsRef = useRef<Array<{ type: 'stroke' | 'text' | 'formula' | 'shape'; id: string }>>([])
  
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

  // Zoom por cuadrante
  const [quadrantZoom, setQuadrantZoom] = useState<number[]>([1, 1, 1, 1])
  const [editingZoom, setEditingZoom] = useState<number | null>(null)
  const [zoomInputValue, setZoomInputValue] = useState('')
  const zoomInputRef = useRef<HTMLInputElement>(null)

  // Funciones de zoom
  const zoomIn = (quadrantIndex: number) => {
    setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? Math.min(z + 0.25, 3) : z))
  }
  const zoomOut = (quadrantIndex: number) => {
    setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? Math.max(z - 0.25, 0.5) : z))
  }
  const resetZoom = (quadrantIndex: number) => {
    setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? 1 : z))
  }

  // Mantener ref sincronizado con state
  useEffect(() => {
    selectedElementsRef.current = selectedElements
  }, [selectedElements])

  // Funciones de selección
  const isElementSelected = (type: 'stroke' | 'text' | 'formula' | 'shape', id: string, useRef = false) => {
    const elements = useRef ? selectedElementsRef.current : selectedElements
    return elements.some(el => el.type === type && el.id === id)
  }

  const toggleSelection = (type: 'stroke' | 'text' | 'formula' | 'shape', id: string, addToSelection: boolean) => {
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
    const all: Array<{ type: 'stroke' | 'text' | 'formula' | 'shape'; id: string }> = []
    quadrantContent.strokes.forEach(s => all.push({ type: 'stroke', id: s.id }))
    ;(quadrantContent.textBoxes || []).forEach(t => all.push({ type: 'text', id: t.id }))
    ;(quadrantContent.formulas || []).forEach(f => all.push({ type: 'formula', id: f.id }))
    ;(quadrantContent.shapes || []).forEach(sh => all.push({ type: 'shape', id: sh.id }))
    setSelectedElements(all)
  }

  const deleteSelectedElements = () => {
    // Usar la ref para obtener los elementos seleccionados actuales
    if (selectedElementsRef.current.length === 0) return
    
    const quadrantContent = quadrants[activeQuadrant].content
    const newContent = {
      strokes: quadrantContent.strokes.filter(s => !isElementSelected('stroke', s.id, true)),
      textBoxes: (quadrantContent.textBoxes || []).filter(t => !isElementSelected('text', t.id, true)),
      formulas: (quadrantContent.formulas || []).filter(f => !isElementSelected('formula', f.id, true)),
      shapes: (quadrantContent.shapes || []).filter(sh => !isElementSelected('shape', sh.id, true)),
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
      shapes: (quadrantContent.shapes || []).map(sh => {
        if (isElementSelected('shape', sh.id)) {
          return { ...sh, x: sh.x + deltaX, y: sh.y + deltaY }
        }
        return sh
      }),
    }
    updateQuadrantContent(activeQuadrant, newContent)
  }

  // Función helper para obtener coordenadas correctas del canvas
  const getCanvasCoordinates = (e: React.MouseEvent, quadrantIndex: number): { x: number; y: number } | null => {
    // Usar el canvas directamente para obtener coordenadas precisas
    const canvasRef = canvasRefs.current[quadrantIndex]
    const canvas = canvasRef?.getCanvas?.()
    
    // Calcular el zoom efectivo (considerando pantalla completa)
    let effectiveZoom = quadrantZoom[quadrantIndex]
    if (zoomedQuadrant === quadrantIndex && originalQuadrantSize) {
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const scaleX = screenWidth / originalQuadrantSize.width
      const scaleY = screenHeight / originalQuadrantSize.height
      effectiveZoom = Math.min(scaleX, scaleY) * quadrantZoom[quadrantIndex]
    }
    
    if (!canvas) {
      // Fallback al contenedor si el canvas no está disponible
      const container = canvasContainerRefs.current[quadrantIndex]
      if (!container) return null
      
      const rect = container.getBoundingClientRect()
      const x = (e.clientX - rect.left) / effectiveZoom
      const y = (e.clientY - rect.top) / effectiveZoom
      return { x, y }
    }
    
    // El canvas ya está dentro del div transformado, así que getBoundingClientRect
    // devuelve las coordenadas visuales correctas
    const rect = canvas.getBoundingClientRect()
    
    // Convertir a coordenadas lógicas del canvas
    const x = (e.clientX - rect.left) / effectiveZoom
    const y = (e.clientY - rect.top) / effectiveZoom
    
    return { x, y }
  }

  // Handlers de drag
  const handleDragStart = (e: React.MouseEvent, type: 'stroke' | 'text' | 'formula' | 'shape', id: string) => {
    if (currentTool !== 'select') return
    e.stopPropagation()
    
    // Lógica profesional de selección
    let newSelection: Array<{ type: 'stroke' | 'text' | 'formula' | 'shape'; id: string }>
    
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
    const coords = getCanvasCoordinates(e, activeQuadrant)
    if (!coords) return
    
    const zoom = quadrantZoom[activeQuadrant]
    const { x: currentX, y: currentY } = coords

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
      } else if (selected.type === 'shape') {
        updateQuadrantContent(activeQuadrant, {
          ...quadrantContent,
          shapes: (quadrantContent.shapes || []).map(sh =>
            sh.id === selected.id ? { ...sh, scale: newScale } : sh
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
    
    // Ajustar delta por el zoom (zoom ya definido arriba)
    const deltaX = (e.clientX - dragStart.x) / zoom
    const deltaY = (e.clientY - dragStart.y) / zoom
    
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
      const newSelection: Array<{ type: 'stroke' | 'text' | 'formula' | 'shape'; id: string }> = []
      
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
      
      // Seleccionar formas que intersecten
      ;(quadrantContent.shapes || []).forEach(shape => {
        if (shape.x >= minX && shape.x <= maxX && shape.y >= minY && shape.y <= maxY) {
          newSelection.push({ type: 'shape', id: shape.id })
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
    
    const coords = getCanvasCoordinates(e, quadrantIndex)
    if (!coords) return
    const { x, y } = coords
    
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

  // Sincronizar formulaInput cuando cambia de pizarra (solo en modo tiempo real)
  useEffect(() => {
    if (showFormulaBar && !formulaModoLibre) {
      const currentLatex = quadrants[activeQuadrant].latexContent || ''
      setFormulaInput(currentLatex)
      if (currentLatex) {
        try {
          const html = katex.renderToString(currentLatex, { throwOnError: true, displayMode: true })
          setFormulaPreview(html)
          setFormulaError('')
        } catch {
          setFormulaPreview('')
          setFormulaError('')
        }
      } else {
        setFormulaPreview('')
        setFormulaError('')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuadrant, showFormulaBar, formulaModoLibre])

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Verificar si el foco está en un input o textarea
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      
      // Delete para eliminar seleccionados (solo si no hay foco en input/textarea)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementsRef.current.length > 0 && !inlineEditingTextId && !isInputFocused) {
          e.preventDefault()
          deleteSelectedElements()
        }
      }
      // Escape para deseleccionar o cerrar edición
      if (e.key === 'Escape') {
        if (pendingPlacement) {
          cancelPlacement()
        } else if (inlineEditingTextId) {
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
  }, [selectedElements, currentTool, inlineEditingTextId, showFormulaBar, activeQuadrant, quadrants, pendingPlacement])

  // Función para cargar una pizarra en un cuadrante (definida antes del useEffect)
  const loadWhiteboardById = async (quadrantIndex: number, whiteboardId: string) => {
    try {
      const response = await fetch(`/api/whiteboard?id=${whiteboardId}`)
      if (response.ok) {
        const data = await response.json()
        setQuadrants(prev => prev.map((q, i) => 
          i === quadrantIndex 
            ? { 
                id: whiteboardId, 
                title: data.title, 
                content: data.content || { strokes: [], formulas: [] }, 
                isDirty: false,
                latexContent: data.content?.latexContent || '',
                latexFontSize: data.content?.latexFontSize || 24,
                bgColor: data.content?.bgColor || q.bgColor || '#ffffff'
              }
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
        const content = data.content || { strokes: [], formulas: [] }
        setQuadrants(prev => prev.map((q, i) => 
          i === quadrantIndex 
            ? { 
                id: whiteboardId, 
                title: data.title, 
                content: { 
                  strokes: content.strokes || [], 
                  formulas: content.formulas || [],
                  textBoxes: content.textBoxes || [],
                  shapes: content.shapes || [],
                }, 
                isDirty: false,
                latexContent: content.latexContent || '',
                latexFontSize: content.latexFontSize || 38,
                bgColor: content.bgColor || q.bgColor || '#ffffff'
              }
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
            ? { id: data.id, title: data.title || title, content: { strokes: [], formulas: [] }, isDirty: false, latexContent: '', latexFontSize: 38, bgColor: q.bgColor }
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
        ? { id: null, title: `Pizarra ${quadrantIndex + 1}`, content: { strokes: [], formulas: [] }, isDirty: false, latexContent: '', latexFontSize: 38, bgColor: q.bgColor }
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

  // Actualizar color de fondo de un cuadrante
  const updateQuadrantBgColor = (quadrantIndex: number, bgColor: string) => {
    setQuadrants(prev => prev.map((q, i) => 
      i === quadrantIndex 
        ? { ...q, bgColor }
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
      // Incluir latexContent y latexFontSize en el content al guardar
      const contentToSave = {
        ...quadrant.content,
        latexContent: quadrant.latexContent,
        latexFontSize: quadrant.latexFontSize,
      }
      const response = await fetch('/api/whiteboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quadrant.id,
          title: quadrant.title,
          content: contentToSave,
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
    
    const coords = getCanvasCoordinates(e, quadrantIndex)
    if (!coords) return
    const { x, y } = coords
    
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
    // Cargar el latexContent existente del cuadrante activo
    const existingLatex = quadrants[activeQuadrant].latexContent || ''
    setFormulaInput(existingLatex)
    setFormulaModoLibre(false) // Modo tiempo real
    if (existingLatex) {
      try {
        const html = katex.renderToString(existingLatex, { throwOnError: true, displayMode: true })
        setFormulaPreview(html)
        setFormulaError('')
      } catch {
        setFormulaPreview('')
        setFormulaError('')
      }
    } else {
      setFormulaPreview('')
    }
    setFormulaError('')
    setFormulaScale(1.5)
    setEditingFormulaId(null)
    setFormulaPosition({ x: 100, y: 200 })
    setShowFormulaBar(true)
    setCurrentTool('formula')
    setTimeout(() => formulaInputRef.current?.focus(), 100)
  }

  // Agregar fórmula en modo libre (insertar con clic)
  const handleAddFormulaLibre = () => {
    setFormulaInput('')
    setFormulaPreview('')
    setFormulaError('')
    setFormulaModoLibre(true) // Modo insertar con clic
    setFormulaScale(1.5)
    setEditingFormulaId(null)
    setFormulaPosition({ x: 100, y: 200 })
    setShowFormulaBar(true)
    setCurrentTool('formula')
    setTimeout(() => formulaInputRef.current?.focus(), 100)
  }

  const handleFormulaChange = (latex: string) => {
    setFormulaInput(latex)
    // Actualizar latexContent en tiempo real solo si NO está en modo libre
    if (!formulaModoLibre) {
      handleLatexContentChange(latex)
    }
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

    // Si estamos editando una fórmula existente, guardar directamente
    if (editingFormulaId) {
      const quadrantContent = quadrants[activeQuadrant].content
      const existingFormula = (quadrantContent.formulas || []).find(f => f.id === editingFormulaId)
      
      const updatedFormula: WhiteboardFormula = {
        id: editingFormulaId,
        latex: formulaInput,
        x: existingFormula?.x || 100,
        y: existingFormula?.y || 100,
        scale: formulaScale,
      }

      const newContent: WhiteboardContent = {
        ...quadrantContent,
        formulas: (quadrantContent.formulas || []).map(f => f.id === editingFormulaId ? updatedFormula : f),
      }

      updateQuadrantContent(activeQuadrant, newContent)
      setShowFormulaBar(false)
      setFormulaInput('')
      setEditingFormulaId(null)
      setCurrentTool('pen')
    } else {
      // Nueva fórmula: activar placement mode
      setPendingPlacement({
        type: 'formula',
        data: { latex: formulaInput, scale: formulaScale }
      })
      setShowFormulaBar(false)
      setFormulaInput('')
      setCurrentTool('formula')
    }
  }

  const handleCancelFormula = () => {
    setShowFormulaBar(false)
    setFormulaInput('')
    setEditingFormulaId(null)
    setCurrentTool('pen')
  }

  // ========== EDITOR LATEX EN TIEMPO REAL ==========
  // Actualizar el contenido LaTeX del cuadrante activo
  const handleLatexContentChange = (latex: string) => {
    setQuadrants(prev => prev.map((q, i) => 
      i === activeQuadrant 
        ? { ...q, latexContent: latex, isDirty: true }
        : q
    ))
  }

  // Actualizar el tamaño de fuente del LaTeX del cuadrante activo
  const handleLatexFontSizeChange = (size: number) => {
    setQuadrants(prev => prev.map((q, i) => 
      i === activeQuadrant 
        ? { ...q, latexFontSize: Math.max(12, Math.min(72, size)), isDirty: true }
        : q
    ))
  }

  // Insertar snippet en el LaTeX del cuadrante activo
  const insertLatexSnippet = (snippet: string) => {
    const currentLatex = quadrants[activeQuadrant].latexContent
    handleLatexContentChange(currentLatex + snippet)
  }

  // Renderizar LaTeX a HTML con KaTeX
  const renderLatexToHtml = (latex: string): string => {
    if (!latex.trim()) return ''
    try {
      // Procesar líneas individualmente
      const lines = latex.split('\n').map(line => {
        if (line.length === 0) return ' '
        // Quitar \\ del final de línea (ya que usamos <br/> para el salto visual)
        let cleanLine = line.replace(/\s*\\\\$/, '').trim()
        if (cleanLine.length === 0) return ' '
        // Si no tiene $, envolver en $
        const temp = cleanLine.includes('$') ? cleanLine : `$${cleanLine}$`
        return temp.replace(/ /g, '\u00A0') // Espacios no-breaking
      })
      
      // Renderizar cada línea
      return lines.map(line => {
        try {
          // Extraer contenido entre $ y renderizar
          const mathContent = line.replace(/^\$/, '').replace(/\$$/, '')
          return katex.renderToString(mathContent, { throwOnError: false, displayMode: false })
        } catch {
          return line
        }
      }).join('<br/>')
    } catch {
      return latex
    }
  }
  // ========== FIN EDITOR LATEX EN TIEMPO REAL ==========

  // Insertar figura geométrica (activar placement mode)
  const insertShape = (shapeType: string) => {
    if (activeQuadrant === null) return
    
    setPendingPlacement({
      type: 'shape',
      data: { shapeType, color: currentColor }
    })
    setCurrentTool('formula') // Usamos formula tool para el placement mode
  }

  // Colocar elemento pendiente en la posición del click
  const handlePlacementClick = (e: React.MouseEvent, quadrantIndex: number) => {
    if (!pendingPlacement) return
    if (activeQuadrant !== quadrantIndex) return
    
    const coords = getCanvasCoordinates(e, quadrantIndex)
    if (!coords) return
    const { x, y } = coords
    
    const quadrantContent = quadrants[quadrantIndex].content
    
    if (pendingPlacement.type === 'formula') {
      const newFormula: WhiteboardFormula = {
        id: `formula-${Date.now()}`,
        latex: pendingPlacement.data.latex || '',
        x,
        y,
        scale: pendingPlacement.data.scale || 1.5,
      }
      
      updateQuadrantContent(quadrantIndex, {
        ...quadrantContent,
        formulas: [...(quadrantContent.formulas || []), newFormula],
      })
    } else if (pendingPlacement.type === 'shape') {
      const newShape: WhiteboardShape = {
        id: `shape-${Date.now()}`,
        shapeType: pendingPlacement.data.shapeType || 'circle',
        x,
        y,
        scale: 1,
        color: pendingPlacement.data.color || currentColor,
      }
      
      updateQuadrantContent(quadrantIndex, {
        ...quadrantContent,
        shapes: [...(quadrantContent.shapes || []), newShape],
      })
    }
    
    setPendingPlacement(null)
    setCursorPosition(null)
    setCurrentTool('pen')
  }

  // Cancelar placement mode con Escape
  const cancelPlacement = () => {
    setPendingPlacement(null)
    setCursorPosition(null)
    setCurrentTool('pen')
  }

  // Determinar cuántos cuadrantes mostrar según el modo
  // Siempre usa índices consecutivos: 0, 1, 2, 3
  const getVisibleQuadrants = () => {
    // Si hay zoom a pantalla completa, mostrar solo ese cuadrante
    if (zoomedQuadrant !== null) {
      return [zoomedQuadrant]
    }
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
    // Si hay zoom a pantalla completa, no necesita grid
    if (zoomedQuadrant !== null) {
      return ''
    }
    switch (viewMode) {
      case '1': return 'grid-cols-1 grid-rows-1'
      case '2h': return 'grid-cols-2 grid-rows-1'
      case '2v': return 'grid-cols-1 grid-rows-2'
      case '4': return 'grid-cols-2 grid-rows-2'
      default: return 'grid-cols-2 grid-rows-2'
    }
  }

  // Toggle zoom de cuadrante (pantalla completa)
  // Guarda el tamaño original del cuadrante para calcular la escala proporcional
  const toggleZoom = (quadrantIndex: number) => {
    if (zoomedQuadrant === quadrantIndex) {
      // Salir de pantalla completa
      setZoomedQuadrant(null)
      setOriginalQuadrantSize(null)
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    } else {
      // Guardar tamaño original antes de expandir
      const container = quadrantContainerRefs.current[quadrantIndex]
      if (container) {
        const rect = container.getBoundingClientRect()
        setOriginalQuadrantSize({ width: rect.width, height: rect.height })
      }
      // Entrar en pantalla completa
      setZoomedQuadrant(quadrantIndex)
      setActiveQuadrant(quadrantIndex)
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    }
  }

  // Calcular escala proporcional para pantalla completa
  const getFullscreenScale = (quadrantIndex: number): number => {
    if (zoomedQuadrant !== quadrantIndex || !originalQuadrantSize) return quadrantZoom[quadrantIndex]
    
    // Calcular cuánto más grande es la pantalla vs el cuadrante original
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const scaleX = screenWidth / originalQuadrantSize.width
    const scaleY = screenHeight / originalQuadrantSize.height
    // Usar la escala menor para que quepa todo, multiplicado por el zoom actual
    return Math.min(scaleX, scaleY) * quadrantZoom[quadrantIndex]
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
                
                {/* Lápiz con modos */}
                <div className="relative pen-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentTool('pen')
                      setShowPenSizes(!showPenSizes)
                      setShowEraserSizes(false)
                    }}
                    className={`p-2 rounded flex items-center gap-1 ${currentTool === 'pen' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
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
                  className={`p-2 rounded ${currentTool === 'formula' && !formulaModoLibre ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Fórmula (tiempo real)"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="4" y="17" fontSize="14" fontWeight="bold" fontStyle="italic">fx</text>
                  </svg>
                </button>
                <button
                  onClick={handleAddFormulaLibre}
                  className={`p-2 rounded ${currentTool === 'formula' && formulaModoLibre ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Fórmula (posición libre - clic para colocar)"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="0" y="14" fontSize="9" fontWeight="bold" fontStyle="italic">fx</text>
                    <text x="10" y="20" fontSize="7" fill="#6b7280">+</text>
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
          <div className={`flex-1 grid ${zoomedQuadrant === null ? getGridClass() : ''} gap-1 p-2 bg-gray-200 relative`}>
            {getVisibleQuadrants().map(quadrantIndex => (
              <div
                key={quadrantIndex}
                ref={el => { quadrantContainerRefs.current[quadrantIndex] = el }}
                className={`group/quadrant relative bg-white rounded-lg overflow-hidden transition-all ${
                  zoomedQuadrant === quadrantIndex 
                    ? 'fixed inset-0 z-50 rounded-none' 
                    : activeQuadrant === quadrantIndex 
                      ? 'ring-4 ring-primary-500 shadow-lg' 
                      : 'ring-1 ring-gray-300 hover:ring-2 hover:ring-gray-400'
                }`}
                onClick={() => {
                  if (activeQuadrant !== quadrantIndex) {
                    setSelectedElements([]) // Limpiar selección al cambiar de cuadrante
                    setActiveQuadrant(quadrantIndex)
                  }
                }}
                onDoubleClick={(e) => {
                  // Solo hacer zoom si no está en modo dibujo y no es un elemento interactivo
                  const target = e.target as HTMLElement
                  if (
                    currentTool === 'pen' || currentTool === 'eraser' ||
                    target.closest('button') || 
                    target.closest('[data-selectable]') ||
                    target.closest('input') ||
                    target.closest('textarea')
                  ) return
                  toggleZoom(quadrantIndex)
                }}
              >
                {/* Indicador de zoom - botón para salir */}
                {zoomedQuadrant === quadrantIndex && (
                  <div className="absolute top-2 right-2 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleZoom(quadrantIndex)
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium shadow-lg hover:bg-primary-700 transition-all"
                      title="Doble clic o clic aquí para salir"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Salir
                    </button>
                  </div>
                )}

                {/* Selector de color de fondo por cuadrante - esquina derecha */}
                {quadrants[quadrantIndex].id && zoomedQuadrant !== quadrantIndex && (
                  <div className="absolute top-2 right-2 z-10">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/95 shadow-sm border border-gray-200">
                      {BG_COLORS.map(color => (
                        <button
                          key={color.value}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateQuadrantBgColor(quadrantIndex, color.value)
                          }}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            quadrants[quadrantIndex].bgColor === color.value
                              ? 'border-primary-500 scale-110 ring-1 ring-primary-200'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

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

                {/* Banner de placement mode */}
                {pendingPlacement && activeQuadrant === quadrantIndex && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-yellow-100 border border-yellow-400 rounded-lg shadow-md text-sm">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>
                    <span className="text-yellow-800 font-medium">
                      Haz clic donde quieres colocar {pendingPlacement.type === 'formula' ? 'la fórmula' : 'la figura'}
                    </span>
                    <button
                      onClick={cancelPlacement}
                      className="ml-2 px-2 py-0.5 text-xs bg-yellow-200 hover:bg-yellow-300 rounded text-yellow-800 transition-colors"
                    >
                      Cancelar (Esc)
                    </button>
                  </div>
                )}

                {/* Canvas del cuadrante - Solo si hay pizarra creada */}
                {quadrants[quadrantIndex].id ? (
                  <div
                    ref={el => { canvasContainerRefs.current[quadrantIndex] = el }}
                    className="absolute inset-0 overflow-auto"
                    onMouseDown={(e) => {
                      // Si este cuadrante no está activo, activarlo primero
                      if (activeQuadrant !== quadrantIndex) {
                        setSelectedElements([])
                        selectedElementsRef.current = []
                        setActiveQuadrant(quadrantIndex)
                        return // No procesar el clic hasta que el cuadrante esté activo
                      }
                      if (currentTool === 'select') {
                        handleCanvasMouseDown(e, quadrantIndex)
                      }
                    }}
                    onClick={(e) => {
                      // Verificar que este cuadrante esté activo
                      if (activeQuadrant !== quadrantIndex) return
                      // Placement mode: colocar elemento pendiente
                      if (pendingPlacement) {
                        handlePlacementClick(e, quadrantIndex)
                        return
                      }
                      if (currentTool === 'text') {
                        handleCanvasClickForText(e, quadrantIndex)
                      }
                    }}
                    onMouseMove={(e) => {
                      if (activeQuadrant === quadrantIndex) {
                        handleDragMove(e)
                        // Actualizar posición del cursor para preview en placement mode
                        if (pendingPlacement) {
                          const coords = getCanvasCoordinates(e, quadrantIndex)
                          if (coords) setCursorPosition(coords)
                        }
                      }
                    }}
                    onMouseUp={() => {
                      if (activeQuadrant === quadrantIndex) {
                        handleDragEnd()
                      }
                    }}
                    onMouseLeave={() => {
                      if (activeQuadrant === quadrantIndex) {
                        handleDragEnd()
                      }
                    }}
                  >
                    {/* Contenedor con zoom */}
                    <div
                      className="relative transition-transform duration-150"
                      style={{ 
                        width: zoomedQuadrant === quadrantIndex && originalQuadrantSize ? originalQuadrantSize.width : '100%',
                        height: zoomedQuadrant === quadrantIndex && originalQuadrantSize ? originalQuadrantSize.height : '100%',
                        transform: `scale(${getFullscreenScale(quadrantIndex)})`,
                        transformOrigin: 'top left',
                      }}
                    >
                    <WhiteboardCanvas
                    ref={el => { canvasRefs.current[quadrantIndex] = el }}
                    content={quadrants[quadrantIndex].content}
                    onContentChange={(content) => updateQuadrantContent(quadrantIndex, content)}
                    currentColor={currentColor}
                    currentSize={currentSize}
                    currentTool={activeQuadrant === quadrantIndex ? currentTool : 'select'}
                    penMode={penMode}
                    bgColor={quadrants[quadrantIndex].bgColor}
                    onHistoryChange={() => {}}
                    zoom={getFullscreenScale(quadrantIndex)}
                    selectedStrokeIds={
                      activeQuadrant === quadrantIndex
                        ? selectedElements.filter(el => el.type === 'stroke').map(el => el.id)
                        : []
                    }
                  />

                  {/* Contenido LaTeX renderizado en tiempo real - posición fija */}
                  {quadrants[quadrantIndex].latexContent && (
                    <div
                      className="absolute pointer-events-none z-[1]"
                      style={{
                        top: 45,
                        left: 25,
                        fontSize: quadrants[quadrantIndex].latexFontSize,
                        fontFamily: "'KaTeX_Main', serif",
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}
                      dangerouslySetInnerHTML={{ __html: renderLatexToHtml(quadrants[quadrantIndex].latexContent) }}
                    />
                  )}

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

                  {/* Figuras geométricas */}
                  {(quadrants[quadrantIndex].content.shapes || []).map(shape => (
                    <div
                      key={shape.id}
                      data-selectable="shape"
                      className={`absolute select-none transition-all ${
                        currentTool === 'select'
                          ? isElementSelected('shape', shape.id)
                            ? 'ring-2 ring-primary-500 cursor-move'
                            : 'cursor-pointer hover:ring-2 hover:ring-primary-300'
                          : 'cursor-pointer hover:ring-2 hover:ring-primary-300'
                      }`}
                      style={{
                        left: shape.x,
                        top: shape.y,
                        transform: `scale(${shape.scale})`,
                        transformOrigin: 'top left',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (currentTool === 'select') {
                          toggleSelection('shape', shape.id, e.shiftKey)
                        }
                      }}
                      onMouseDown={(e) => handleDragStart(e, 'shape', shape.id)}
                    >
                      {SHAPES_2D[shape.shapeType] ? (
                        <svg 
                          width="60" 
                          height="60" 
                          viewBox={SHAPES_2D[shape.shapeType].viewBox}
                          fill="none" 
                          stroke={shape.color} 
                          strokeWidth="4"
                          strokeLinejoin="round"
                        >
                          <path d={SHAPES_2D[shape.shapeType].path} />
                        </svg>
                      ) : SHAPES_3D[shape.shapeType] ? (
                        <img 
                          src={SHAPES_3D[shape.shapeType].src}
                          alt={SHAPES_3D[shape.shapeType].label}
                          width="60" 
                          height="60"
                          className="pointer-events-none"
                          style={{ filter: shape.color !== '#000000' ? `drop-shadow(0 0 0 ${shape.color})` : 'none' }}
                          draggable={false}
                        />
                      ) : null}
                      {/* Handle de redimensionar */}
                      {currentTool === 'select' && isElementSelected('shape', shape.id) && selectedElements.length === 1 && (
                        <div
                          className="absolute -right-2 -bottom-2 w-4 h-4 bg-primary-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
                          style={{ transform: `scale(${1/shape.scale})` }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleResizeStart(e, shape.scale)
                          }}
                        />
                      )}
                    </div>
                  ))}

                  {/* Preview del elemento pendiente siguiendo el cursor */}
                  {pendingPlacement && activeQuadrant === quadrantIndex && cursorPosition && (
                    <div
                      className="absolute pointer-events-none opacity-60"
                      style={{
                        left: cursorPosition.x,
                        top: cursorPosition.y,
                        transform: pendingPlacement.type === 'formula' 
                          ? `scale(${pendingPlacement.data.scale || 1.5})` 
                          : 'scale(1)',
                        transformOrigin: 'top left',
                      }}
                    >
                      {pendingPlacement.type === 'formula' && pendingPlacement.data.latex && (
                        <div 
                          className="bg-yellow-100 border-2 border-dashed border-yellow-400 rounded p-1"
                          dangerouslySetInnerHTML={{
                            __html: katex.renderToString(pendingPlacement.data.latex, { throwOnError: false, displayMode: true })
                          }} 
                        />
                      )}
                      {pendingPlacement.type === 'shape' && pendingPlacement.data.shapeType && (
                        <div className="bg-blue-100 border-2 border-dashed border-blue-400 rounded p-1">
                          {SHAPES_2D[pendingPlacement.data.shapeType] ? (
                            <svg 
                              width="60" 
                              height="60" 
                              viewBox={SHAPES_2D[pendingPlacement.data.shapeType].viewBox}
                              fill="none" 
                              stroke={pendingPlacement.data.color || '#000000'} 
                              strokeWidth="4"
                              strokeLinejoin="round"
                            >
                              <path d={SHAPES_2D[pendingPlacement.data.shapeType].path} />
                            </svg>
                          ) : SHAPES_3D[pendingPlacement.data.shapeType] ? (
                            <img 
                              src={SHAPES_3D[pendingPlacement.data.shapeType].src}
                              alt={SHAPES_3D[pendingPlacement.data.shapeType].label}
                              width="60" 
                              height="60"
                              draggable={false}
                            />
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                  </div>
                ) : (
                  /* Cuadrante vacío - Mostrar botón para agregar pizarra */
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
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

                {/* Control de Zoom - solo visible en hover */}
                {quadrants[quadrantIndex].id && (
                  <div 
                    className="absolute bottom-2 right-2 z-30 opacity-0 group-hover/quadrant:opacity-100 transition-opacity duration-200"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      {/* Lupa con porcentaje editable */}
                      <div className="flex items-center gap-1 px-2 py-1.5 bg-white rounded-lg shadow-md border border-gray-200">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {editingZoom === quadrantIndex ? (
                          <input
                            ref={zoomInputRef}
                            type="text"
                            value={zoomInputValue}
                            onChange={(e) => setZoomInputValue(e.target.value.replace(/[^0-9]/g, ''))}
                            onBlur={() => {
                              const value = parseInt(zoomInputValue) || 100
                              const clampedValue = Math.max(10, Math.min(400, value))
                              setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? clampedValue / 100 : z))
                              setEditingZoom(null)
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') {
                                const value = parseInt(zoomInputValue) || 100
                                const clampedValue = Math.max(10, Math.min(400, value))
                                setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? clampedValue / 100 : z))
                                setEditingZoom(null)
                              } else if (e.key === 'Escape') {
                                setEditingZoom(null)
                              }
                            }}
                            className="w-10 text-xs font-medium text-gray-600 bg-transparent border-b border-primary-400 outline-none text-center"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              setZoomInputValue(Math.round(quadrantZoom[quadrantIndex] * 100).toString())
                              setEditingZoom(quadrantIndex)
                              setTimeout(() => {
                                zoomInputRef.current?.focus()
                                zoomInputRef.current?.select()
                              }, 50)
                            }}
                            className="text-xs font-medium text-gray-600 hover:text-primary-600 transition-colors min-w-[28px]"
                            title="Clic para escribir zoom (10-400%)"
                          >
                            {Math.round(quadrantZoom[quadrantIndex] * 100)}%
                          </button>
                        )}
                        {/* Botón dropdown */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const dropdown = e.currentTarget.nextElementSibling
                            if (dropdown) {
                              dropdown.classList.toggle('hidden')
                            }
                          }}
                          className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                          title="Opciones de zoom"
                        >
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {/* Dropdown de opciones de zoom */}
                        <div className="hidden absolute bottom-full right-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[80px]">
                          {[25, 50, 75, 100, 150, 200, 300].map(level => (
                            <button
                              key={level}
                              onClick={(e) => {
                                e.stopPropagation()
                                setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? level / 100 : z))
                                const dropdown = e.currentTarget.parentElement
                                if (dropdown) dropdown.classList.add('hidden')
                              }}
                              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 transition-colors ${
                                Math.round(quadrantZoom[quadrantIndex] * 100) === level ? 'text-primary-600 font-medium bg-primary-50' : 'text-gray-600'
                              }`}
                            >
                              {level}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
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

          {/* Barra inferior de fórmulas - Diseño con 2 columnas */}
          {showFormulaBar && (
            <div className="bg-white border-t border-gray-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
              <div className="flex flex-col md:flex-row h-auto md:h-40">
                {/* Columna izquierda - Editor LaTeX */}
                <div className="w-full md:w-1/4 lg:w-1/5 p-2 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-primary-600 font-medium text-xs">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <text x="4" y="17" fontSize="14" fontWeight="bold" fontStyle="italic">fx</text>
                    </svg>
                    <span>Editor LaTeX</span>
                    {formulaModoLibre && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Modo Libre</span>
                    )}
                  </div>
                  <div className="relative flex-grow">
                    <div className="absolute left-2 top-2 text-gray-400 pointer-events-none font-mono text-xs">$$</div>
                    <textarea
                      ref={formulaInputRef}
                      value={formulaInput}
                      onChange={(e) => handleFormulaChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey && !formulaError && formulaInput.trim()) {
                          handleSaveFormula()
                        } else if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                          e.preventDefault()
                          const textarea = e.currentTarget
                          const start = textarea.selectionStart
                          const end = textarea.selectionEnd
                          // Insertar \\ seguido de salto de línea real para visualización
                          const newValue = formulaInput.substring(0, start) + ' \\\\\n' + formulaInput.substring(end)
                          handleFormulaChange(newValue)
                          setTimeout(() => {
                            textarea.selectionStart = textarea.selectionEnd = start + 4
                          }, 0)
                        }
                      }}
                      placeholder="\frac{-b \pm \sqrt{b^2-4ac}}{2a}"
                      className={`block w-full h-full min-h-[60px] rounded-md border bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-xs font-mono p-2 pl-7 shadow-sm transition-all resize-none ${
                        formulaError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {/* Vista previa - solo modo libre */}
                  {formulaModoLibre && (
                    <div className="min-h-[32px] flex items-center bg-gray-50 rounded px-2 py-1 border border-gray-200">
                      {formulaPreview ? (
                        <div className="transform scale-75 origin-left" dangerouslySetInnerHTML={{ __html: formulaPreview }} />
                      ) : (
                        <span className="text-gray-400 text-xs italic">Vista previa...</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleCancelFormula}
                      className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveFormula}
                      disabled={!formulaInput.trim() || !!formulaError}
                      className="px-2 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <span>{formulaModoLibre ? 'Insertar' : 'OK'}</span>
                    </button>
                  </div>
                </div>

                {/* Columna derecha - Grid de símbolos */}
                <div className="flex-1 flex flex-col bg-gray-50">
                  {/* Pestañas de categorías */}
                  <div className="flex items-center px-1 pt-1 border-b border-gray-200 bg-white overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {[
                      { key: 'basic', label: 'Basic' },
                      { key: 'greek-lower', label: 'αβγ', className: 'font-serif italic' },
                      { key: 'greek-upper', label: 'ABΓ', className: 'font-serif' },
                      { key: 'trig', label: 'sin cos' },
                      { key: 'operators', label: '≥ ÷ →', className: 'font-mono tracking-tighter' },
                      { key: 'chemistry', label: 'H₂O', className: 'font-serif' },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setFormulaCategory(tab.key as typeof formulaCategory)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-t-md border-x border-t transition-colors whitespace-nowrap ${tab.className || ''} ${
                          formulaCategory === tab.key
                            ? 'bg-primary-600 text-white border-primary-600 relative top-[1px] z-10'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                    <div className="w-px h-5 bg-gray-300 mx-1" />
                    {[
                      { key: 'shapes-2d', label: '2D' },
                      { key: 'shapes-3d', label: '3D' },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setFormulaCategory(tab.key as typeof formulaCategory)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-t-md border-x border-t transition-colors whitespace-nowrap ${
                          formulaCategory === tab.key
                            ? 'bg-emerald-600 text-white border-emerald-600 relative top-[1px] z-10'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Grid de símbolos */}
                  <div className="flex-1 p-1.5 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {/* Fórmulas LaTeX */}
                  {formulaCategory !== 'shapes-2d' && formulaCategory !== 'shapes-3d' && (
                    <div className="grid grid-cols-10 sm:grid-cols-14 lg:grid-cols-18 gap-1">
                      {FORMULA_CATEGORIES[formulaCategory].map((item, idx) => (
                        <button
                          key={`${item.label}-${idx}`}
                          onClick={() => insertFormulaSnippet(item.latex)}
                          title={item.latex}
                          className="h-7 flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:border-primary-500 hover:text-primary-600 transition-all font-serif text-xs"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Figuras 2D */}
                  {formulaCategory === 'shapes-2d' && (
                    <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-1">
                      {Object.entries(SHAPES_2D).map(([key, shape]) => (
                        <button
                          key={key}
                          onClick={() => insertShape(key)}
                          title={shape.label}
                          className="h-12 flex flex-col items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                        >
                          <svg 
                            width="24" 
                            height="24" 
                            viewBox={shape.viewBox}
                            fill="none" 
                            stroke={currentColor} 
                            strokeWidth="4"
                            strokeLinejoin="round"
                          >
                            <path d={shape.path} />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Figuras 3D */}
                  {formulaCategory === 'shapes-3d' && (
                    <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-1">
                      {Object.entries(SHAPES_3D).map(([key, shape]) => (
                        <button
                          key={key}
                          onClick={() => insertShape(key)}
                          title={shape.label}
                          className="h-12 flex flex-col items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                        >
                          <img 
                            src={shape.src}
                            alt={shape.label}
                            width="24" 
                            height="24"
                            className="pointer-events-none"
                            draggable={false}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
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
