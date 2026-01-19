'use client'

import {
    Geometry2DContent,
    Geometry2DFigure,
    GeometryAngle,
    GeometryArea,
    GeometryCircle,
    GeometryEdge,
    GeometryMark,
    GeometryMarkType,
    GeometryVertex
} from '@/types'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Geometry2DLayerProps {
  content: Geometry2DContent
  onContentChange: (content: Geometry2DContent) => void
  tool: 'move' | 'segment' | 'scale' | 'angle' | 'mark' | 'area'
  markType: GeometryMarkType
  areaColor: string
  zoom?: number
  panOffset?: { x: number; y: number }
}

const generateId = () => Math.random().toString(36).substring(2, 11)

// Colores por defecto
const VERTEX_COLOR = '#3498db'
const VERTEX_SELECTED_COLOR = '#e67e22'
const EDGE_COLOR = '#333333'
const ANGLE_COLOR = '#27ae60'
const MARK_COLOR = '#e74c3c'

export default function Geometry2DLayer({
  content,
  onContentChange,
  tool,
  markType,
  areaColor,
  zoom = 1,
  panOffset = { x: 0, y: 0 }
}: Geometry2DLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Estado de interacción
  const [draggedVertex, setDraggedVertex] = useState<string | null>(null)
  const [selectedVertices, setSelectedVertices] = useState<string[]>([])
  const [scalingFigure, setScalingFigure] = useState<{ vertexIds: string[]; center: { x: number; y: number }; initialDistance: number } | null>(null)
  
  // Refs para evitar re-renders durante arrastre
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Obtener vértice por ID
  const getVertex = useCallback((id: string): GeometryVertex | undefined => {
    return content.vertices.find(v => v.id === id)
  }, [content.vertices])

  // Obtener coordenadas del mouse relativas al canvas
  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - panOffset.x) / zoom,
      y: (e.clientY - rect.top - panOffset.y) / zoom
    }
  }, [zoom, panOffset])

  // Encontrar vértice cercano al punto
  const findVertexNear = useCallback((x: number, y: number, threshold: number = 15): GeometryVertex | null => {
    for (const vertex of content.vertices) {
      const dist = Math.hypot(vertex.x - x, vertex.y - y)
      if (dist < threshold / zoom) {
        return vertex
      }
    }
    return null
  }, [content.vertices, zoom])

  // Encontrar arista cercana al punto
  const findEdgeNear = useCallback((x: number, y: number, threshold: number = 10): GeometryEdge | null => {
    for (const edge of content.edges) {
      const v1 = getVertex(edge.startVertexId)
      const v2 = getVertex(edge.endVertexId)
      if (!v1 || !v2) continue
      
      const dist = distPointToSegment(x, y, v1.x, v1.y, v2.x, v2.y)
      if (dist < threshold / zoom) {
        return edge
      }
    }
    return null
  }, [content.edges, getVertex, zoom])

  // Distancia de punto a segmento
  const distPointToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
    if (L2 === 0) return Math.hypot(px - x1, py - y1)
    let t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / L2))
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
  }

  // Obtener todos los vértices conectados a un vértice (para mover/escalar figuras completas)
  const getConnectedVertices = useCallback((startVertexId: string): string[] => {
    const connected = new Set<string>([startVertexId])
    let changed = true
    while (changed) {
      changed = false
      for (const edge of content.edges) {
        if (connected.has(edge.startVertexId) && !connected.has(edge.endVertexId)) {
          connected.add(edge.endVertexId)
          changed = true
        }
        if (connected.has(edge.endVertexId) && !connected.has(edge.startVertexId)) {
          connected.add(edge.startVertexId)
          changed = true
        }
      }
    }
    return Array.from(connected)
  }, [content.edges])

  // Manejar mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    lastMousePos.current = pos
    
    const vertex = findVertexNear(pos.x, pos.y)
    
    if (tool === 'move' && vertex) {
      setDraggedVertex(vertex.id)
    } else if (tool === 'scale' && vertex) {
      const connectedIds = getConnectedVertices(vertex.id)
      const connectedVertices = connectedIds.map(id => getVertex(id)).filter(Boolean) as GeometryVertex[]
      const centerX = connectedVertices.reduce((sum, v) => sum + v.x, 0) / connectedVertices.length
      const centerY = connectedVertices.reduce((sum, v) => sum + v.y, 0) / connectedVertices.length
      const initialDistance = Math.hypot(pos.x - centerX, pos.y - centerY) || 1
      setScalingFigure({ vertexIds: connectedIds, center: { x: centerX, y: centerY }, initialDistance })
    } else if (tool === 'segment' && vertex) {
      if (selectedVertices.length === 0) {
        setSelectedVertices([vertex.id])
      } else if (selectedVertices.length === 1 && selectedVertices[0] !== vertex.id) {
        // Crear nuevo segmento
        const newEdge: GeometryEdge = {
          id: generateId(),
          startVertexId: selectedVertices[0],
          endVertexId: vertex.id,
          color: EDGE_COLOR
        }
        onContentChange({
          ...content,
          edges: [...content.edges, newEdge]
        })
        setSelectedVertices([])
      }
    } else if (tool === 'angle' && vertex) {
      const newSelection = [...selectedVertices, vertex.id]
      if (newSelection.length === 3) {
        // Crear ángulo: primer punto, vértice, segundo punto
        const value = prompt('Ingresa el valor del ángulo:', '90')
        if (value !== null) {
          const newAngle: GeometryAngle = {
            id: generateId(),
            vertexAId: newSelection[0],
            vertexVId: newSelection[1],
            vertexBId: newSelection[2],
            value: value ? `${value}°` : undefined,
            color: ANGLE_COLOR,
            arcRadius: 30
          }
          onContentChange({
            ...content,
            angles: [...content.angles, newAngle]
          })
        }
        setSelectedVertices([])
      } else {
        setSelectedVertices(newSelection)
      }
    } else if (tool === 'mark') {
      const edge = findEdgeNear(pos.x, pos.y)
      if (edge) {
        // Verificar si ya existe una marca en esta arista
        const existingMark = content.marks.find(m => m.edgeId === edge.id)
        if (existingMark) {
          // Remover marca existente
          onContentChange({
            ...content,
            marks: content.marks.filter(m => m.id !== existingMark.id)
          })
        } else {
          // Agregar nueva marca
          const newMark: GeometryMark = {
            id: generateId(),
            edgeId: edge.id,
            type: markType,
            color: MARK_COLOR
          }
          onContentChange({
            ...content,
            marks: [...content.marks, newMark]
          })
        }
      }
    } else if (tool === 'area' && vertex) {
      if (selectedVertices.length > 2 && selectedVertices[0] === vertex.id) {
        // Cerrar área
        const newArea: GeometryArea = {
          id: generateId(),
          vertexIds: [...selectedVertices],
          fillColor: areaColor
        }
        onContentChange({
          ...content,
          areas: [...content.areas, newArea]
        })
        setSelectedVertices([])
      } else if (!selectedVertices.includes(vertex.id)) {
        setSelectedVertices([...selectedVertices, vertex.id])
      }
    }
  }, [tool, getMousePos, findVertexNear, findEdgeNear, selectedVertices, content, onContentChange, markType, areaColor, getConnectedVertices, getVertex])

  // Manejar mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    
    if (tool === 'move' && draggedVertex) {
      // Mover vértice
      const newVertices = content.vertices.map(v => 
        v.id === draggedVertex ? { ...v, x: pos.x, y: pos.y } : v
      )
      onContentChange({ ...content, vertices: newVertices })
    } else if (tool === 'scale' && scalingFigure) {
      // Escalar figura
      const currentDistance = Math.hypot(pos.x - scalingFigure.center.x, pos.y - scalingFigure.center.y)
      const scaleFactor = currentDistance / scalingFigure.initialDistance
      
      const newVertices = content.vertices.map(v => {
        if (scalingFigure.vertexIds.includes(v.id)) {
          return {
            ...v,
            x: scalingFigure.center.x + (v.x - scalingFigure.center.x) * scaleFactor,
            y: scalingFigure.center.y + (v.y - scalingFigure.center.y) * scaleFactor
          }
        }
        return v
      })
      
      // Actualizar círculos también
      const newCircles = content.circles.map(c => ({
        ...c,
        radius: c.radius * scaleFactor
      }))
      
      onContentChange({ ...content, vertices: newVertices, circles: newCircles })
      
      // Actualizar distancia inicial para el siguiente frame
      setScalingFigure({ ...scalingFigure, initialDistance: currentDistance })
    }
    
    lastMousePos.current = pos
  }, [tool, draggedVertex, scalingFigure, content, onContentChange, getMousePos])

  // Manejar mouse up
  const handleMouseUp = useCallback(() => {
    setDraggedVertex(null)
    setScalingFigure(null)
  }, [])

  // Manejar doble click (eliminar área)
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'area') {
      const pos = getMousePos(e)
      // Eliminar área que contenga el punto
      const newAreas = content.areas.filter(area => {
        const areaVertices = area.vertexIds.map(id => getVertex(id)).filter(Boolean) as GeometryVertex[]
        return !isPointInPolygon(pos.x, pos.y, areaVertices)
      })
      if (newAreas.length !== content.areas.length) {
        onContentChange({ ...content, areas: newAreas })
      }
    }
  }, [tool, getMousePos, content, onContentChange, getVertex])

  // Verificar si un punto está dentro de un polígono
  const isPointInPolygon = (x: number, y: number, vertices: GeometryVertex[]): boolean => {
    let inside = false
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y
      const xj = vertices[j].x, yj = vertices[j].y
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    return inside
  }

  // Redibujar canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr
    
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.translate(panOffset.x, panOffset.y)
    ctx.scale(zoom, zoom)
    
    // 1. Dibujar áreas (primero, para que queden debajo)
    content.areas.forEach(area => {
      const areaVertices = area.vertexIds.map(id => getVertex(id)).filter(Boolean) as GeometryVertex[]
      if (areaVertices.length < 3) return
      
      ctx.fillStyle = area.fillColor
      ctx.beginPath()
      ctx.moveTo(areaVertices[0].x, areaVertices[0].y)
      areaVertices.forEach(v => ctx.lineTo(v.x, v.y))
      ctx.closePath()
      ctx.fill()
    })
    
    // 2. Dibujar círculos
    content.circles.forEach(circle => {
      if (circle.fillColor) {
        ctx.fillStyle = circle.fillColor
        ctx.beginPath()
        ctx.arc(circle.centerX, circle.centerY, circle.radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = circle.strokeColor || EDGE_COLOR
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(circle.centerX, circle.centerY, circle.radius, 0, Math.PI * 2)
      ctx.stroke()
      
      // Dibujar punto central del círculo
      ctx.fillStyle = VERTEX_COLOR
      ctx.beginPath()
      ctx.arc(circle.centerX, circle.centerY, 4, 0, Math.PI * 2)
      ctx.fill()
    })
    
    // 3. Dibujar ángulos
    content.angles.forEach(angle => {
      const vA = getVertex(angle.vertexAId)
      const vV = getVertex(angle.vertexVId)
      const vB = getVertex(angle.vertexBId)
      if (!vA || !vV || !vB) return
      
      const a1 = Math.atan2(vA.y - vV.y, vA.x - vV.x)
      const a2 = Math.atan2(vB.y - vV.y, vB.x - vV.x)
      let diff = a2 - a1
      while (diff < -Math.PI) diff += 2 * Math.PI
      while (diff > Math.PI) diff -= 2 * Math.PI
      
      const radius = angle.arcRadius || 30
      ctx.strokeStyle = angle.color || ANGLE_COLOR
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(vV.x, vV.y, radius, a1, a1 + diff, diff < 0)
      ctx.stroke()
      
      // Dibujar valor del ángulo
      if (angle.value) {
        const midAngle = a1 + diff / 2
        const textX = vV.x + (radius + 15) * Math.cos(midAngle)
        const textY = vV.y + (radius + 15) * Math.sin(midAngle)
        ctx.fillStyle = angle.color || ANGLE_COLOR
        ctx.font = 'bold 13px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(angle.value, textX, textY)
      }
    })
    
    // 4. Dibujar marcas
    content.marks.forEach(mark => {
      const edge = content.edges.find(e => e.id === mark.edgeId)
      if (!edge) return
      const v1 = getVertex(edge.startVertexId)
      const v2 = getVertex(edge.endVertexId)
      if (!v1 || !v2) return
      
      const mx = (v1.x + v2.x) / 2
      const my = (v1.y + v2.y) / 2
      const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x)
      
      ctx.save()
      ctx.translate(mx, my)
      ctx.rotate(angle)
      ctx.strokeStyle = mark.color || MARK_COLOR
      ctx.fillStyle = mark.color || MARK_COLOR
      ctx.lineWidth = 2
      
      switch (mark.type) {
        case 'lines':
          ctx.beginPath()
          ctx.moveTo(-3, -8)
          ctx.lineTo(-3, 8)
          ctx.moveTo(3, -8)
          ctx.lineTo(3, 8)
          ctx.stroke()
          break
        case 'circle':
          ctx.beginPath()
          ctx.arc(0, 0, 4, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'thick':
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.moveTo(-8, 0)
          ctx.lineTo(8, 0)
          ctx.stroke()
          break
        case 'zigzag':
          ctx.beginPath()
          ctx.moveTo(-10, 4)
          ctx.lineTo(-5, -4)
          ctx.lineTo(0, 4)
          ctx.lineTo(5, -4)
          ctx.lineTo(10, 4)
          ctx.stroke()
          break
      }
      
      ctx.restore()
    })
    
    // 5. Dibujar aristas
    content.edges.forEach(edge => {
      const v1 = getVertex(edge.startVertexId)
      const v2 = getVertex(edge.endVertexId)
      if (!v1 || !v2) return
      
      ctx.strokeStyle = edge.color || EDGE_COLOR
      ctx.lineWidth = edge.strokeWidth || 2
      ctx.beginPath()
      ctx.moveTo(v1.x, v1.y)
      ctx.lineTo(v2.x, v2.y)
      ctx.stroke()
    })
    
    // 6. Dibujar vértices
    content.vertices.forEach(vertex => {
      const isSelected = selectedVertices.includes(vertex.id)
      ctx.fillStyle = isSelected ? VERTEX_SELECTED_COLOR : (vertex.color || VERTEX_COLOR)
      ctx.beginPath()
      ctx.arc(vertex.x, vertex.y, 5, 0, Math.PI * 2)
      ctx.fill()
      
      // Dibujar etiqueta si existe
      if (vertex.label) {
        ctx.fillStyle = '#333'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(vertex.label, vertex.x, vertex.y - 8)
      }
    })
    
    ctx.restore()
  }, [content, getVertex, selectedVertices, zoom, panOffset])

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
  }, [redraw])

  // Redibujar cuando cambia el contenido
  useEffect(() => {
    redraw()
  }, [redraw])

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto"
        style={{ cursor: tool === 'move' || tool === 'scale' ? 'grab' : 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  )
}

