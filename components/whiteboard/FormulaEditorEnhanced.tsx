'use client'

import katex from 'katex'
import { useCallback, useEffect, useRef, useState } from 'react'

interface FormulaEditorEnhancedProps {
  initialLatex?: string
  onLatexChange?: (latex: string) => void
  onInsertFormula?: (latex: string) => void
  isFloating?: boolean
  position?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
  onClose?: () => void
}

const FORMULA_BUTTONS = [
  { label: 'xⁿ', latex: 'x^{n}', title: 'Potencia' },
  { label: 'ⁿ√x', latex: '\\sqrt[n]{x}', title: 'Raíz n-ésima' },
  { label: 'a/b', latex: '\\frac{a}{b}', title: 'Fracción' },
  { label: '×', latex: '\\times', title: 'Multiplicación' },
  { label: 'x²', latex: 'x^{2}', title: 'Cuadrado' },
  { label: '√x', latex: '\\sqrt{x}', title: 'Raíz cuadrada' },
  { label: 'π', latex: '\\pi', title: 'Pi' },
  { label: 'Σ', latex: '\\sum_{i=1}^{n}', title: 'Sumatoria' },
  { label: '∫', latex: '\\int_{a}^{b}', title: 'Integral' },
  { label: 'lim', latex: '\\lim_{x \\to \\infty}', title: 'Límite' },
]

