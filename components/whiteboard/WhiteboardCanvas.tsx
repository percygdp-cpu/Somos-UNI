'use client'

import { WhiteboardContent, WhiteboardPoint, WhiteboardStroke } from '@/types'
import getStroke from 'perfect-freehand'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Multiplicador para el tamaño virtual del canvas (3x = 3 veces el tamaño visible)
const VIRTUAL_CANVAS_MULTIPLIER = 3

interface WhiteboardCanvasProps {
  content: WhiteboardContent
  onContentChange: (content: WhiteboardContent) => void
  currentColor: string
  currentSize: number
  currentTool: 'select' | 'pen' | 'eraser' | 'text' | 'formula' | 'pan'
  penMode?: 'free' | 'line' | 'arrow' | 'curveArrow'
  bgColor?: string
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void
  zoom?: number
  selectedStrokeIds?: string[]
  // Offset del viewport para pan/scroll (legacy, no usado con enableVirtualCanvas)
  panOffset?: { x: number; y: number }
  onPanChange?: (offset: { x: number; y: number }) => void
  // Callback para scroll con la herramienta pan (delta de movimiento)
  onPanScroll?: (deltaX: number, deltaY: number) => void
  // Habilitar canvas virtual expandido con scrollbars
  enableVirtualCanvas?: boolean
}

export interface WhiteboardCanvasRef {
  undo: () => void
  redo: () => void
  clear: () => void
  exportImage: () => string | null
  getCanvas: () => HTMLCanvasElement | null
}

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )

  d.push('Z')
  return d.join(' ')
}

// Función para dibujar una flecha al final de una línea
function drawArrowHead(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, size: number, color: string) {
  const angle = Math.atan2(toY - fromY, toX - fromX)
  const headLength = Math.max(size * 2.5, 12)
  const headAngle = Math.PI / 7 // ~25 grados para flecha más puntiaguda
  
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.lineJoin = 'miter'
  
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - headLength * Math.cos(angle - headAngle),
    toY - headLength * Math.sin(angle - headAngle)
  )
  ctx.lineTo(
    toX - headLength * Math.cos(angle + headAngle),
    toY - headLength * Math.sin(angle + headAngle)
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Función para dibujar una línea recta
function drawStraightLine(ctx: CanvasRenderingContext2D, start: WhiteboardPoint, end: WhiteboardPoint, size: number, color: string, withArrow: boolean) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const headLength = Math.max(size * 2.5, 12)
  
  // Si tiene flecha, acortar la línea para que no sobresalga
  const endX = withArrow ? end.x - headLength * 0.5 * Math.cos(angle) : end.x
  const endY = withArrow ? end.y - headLength * 0.5 * Math.sin(angle) : end.y
  
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(endX, endY)
  ctx.stroke()
  ctx.restore()
  
  if (withArrow) {
    drawArrowHead(ctx, start.x, start.y, end.x, end.y, size, color)
  }
}

// Función para dibujar una flecha curva (línea recta de punto a punto con ligera curva hacia abajo)
function drawCurvedLine(ctx: CanvasRenderingContext2D, points: WhiteboardPoint[], size: number, color: string, withArrow: boolean) {
  if (points.length < 2) return
  
  const headLength = Math.max(size * 2.5, 12)
  
  // Usamos solo el punto inicial y final
  const start = points[0]
  const end = points[points.length - 1]
  
  // Calcular el punto medio
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  
  // Calcular la distancia entre puntos
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Curva hacia abajo: desplazamos el punto de control hacia abajo
  // La cantidad de curva es proporcional a la distancia (máximo 30px)
  const curveAmount = Math.min(distance * 0.15, 30)
  
  // Punto de control para la curva (desplazado hacia abajo)
  const controlX = midX
  const controlY = midY + curveAmount
  
  // Para la flecha, calculamos la tangente al final de la curva
  // La tangente de una curva cuadrática en t=1 es: 2*(P2-P1) = 2*(end - control)
  const tangentX = end.x - controlX
  const tangentY = end.y - controlY
  const angle = Math.atan2(tangentY, tangentX)
  
  // Punto donde termina la línea (antes de la flecha)
  const lineEndX = withArrow ? end.x - headLength * 0.5 * Math.cos(angle) : end.x
  const lineEndY = withArrow ? end.y - headLength * 0.5 * Math.sin(angle) : end.y
  
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.quadraticCurveTo(controlX, controlY, lineEndX, lineEndY)
  ctx.stroke()
  ctx.restore()
  
  if (withArrow) {
    drawArrowHead(ctx, controlX, controlY, end.x, end.y, size, color)
  }
}