// Función helper para crear figuras 2D predefinidas
export function createGeometry2DFigure(
  figureType: Geometry2DFigure['figureType'],
  centerX: number,
  centerY: number,
  size: number = 60,
  fillColor?: string
): { vertices: GeometryVertex[]; edges: GeometryEdge[]; figure: Geometry2DFigure; circle?: GeometryCircle } {
  const vertices: GeometryVertex[] = []
  const edges: GeometryEdge[] = []
  let points: { x: number; y: number }[] = []
  
  switch (figureType) {
    case 'triangle':
      points = [
        { x: centerX, y: centerY - size },
        { x: centerX - size, y: centerY + size },
        { x: centerX + size, y: centerY + size }
      ]
      break
    case 'square':
      points = [
        { x: centerX - size, y: centerY - size },
        { x: centerX + size, y: centerY - size },
        { x: centerX + size, y: centerY + size },
        { x: centerX - size, y: centerY + size }
      ]
      break
    case 'rectangle':
      points = [
        { x: centerX - size * 1.5, y: centerY - size },
        { x: centerX + size * 1.5, y: centerY - size },
        { x: centerX + size * 1.5, y: centerY + size },
        { x: centerX - size * 1.5, y: centerY + size }
      ]
      break
    case 'rhombus':
      points = [
        { x: centerX, y: centerY - size },
        { x: centerX + size * 1.2, y: centerY },
        { x: centerX, y: centerY + size },
        { x: centerX - size * 1.2, y: centerY }
      ]
      break
    case 'parallelogram':
      points = [
        { x: centerX - size + 20, y: centerY - size },
        { x: centerX + size + 20, y: centerY - size },
        { x: centerX + size - 20, y: centerY + size },
        { x: centerX - size - 20, y: centerY + size }
      ]
      break
    case 'trapezoid':
      points = [
        { x: centerX - size / 1.5, y: centerY - size },
        { x: centerX + size / 1.5, y: centerY - size },
        { x: centerX + size, y: centerY + size },
        { x: centerX - size, y: centerY + size }
      ]
      break
    case 'circle':
      // Para círculos, no creamos vértices/aristas tradicionales
      const circleId = generateId()
      return {
        vertices: [],
        edges: [],
        figure: {
          id: generateId(),
          figureType: 'circle',
          vertexIds: [],
          edgeIds: [],
          centerX,
          centerY,
          radius: size,
          fillColor
        },
        circle: {
          id: circleId,
          centerX,
          centerY,
          radius: size,
          fillColor,
          strokeColor: EDGE_COLOR
        }
      }
  }
  
  // Crear vértices
  const vertexIds: string[] = []
  points.forEach((p, i) => {
    const id = generateId()
    vertexIds.push(id)
    vertices.push({
      id,
      x: p.x,
      y: p.y,
      label: String.fromCharCode(65 + i) // A, B, C, ...
    })
  })
  
  // Crear aristas
  const edgeIds: string[] = []
  for (let i = 0; i < vertexIds.length; i++) {
    const edgeId = generateId()
    edgeIds.push(edgeId)
    edges.push({
      id: edgeId,
      startVertexId: vertexIds[i],
      endVertexId: vertexIds[(i + 1) % vertexIds.length],
      color: EDGE_COLOR
    })
  }
  
  const figure: Geometry2DFigure = {
    id: generateId(),
    figureType,
    vertexIds,
    edgeIds,
    fillColor
  }
  
  return { vertices, edges, figure }
}