export default function FormulaEditorEnhanced({
  initialLatex = '',
  onLatexChange,
  onInsertFormula,
  isFloating = false,
  position = { x: 20, y: 20 },
  onPositionChange,
  onClose
}: FormulaEditorEnhancedProps) {
  const [latex, setLatex] = useState(initialLatex)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const ghostCursorRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)

  // Actualizar latex
  const handleLatexChange = useCallback((newLatex: string) => {
    setLatex(newLatex)
    onLatexChange?.(newLatex)
  }, [onLatexChange])

  // Insertar símbolo en la posición del cursor
  const insertSymbol = useCallback((symbol: string) => {
    const input = inputRef.current
    if (!input) {
      onInsertFormula?.(symbol)
      return
    }

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const newLatex = latex.slice(0, start) + symbol + latex.slice(end)
    handleLatexChange(newLatex)
    
    // Mover cursor después del símbolo insertado
    setTimeout(() => {
      const newPos = start + symbol.length
      input.setSelectionRange(newPos, newPos)
      input.focus()
      updateCursorPosition()
    }, 0)
  }, [latex, handleLatexChange, onInsertFormula])

  // Actualizar posición del cursor fantasma
  const updateCursorPosition = useCallback(() => {
    const input = inputRef.current
    const preview = previewRef.current
    const ghostCursor = ghostCursorRef.current
    
    if (!input || !preview || !ghostCursor) return

    const lines = latex.substring(0, input.selectionStart).split('\n')
    const row = lines.length - 1
    const col = lines[row].length

    // Encontrar la línea correspondiente en el preview
    const mathLines = preview.querySelectorAll('.math-line')
    const targetLine = mathLines[row] as HTMLElement
    
    if (targetLine) {
      const rect = targetLine.getBoundingClientRect()
      const previewRect = preview.getBoundingClientRect()
      const fullTextLen = latex.split('\n')[row]?.length || 1
      const charPos = (rect.width * (col / fullTextLen))
      
      ghostCursor.style.display = 'block'
      ghostCursor.style.left = `${rect.left - previewRect.left + charPos}px`
      ghostCursor.style.top = `${rect.top - previewRect.top}px`
      ghostCursor.style.height = `${rect.height}px`
    } else {
      ghostCursor.style.display = 'none'
    }
    
    setCursorPosition(input.selectionStart || 0)
  }, [latex])

  // Click en el preview para posicionar cursor
  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const input = inputRef.current
    const preview = previewRef.current
    if (!input || !preview) return

    const mathLines = preview.querySelectorAll('.math-line')
    if (!mathLines.length) {
      input.focus()
      return
    }

    // Encontrar la línea más cercana
    let closestRow = 0
    let minDist = Infinity
    
    mathLines.forEach((line, i) => {
      const rect = (line as HTMLElement).getBoundingClientRect()
      const dist = Math.abs(e.clientY - (rect.top + rect.height / 2))
      if (dist < minDist) {
        minDist = dist
        closestRow = i
      }
    })

    const targetLine = mathLines[closestRow] as HTMLElement
    const rect = targetLine.getBoundingClientRect()
    const textInRow = latex.split('\n')[closestRow] || ''
    const clickX = e.clientX - rect.left
    const col = Math.max(0, Math.min(textInRow.length, Math.round((clickX / rect.width) * textInRow.length)))

    // Calcular posición absoluta en el texto
    let pos = 0
    const allLines = latex.split('\n')
    for (let i = 0; i < closestRow; i++) {
      pos += allLines[i].length + 1 // +1 por el salto de línea
    }
    pos += col

    input.focus()
    setTimeout(() => {
      input.setSelectionRange(pos, pos)
      updateCursorPosition()
    }, 0)
  }, [latex, updateCursorPosition])

  // Renderizar preview con KaTeX
  const renderPreview = useCallback(() => {
    if (!previewRef.current) return

    const lines = latex.split('\n')
    previewRef.current.innerHTML = lines.map((line, i) => {
      if (!line.trim()) {
        return '<div class="math-line" style="visibility:hidden; min-height: 1.5em;">.</div>'
      }
      try {
        const rendered = katex.renderToString(line.replace(/ /g, '\\;'), {
          throwOnError: false,
          displayMode: false
        })
        return `<div class="math-line">${rendered}</div>`
      } catch {
        return `<div class="math-line text-red-500">${line}</div>`
      }
    }).join('')
  }, [latex])

  // Manejar arrastre del editor flotante
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    }
  }, [position])

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return
    const newX = dragStartRef.current.posX + (e.clientX - dragStartRef.current.x)
    const newY = dragStartRef.current.posY + (e.clientY - dragStartRef.current.y)
    onPositionChange?.({ x: newX, y: newY })
  }, [isDragging, onPositionChange])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  // Event listeners para arrastre
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
    }
    return () => {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // Actualizar preview cuando cambia el latex
  useEffect(() => {
    renderPreview()
  }, [renderPreview])

  // Actualizar cursor cuando cambia la selección
  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const handleSelectionChange = () => updateCursorPosition()
    input.addEventListener('keyup', handleSelectionChange)
    input.addEventListener('click', handleSelectionChange)
    
    return () => {
      input.removeEventListener('keyup', handleSelectionChange)
      input.removeEventListener('click', handleSelectionChange)
    }
  }, [updateCursorPosition])

  // Estilos condicionales para modo flotante
  const containerClasses = isFloating
    ? 'fixed z-50 bg-gray-800 rounded-xl shadow-2xl border border-gray-600 overflow-hidden'
    : 'bg-white rounded-lg shadow-sm border border-gray-200 p-3'

  const containerStyle = isFloating
    ? { left: position.x, top: position.y, width: isMinimized ? 300 : 650 }
    : {}

  return (
    <div className={containerClasses} style={containerStyle}>
      {/* Header (solo en modo flotante) */}
      {isFloating && (
        <div
          className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between cursor-move select-none"
          onMouseDown={handleDragStart}
        >
          <span className="text-sm font-medium">⌨️ Editor Matemático</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-6 h-6 flex items-center justify-center hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            >
              {isMinimized ? '+' : '−'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center hover:bg-red-600 rounded text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenido */}
      {!isMinimized && (
        <>
          {/* Preview con cursor fantasma */}
          <div
            ref={previewRef}
            className={`relative cursor-text ${isFloating ? 'bg-white p-4 min-h-[80px]' : 'mb-3 p-3 bg-gray-50 rounded-lg min-h-[60px]'}`}
            onClick={handlePreviewClick}
            style={{ fontSize: isFloating ? '1.5rem' : '1.2rem' }}
          >
            {/* Ghost cursor */}
            <div
              ref={ghostCursorRef}
              className="absolute w-0.5 bg-red-500 pointer-events-none animate-pulse"
              style={{ display: 'none' }}
            />
            {!latex && (
              <span className="text-gray-400 italic">Escribe una fórmula...</span>
            )}
          </div>

          {/* Textarea para input */}
          <textarea
            ref={inputRef}
            value={latex}
            onChange={(e) => handleLatexChange(e.target.value)}
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
            placeholder="Escribe LaTeX aquí..."
            className={`w-full resize-none font-mono ${
              isFloating 
                ? 'bg-gray-900 text-green-400 p-4 text-lg border-0 outline-none h-48' 
                : 'px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent h-20'
            }`}
            spellCheck={false}
          />

          {/* Botones de símbolos */}
          <div className={`flex flex-wrap gap-1 ${isFloating ? 'bg-gray-700 p-3' : 'mt-3'}`}>
            {FORMULA_BUTTONS.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => insertSymbol(btn.latex)}
                className={`px-3 py-2 text-sm font-medium rounded transition-all ${
                  isFloating
                    ? 'bg-gray-600 text-white hover:bg-gray-500 border border-gray-500'
                    : 'bg-gray-50 hover:bg-primary-50 hover:text-primary-700 border border-gray-200'
                }`}
                title={btn.title}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
