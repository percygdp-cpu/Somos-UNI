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

const WhiteboardCanvas = forwardRef<WhiteboardCanvasRef, WhiteboardCanvasProps>(
  ({ content, onContentChange, currentColor, currentSize, currentTool, onHistoryChange, zoom = 1, selectedStrokeIds = [] }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [currentPoints, setCurrentPoints] = useState<WhiteboardPoint[]>([])
    const [history, setHistory] = useState<WhiteboardContent[]>([content])
    const [historyIndex, setHistoryIndex] = useState(0)

    // Generar ID único
    const generateId = () => Math.random().toString(36).substring(2, 11)

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

    // Redibujar cuando cambia el contenido o la selección
    useEffect(() => {
      redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, selectedStrokeIds])

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
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

      // Dibujar todos los trazos
      content.strokes.forEach(stroke => {
        if (stroke.points.length < 2) return

        const strokePoints = stroke.points.map(p => [p.x, p.y, p.pressure || 0.5])
        const outlinePoints = getStroke(strokePoints, {
          size: stroke.size,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        })

        const pathData = getSvgPathFromStroke(outlinePoints)
        const path = new Path2D(pathData)
        
        ctx.fillStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color
        ctx.fill(path)

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

      // Dibujar trazo actual
      if (currentPoints.length > 1) {
        const strokePoints = currentPoints.map(p => [p.x, p.y, p.pressure || 0.5])
        const outlinePoints = getStroke(strokePoints, {
          size: currentSize,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        })

        const pathData = getSvgPathFromStroke(outlinePoints)
        const path = new Path2D(pathData)
        
        ctx.fillStyle = currentTool === 'eraser' ? '#ffffff' : currentColor
        ctx.fill(path)
      }
    }, [content, currentPoints, currentColor, currentSize, currentTool, selectedStrokeIds])

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

      setIsDrawing(true)
      setCurrentPoints([point])
    }

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return
      e.preventDefault()

      const point = getPointFromEvent(e)
      if (!point) return

      setCurrentPoints(prev => [...prev, point])
      redraw()
    }

    const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return
      e.preventDefault()

      if (currentPoints.length > 1 && (currentTool === 'pen' || currentTool === 'eraser')) {
        const newStroke: WhiteboardStroke = {
          id: generateId(),
          points: currentPoints,
          color: currentColor,
          size: currentSize,
          tool: currentTool
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
