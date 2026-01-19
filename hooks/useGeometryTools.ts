'use client'

import {
    Geometry2DContent,
    Geometry3DFigureType,
    Geometry3DObject,
    GeometryMarkType
} from '@/types'
import { useCallback, useState } from 'react'
import { createGeometry2DFigure } from '../components/whiteboard/Geometry2DLayer'
import { createGeometry3DObject } from '../components/whiteboard/Geometry3DViewer'

export type Geometry2DTool = 'move' | 'segment' | 'scale' | 'angle' | 'mark' | 'area'
export type Geometry3DTool = 'rotate' | 'move3d' | 'scale3d' | 'point' | 'segment3d' | 'area3d' | 'angle3d'

interface UseGeometryToolsOptions {
  canvasWidth?: number
  canvasHeight?: number
}

interface UseGeometryToolsReturn {
  // Estado de Geometría 2D
  geometry2DTool: Geometry2DTool
  setGeometry2DTool: (tool: Geometry2DTool) => void
  geometry2DMarkType: GeometryMarkType
  setGeometry2DMarkType: (type: GeometryMarkType) => void
  areaColor: string
  setAreaColor: (color: string) => void
  
  // Estado de Geometría 3D
  geometry3DTool: Geometry3DTool
  setGeometry3DTool: (tool: Geometry3DTool) => void
  geometry3DColor: string
  setGeometry3DColor: (color: string) => void
  
  // Funciones de creación
  addGeometry2DFigure: (
    figureType: 'triangle' | 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'trapezoid' | 'circle',
    content: Geometry2DContent,
    centerX?: number,
    centerY?: number
  ) => Geometry2DContent
  
  addGeometry3DObject: (
    figureType: Geometry3DFigureType,
    objects: Geometry3DObject[],
    x?: number,
    y?: number
  ) => Geometry3DObject[]
  
  updateGeometry3DObject: (
    objects: Geometry3DObject[],
    objectId: string,
    updates: Partial<Geometry3DObject>
  ) => Geometry3DObject[]
  
  removeGeometry3DObject: (
    objects: Geometry3DObject[],
    objectId: string
  ) => Geometry3DObject[]
  
  // Estado inicial
  getInitialGeometry2DContent: () => Geometry2DContent
}

export function useGeometryTools(options: UseGeometryToolsOptions = {}): UseGeometryToolsReturn {
  const { canvasWidth = 800, canvasHeight = 600 } = options
  
  // Estado de Geometría 2D
  const [geometry2DTool, setGeometry2DTool] = useState<Geometry2DTool>('move')
  const [geometry2DMarkType, setGeometry2DMarkType] = useState<GeometryMarkType>('lines')
  const [areaColor, setAreaColor] = useState('rgba(255, 209, 220, 0.5)')
  
  // Estado de Geometría 3D
  const [geometry3DTool, setGeometry3DTool] = useState<Geometry3DTool>('rotate')
  const [geometry3DColor, setGeometry3DColor] = useState('#f1c40f')
  
  // Obtener contenido 2D inicial vacío
  const getInitialGeometry2DContent = useCallback((): Geometry2DContent => ({
    vertices: [],
    edges: [],
    angles: [],
    marks: [],
    areas: [],
    figures: [],
    circles: []
  }), [])
  
  // Agregar figura 2D
  const addGeometry2DFigure = useCallback((
    figureType: 'triangle' | 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'trapezoid' | 'circle',
    content: Geometry2DContent,
    centerX?: number,
    centerY?: number
  ): Geometry2DContent => {
    const x = centerX ?? canvasWidth / 2
    const y = centerY ?? canvasHeight / 2
    
    const { vertices, edges, figure, circle } = createGeometry2DFigure(
      figureType,
      x,
      y,
      60,
      areaColor
    )
    
    return {
      ...content,
      vertices: [...content.vertices, ...vertices],
      edges: [...content.edges, ...edges],
      figures: [...content.figures, figure],
      circles: circle ? [...content.circles, circle] : content.circles
    }
  }, [canvasWidth, canvasHeight, areaColor])
  
  // Agregar objeto 3D
  const addGeometry3DObject = useCallback((
    figureType: Geometry3DFigureType,
    objects: Geometry3DObject[],
    x?: number,
    y?: number
  ): Geometry3DObject[] => {
    const posX = x ?? 50
    const posY = y ?? 50
    
    const newObject = createGeometry3DObject(figureType, posX, posY, 300, 300)
    return [...objects, newObject]
  }, [])
  
  // Actualizar objeto 3D
  const updateGeometry3DObject = useCallback((
    objects: Geometry3DObject[],
    objectId: string,
    updates: Partial<Geometry3DObject>
  ): Geometry3DObject[] => {
    return objects.map(obj => 
      obj.id === objectId ? { ...obj, ...updates } : obj
    )
  }, [])
  
  // Eliminar objeto 3D
  const removeGeometry3DObject = useCallback((
    objects: Geometry3DObject[],
    objectId: string
  ): Geometry3DObject[] => {
    return objects.filter(obj => obj.id !== objectId)
  }, [])
  
  return {
    geometry2DTool,
    setGeometry2DTool,
    geometry2DMarkType,
    setGeometry2DMarkType,
    areaColor,
    setAreaColor,
    geometry3DTool,
    setGeometry3DTool,
    geometry3DColor,
    setGeometry3DColor,
    addGeometry2DFigure,
    addGeometry3DObject,
    updateGeometry3DObject,
    removeGeometry3DObject,
    getInitialGeometry2DContent
  }
}
