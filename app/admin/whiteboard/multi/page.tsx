'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import WhiteboardCanvas, { WhiteboardCanvasRef } from '@/components/whiteboard/WhiteboardCanvas'
import { Geometry3DObject, WhiteboardContent, WhiteboardFormula, WhiteboardImage, WhiteboardShape } from '@/types'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

// Cargar componentes 3D dinámicamente para evitar SSR con Three.js
const Inline3DViewer = dynamic(
  () => import('@/components/whiteboard/Inline3DViewer'),
  { ssr: false, loading: () => <div className="animate-pulse bg-gray-200 rounded" /> }
)

const Geometry2DCanvas = dynamic(
  () => import('@/components/whiteboard/Geometry2DCanvas'),
  { ssr: false, loading: () => <div className="animate-pulse bg-gray-200 rounded" /> }
)

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

// Función para procesar espacios en LaTeX
// Convierte espacios normales a espacios LaTeX para que se rendericen correctamente
function processLatexSpaces(latex: string): string {
  // Si está vacío, retornar vacío
  if (!latex) return latex
  
  // Usar ~ (tilde) que es el carácter de espacio no-breakable en LaTeX
  // Es la forma más compatible y simple de preservar espacios
  return latex.replace(/ /g, '~')
}

// Función para generar cursor SVG según el modo del lápiz
function getPenCursor(color: string, penMode: 'free' | 'line' | 'arrow' | 'curveArrow', size: number = 4): string {
  // Crear el SVG como string y convertir a base64
  let svgContent = ''
  
  if (penMode === 'free') {
    // Cursor de lápiz clásico
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M8 24 L24 8 L26 10 L10 26 Z" fill="${color}" stroke="#000" stroke-width="0.5"/><path d="M6 26 L8 24 L10 26 L8 28 Z" fill="#ffcc99" stroke="#000" stroke-width="0.5"/><path d="M24 8 L26 6 L28 8 L26 10 Z" fill="#ff9999" stroke="#000" stroke-width="0.5"/></svg>`
  } else if (penMode === 'line') {
    // Cursor de línea
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><line x1="6" y1="26" x2="26" y2="6" stroke="${color}" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="26" r="3" fill="white" stroke="${color}" stroke-width="1.5"/></svg>`
  } else if (penMode === 'arrow') {
    // Cursor de flecha recta
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><line x1="6" y1="26" x2="22" y2="10" stroke="${color}" stroke-width="3" stroke-linecap="round"/><path d="M26 6 L20 8 L24 12 Z" fill="${color}"/><circle cx="6" cy="26" r="3" fill="white" stroke="${color}" stroke-width="1.5"/></svg>`
  } else {
    // Cursor de flecha curva
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 26 Q 10 10 24 10" stroke="${color}" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M28 8 L22 8 L24 14 Z" fill="${color}"/><circle cx="6" cy="26" r="3" fill="white" stroke="${color}" stroke-width="1.5"/></svg>`
  }
  
  // Convertir a base64 para mayor compatibilidad
  const base64 = typeof btoa !== 'undefined' ? btoa(svgContent) : Buffer.from(svgContent).toString('base64')
  return `url(data:image/svg+xml;base64,${base64}) 6 26, crosshair`
}

export default function WhiteboardMultiPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialWhiteboardId = searchParams.get('id')
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
  const [eraserSize, setEraserSize] = useState(24)
  const [currentTool, setCurrentTool] = useState<'select' | 'pen' | 'eraser' | 'text' | 'formula' | 'pan'>('pen')
  const [penMode, setPenMode] = useState<'free' | 'line' | 'arrow' | 'curveArrow'>('free')
  
  // Estado de pan (desplazamiento) por cuadrante
  const [quadrantPanOffsets, setQuadrantPanOffsets] = useState<{ x: number; y: number }[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
  ])
  
  // Refs para cada canvas
  const canvasRefs = useRef<(WhiteboardCanvasRef | null)[]>([null, null, null, null])
  const canvasContainerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])

  // Estado de guardado
  const [savingQuadrant, setSavingQuadrant] = useState<number | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const quadrantsRef = useRef(quadrants)

  // Estados de historial para cada cuadrante (undo/redo)
  const [canUndoQuadrants, setCanUndoQuadrants] = useState<boolean[]>([false, false, false, false])
  const [canRedoQuadrants, setCanRedoQuadrants] = useState<boolean[]>([false, false, false, false])

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
  
  // Edición inline de fórmulas (directamente en la pizarra)
  const [inlineEditingFormulaId, setInlineEditingFormulaId] = useState<string | null>(null)
  const [inlineFormulaValue, setInlineFormulaValue] = useState('')
  const [inlineFormulaScale, setInlineFormulaScale] = useState(1.5)
  const inlineFormulaRef = useRef<HTMLTextAreaElement>(null)
  
  // Cursor fantasma para LaTeX en tiempo real
  const [ghostCursorPos, setGhostCursorPos] = useState<{ top: number; left: number; height: number } | null>(null)
  const latexLayerRef = useRef<HTMLDivElement>(null)
  
  const [formulaPanelPos, setFormulaPanelPos] = useState({ x: 0, y: 0 }) // 0,0 = posición por defecto (bottom-right)
  const [formulaPanelSize, setFormulaPanelSize] = useState({ width: 340, height: 300 }) // Tamaño del panel (responsive)
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Colores de resaltado para selección de texto en fórmulas (formato HEX para KaTeX)
  const HIGHLIGHT_COLORS = [
    { name: 'Amarillo', value: '#FFEB3B' },
    { name: 'Verde', value: '#81C784' },
    { name: 'Azul', value: '#64B5F6' },
    { name: 'Rosa', value: '#F48FB1' },
    { name: 'Naranja', value: '#FFB74D' },
    { name: 'Morado', value: '#CE93D8' },
  ]

  // Colores de texto para fórmulas
  const TEXT_COLORS = [
    { name: 'Rojo', value: '#E53935' },
    { name: 'Azul', value: '#1E88E5' },
    { name: 'Verde', value: '#43A047' },
    { name: 'Naranja', value: '#FB8C00' },
    { name: 'Morado', value: '#8E24AA' },
  ]

  // Extraer el contenido interno de un comando LaTeX (quita \comando{color}{contenido} -> contenido)
  const extractInnerContent = (text: string): string => {
    // Quitar \colorbox{...}{...} y \textcolor{...}{...} recursivamente
    let result = text
    let changed = true
    while (changed) {
      changed = false
      // Patrón para \colorbox{color}{contenido} o \textcolor{color}{contenido}
      const match = result.match(/^\\(?:colorbox|textcolor)\{[^}]*\}\{(.*)\}$/)
      if (match) {
        result = match[1]
        changed = true
      }
    }
    return result
  }

  // Aplicar resaltado a la selección del texto LaTeX
  const applyHighlightToSelection = (color: string) => {
    const input = formulaInputRef.current
    if (!input) return
    
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    
    if (start === end) return
    
    // Extraer texto seleccionado y limpiar comandos de color existentes
    const selectedText = formulaInput.slice(start, end)
    const cleanText = extractInnerContent(selectedText)
    
    // Aplicar nuevo color
    const wrapped = `\\colorbox{${color}}{${cleanText}}`
    const newValue = formulaInput.slice(0, start) + wrapped + formulaInput.slice(end)
    setFormulaInput(newValue)
    handleFormulaChange(newValue)
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(start, start + wrapped.length)
    }, 0)
  }

  // Aplicar color de texto a la selección
  const applyTextColorToSelection = (color: string) => {
    const input = formulaInputRef.current
    if (!input) return
    
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    
    if (start === end) return
    
    // Extraer texto seleccionado y limpiar comandos de color existentes
    const selectedText = formulaInput.slice(start, end)
    const cleanText = extractInnerContent(selectedText)
    
    // Aplicar nuevo color
    const wrapped = `\\textcolor{${color}}{${cleanText}}`
    const newValue = formulaInput.slice(0, start) + wrapped + formulaInput.slice(end)
    setFormulaInput(newValue)
    handleFormulaChange(newValue)
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(start, start + wrapped.length)
    }, 0)
  }

  // Quitar formato de color de la selección
  const removeColorFromSelection = () => {
    const input = formulaInputRef.current
    if (!input) return
    
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    
    if (start === end) return
    
    const selectedText = formulaInput.slice(start, end)
    const cleanText = extractInnerContent(selectedText)
    
    const newValue = formulaInput.slice(0, start) + cleanText + formulaInput.slice(end)
    setFormulaInput(newValue)
    handleFormulaChange(newValue)
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(start, start + cleanText.length)
    }, 0)
  }

  // Estado para placement mode (click-to-place)
  const [pendingPlacement, setPendingPlacement] = useState<{
    type: 'formula' | 'shape';
    data: { latex?: string; scale?: number; shapeType?: string; color?: string };
  } | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)

  // Categorías de símbolos para fórmulas
  const FORMULA_CATEGORIES = {
    'basic': [
      { label: 'x²', latex: '^{2}' },
      { label: 'xⁿ', latex: '^{n}' },
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

  // Visor 3D Inline (en lugar de modal)
  const [active3DShape, setActive3DShape] = useState<{ id: string; shapeType: string; x: number; y: number; scale: number } | null>(null)
  
  // Canvas Geometría 2D - ahora inline en la pizarra
  const [showGeometry2D, setShowGeometry2D] = useState(false)
  const [editing2DElementId, setEditing2DElementId] = useState<string | null>(null) // ID del elemento 2D que se está editando
  const [editing3DElementId, setEditing3DElementId] = useState<string | null>(null) // ID del elemento 3D que se está editando
  const containerRef = useRef<HTMLDivElement>(null)

  // Dropdowns
  const [showPenSizes, setShowPenSizes] = useState(false)
  const [showEraserSizes, setShowEraserSizes] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showViewModes, setShowViewModes] = useState(false)

  // Selección de elementos
  const [selectedElements, setSelectedElements] = useState<Array<{ type: 'stroke' | 'text' | 'formula' | 'shape' | 'image' | 'geometry2d' | 'geometry3d'; id: string }>>([])
  const selectedElementsRef = useRef<Array<{ type: 'stroke' | 'text' | 'formula' | 'shape' | 'image' | 'geometry2d' | 'geometry3d'; id: string }>>([])
  
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

  // Funciones de zoom (10% en 10%) - usando Math.round para evitar errores de punto flotante
  const zoomIn = (quadrantIndex: number) => {
    setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? Math.min(Math.round((z + 0.1) * 10) / 10, 3) : z))
  }
  const zoomOut = (quadrantIndex: number) => {
    setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? Math.max(Math.round((z - 0.1) * 10) / 10, 0.5) : z))
  }
  const resetZoom = (quadrantIndex: number) => {
    setQuadrantZoom(prev => prev.map((z, i) => i === quadrantIndex ? 1 : z))
  }

  // Mantener ref sincronizado con state
  useEffect(() => {
    selectedElementsRef.current = selectedElements
  }, [selectedElements])

  // Tipo para elementos seleccionables
  type SelectableType = 'stroke' | 'text' | 'formula' | 'shape' | 'image' | 'geometry2d' | 'geometry3d'
  
  // Funciones de selección
  const isElementSelected = (type: SelectableType, id: string, useRef = false) => {
    const elements = useRef ? selectedElementsRef.current : selectedElements
    return elements.some(el => el.type === type && el.id === id)
  }

  const toggleSelection = (type: SelectableType, id: string, addToSelection: boolean) => {
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
    const all: Array<{ type: SelectableType; id: string }> = []
    quadrantContent.strokes.forEach(s => all.push({ type: 'stroke', id: s.id }))
    ;(quadrantContent.textBoxes || []).forEach(t => all.push({ type: 'text', id: t.id }))
    ;(quadrantContent.formulas || []).forEach(f => all.push({ type: 'formula', id: f.id }))
    ;(quadrantContent.shapes || []).forEach(sh => all.push({ type: 'shape', id: sh.id }))
    ;(quadrantContent.images || []).forEach(img => all.push({ type: 'image', id: img.id }))
    ;(quadrantContent.geometry3D || []).forEach(g => all.push({ type: 'geometry3d', id: g.id }))
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
      images: (quadrantContent.images || []).filter(img => !isElementSelected('image', img.id, true)),
      geometry3D: (quadrantContent.geometry3D || []).filter(g => !isElementSelected('geometry3d', g.id, true)),
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
      images: (quadrantContent.images || []).map(img => {
        if (isElementSelected('image', img.id)) {
          return { ...img, x: img.x + deltaX, y: img.y + deltaY }
        }
        return img
      }),
      geometry3D: (quadrantContent.geometry3D || []).map(g => {
        if (isElementSelected('geometry3d', g.id)) {
          return { ...g, x: g.x + deltaX, y: g.y + deltaY }
        }
        return g
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
  const handleDragStart = (e: React.MouseEvent, type: SelectableType, id: string) => {
    if (currentTool !== 'select') return
    e.stopPropagation()
    
    // Lógica profesional de selección
    let newSelection: Array<{ type: SelectableType; id: string }>
    
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

  // Redimensionar imágenes (mantiene proporción)
  const handleImageResizeStart = (e: React.MouseEvent, image: WhiteboardImage) => {
    e.stopPropagation()
    e.preventDefault()
    
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = image.width
    const startHeight = image.height
    const aspectRatio = startWidth / startHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      const delta = Math.max(deltaX, deltaY)
      
      const newWidth = Math.max(50, startWidth + delta)
      const newHeight = newWidth / aspectRatio

      const quadrantContent = quadrants[activeQuadrant].content
      updateQuadrantContent(activeQuadrant, {
        ...quadrantContent,
        images: (quadrantContent.images || []).map(img =>
          img.id === image.id ? { ...img, width: newWidth, height: newHeight } : img
        )
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Sincronizar formulaInput cuando cambia de pizarra (solo en modo tiempo real)
  useEffect(() => {
    if (showFormulaBar && !formulaModoLibre) {
      const currentLatex = quadrants[activeQuadrant].latexContent || ''
      setFormulaInput(currentLatex)
      if (currentLatex) {
        try {
          const html = katex.renderToString(processLatexSpaces(currentLatex), { throwOnError: true, displayMode: true })
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
      // Ctrl+Z para deshacer, Ctrl+Shift+Z o Ctrl+Y para rehacer
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          if (e.shiftKey) {
            canvasRefs.current[activeQuadrant]?.redo()
          } else {
            canvasRefs.current[activeQuadrant]?.undo()
          }
        } else if (e.key === 'y') {
          e.preventDefault()
          canvasRefs.current[activeQuadrant]?.redo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElements, currentTool, inlineEditingTextId, showFormulaBar, activeQuadrant, quadrants, pendingPlacement])

  // Manejo de pegado de imágenes (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // No procesar si hay un input/textarea enfocado
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
      if (isInputFocused) return

      // Verificar si hay cuadrante activo con pizarra
      const quadrant = quadrantsRef.current[activeQuadrant]
      if (!quadrant) return

      // Buscar imágenes en el clipboard
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          
          const blob = item.getAsFile()
          if (!blob) continue

          // Convertir a data URL
          const reader = new FileReader()
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string
            if (!dataUrl) return

            // Crear imagen para obtener dimensiones
            const img = new Image()
            img.onload = () => {
              // Limitar tamaño máximo a 400px manteniendo proporción
              const maxSize = 400
              let width = img.width
              let height = img.height
              
              if (width > maxSize || height > maxSize) {
                if (width > height) {
                  height = (height / width) * maxSize
                  width = maxSize
                } else {
                  width = (width / height) * maxSize
                  height = maxSize
                }
              }

              // Crear la nueva imagen
              const newImage: WhiteboardImage = {
                id: Math.random().toString(36).substring(2, 11),
                src: dataUrl,
                x: 100, // Posición inicial
                y: 100,
                width,
                height
              }

              // Actualizar el contenido del cuadrante
              const updatedContent: WhiteboardContent = {
                ...quadrant.content,
                images: [...(quadrant.content.images || []), newImage]
              }

              updateQuadrantContent(activeQuadrant, updatedContent)
            }
            img.src = dataUrl
          }
          reader.readAsDataURL(blob)
          break // Solo procesar la primera imagen
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuadrant])

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
      // Si hay un ID específico en la URL, cargar solo esa pizarra en modo 1
      if (initialWhiteboardId) {
        setViewMode('1')
        setActiveQuadrant(0)
        await loadWhiteboardById(0, initialWhiteboardId)
        await fetchWhiteboardList()
        setLoading(false)
        setInitialLoadDone(true)
        return
      }

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
  }, [user?.id, initialWhiteboardId])

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

  // Manejar cambios de historial de un cuadrante
  const handleHistoryChange = useCallback((quadrantIndex: number, canUndo: boolean, canRedo: boolean) => {
    setCanUndoQuadrants(prev => {
      const newState = [...prev]
      newState[quadrantIndex] = canUndo
      return newState
    })
    setCanRedoQuadrants(prev => {
      const newState = [...prev]
      newState[quadrantIndex] = canRedo
      return newState
    })
  }, [])

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
      if (!target.closest('.color-picker-dropdown')) {
        setShowColorPicker(false)
      }
      if (!target.closest('.view-mode-dropdown')) {
        setShowViewModes(false)
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
    // Cargar datos de la fórmula
    setFormulaInput(formula.latex)
    setFormulaScale(formula.scale)
    setEditingFormulaId(formula.id)
    setFormulaPosition({ x: formula.x, y: formula.y })
    handleFormulaChange(formula.latex)
    
    // Asegurar que el panel esté abierto
    setShowFormulaBar(true)
    setCurrentTool('formula')
    
    // Dar foco al textarea y posicionar cursor al final
    setTimeout(() => {
      const input = formulaInputRef.current
      if (input) {
        input.focus()
        // Posicionar cursor al final del texto
        const len = formula.latex.length
        input.setSelectionRange(len, len)
      }
    }, 50)
  }

  // Iniciar edición inline de fórmula (directamente en la pizarra)
  const startInlineFormulaEdit = (formula: WhiteboardFormula) => {
    setInlineEditingFormulaId(formula.id)
    setInlineFormulaValue(formula.latex)
    setInlineFormulaScale(formula.scale)
    setTimeout(() => {
      const input = inlineFormulaRef.current
      if (input) {
        input.focus()
        input.setSelectionRange(formula.latex.length, formula.latex.length)
      }
    }, 0)
  }

  // Guardar edición inline de fórmula
  const saveInlineFormula = () => {
    if (!inlineEditingFormulaId) return
    
    const quadrantContent = quadrants[activeQuadrant].content
    
    if (!inlineFormulaValue.trim()) {
      // Si está vacío, eliminar la fórmula
      updateQuadrantContent(activeQuadrant, {
        ...quadrantContent,
        formulas: (quadrantContent.formulas || []).filter(f => f.id !== inlineEditingFormulaId)
      })
    } else {
      // Actualizar la fórmula
      updateQuadrantContent(activeQuadrant, {
        ...quadrantContent,
        formulas: (quadrantContent.formulas || []).map(f =>
          f.id === inlineEditingFormulaId
            ? { ...f, latex: inlineFormulaValue, scale: inlineFormulaScale }
            : f
        )
      })
    }
    
    setInlineEditingFormulaId(null)
    setInlineFormulaValue('')
  }

  // Funciones de fórmulas
  const handleAddFormula = () => {
    // Cargar el latexContent existente del cuadrante activo
    const existingLatex = quadrants[activeQuadrant].latexContent || ''
    setFormulaInput(existingLatex)
    setFormulaModoLibre(false) // Modo tiempo real
    if (existingLatex) {
      try {
        const html = katex.renderToString(processLatexSpaces(existingLatex), { throwOnError: true, displayMode: true })
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
      // Procesar espacios para que se rendericen correctamente
      const html = katex.renderToString(processLatexSpaces(latex), { throwOnError: true, displayMode: true })
      setFormulaPreview(html)
      setFormulaError('')
    } catch (err) {
      setFormulaError('Fórmula inválida')
      setFormulaPreview('')
    }
  }

  const insertFormulaSnippet = (snippet: string) => {
    const input = formulaInputRef.current
    if (!input) {
      // Fallback: añadir al final
      const newValue = formulaInput + snippet
      handleFormulaChange(newValue)
      return
    }
    
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const before = formulaInput.substring(0, start)
    const after = formulaInput.substring(end)
    const newValue = before + snippet + after
    
    handleFormulaChange(newValue)
    
    // Posicionar cursor antes del último "}" del snippet insertado
    setTimeout(() => {
      const lastBraceIndex = snippet.lastIndexOf('}')
      let newCursorPos: number
      if (lastBraceIndex !== -1) {
        // Posicionar justo antes del último }
        newCursorPos = start + lastBraceIndex
      } else {
        // Si no hay }, posicionar al final del snippet
        newCursorPos = start + snippet.length
      }
      input.setSelectionRange(newCursorPos, newCursorPos)
      input.focus()
    }, 0)
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
      setGhostCursorPos(null)
    } else {
      // Nueva fórmula: activar placement mode
      setPendingPlacement({
        type: 'formula',
        data: { 
          latex: formulaInput, 
          scale: formulaScale,
        }
      })
      setShowFormulaBar(false)
      setFormulaInput('')
      setCurrentTool('formula')
      setGhostCursorPos(null)
    }
  }

  const handleCancelFormula = () => {
    setShowFormulaBar(false)
    setFormulaInput('')
    setEditingFormulaId(null)
    setCurrentTool('pen')
    setGhostCursorPos(null)
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

  // Renderizar LaTeX a HTML con KaTeX - cada línea en un div con data-line
  const renderLatexToHtml = (latex: string): string => {
    if (!latex.trim()) return ''
    try {
      // Procesar líneas individualmente
      const lines = latex.split('\n').map(line => {
        if (line.length === 0) return ' '
        // Quitar \\ del final de línea (ya que usamos <br/> para el salto visual)
        // NO hacer trim() para preservar espacios al inicio
        let cleanLine = line.replace(/\s*\\\\$/, '').trimEnd()
        if (cleanLine.length === 0) return ' '
        // Si no tiene $, envolver en $
        const temp = cleanLine.includes('$') ? cleanLine : `$${cleanLine}$`
        return temp
      })
      
      // Renderizar cada línea en un div con data-line para poder calcular posición
      return lines.map((line, idx) => {
        try {
          // Extraer contenido entre $ y renderizar
          const mathContent = line.replace(/^\$/, '').replace(/\$$/, '')
          // Procesar espacios para que se rendericen correctamente
          const rendered = katex.renderToString(processLatexSpaces(mathContent), { throwOnError: false, displayMode: false })
          return `<div class="math-line" data-line="${idx}" style="min-height: 1.2em; line-height: 1.4;">${rendered}</div>`
        } catch {
          return `<div class="math-line" data-line="${idx}" style="min-height: 1.2em; line-height: 1.4;">${line}</div>`
        }
      }).join('')
    } catch {
      return latex
    }
  }
  
  // Función para reubicar el cursor en el textarea cuando se hace click en el LaTeX renderizado
  const handleLatexLayerClick = (
    e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>,
    quadrantIndex: number
  ) => {
    if (!showFormulaBar || formulaModoLibre || !formulaInputRef.current) return

    // Detener propagación para evitar que otros handlers interfieran
    e.stopPropagation()
    e.preventDefault()

    // Asegurar cuadrante activo y sincronizar input si es necesario
    if (activeQuadrant !== quadrantIndex) {
      setActiveQuadrant(quadrantIndex)
      const currentLatex = quadrants[quadrantIndex].latexContent || ''
      if (formulaInput !== currentLatex) {
        handleFormulaChange(currentLatex)
      }
    }

    const container = e.currentTarget
    const rect = container.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const clickX = e.clientX - rect.left
    
    // Encontrar todas las líneas renderizadas
    const mathLines = container.querySelectorAll('.math-line')
    if (mathLines.length === 0) {
      // Si no hay líneas, posicionar al inicio
      formulaInputRef.current.focus()
      formulaInputRef.current.setSelectionRange(0, 0)
      updateGhostCursor(container)
      return
    }
    
    // Encontrar la línea más cercana al click
    let closestLine = 0
    let minDistance = Infinity
    
    mathLines.forEach((line, idx) => {
      const lineRect = line.getBoundingClientRect()
      const lineTop = lineRect.top - rect.top
      const lineBottom = lineRect.bottom - rect.top
      const lineMid = (lineTop + lineBottom) / 2
      const distance = Math.abs(clickY - lineMid)
      
      if (distance < minDistance) {
        minDistance = distance
        closestLine = idx
      }
    })
    
    // Obtener el texto original del textarea
    const text = formulaInputRef.current.value
    const lines = text.split('\n')
    
    // Calcular posición en el texto para llegar al inicio de la línea
    let charPos = 0
    for (let i = 0; i < closestLine && i < lines.length; i++) {
      charPos += lines[i].length + 1 // +1 por el \n
    }
    
    // Estimar columna de forma más precisa usando los elementos internos de KaTeX
    const lineText = lines[closestLine] || ''
    const lineElement = mathLines[closestLine] as HTMLElement
    
    if (lineElement && lineText.length > 0) {
      const lineRect = lineElement.getBoundingClientRect()
      const relativeX = e.clientX - lineRect.left
      
      // Buscar todos los elementos de texto/símbolo dentro del KaTeX renderizado
      const katexElements = lineElement.querySelectorAll('.mord, .mbin, .mrel, .mopen, .mclose, .mpunct, .mop, .minner, .mspace')
      
      if (katexElements.length > 0) {
        // Encontrar el elemento más cercano al click X
        let closestElementRect: DOMRect | null = null
        let closestElementDist = Infinity
        let closestElementIndex = 0
        
        katexElements.forEach((el, idx) => {
          const elRect = el.getBoundingClientRect()
          const elCenter = elRect.left + elRect.width / 2
          const dist = Math.abs(e.clientX - elCenter)
          
          if (dist < closestElementDist) {
            closestElementDist = dist
            closestElementRect = elRect
            closestElementIndex = idx
          }
        })
        
        if (closestElementRect) {
          const elRect = closestElementRect as DOMRect
          // Determinar si el click está antes o después del centro del elemento
          const isAfter = e.clientX > elRect.left + elRect.width / 2
          
          // Estimar la posición del carácter basándose en el índice del elemento
          // Usar una proporción entre elementos KaTeX y caracteres del texto
          const elementRatio = katexElements.length > 1 
            ? closestElementIndex / (katexElements.length - 1)
            : 0.5
          
          let col = Math.round(elementRatio * lineText.length)
          if (isAfter && col < lineText.length) col++
          
          charPos += Math.min(col, lineText.length)
        } else {
          // Fallback: usar ratio lineal
          const lineWidth = lineRect.width || 1
          const charRatio = Math.max(0, Math.min(1, relativeX / lineWidth))
          charPos += Math.round(charRatio * lineText.length)
        }
      } else {
        // Fallback si no hay elementos KaTeX: usar ratio lineal
        const lineWidth = lineRect.width || 1
        const charRatio = Math.max(0, Math.min(1, relativeX / lineWidth))
        charPos += Math.round(charRatio * lineText.length)
      }
    }
    
    // Asegurar que charPos no excede la longitud del texto
    charPos = Math.max(0, Math.min(charPos, text.length))
    
    // Posicionar cursor en el textarea
    formulaInputRef.current.focus()
    formulaInputRef.current.setSelectionRange(charPos, charPos)
    
    // Actualizar cursor fantasma inmediatamente
    setTimeout(() => updateGhostCursor(container), 0)
  }
  
  // Actualizar posición del cursor fantasma
  const updateGhostCursor = (containerOverride?: HTMLDivElement) => {
    const container = containerOverride || latexLayerRef.current
    if (!formulaInputRef.current || !container || !showFormulaBar || formulaModoLibre) {
      setGhostCursorPos(null)
      return
    }
    
    const textarea = formulaInputRef.current
    const cursorPos = textarea.selectionStart
    const text = textarea.value
    
    // Encontrar línea y columna del cursor
    const beforeCursor = text.substring(0, cursorPos)
    const lines = beforeCursor.split('\n')
    const cursorLine = lines.length - 1
    const cursorCol = lines[lines.length - 1].length
    
    // Encontrar la línea correspondiente en el render
    const mathLines = container.querySelectorAll('.math-line')
    const lineElement = mathLines[cursorLine] as HTMLElement
    
    if (!lineElement) {
      setGhostCursorPos(null)
      return
    }
    
    const containerRect = container.getBoundingClientRect()
    const lineRect = lineElement.getBoundingClientRect()
    
    // Estimar posición X del cursor usando elementos KaTeX si están disponibles
    const lineText = text.split('\n')[cursorLine] || ''
    let cursorX = lineRect.left - containerRect.left
    
    if (lineText.length > 0) {
      const katexElements = lineElement.querySelectorAll('.mord, .mbin, .mrel, .mopen, .mclose, .mpunct, .mop, .minner, .mspace')
      
      if (katexElements.length > 0) {
        // Calcular qué elemento corresponde a la posición del cursor
        const charRatio = cursorCol / lineText.length
        const elementIndex = Math.min(
          Math.round(charRatio * (katexElements.length - 1)),
          katexElements.length - 1
        )
        
        if (elementIndex >= 0 && katexElements[elementIndex]) {
          const elRect = katexElements[elementIndex].getBoundingClientRect()
          // Posicionar el cursor al inicio o final del elemento según la posición
          const withinElement = (cursorCol / lineText.length) * katexElements.length - elementIndex
          cursorX = elRect.left - containerRect.left + (withinElement > 0.5 ? elRect.width : 0)
        }
      } else {
        // Fallback: ratio lineal
        const charRatio = cursorCol / lineText.length
        cursorX = lineRect.left - containerRect.left + charRatio * lineRect.width
      }
    }
    
    setGhostCursorPos({
      top: lineRect.top - containerRect.top,
      left: cursorX,
      height: lineRect.height
    })
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
          <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-1.5 sm:py-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 flex-nowrap min-w-max">
              {/* Volver */}
              <button
                onClick={() => router.push('/admin/whiteboard')}
                className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
                title="Volver"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Herramientas */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 rounded-lg p-0.5 sm:p-1 flex-shrink-0">
                <button
                  onClick={() => setCurrentTool('select')}
                  className={`p-1.5 sm:p-2 rounded ${currentTool === 'select' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Seleccionar"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </button>
                
                {/* Mano (Pan/Desplazar) */}
                <button
                  onClick={() => setCurrentTool('pan')}
                  className={`p-1.5 sm:p-2 rounded ${currentTool === 'pan' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Mover vista (arrastrar para desplazar)"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                  </svg>
                </button>
              </div>

              {/* Modos de Lápiz - Botones separados */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 rounded-lg p-0.5 sm:p-1 flex-shrink-0">
                {/* Lápiz Libre */}
                <button
                  onClick={() => { setCurrentTool('pen'); setPenMode('free'); }}
                  className={`p-1.5 sm:p-2 rounded transition-all ${currentTool === 'pen' && penMode === 'free' ? 'bg-white shadow-sm ring-2 ring-primary-300' : 'hover:bg-gray-200'}`}
                  title="Lápiz libre"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                
                {/* Línea recta */}
                <button
                  onClick={() => { setCurrentTool('pen'); setPenMode('line'); }}
                  className={`p-1.5 sm:p-2 rounded transition-all ${currentTool === 'pen' && penMode === 'line' ? 'bg-white shadow-sm ring-2 ring-primary-300' : 'hover:bg-gray-200'}`}
                  title="Línea recta"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="5" y1="19" x2="19" y2="5" strokeWidth={2} strokeLinecap="round"/>
                  </svg>
                </button>
                
                {/* Flecha recta */}
                <button
                  onClick={() => { setCurrentTool('pen'); setPenMode('arrow'); }}
                  className={`p-1.5 sm:p-2 rounded transition-all ${currentTool === 'pen' && penMode === 'arrow' ? 'bg-white shadow-sm ring-2 ring-primary-300' : 'hover:bg-gray-200'}`}
                  title="Flecha recta"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="5" y1="19" x2="19" y2="5" strokeWidth={2} strokeLinecap="round"/>
                    <polyline points="12,5 19,5 19,12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {/* Flecha curva */}
                <button
                  onClick={() => { setCurrentTool('pen'); setPenMode('curveArrow'); }}
                  className={`p-1.5 sm:p-2 rounded transition-all ${currentTool === 'pen' && penMode === 'curveArrow' ? 'bg-white shadow-sm ring-2 ring-primary-300' : 'hover:bg-gray-200'}`}
                  title="Flecha curva"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M5 19 Q 8 2, 19 5" strokeWidth={2} strokeLinecap="round" fill="none"/>
                    <polyline points="15,3 19,5 17,9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {/* Selector de grosor */}
                <div className="relative pen-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (currentTool !== 'pen') setCurrentTool('pen')
                      setShowPenSizes(!showPenSizes)
                      setShowEraserSizes(false)
                    }}
                    className={`p-1.5 sm:p-2 rounded flex items-center gap-0.5 ${showPenSizes ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    title="Grosor del trazo"
                  >
                    <span 
                      className="rounded-full"
                      style={{ 
                        width: Math.min(currentSize/2, 12), 
                        height: Math.min(currentSize/2, 12),
                        backgroundColor: currentColor 
                      }}
                    />
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showPenSizes && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-2 z-20 w-44">
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
                  )}
                </div>

                {/* Borrador */}
              </div>

              {/* Borrador - grupo separado */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 rounded-lg p-0.5 sm:p-1 flex-shrink-0">
                <div className="relative eraser-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentTool('eraser')
                      setShowEraserSizes(!showEraserSizes)
                      setShowPenSizes(false)
                    }}
                    className={`p-1.5 sm:p-2 rounded flex items-center gap-0.5 sm:gap-1 ${currentTool === 'eraser' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    title="Borrador"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20H7L3 16c-.6-.6-.6-1.5 0-2.1l10-10c.6-.6 1.5-.6 2.1 0l6 6c.6.6.6 1.5 0 2.1L13 20" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 11l7 7" />
                    </svg>
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showEraserSizes && currentTool === 'eraser' && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-2 z-20 flex flex-wrap items-center gap-1 w-48">
                      {SIZES.map(size => (
                        <button
                          key={size.value}
                          onClick={() => {
                            setEraserSize(size.value)
                            setShowEraserSizes(false)
                          }}
                          className={`flex items-center justify-center w-7 h-7 rounded transition-all ${
                            eraserSize === size.value ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'
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

              <div className="w-px h-6 sm:h-8 bg-gray-300 hidden sm:block" />

              {/* Texto y Fórmulas */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 rounded-lg p-0.5 sm:p-1 flex-shrink-0">
                <button
                  onClick={() => setCurrentTool('text')}
                  className={`p-1.5 sm:p-2 rounded ${currentTool === 'text' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Agregar texto"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="7" y="18" fontSize="18" fontWeight="bold">T</text>
                  </svg>
                </button>
                <button
                  onClick={handleAddFormula}
                  className={`p-1.5 sm:p-2 rounded ${currentTool === 'formula' && !formulaModoLibre ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Fórmula (tiempo real)"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="4" y="17" fontSize="14" fontWeight="bold" fontStyle="italic">fx</text>
                  </svg>
                </button>
                <button
                  onClick={handleAddFormulaLibre}
                  className={`p-1.5 sm:p-2 rounded ${currentTool === 'formula' && formulaModoLibre ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Fórmula (posición libre - clic para colocar)"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <text x="0" y="14" fontSize="9" fontWeight="bold" fontStyle="italic">fx</text>
                    <text x="10" y="20" fontSize="7" fill="#6b7280">+</text>
                  </svg>
                </button>
              </div>

              <div className="w-px h-6 sm:h-8 bg-gray-300 hidden sm:block" />

              {/* Selector de modo de vista (Multi-pizarra) - Desplegable en mobile */}
              <div className="relative view-mode-dropdown flex-shrink-0">
                {/* Botón compacto en mobile */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowViewModes(!showViewModes)
                    setShowColorPicker(false)
                  }}
                  className="sm:hidden p-1.5 rounded bg-gray-100 flex items-center gap-1"
                  title="Modo de vista"
                >
                  {/* Icono del modo actual */}
                  {viewMode === '1' && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  )}
                  {viewMode === '2h' && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="8" height="18" rx="1" />
                      <rect x="13" y="3" width="8" height="18" rx="1" />
                    </svg>
                  )}
                  {viewMode === '2v' && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="18" height="8" rx="1" />
                      <rect x="3" y="13" width="18" height="8" rx="1" />
                    </svg>
                  )}
                  {viewMode === '4' && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="8" height="8" rx="1" />
                      <rect x="13" y="3" width="8" height="8" rx="1" />
                      <rect x="3" y="13" width="8" height="8" rx="1" />
                      <rect x="13" y="13" width="8" height="8" rx="1" />
                    </svg>
                  )}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown en mobile */}
                {showViewModes && (
                  <div className="sm:hidden absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-2 z-20 flex items-center gap-1">
                    <button
                      onClick={() => { setViewMode('1'); setShowViewModes(false); }}
                      className={`p-2 rounded ${viewMode === '1' ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'}`}
                      title="1 pizarra"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setViewMode('2h'); setShowViewModes(false); }}
                      className={`p-2 rounded ${viewMode === '2h' ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'}`}
                      title="2 pizarras horizontales"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="3" width="8" height="18" rx="1" />
                        <rect x="13" y="3" width="8" height="18" rx="1" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setViewMode('2v'); setShowViewModes(false); }}
                      className={`p-2 rounded ${viewMode === '2v' ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'}`}
                      title="2 pizarras verticales"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="3" width="18" height="8" rx="1" />
                        <rect x="3" y="13" width="18" height="8" rx="1" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setViewMode('4'); setShowViewModes(false); }}
                      className={`p-2 rounded ${viewMode === '4' ? 'bg-primary-100 ring-2 ring-primary-300' : 'hover:bg-gray-100'}`}
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
                )}

                {/* Versión desktop - todos los botones visibles */}
                <div className="hidden sm:flex items-center gap-0.5 sm:gap-1 bg-gray-100 rounded-lg p-0.5 sm:p-1">
                  <button
                    onClick={() => setViewMode('1')}
                    className={`p-1.5 sm:p-2 rounded ${viewMode === '1' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    title="1 pizarra"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('2h')}
                    className={`p-1.5 sm:p-2 rounded ${viewMode === '2h' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    title="2 pizarras horizontales"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="8" height="18" rx="1" />
                      <rect x="13" y="3" width="8" height="18" rx="1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('2v')}
                    className={`p-1.5 sm:p-2 rounded ${viewMode === '2v' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    title="2 pizarras verticales"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="18" height="8" rx="1" />
                      <rect x="3" y="13" width="18" height="8" rx="1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('4')}
                    className={`p-1.5 sm:p-2 rounded ${viewMode === '4' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    title="4 pizarras"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="8" height="8" rx="1" />
                      <rect x="13" y="3" width="8" height="8" rx="1" />
                      <rect x="3" y="13" width="8" height="8" rx="1" />
                      <rect x="13" y="13" width="8" height="8" rx="1" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="w-px h-6 sm:h-8 bg-gray-300 hidden sm:block" />

              {/* Colores - Desplegable en mobile, siempre visibles */}
              <div className="relative color-picker-dropdown flex-shrink-0">
                  {/* Botón compacto en mobile - muestra color actual */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowColorPicker(!showColorPicker)
                      setShowViewModes(false)
                    }}
                    className="sm:hidden p-1.5 rounded bg-gray-100 flex items-center gap-1"
                    title="Color"
                  >
                    <span 
                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: currentColor }}
                    />
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown de colores en mobile */}
                  {showColorPicker && (
                    <div className="sm:hidden absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border p-2 z-20 flex flex-wrap items-center gap-2 w-36">
                      {COLORS.map(color => (
                        <button
                          key={color.value}
                          onClick={() => {
                            setCurrentColor(color.value)
                            setShowColorPicker(false)
                          }}
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

                  {/* Versión desktop - todos los colores visibles */}
                  <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                    {COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => setCurrentColor(color.value)}
                        className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full transition-all border-2 ${
                          currentColor === color.value 
                            ? 'border-primary-500 scale-110 shadow-md' 
                            : 'border-gray-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

              <div className="w-px h-6 sm:h-8 bg-gray-300 hidden sm:block" />

              {/* Acciones Deshacer/Rehacer */}
              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                <button
                  onClick={() => canvasRefs.current[activeQuadrant]?.undo()}
                  disabled={!canUndoQuadrants[activeQuadrant]}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
                  title="Deshacer (Ctrl+Z)"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button
                  onClick={() => canvasRefs.current[activeQuadrant]?.redo()}
                  disabled={!canRedoQuadrants[activeQuadrant]}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
                  title="Rehacer (Ctrl+Y)"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (confirm('¿Limpiar el cuadrante activo?')) {
                      canvasRefs.current[activeQuadrant]?.clear()
                    }
                  }}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-red-100 text-red-500 transition-all"
                  title="Limpiar cuadrante activo"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                {/* Fullscreen - después del tachito */}
                <button
                  onClick={handleFullscreen}
                  className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-all"
                  title="Pantalla completa"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
                {/* Centrar vista (resetear pan) */}
                {(quadrantPanOffsets[activeQuadrant].x !== 0 || quadrantPanOffsets[activeQuadrant].y !== 0) && (
                  <button
                    onClick={() => {
                      setQuadrantPanOffsets(prev => {
                        const newOffsets = [...prev]
                        newOffsets[activeQuadrant] = { x: 0, y: 0 }
                        return newOffsets
                      })
                    }}
                    className="p-1.5 sm:p-2 rounded-lg hover:bg-blue-100 text-blue-500 transition-all"
                    title="Centrar vista (resetear desplazamiento)"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Espaciador flexible - solo en desktop */}
              <div className="hidden sm:block flex-1 min-w-0" />
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
                    style={{ 
                      backgroundColor: quadrants[quadrantIndex].bgColor,
                      cursor: activeQuadrant === quadrantIndex && currentTool === 'pen' 
                        ? getPenCursor(currentColor, penMode, currentSize)
                        : currentTool === 'eraser' ? 'cell' 
                        : currentTool === 'pan' ? 'grab'
                        : currentTool === 'text' ? 'text'
                        : 'default'
                    }}
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
                    {/* Contenedor virtual grande con zoom - contiene canvas y todos los overlays */}
                    <div
                      className="relative transition-transform duration-150"
                      style={{ 
                        // Canvas virtual 3x más grande para scroll
                        width: zoomedQuadrant === quadrantIndex && originalQuadrantSize ? originalQuadrantSize.width : '300%',
                        height: zoomedQuadrant === quadrantIndex && originalQuadrantSize ? originalQuadrantSize.height : '300%',
                        transform: `scale(${getFullscreenScale(quadrantIndex)})`,
                        transformOrigin: 'top left',
                        minWidth: '100%',
                        minHeight: '100%',
                      }}
                    >
                    <WhiteboardCanvas
                    ref={el => { canvasRefs.current[quadrantIndex] = el }}
                    content={quadrants[quadrantIndex].content}
                    onContentChange={(content) => updateQuadrantContent(quadrantIndex, content)}
                    currentColor={currentColor}
                    currentSize={currentTool === 'eraser' ? eraserSize : currentSize}
                    currentTool={activeQuadrant === quadrantIndex ? currentTool : 'select'}
                    penMode={penMode}
                    bgColor={quadrants[quadrantIndex].bgColor}
                    onHistoryChange={(canUndo, canRedo) => handleHistoryChange(quadrantIndex, canUndo, canRedo)}
                    zoom={getFullscreenScale(quadrantIndex)}
                    selectedStrokeIds={
                      activeQuadrant === quadrantIndex
                        ? selectedElements.filter(el => el.type === 'stroke').map(el => el.id)
                        : []
                    }
                    panOffset={quadrantPanOffsets[quadrantIndex]}
                    onPanScroll={(deltaX, deltaY) => {
                      // Controlar el scroll del contenedor padre con la herramienta pan
                      const container = canvasContainerRefs.current[quadrantIndex]
                      if (container) {
                        container.scrollLeft += deltaX
                        container.scrollTop += deltaY
                      }
                    }}
                    enableVirtualCanvas={true}
                  />

                  {/* Contenido LaTeX renderizado en tiempo real - se mueve con el canvas */}
                  {quadrants[quadrantIndex].latexContent && (
                    <div
                      ref={activeQuadrant === quadrantIndex ? latexLayerRef : undefined}
                      className={`absolute ${showFormulaBar && !formulaModoLibre ? 'pointer-events-auto cursor-text z-[50]' : 'pointer-events-none z-[1]'}`}
                      style={{
                        top: 45,
                        left: 25,
                        fontSize: quadrants[quadrantIndex].latexFontSize,
                        fontFamily: "'KaTeX_Main', serif",
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        // Hacer el área clickeable más grande cuando fx está activo
                        minWidth: showFormulaBar && !formulaModoLibre ? '80%' : undefined,
                        minHeight: showFormulaBar && !formulaModoLibre ? '60%' : undefined,
                      }}
                      onClick={showFormulaBar && !formulaModoLibre ? (e) => handleLatexLayerClick(e, quadrantIndex) : undefined}
                      onMouseDown={showFormulaBar && !formulaModoLibre ? (e) => handleLatexLayerClick(e, quadrantIndex) : undefined}
                      onPointerDown={showFormulaBar && !formulaModoLibre ? (e) => handleLatexLayerClick(e, quadrantIndex) : undefined}
                      dangerouslySetInnerHTML={{ __html: renderLatexToHtml(quadrants[quadrantIndex].latexContent) }}
                    />
                  )}
                  
                  {/* Cursor fantasma sincronizado con el textarea */}
                  {showFormulaBar && !formulaModoLibre && activeQuadrant === quadrantIndex && ghostCursorPos && (
                    <div
                      className="absolute pointer-events-none z-[51]"
                      style={{
                        top: 45 + ghostCursorPos.top,
                        left: 25 + ghostCursorPos.left,
                        width: 2,
                        height: ghostCursorPos.height || 20,
                        backgroundColor: '#3b82f6',
                        animation: 'blink 1s step-end infinite',
                      }}
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
                    inlineEditingFormulaId === formula.id ? (
                      // Modo edición inline
                      <div
                        key={formula.id}
                        className="absolute"
                        style={{
                          left: formula.x,
                          top: formula.y,
                          zIndex: 30,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col gap-1 bg-white rounded-lg shadow-lg border-2 border-blue-400 p-2">
                          <textarea
                            ref={inlineFormulaRef}
                            value={inlineFormulaValue}
                            onChange={(e) => setInlineFormulaValue(e.target.value)}
                            onBlur={saveInlineFormula}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                saveInlineFormula()
                              } else if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                saveInlineFormula()
                              }
                            }}
                            placeholder="Escribe LaTeX aquí..."
                            className="font-mono text-sm bg-gray-50 border border-gray-300 rounded p-2 outline-none focus:border-blue-500 resize-none"
                            style={{
                              minWidth: '200px',
                              minHeight: '40px',
                              width: Math.max(200, inlineFormulaValue.length * 8),
                            }}
                            autoFocus
                          />
                          {/* Vista previa en tiempo real */}
                          <div 
                            className="p-2 bg-gray-100 rounded min-h-[30px] border border-gray-200"
                            style={{ transform: `scale(${inlineFormulaScale})`, transformOrigin: 'top left' }}
                          >
                            {inlineFormulaValue ? (
                              <div 
                                dangerouslySetInnerHTML={{
                                  __html: (() => {
                                    try {
                                      return katex.renderToString(processLatexSpaces(inlineFormulaValue), { throwOnError: false, displayMode: true })
                                    } catch {
                                      return '<span style="color:red">Error de sintaxis</span>'
                                    }
                                  })()
                                }} 
                              />
                            ) : (
                              <span className="text-gray-400 text-xs">Vista previa...</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Enter: guardar | Esc: cancelar</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Modo visualización normal
                      <div
                        key={formula.id}
                        data-selectable="formula"
                        className={`absolute select-none rounded p-1 transition-all ${
                          currentTool === 'select'
                            ? isElementSelected('formula', formula.id)
                              ? 'ring-2 ring-primary-500 cursor-move'
                              : 'cursor-pointer hover:ring-2 hover:ring-primary-300'
                            : showFormulaBar
                              ? 'cursor-text hover:ring-2 hover:ring-blue-400 hover:bg-blue-50/50'
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
                          // Si el panel de fórmulas está abierto, clic inicia edición inline
                          if (showFormulaBar) {
                            startInlineFormulaEdit(formula)
                          } else if (currentTool === 'select') {
                            toggleSelection('formula', formula.id, e.shiftKey)
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          // Doble clic siempre inicia edición inline
                          startInlineFormulaEdit(formula)
                        }}
                        onMouseDown={(e) => handleDragStart(e, 'formula', formula.id)}
                      >
                        <div 
                          dangerouslySetInnerHTML={{
                            __html: katex.renderToString(processLatexSpaces(formula.latex), { throwOnError: false, displayMode: true })
                          }} 
                        />
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
                    )
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
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        // Si es figura 3D, activar visor inline
                        if (SHAPES_3D[shape.shapeType]) {
                          setActive3DShape({
                            id: shape.id,
                            shapeType: shape.shapeType,
                            x: shape.x,
                            y: shape.y,
                            scale: shape.scale
                          })
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

                  {/* Imágenes pegadas */}
                  {(quadrants[quadrantIndex].content.images || []).map(image => (
                    <div
                      key={image.id}
                      data-selectable="image"
                      className={`absolute select-none transition-all ${
                        currentTool === 'select'
                          ? isElementSelected('image', image.id)
                            ? 'ring-2 ring-primary-500 cursor-move'
                            : 'cursor-pointer hover:ring-2 hover:ring-primary-300'
                          : ''
                      }`}
                      style={{
                        left: image.x,
                        top: image.y,
                        width: image.width,
                        height: image.height,
                        transform: image.rotation ? `rotate(${image.rotation}deg)` : undefined,
                        transformOrigin: 'top left',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (currentTool === 'select') {
                          toggleSelection('image', image.id, e.shiftKey)
                        }
                      }}
                      onMouseDown={(e) => handleDragStart(e, 'image', image.id)}
                    >
                      <img 
                        src={image.src} 
                        alt="" 
                        className="w-full h-full object-contain pointer-events-none"
                        draggable={false}
                      />
                      {/* Handle de redimensionar */}
                      {currentTool === 'select' && isElementSelected('image', image.id) && selectedElements.length === 1 && (
                        <div
                          className="absolute -right-2 -bottom-2 w-4 h-4 bg-primary-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleImageResizeStart(e, image)
                          }}
                        />
                      )}
                    </div>
                  ))}

                  {/* Elementos de Geometría 3D inline */}
                  {(quadrants[quadrantIndex].content.geometry3D || []).map(obj3d => (
                    <div
                      key={obj3d.id}
                      data-selectable="geometry3d"
                      className={`absolute select-none transition-all ${
                        currentTool === 'select'
                          ? isElementSelected('geometry3d', obj3d.id)
                            ? 'ring-2 ring-purple-500 cursor-move'
                            : 'cursor-pointer hover:ring-2 hover:ring-purple-300'
                          : 'cursor-pointer hover:ring-2 hover:ring-purple-300'
                      } ${editing3DElementId === obj3d.id ? 'ring-2 ring-purple-500' : ''}`}
                      style={{
                        left: obj3d.x,
                        top: obj3d.y,
                        width: obj3d.width,
                        height: obj3d.height,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (currentTool === 'select') {
                          toggleSelection('geometry3d', obj3d.id, e.shiftKey)
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        // Activar edición 3D inline
                        setEditing3DElementId(obj3d.id)
                        setActive3DShape({
                          id: obj3d.id,
                          shapeType: obj3d.figureType,
                          x: obj3d.x,
                          y: obj3d.y,
                          scale: obj3d.scale
                        })
                      }}
                      onMouseDown={(e) => {
                        if (editing3DElementId !== obj3d.id) {
                          handleDragStart(e, 'geometry3d', obj3d.id)
                        }
                      }}
                    >
                      {/* Visor 3D inline con Three.js */}
                      {editing3DElementId === obj3d.id && active3DShape ? (
                        <Inline3DViewer
                          shapeType={obj3d.figureType}
                          width={obj3d.width}
                          height={obj3d.height}
                          onRotationChange={(rx, ry) => {
                            // Actualizar rotación del objeto 3D
                            const quadrantContent = quadrants[quadrantIndex].content
                            updateQuadrantContent(quadrantIndex, {
                              ...quadrantContent,
                              geometry3D: (quadrantContent.geometry3D || []).map(o =>
                                o.id === obj3d.id ? { ...o, rotationX: rx, rotationY: ry } : o
                              )
                            })
                          }}
                          onClose={() => {
                            setEditing3DElementId(null)
                            setActive3DShape(null)
                          }}
                          onCapture={(dataUrl) => {
                            // Convertir a imagen estática si el usuario lo desea
                            const quadrantContent = quadrants[quadrantIndex].content
                            const newImage: WhiteboardImage = {
                              id: `img-${Date.now()}`,
                              src: dataUrl,
                              x: obj3d.x,
                              y: obj3d.y,
                              width: obj3d.width,
                              height: obj3d.height,
                            }
                            // Remover el 3D y agregar imagen
                            updateQuadrantContent(quadrantIndex, {
                              ...quadrantContent,
                              geometry3D: (quadrantContent.geometry3D || []).filter(o => o.id !== obj3d.id),
                              images: [...(quadrantContent.images || []), newImage],
                            })
                            setEditing3DElementId(null)
                            setActive3DShape(null)
                          }}
                          initialRotationX={obj3d.rotationX}
                          initialRotationY={obj3d.rotationY}
                        />
                      ) : (
                        // Vista previa estática del 3D
                        <div 
                          className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border border-gray-300 flex items-center justify-center overflow-hidden"
                        >
                          <div className="text-center">
                            <div className="text-3xl mb-1">
                              {obj3d.figureType === 'cube' && '🧊'}
                              {obj3d.figureType === 'tetrahedron' && '🔺'}
                              {obj3d.figureType === 'sphere' && '🌐'}
                              {obj3d.figureType === 'cylinder' && '🛢️'}
                              {obj3d.figureType === 'cone' && '📐'}
                              {obj3d.figureType === 'pyramid' && '🔻'}
                              {obj3d.figureType === 'prism' && '📦'}
                            </div>
                            <div className="text-xs text-gray-500 font-medium capitalize">{obj3d.figureType}</div>
                            <div className="text-[10px] text-gray-400 mt-1">Doble clic para editar</div>
                          </div>
                        </div>
                      )}
                      {/* Handle de redimensionar */}
                      {currentTool === 'select' && isElementSelected('geometry3d', obj3d.id) && selectedElements.length === 1 && !editing3DElementId && (
                        <div
                          className="absolute -right-2 -bottom-2 w-4 h-4 bg-purple-500 rounded-full cursor-se-resize border-2 border-white shadow-md"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleImageResizeStart(e, { ...obj3d, src: '', rotation: 0 })
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
                            __html: katex.renderToString(processLatexSpaces(pendingPlacement.data.latex), { throwOnError: false, displayMode: true })
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

          {/* Panel flotante de fórmulas - Arrastrable y Redimensionable */}
          {showFormulaBar && (
            <div 
              className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden select-none flex flex-col"
              style={{ 
                width: `${formulaPanelSize.width}px`,
                height: `${formulaPanelSize.height}px`,
                minWidth: '220px',
                maxWidth: '550px',
                minHeight: '180px',
                maxHeight: '450px',
                ...(formulaPanelPos.x === 0 && formulaPanelPos.y === 0 
                  ? { bottom: '16px', right: '16px' } 
                  : { left: `${formulaPanelPos.x}px`, top: `${formulaPanelPos.y}px` }
                )
              }}
            >
              {/* Header arrastrable */}
              <div 
                className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 bg-primary-50 cursor-move flex-shrink-0"
                onMouseDown={(e) => {
                  e.preventDefault()
                  const panel = e.currentTarget.parentElement!
                  const rect = panel.getBoundingClientRect()
                  setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                  setIsDraggingPanel(true)
                  
                  const handleMouseMove = (ev: MouseEvent) => {
                    setFormulaPanelPos({ x: ev.clientX - dragOffset.x, y: ev.clientY - dragOffset.y })
                  }
                  const handleMouseUp = () => {
                    setIsDraggingPanel(false)
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                  <svg className="w-4 h-4 text-primary-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <text x="4" y="17" fontSize="14" fontWeight="bold" fontStyle="italic">fx</text>
                  </svg>
                  {formulaPanelSize.width >= 280 && (
                    <span className="font-medium text-sm text-gray-800 truncate">Fórmulas</span>
                  )}
                  {formulaModoLibre && formulaPanelSize.width >= 320 && (
                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-medium flex-shrink-0">Libre</span>
                  )}
                </div>
                <button
                  onClick={handleCancelFormula}
                  className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Editor LaTeX - área de texto redimensionable */}
              <div className="p-2 border-b border-gray-100 flex-shrink-0">
                <textarea
                  ref={formulaInputRef}
                  value={formulaInput}
                  onChange={(e) => {
                    handleFormulaChange(e.target.value)
                    setTimeout(updateGhostCursor, 10)
                  }}
                  onKeyUp={() => updateGhostCursor()}
                  onClick={() => updateGhostCursor()}
                  onSelect={() => updateGhostCursor()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey && !formulaError && formulaInput.trim()) {
                      handleSaveFormula()
                    } else if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                      e.preventDefault()
                      const textarea = e.currentTarget
                      const start = textarea.selectionStart
                      const end = textarea.selectionEnd
                      const newValue = formulaInput.substring(0, start) + ' \\\\\n' + formulaInput.substring(end)
                      handleFormulaChange(newValue)
                      setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = start + 4
                        updateGhostCursor()
                      }, 0)
                    } else {
                      setTimeout(updateGhostCursor, 10)
                    }
                  }}
                  placeholder="\frac{a}{b}"
                  className={`block w-full rounded border bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 font-mono p-2 resize-y ${
                    formulaError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  style={{ 
                    minHeight: '70px',
                    maxHeight: '150px',
                    fontSize: formulaPanelSize.width >= 300 ? '14px' : '12px'
                  }}
                />
                
                {/* Vista previa inline - SOLO para modo libre (fxlibre) */}
                {formulaModoLibre && formulaPreview && formulaPanelSize.height >= 280 && (
                  <div className="mt-1.5 min-h-[28px] flex items-center bg-gray-50 rounded px-2 py-1 border border-gray-200 overflow-x-auto">
                    <div className="transform scale-90 origin-left" dangerouslySetInnerHTML={{ __html: formulaPreview }} />
                  </div>
                )}
              </div>

              {/* Pestañas de categorías - responsive con scroll */}
              <div className="flex items-center px-1 py-1 gap-0.5 overflow-x-auto bg-gray-50 border-b border-gray-100 flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
                {[
                  { key: 'basic', label: '∑', shortLabel: '∑' },
                  { key: 'greek-lower', label: 'αβ', shortLabel: 'α' },
                  { key: 'greek-upper', label: 'ΓΔ', shortLabel: 'Γ' },
                  { key: 'trig', label: 'sin', shortLabel: 'fn' },
                  { key: 'operators', label: '≥', shortLabel: '≥' },
                  { key: 'chemistry', label: 'H₂', shortLabel: 'H' },
                  { key: 'shapes-2d', label: '△', shortLabel: '△', isShape: true },
                  { key: 'shapes-3d', label: '3D', shortLabel: '3D', isShape: true },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setFormulaCategory(tab.key as typeof formulaCategory)}
                    className={`px-1.5 py-0.5 font-medium rounded transition-colors whitespace-nowrap flex-shrink-0 ${
                      formulaCategory === tab.key
                        ? tab.isShape 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:bg-white'
                    }`}
                    style={{ fontSize: formulaPanelSize.width >= 300 ? '11px' : '10px' }}
                  >
                    {formulaPanelSize.width >= 320 ? tab.label : tab.shortLabel}
                  </button>
                ))}
              </div>

              {/* Grid de símbolos - responsive con columnas adaptables */}
              <div className="p-1.5 overflow-y-auto bg-gray-50 flex-1 min-h-0">
                {formulaCategory !== 'shapes-2d' && formulaCategory !== 'shapes-3d' && (
                  <div 
                    className="grid gap-0.5"
                    style={{ 
                      gridTemplateColumns: `repeat(${Math.max(4, Math.min(10, Math.floor((formulaPanelSize.width - 16) / 38)))}, 1fr)`
                    }}
                  >
                    {FORMULA_CATEGORIES[formulaCategory].map((item, idx) => (
                      <button
                        key={`${item.label}-${idx}`}
                        onClick={() => insertFormulaSnippet(item.latex)}
                        title={item.latex}
                        className="flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:border-primary-500 hover:bg-primary-50 transition-all font-serif"
                        style={{ 
                          height: formulaPanelSize.width >= 300 ? '24px' : '20px',
                          fontSize: formulaPanelSize.width >= 300 ? '12px' : '10px'
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                {formulaCategory === 'shapes-2d' && (
                  <div className="space-y-2">
                    {/* Botón para abrir canvas de geometría 2D */}
                    <button
                      onClick={() => setShowGeometry2D(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg shadow hover:from-emerald-700 hover:to-teal-700 transition-all text-xs font-medium"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polygon points="12,2 22,20 2,20" />
                      </svg>
                      Geometría 2D Interactiva
                    </button>
                    
                    {/* Grid de figuras 2D estáticas */}
                    <div 
                      className="grid gap-0.5"
                      style={{ 
                        gridTemplateColumns: `repeat(${Math.max(4, Math.min(8, Math.floor((formulaPanelSize.width - 16) / 42)))}, 1fr)`
                      }}
                    >
                      {Object.entries(SHAPES_2D).map(([key, shape]) => (
                        <button
                          key={key}
                          onClick={() => insertShape(key)}
                          title={shape.label}
                          className="flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                          style={{ height: formulaPanelSize.width >= 300 ? '28px' : '24px' }}
                        >
                          <svg 
                            width={formulaPanelSize.width >= 300 ? 16 : 14} 
                            height={formulaPanelSize.width >= 300 ? 16 : 14} 
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
                  </div>
                )}

                {formulaCategory === 'shapes-3d' && (
                  <div className="space-y-2">
                    {/* Botones para insertar figuras 3D interactivas */}
                    <div className="grid grid-cols-2 gap-1">
                      {(['cube', 'tetrahedron', 'sphere', 'cylinder', 'cone', 'pyramid'] as const).map((figureType) => (
                        <button
                          key={figureType}
                          onClick={() => {
                            // Insertar un elemento 3D directamente en la pizarra
                            if (activeQuadrant !== null) {
                              const quadrantContent = quadrants[activeQuadrant].content
                              const new3DObject: Geometry3DObject = {
                                id: `3d-${Date.now()}`,
                                figureType: figureType,
                                x: 100 + Math.random() * 100,
                                y: 100 + Math.random() * 100,
                                width: 200,
                                height: 200,
                                rotationX: 0.5,
                                rotationY: 0.5,
                                scale: 1,
                                vertices: [],
                                edges: [],
                                faces: [],
                                angles: [],
                              }
                              updateQuadrantContent(activeQuadrant, {
                                ...quadrantContent,
                                geometry3D: [...(quadrantContent.geometry3D || []), new3DObject],
                              })
                              // Activar edición inmediatamente
                              setEditing3DElementId(new3DObject.id)
                              setActive3DShape({
                                id: new3DObject.id,
                                shapeType: figureType,
                                x: new3DObject.x,
                                y: new3DObject.y,
                                scale: 1
                              })
                            }
                          }}
                          className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded shadow hover:from-blue-600 hover:to-purple-600 transition-all text-xs font-medium"
                        >
                          <span className="text-sm">
                            {figureType === 'cube' && '🧊'}
                            {figureType === 'tetrahedron' && '🔺'}
                            {figureType === 'sphere' && '🌐'}
                            {figureType === 'cylinder' && '🛢️'}
                            {figureType === 'cone' && '📐'}
                            {figureType === 'pyramid' && '🔻'}
                          </span>
                          <span className="capitalize">{figureType}</span>
                        </button>
                      ))}
                    </div>
                    
                    {/* Grid de figuras estáticas */}
                    <div className="text-[10px] text-gray-500 text-center pt-1 border-t border-gray-200">
                      Figuras estáticas (imagen)
                    </div>
                    <div 
                      className="grid gap-0.5"
                      style={{ 
                        gridTemplateColumns: `repeat(${Math.max(4, Math.min(8, Math.floor((formulaPanelSize.width - 16) / 42)))}, 1fr)`
                      }}
                    >
                      {Object.entries(SHAPES_3D).map(([key, shape]) => (
                        <button
                          key={key}
                          onClick={() => insertShape(key)}
                          title={shape.label}
                          className="flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                          style={{ height: formulaPanelSize.width >= 300 ? '28px' : '24px' }}
                        >
                          <img 
                            src={shape.src} 
                            alt={shape.label} 
                            width={formulaPanelSize.width >= 300 ? 16 : 14} 
                            height={formulaPanelSize.width >= 300 ? 16 : 14} 
                            className="pointer-events-none" 
                            draggable={false} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer con acciones - responsive */}
              <div className="flex items-center justify-end gap-1 px-2 py-1 border-t border-gray-200 bg-white flex-shrink-0">
                {formulaPanelSize.width >= 280 && (
                  <button
                    onClick={handleCancelFormula}
                    className="px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    Cerrar
                  </button>
                )}
                <button
                  onClick={handleSaveFormula}
                  disabled={!formulaInput.trim() || !!formulaError}
                  className="px-2 py-0.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded shadow-sm transition-all disabled:opacity-50"
                >
                  {formulaModoLibre ? (formulaPanelSize.width >= 280 ? 'Insertar' : '✓') : 'OK'}
                </button>
              </div>

              {/* Handle de resize - borde derecho */}
              <div
                className="absolute top-8 right-0 w-2 cursor-ew-resize hover:bg-primary-200 transition-colors"
                style={{ bottom: '24px', touchAction: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const startX = e.clientX
                  const startWidth = formulaPanelSize.width
                  const handleMouseMove = (ev: MouseEvent) => {
                    const deltaX = ev.clientX - startX
                    const newWidth = Math.max(220, Math.min(550, startWidth + deltaX))
                    setFormulaPanelSize(prev => ({ ...prev, width: newWidth }))
                  }
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
              />

              {/* Handle de resize - borde inferior */}
              <div
                className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize hover:bg-primary-200 transition-colors"
                style={{ touchAction: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const startY = e.clientY
                  const startHeight = formulaPanelSize.height
                  const handleMouseMove = (ev: MouseEvent) => {
                    const deltaY = ev.clientY - startY
                    const newHeight = Math.max(180, Math.min(450, startHeight + deltaY))
                    setFormulaPanelSize(prev => ({ ...prev, height: newHeight }))
                  }
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
              />

              {/* Handle de resize - esquina inferior derecha (diagonal) */}
              <div
                className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-center justify-center hover:bg-primary-100 transition-colors rounded-tl"
                style={{ touchAction: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const startX = e.clientX
                  const startY = e.clientY
                  const startWidth = formulaPanelSize.width
                  const startHeight = formulaPanelSize.height
                  const handleMouseMove = (ev: MouseEvent) => {
                    const deltaX = ev.clientX - startX
                    const deltaY = ev.clientY - startY
                    const newWidth = Math.max(220, Math.min(550, startWidth + deltaX))
                    const newHeight = Math.max(180, Math.min(450, startHeight + deltaY))
                    setFormulaPanelSize({ width: newWidth, height: newHeight })
                  }
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
              >
                <svg className="w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
                </svg>
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

          {/* Visor 3D Inline - se renderiza en el cuadrante activo */}
          {active3DShape && !editing3DElementId && (
            <Inline3DViewer
              shapeId={active3DShape.id}
              shapeType={active3DShape.shapeType}
              x={active3DShape.x}
              y={active3DShape.y}
              scale={active3DShape.scale}
              width={350}
              height={350}
              onClose={() => setActive3DShape(null)}
              onCapture={(dataUrl, w, h) => {
                if (activeQuadrant !== null) {
                  const quadrantContent = quadrants[activeQuadrant].content
                  const newImage: WhiteboardImage = {
                    id: `img-${Date.now()}`,
                    src: dataUrl,
                    x: active3DShape.x,
                    y: active3DShape.y,
                    width: w || 200,
                    height: h || 200,
                    rotation: 0,
                  }
                  updateQuadrantContent(activeQuadrant, {
                    ...quadrantContent,
                    images: [...(quadrantContent.images || []), newImage],
                  })
                }
                setActive3DShape(null)
              }}
            />
          )}

          {/* Canvas Geometría 2D - se renderiza sobre el cuadrante activo */}
          {showGeometry2D && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[9999]">
              <div 
                className="relative"
                style={{ width: Math.min(800, window.innerWidth - 40), height: Math.min(600, window.innerHeight - 100) }}
              >
                <Geometry2DCanvas
                  width={Math.min(800, window.innerWidth - 40)}
                  height={Math.min(600, window.innerHeight - 100)}
                  onClose={() => setShowGeometry2D(false)}
                  onCapture={(dataUrl) => {
                    if (activeQuadrant !== null) {
                      const quadrantContent = quadrants[activeQuadrant].content
                      const newImage: WhiteboardImage = {
                        id: `img-${Date.now()}`,
                        src: dataUrl,
                        x: 50,
                        y: 50,
                        width: 400,
                        height: 300,
                        rotation: 0,
                      }
                      updateQuadrantContent(activeQuadrant, {
                        ...quadrantContent,
                        images: [...(quadrantContent.images || []), newImage],
                      })
                    }
                    setShowGeometry2D(false)
                  }}
                />
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
