'use client'

import { WhiteboardContent, WhiteboardPoint, WhiteboardStroke } from '@/types'
import getStroke from 'perfect-freehand'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

interface WhiteboardCanvasProps {
  content: WhiteboardContent
  onContentChange: (content: WhiteboardContent) => void
  currentColor: string
  currentSize: number
  currentTool: 'select' | 'pen' | 'eraser' | 'text' | 'formula'
  penMode?: 'free' | 'line' | 'arrow' | 'curveArrow'
  bgColor?: string
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void
  zoom?: number
  selectedStrokeIds?: string[]
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

// Función para dibujar una curva con puntos de control
function drawCurvedLine(ctx: CanvasRenderingContext2D, points: WhiteboardPoint[], size: number, color: string, withArrow: boolean) {
  if (points.length < 2) return
  
  const headLength = Math.max(size * 2.5, 12)
  
  // Para la flecha, necesitamos la tangente al final
  // Usamos los últimos 2 puntos para calcular la dirección
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x)
  
  // Punto donde termina la línea (antes de la flecha)
  const lineEndX = withArrow ? last.x - headLength * Math.cos(angle) : last.x
  const lineEndY = withArrow ? last.y - headLength * Math.sin(angle) : last.y
  
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  
  if (points.length === 2) {
    ctx.lineTo(lineEndX, lineEndY)
  } else {
    // Dibujar curva suave por todos los puntos excepto el último
    for (let i = 1; i < points.length - 2; i++) {
      const curr = points[i]
      const next = points[i + 1]
      const midX = (curr.x + next.x) / 2
      const midY = (curr.y + next.y) / 2
      ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
    }
    // Penúltimo punto como control, terminar en punto acortado
    ctx.quadraticCurveTo(prev.x, prev.y, lineEndX, lineEndY)
  }
  
  ctx.stroke()
  ctx.restore()
  
  if (withArrow) {
    drawArrowHead(ctx, prev.x, prev.y, last.x, last.y, size, color)
  }
}

const WhiteboardCanvas = forwardRef<WhiteboardCanvasRef, WhiteboardCanvasProps>(
  ({ content, onContentChange, currentColor, currentSize, currentTool, penMode = 'free', bgColor = '#ffffff', onHistoryChange, zoom = 1, selectedStrokeIds = [] }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [currentPoints, setCurrentPoints] = useState<WhiteboardPoint[]>([])
    const [history, setHistory] = useState<WhiteboardContent[]>([content])
    const [historyIndex, setHistoryIndex] = useState(0)
    const lastContentRef = useRef<WhiteboardContent>(content)
    const startPointRef = useRef<WhiteboardPoint | null>(null)

    // Generar ID único
    const generateId = () => Math.random().toString(36).substring(2, 11)

    // Sincronizar historial cuando el contenido cambia externamente (ej: al eliminar elementos desde el padre)
    useEffect(() => {
      // Detectar si el cambio viene de afuera (no de un undo/redo interno)
      const currentHistoryContent = history[historyIndex]
      const contentChanged = JSON.stringify(content.strokes) !== JSON.stringify(currentHistoryContent?.strokes)
      
      if (contentChanged && !isDrawing) {
        // El contenido cambió externamente, actualizar el historial
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(content)
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
        
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
        
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
    }, [])

    // Redibujar cuando cambia el contenido, selección o color de fondo
    useEffect(() => {
      redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, selectedStrokeIds, bgColor])

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

      // Dibujar todos los trazos
      content.strokes.forEach(stroke => {
        if (stroke.points.length < 2) return

        const strokeType = stroke.strokeType || 'free'
        
        // Para el borrador, usar el color de fondo actual
        const eraserColor = bgColor
        
        // Dibujar según el tipo de trazo
        if (strokeType === 'line') {
          // Línea recta sin flecha
          const start = stroke.points[0]
          const end = stroke.points[stroke.points.length - 1]
          drawStraightLine(ctx, start, end, stroke.size, stroke.tool === 'eraser' ? eraserColor : stroke.color, false)
        } else if (strokeType === 'arrow') {
          // Línea recta con flecha
          const start = stroke.points[0]
          const end = stroke.points[stroke.points.length - 1]
          drawStraightLine(ctx, start, end, stroke.size, stroke.tool === 'eraser' ? eraserColor : stroke.color, true)
        } else if (strokeType === 'curveArrow') {
          // Curva con flecha
          drawCurvedLine(ctx, stroke.points, stroke.size, stroke.tool === 'eraser' ? eraserColor : stroke.color, true)
        } else {
          // Dibujo libre (default)
          const strokePoints = stroke.points.map(p => [p.x, p.y, p.pressure || 0.5])
          const outlinePoints = getStroke(strokePoints, {
            size: stroke.size,
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
          const xs = stroke.points.map(p => p.x)
          const ys = stroke.points.map(p => p.y)
          const minX = Math.min(...xs) - stroke.size / 2 - 4
          const minY = Math.min(...ys) - stroke.size / 2 - 4
          const maxX = Math.max(...xs) + stroke.size / 2 + 4
          const maxY = Math.max(...ys) + stroke.size / 2 + 4
          
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
        const lastPoint = currentPoints[currentPoints.length - 1]
        
        // El borrador siempre usa trazo libre para el preview
        if (currentTool === 'pen' && penMode === 'line') {
          // Preview de línea recta
          drawStraightLine(ctx, startPointRef.current, lastPoint, currentSize, color, false)
        } else if (currentTool === 'pen' && penMode === 'arrow') {
          // Preview de flecha recta
          drawStraightLine(ctx, startPointRef.current, lastPoint, currentSize, color, true)
        } else if (currentTool === 'pen' && penMode === 'curveArrow') {
          // Preview de curva con flecha - usar todos los puntos para preview estable
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
    }, [content, currentPoints, currentColor, currentSize, currentTool, penMode, bgColor, selectedStrokeIds])

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
      
      if ('touches' in e) {
        if (e.touches.length === 0) return null
        const touch = e.touches[0]
        return {
          x: (touch.clientX - rect.left) / zoom,
          y: (touch.clientY - rect.top) / zoom,
          pressure: 0.5
        }
      } else {
        return {
          x: (e.clientX - rect.left) / zoom,
          y: (e.clientY - rect.top) / zoom,
          pressure: 0.5
        }
      }
    }

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
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
          onContentChange(history[newIndex])
        }
      },
      redo: () => {
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1
          setHistoryIndex(newIndex)
          onContentChange(history[newIndex])
        }
      },
      clear: () => {
        const emptyContent: WhiteboardContent = { strokes: [], formulas: [] }
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(emptyContent)
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
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
        className="flex-1 bg-white rounded-lg shadow-inner overflow-hidden touch-none"
        style={{ minHeight: '500px', height: '100%' }}
      >
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${
            currentTool === 'select' ? 'cursor-default' 
            : currentTool === 'eraser' ? 'cursor-cell'
            : 'cursor-crosshair'
          }`}
          style={{ minHeight: '500px' }}
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