const WhiteboardCanvas = forwardRef<WhiteboardCanvasRef, WhiteboardCanvasProps>(
  ({ content, onContentChange, currentColor, currentSize, currentTool, penMode = 'free', bgColor = '#ffffff', onHistoryChange, zoom = 1, selectedStrokeIds = [], panOffset = { x: 0, y: 0 }, onPanChange, onPanScroll, enableVirtualCanvas = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [currentPoints, setCurrentPoints] = useState<WhiteboardPoint[]>([])
    const [history, setHistory] = useState<WhiteboardContent[]>([content])
    const [historyIndex, setHistoryIndex] = useState(0)
    const lastContentRef = useRef<WhiteboardContent>(content)
    const startPointRef = useRef<WhiteboardPoint | null>(null)
    
    // Estado para pan (arrastre de la vista)
    const [isPanning, setIsPanning] = useState(false)
    // Referencia para el pan: guarda posición inicial y última posición conocida
    const panStartRef = useRef<{ x: number; y: number; lastX: number; lastY: number; offsetX: number; offsetY: number } | null>(null)
    
    // Tamaño actual del canvas (se usa para detectar cambios de tamaño)
    const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
    
    // Flag para saber si el cambio de contenido es interno (dibujo/undo/redo) o externo (padre)
    const isInternalChangeRef = useRef(false)

    // Generar ID único
    const generateId = () => Math.random().toString(36).substring(2, 11)

    // Sincronizar historial cuando el contenido cambia externamente (ej: al eliminar elementos desde el padre)
    useEffect(() => {
      // Si el cambio fue interno, no hacer nada (ya se actualizó el historial)
      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false
        return
      }
      
      // Detectar si el contenido realmente cambió
      const currentHistoryContent = history[historyIndex]
      const contentChanged = JSON.stringify(content) !== JSON.stringify(currentHistoryContent)
      
      if (contentChanged && !isDrawing) {
        // El contenido cambió externamente, reemplazar el historial actual
        // para evitar que undo restaure estados eliminados
        const newHistory = [...history.slice(0, historyIndex + 1), content]
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
        lastContentRef.current = content
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content])

    // Redimensionar canvas
    useEffect(() => {
      const resizeCanvas = () => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        const rect = container.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        
        // El canvas ocupa el 100% del contenedor
        // Si enableVirtualCanvas está true, el padre ya maneja el scroll con un div más grande
        const canvasWidth = rect.width
        const canvasHeight = rect.height
        
        canvas.width = canvasWidth * dpr
        canvas.height = canvasHeight * dpr
        canvas.style.width = `${canvasWidth}px`
        canvas.style.height = `${canvasHeight}px`
        
        // Guardar tamaño actual para escalar coordenadas
        canvasSizeRef.current = { width: canvasWidth, height: canvasHeight }
        
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(dpr, dpr)
        }
        
        redraw()
      }

      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
      return () => window.removeEventListener('resize', resizeCanvas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enableVirtualCanvas])

    // Redibujar cuando cambia el contenido, selección o color de fondo
    useEffect(() => {
      redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, selectedStrokeIds, bgColor, panOffset])

    // Actualizar estado de historial
    useEffect(() => {
      onHistoryChange(historyIndex > 0, historyIndex < history.length - 1)
    }, [historyIndex, history.length, onHistoryChange])

    const redraw = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      
      // Limpiar y aplicar color de fondo
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, width, height)
      
      // Aplicar transformación de pan (desplazamiento del viewport)
      ctx.save()
      ctx.translate(panOffset.x, panOffset.y)

      // Dibujar todos los trazos (sin escalar - las coordenadas ya son relativas al canvas)
      content.strokes.forEach(stroke => {
        if (stroke.points.length < 2) return

        const strokeType = stroke.strokeType || 'free'
        
        // Usar los puntos directamente sin escalar
        const points = stroke.points
        
        // Usar el tamaño del trazo directamente
        const strokeSize = stroke.size
        
        // Para el borrador, usar el color de fondo actual
        const eraserColor = bgColor
        
        // Dibujar según el tipo de trazo
        if (strokeType === 'line') {
          // Línea recta sin flecha
          const start = points[0]
          const end = points[points.length - 1]
          drawStraightLine(ctx, start, end, strokeSize, stroke.tool === 'eraser' ? eraserColor : stroke.color, false)
        } else if (strokeType === 'arrow') {
          // Línea recta con flecha
          const start = points[0]
          const end = points[points.length - 1]
          drawStraightLine(ctx, start, end, strokeSize, stroke.tool === 'eraser' ? eraserColor : stroke.color, true)
        } else if (strokeType === 'curveArrow') {
          // Curva con flecha
          drawCurvedLine(ctx, points, strokeSize, stroke.tool === 'eraser' ? eraserColor : stroke.color, true)
        } else {
          // Dibujo libre (default)
          const strokePoints = points.map(p => [p.x, p.y, p.pressure || 0.5])
          const outlinePoints = getStroke(strokePoints, {
            size: strokeSize,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
          })

          const pathData = getSvgPathFromStroke(outlinePoints)
          const path = new Path2D(pathData)
          
          ctx.fillStyle = stroke.tool === 'eraser' ? eraserColor : stroke.color
          ctx.fill(path)
        }

        // Dibujar indicador de selección si el trazo está seleccionado
        if (selectedStrokeIds.includes(stroke.id)) {
          // Calcular bounding box del trazo
          const xs = points.map(p => p.x)
          const ys = points.map(p => p.y)
          const minX = Math.min(...xs) - strokeSize / 2 - 4
          const minY = Math.min(...ys) - strokeSize / 2 - 4
          const maxX = Math.max(...xs) + strokeSize / 2 + 4
          const maxY = Math.max(...ys) + strokeSize / 2 + 4
          
          // Dibujar rectángulo de selección con borde azul punteado
          ctx.save()
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 2
          ctx.setLineDash([5, 3])
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
          
          // Dibujar handles en las esquinas
          ctx.fillStyle = '#3b82f6'
          ctx.setLineDash([])
          const handleSize = 6
          // Esquina superior izquierda
          ctx.fillRect(minX - handleSize/2, minY - handleSize/2, handleSize, handleSize)
          // Esquina superior derecha
          ctx.fillRect(maxX - handleSize/2, minY - handleSize/2, handleSize, handleSize)
          // Esquina inferior izquierda
          ctx.fillRect(minX - handleSize/2, maxY - handleSize/2, handleSize, handleSize)
          // Esquina inferior derecha
          ctx.fillRect(maxX - handleSize/2, maxY - handleSize/2, handleSize, handleSize)
          ctx.restore()
        }
      })

      // Dibujar trazo actual (preview)
      if (currentPoints.length > 1 && startPointRef.current) {
        const color = currentTool === 'eraser' ? bgColor : currentColor
        const startPoint = startPointRef.current
        const lastPoint = currentPoints[currentPoints.length - 1]
        
        // El borrador siempre usa trazo libre para el preview
        if (currentTool === 'pen' && penMode === 'line') {
          // Preview de línea recta
          drawStraightLine(ctx, startPoint, lastPoint, currentSize, color, false)
        } else if (currentTool === 'pen' && penMode === 'arrow') {
          // Preview de flecha recta
          drawStraightLine(ctx, startPoint, lastPoint, currentSize, color, true)
        } else if (currentTool === 'pen' && penMode === 'curveArrow') {
          // Preview de curva con flecha
          drawCurvedLine(ctx, currentPoints, currentSize, color, true)
        } else {
          // Dibujo libre o borrador
          const strokePoints = currentPoints.map(p => [p.x, p.y, p.pressure || 0.5])
          const outlinePoints = getStroke(strokePoints, {
            size: currentSize,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
          })

          const pathData = getSvgPathFromStroke(outlinePoints)
          const path = new Path2D(pathData)
          
          ctx.fillStyle = color
          ctx.fill(path)
        }
      }
      
      // Restaurar contexto (quitar translate)
      ctx.restore()
    }, [content, currentPoints, currentColor, currentSize, currentTool, penMode, bgColor, selectedStrokeIds, panOffset])

    // Función para muestrear puntos (reducir cantidad para curvas suaves)
    const samplePoints = (points: WhiteboardPoint[], maxPoints: number): WhiteboardPoint[] => {
      if (points.length <= maxPoints) return points
      const step = Math.floor(points.length / maxPoints)
      const sampled: WhiteboardPoint[] = [points[0]]
      for (let i = step; i < points.length - 1; i += step) {
        sampled.push(points[i])
      }
      sampled.push(points[points.length - 1])
      return sampled
    }

    const getPointFromEvent = (e: React.MouseEvent | React.TouchEvent): WhiteboardPoint | null => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const rect = canvas.getBoundingClientRect()
      
      // Obtener coordenadas relativas al canvas, compensando zoom y panOffset
      if ('touches' in e) {
        if (e.touches.length === 0) return null
        const touch = e.touches[0]
        return {
          x: (touch.clientX - rect.left) / zoom - panOffset.x,
          y: (touch.clientY - rect.top) / zoom - panOffset.y,
          pressure: 0.5
        }
      } else {
        return {
          x: (e.clientX - rect.left) / zoom - panOffset.x,
          y: (e.clientY - rect.top) / zoom - panOffset.y,
          pressure: 0.5
        }
      }
    }

    // Obtener posición del mouse/touch para pan (sin compensar panOffset)
    const getRawPointFromEvent = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const rect = canvas.getBoundingClientRect()
      
      if ('touches' in e) {
        if (e.touches.length === 0) return null
        const touch = e.touches[0]
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        }
      } else {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
      }
    }

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
      // Manejar herramienta de pan
      if (currentTool === 'pan') {
        e.preventDefault()
        const rawPoint = getRawPointFromEvent(e)
        if (!rawPoint) return
        
        setIsPanning(true)
        panStartRef.current = {
          x: rawPoint.x,
          y: rawPoint.y,
          lastX: rawPoint.x,
          lastY: rawPoint.y,
          offsetX: panOffset.x,
          offsetY: panOffset.y
        }
        return
      }
      
      // Solo dibujar con pen o eraser
      if (currentTool !== 'pen' && currentTool !== 'eraser') return
      
      e.preventDefault()
      const point = getPointFromEvent(e)
      if (!point) return

      startPointRef.current = point
      setIsDrawing(true)
      setCurrentPoints([point])
    }

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
      // Manejar movimiento del pan
      if (isPanning && panStartRef.current) {
        e.preventDefault()
        const rawPoint = getRawPointFromEvent(e)
        if (!rawPoint) return
        
        // Calcular delta desde la última posición (para scroll incremental)
        const deltaX = panStartRef.current.lastX - rawPoint.x
        const deltaY = panStartRef.current.lastY - rawPoint.y
        
        // Actualizar la última posición
        panStartRef.current.lastX = rawPoint.x
        panStartRef.current.lastY = rawPoint.y
        
        // Si hay callback de scroll (para controlar scrollbars del contenedor padre)
        if (onPanScroll) {
          onPanScroll(deltaX, deltaY)
        } else if (onPanChange) {
          // Fallback al comportamiento anterior (offset absoluto)
          const totalDeltaX = rawPoint.x - panStartRef.current.x
          const totalDeltaY = rawPoint.y - panStartRef.current.y
          onPanChange({
            x: panStartRef.current.offsetX + totalDeltaX,
            y: panStartRef.current.offsetY + totalDeltaY
          })
        }
        return
      }
      
      if (!isDrawing) return
      e.preventDefault()

      const point = getPointFromEvent(e)
      if (!point) return

      // El borrador siempre usa trazo libre
      // Para línea recta y flecha (solo con pen), guardamos primer y último punto
      if (currentTool === 'pen' && (penMode === 'line' || penMode === 'arrow')) {
        setCurrentPoints([startPointRef.current!, point])
      } else if (currentTool === 'pen' && penMode === 'curveArrow') {
        // Curva con flecha: acumular todos los puntos
        setCurrentPoints(prev => [...prev, point])
      } else {
        // Trazo libre o borrador
        setCurrentPoints(prev => [...prev, point])
      }
      redraw()
    }

    const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
      // Terminar pan
      if (isPanning) {
        setIsPanning(false)
        panStartRef.current = null
        return
      }
      
      if (!isDrawing) return
      e.preventDefault()

      if (currentPoints.length > 1 && (currentTool === 'pen' || currentTool === 'eraser')) {
        // Determinar tipo de trazo y puntos finales
        let finalPoints = currentPoints
        let strokeType: 'free' | 'line' | 'arrow' | 'curveArrow' = 'free'
        
        // El borrador siempre es trazo libre
        // El pen usa el penMode seleccionado
        if (currentTool === 'pen') {
          strokeType = penMode
          // Para curvas, muestrear los puntos para que sea suave
          if (penMode === 'curveArrow') {
            finalPoints = samplePoints(currentPoints, 8)
          }
        }
        
        const newStroke: WhiteboardStroke = {
          id: generateId(),
          points: finalPoints,
          color: currentColor,
          size: currentSize,
          tool: currentTool,
          strokeType: strokeType
        }

        const newContent: WhiteboardContent = {
          ...content,
          strokes: [...content.strokes, newStroke]
        }

        // Actualizar historial
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(newContent)
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)

        // Marcar como cambio interno para evitar doble sincronización
        isInternalChangeRef.current = true
        onContentChange(newContent)
      }

      setIsDrawing(false)
      setCurrentPoints([])
      startPointRef.current = null
    }

    // Exponer métodos al padre
    useImperativeHandle(ref, () => ({
      undo: () => {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1
          setHistoryIndex(newIndex)
          isInternalChangeRef.current = true
          onContentChange(history[newIndex])
        }
      },
      redo: () => {
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1
          setHistoryIndex(newIndex)
          isInternalChangeRef.current = true
          onContentChange(history[newIndex])
        }
      },
      clear: () => {
        const emptyContent: WhiteboardContent = { strokes: [], formulas: [] }
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(emptyContent)
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
        isInternalChangeRef.current = true
        onContentChange(emptyContent)
      },
      exportImage: () => {
        const canvas = canvasRef.current
        if (!canvas) return null
        return canvas.toDataURL('image/png')
      },
      getCanvas: () => canvasRef.current
    }))

    return (
      <div 
        ref={containerRef} 
        className={`flex-1 rounded-lg shadow-inner touch-none overflow-hidden`}
        style={enableVirtualCanvas ? { height: '100%', backgroundColor: bgColor } : { minHeight: '500px', height: '100%', backgroundColor: bgColor }}
      >
        <canvas
          ref={canvasRef}
          className={`${enableVirtualCanvas ? '' : 'w-full h-full'} ${
            currentTool === 'select' ? 'cursor-default' 
            : currentTool === 'eraser' ? 'cursor-cell'
            : currentTool === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab')
            : 'cursor-crosshair'
          }`}
          style={enableVirtualCanvas ? {} : { minHeight: '500px' }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          onTouchCancel={handleEnd}
        />
      </div>
    )
  }
)

WhiteboardCanvas.displayName = 'WhiteboardCanvas'

export default WhiteboardCanvas
