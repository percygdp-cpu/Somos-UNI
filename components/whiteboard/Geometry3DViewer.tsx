'use client'

import {
    Geometry3DAngle,
    Geometry3DEdge,
    Geometry3DFace,
    Geometry3DFigureType,
    Geometry3DObject,
    Geometry3DVertex
} from '@/types'
import { useCallback, useEffect, useRef, useState } from 'react'

// Importar Three.js dinámicamente
import * as THREE from 'three'

interface Geometry3DViewerProps {
  object: Geometry3DObject
  onObjectChange: (object: Geometry3DObject) => void
  tool: 'rotate' | 'move3d' | 'scale3d' | 'point' | 'segment3d' | 'area3d' | 'angle3d'
  selectedColor: string
  onRemove?: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 11)

export default function Geometry3DViewer({
  object,
  onObjectChange,
  tool,
  selectedColor,
  onRemove
}: Geometry3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const mainGroupRef = useRef<THREE.Group | null>(null)
  const raycasterRef = useRef<THREE.Raycaster | null>(null)
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  
  const [isDragging, setIsDragging] = useState(false)
  const [selectedVertices, setSelectedVertices] = useState<string[]>([])
  const [temporaryPoints, setTemporaryPoints] = useState<THREE.Vector3[]>([])
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const labelsRef = useRef<HTMLDivElement[]>([])

  // Inicializar Three.js
  useEffect(() => {
    if (!containerRef.current) return

    // Crear escena
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf1f3f5)
    sceneRef.current = scene

    // Crear cámara
    const camera = new THREE.PerspectiveCamera(45, object.width / object.height, 0.1, 1000)
    camera.position.set(10, 10, 12)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Crear renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(object.width, object.height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const sun = new THREE.DirectionalLight(0xffffff, 0.5)
    sun.position.set(5, 10, 7)
    scene.add(sun)

    // Grupo principal
    const mainGroup = new THREE.Group()
    scene.add(mainGroup)
    mainGroupRef.current = mainGroup

    // Raycaster
    raycasterRef.current = new THREE.Raycaster()
    raycasterRef.current.params.Line = { threshold: 0.4 }

    // Crear geometría inicial
    createGeometry()

    // Animación
    const animate = () => {
      requestAnimationFrame(animate)
      updateLabels()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      renderer.dispose()
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
      // Limpiar labels
      labelsRef.current.forEach(label => label.remove())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Actualizar cuando cambia el objeto
  useEffect(() => {
    if (mainGroupRef.current) {
      mainGroupRef.current.rotation.x = object.rotationX
      mainGroupRef.current.rotation.y = object.rotationY
      mainGroupRef.current.scale.set(object.scale, object.scale, object.scale)
    }
  }, [object.rotationX, object.rotationY, object.scale])

  // Crear geometría basada en el tipo de figura
  const createGeometry = useCallback(() => {
    const mainGroup = mainGroupRef.current
    if (!mainGroup) return

    // Limpiar grupo
    while (mainGroup.children.length > 0) {
      mainGroup.remove(mainGroup.children[0])
    }

    // Crear puntos físicos
    object.vertices.forEach(vertex => {
      const geometry = new THREE.SphereGeometry(vertex.isUserAdded ? 0.08 : 0.12)
      const material = new THREE.MeshBasicMaterial({
        color: vertex.isUserAdded ? 0xe74c3c : 0x2980b9,
        depthTest: false
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(vertex.x, vertex.y, vertex.z)
      mesh.userData = { isVertex: true, vertexId: vertex.id, isTemp: vertex.isUserAdded }
      mesh.renderOrder = 100
      mainGroup.add(mesh)
    })

    // Crear aristas
    object.edges.forEach(edge => {
      const v1 = object.vertices.find(v => v.id === edge.startVertexId)
      const v2 = object.vertices.find(v => v.id === edge.endVertexId)
      if (!v1 || !v2) return

      const points = [
        new THREE.Vector3(v1.x, v1.y, v1.z),
        new THREE.Vector3(v2.x, v2.y, v2.z)
      ]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({
        color: edge.color ? parseInt(edge.color.replace('#', '0x')) : 0x7f8c8d,
        transparent: true,
        opacity: edge.isUserAdded ? 1 : 0.6
      })
      const line = new THREE.Line(geometry, material)
      line.userData = { isEdge: true, edgeId: edge.id, v1Id: edge.startVertexId, v2Id: edge.endVertexId }
      mainGroup.add(line)
    })

    // Crear caras
    object.faces.forEach(face => {
      const faceVertices = face.vertexIds
        .map(id => object.vertices.find(v => v.id === id))
        .filter(Boolean) as Geometry3DVertex[]
      
      if (faceVertices.length < 3) return

      const shape = new THREE.Shape()
      // Proyectar a 2D para crear la forma (simplificado)
      const geometry = new THREE.BufferGeometry()
      const positions: number[] = []
      faceVertices.forEach(v => positions.push(v.x, v.y, v.z))
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      
      // Crear índices para triangulación simple
      const indices: number[] = []
      for (let i = 1; i < faceVertices.length - 1; i++) {
        indices.push(0, i, i + 1)
      }
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      const material = new THREE.MeshPhongMaterial({
        color: parseInt(face.fillColor.replace('#', '0x')),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: face.opacity || 0.7
      })
      const mesh = new THREE.Mesh(geometry, material)
      mainGroup.add(mesh)
    })

    // Aplicar rotación y escala actual
    mainGroup.rotation.x = object.rotationX
    mainGroup.rotation.y = object.rotationY
    mainGroup.scale.set(object.scale, object.scale, object.scale)
  }, [object])

  // Actualizar labels 3D
  const updateLabels = useCallback(() => {
    // Limpiar labels anteriores
    labelsRef.current.forEach(label => label.remove())
    labelsRef.current = []

    if (!containerRef.current || !cameraRef.current || !mainGroupRef.current) return

    object.angles.forEach(angle => {
      const v = object.vertices.find(v => v.id === angle.vertexVId)
      if (!v || !angle.value) return

      const pos = new THREE.Vector3(v.x, v.y, v.z)
      pos.applyMatrix4(mainGroupRef.current!.matrixWorld)
      pos.project(cameraRef.current!)

      const div = document.createElement('div')
      div.className = 'absolute bg-white text-orange-600 border-2 border-orange-600 px-2 py-1 rounded text-sm font-bold pointer-events-none transform -translate-x-1/2 -translate-y-1/2 shadow-md'
      div.style.left = `${(pos.x + 1) / 2 * object.width}px`
      div.style.top = `${-(pos.y - 1) / 2 * object.height}px`
      div.textContent = angle.value

      containerRef.current!.appendChild(div)
      labelsRef.current.push(div)
    })
  }, [object])

  // Manejar mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !mainGroupRef.current || !raycasterRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    mouseRef.current.x = ((e.clientX - rect.left) / object.width) * 2 - 1
    mouseRef.current.y = -((e.clientY - rect.top) / object.height) * 2 + 1

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)
    const intersects = raycasterRef.current.intersectObjects(mainGroupRef.current.children)

    const vertexHit = intersects.find(i => i.object.userData.isVertex)
    const edgeHit = intersects.find(i => i.object.userData.isEdge)

    if (tool === 'point' && edgeHit) {
      // Agregar puntos temporales en la arista
      const edge = object.edges.find(e => e.id === edgeHit.object.userData.edgeId)
      if (edge) {
        const v1 = object.vertices.find(v => v.id === edge.startVertexId)
        const v2 = object.vertices.find(v => v.id === edge.endVertexId)
        if (v1 && v2) {
          const tempPoints: THREE.Vector3[] = []
          for (let i = 1; i < 10; i++) {
            tempPoints.push(new THREE.Vector3(
              v1.x + (v2.x - v1.x) * (i / 10),
              v1.y + (v2.y - v1.y) * (i / 10),
              v1.z + (v2.z - v1.z) * (i / 10)
            ))
          }
          setTemporaryPoints(tempPoints)
        }
      }
    } else if (tool === 'point' && vertexHit && vertexHit.object.userData.isTemp) {
      // Confirmar punto temporal
      const pos = (vertexHit.object as THREE.Mesh).position
      const newVertex: Geometry3DVertex = {
        id: generateId(),
        x: pos.x,
        y: pos.y,
        z: pos.z,
        isUserAdded: true
      }
      onObjectChange({
        ...object,
        vertices: [...object.vertices, newVertex]
      })
      setTemporaryPoints([])
    } else if (tool === 'segment3d' && vertexHit && !vertexHit.object.userData.isTemp) {
      const vertexId = vertexHit.object.userData.vertexId
      if (selectedVertices.length === 0) {
        setSelectedVertices([vertexId])
      } else if (selectedVertices.length === 1 && selectedVertices[0] !== vertexId) {
        // Crear segmento
        const newEdge: Geometry3DEdge = {
          id: generateId(),
          startVertexId: selectedVertices[0],
          endVertexId: vertexId,
          color: '#2c3e50',
          isUserAdded: true
        }
        onObjectChange({
          ...object,
          edges: [...object.edges, newEdge]
        })
        setSelectedVertices([])
      }
    } else if (tool === 'area3d' && vertexHit && !vertexHit.object.userData.isTemp) {
      const vertexId = vertexHit.object.userData.vertexId
      if (selectedVertices.length > 2 && selectedVertices[0] === vertexId) {
        // Cerrar área
        const newFace: Geometry3DFace = {
          id: generateId(),
          vertexIds: [...selectedVertices],
          fillColor: selectedColor,
          opacity: 0.7
        }
        onObjectChange({
          ...object,
          faces: [...object.faces, newFace]
        })
        setSelectedVertices([])
      } else if (!selectedVertices.includes(vertexId)) {
        setSelectedVertices([...selectedVertices, vertexId])
      }
    } else if (tool === 'angle3d' && vertexHit && !vertexHit.object.userData.isTemp) {
      const vertexId = vertexHit.object.userData.vertexId
      const newSelection = [...selectedVertices, vertexId]
      if (newSelection.length === 3) {
        const value = prompt('Ingresa el valor del ángulo:', '90°')
        if (value) {
          const newAngle: Geometry3DAngle = {
            id: generateId(),
            vertexAId: newSelection[0],
            vertexVId: newSelection[1],
            vertexBId: newSelection[2],
            value
          }
          onObjectChange({
            ...object,
            angles: [...object.angles, newAngle]
          })
        }
        setSelectedVertices([])
      } else {
        setSelectedVertices(newSelection)
      }
    } else {
      setIsDragging(true)
    }

    lastPosRef.current = { x: e.clientX, y: e.clientY }
  }, [tool, object, onObjectChange, selectedVertices, selectedColor])

  // Manejar mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return

    const dx = (e.clientX - lastPosRef.current.x) * 0.01
    const dy = (e.clientY - lastPosRef.current.y) * 0.01

    if (tool === 'rotate') {
      onObjectChange({
        ...object,
        rotationY: object.rotationY + dx,
        rotationX: object.rotationX + dy
      })
    } else if (tool === 'move3d') {
      onObjectChange({
        ...object,
        x: object.x + (e.clientX - lastPosRef.current.x),
        y: object.y + (e.clientY - lastPosRef.current.y)
      })
    } else if (tool === 'scale3d') {
      const newScale = Math.max(0.1, object.scale + dx)
      onObjectChange({
        ...object,
        scale: newScale
      })
    }

    lastPosRef.current = { x: e.clientX, y: e.clientY }
  }, [isDragging, tool, object, onObjectChange])

  // Manejar mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Recrear geometría cuando cambian los datos
  useEffect(() => {
    createGeometry()
  }, [createGeometry])

  return (
    <div
      ref={containerRef}
      className="absolute border-2 border-dashed border-purple-400 rounded-lg overflow-hidden bg-gray-100"
      style={{
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        cursor: tool === 'rotate' ? 'grab' : tool === 'move3d' ? 'move' : 'crosshair'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Botón para eliminar */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 z-10 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors text-xs font-bold"
        >
          ✕
        </button>
      )}
      
      {/* Indicador de herramienta activa */}
      <div className="absolute bottom-1 left-1 z-10 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
        {tool === 'rotate' && '🔄 Girar'}
        {tool === 'move3d' && '✋ Mover'}
        {tool === 'scale3d' && '⤢ Escalar'}
        {tool === 'point' && '• Punto'}
        {tool === 'segment3d' && '•─• Segmento'}
        {tool === 'area3d' && '▲ Área'}
        {tool === 'angle3d' && '∠ Ángulo'}
      </div>
      
      {/* Indicador de selección */}
      {selectedVertices.length > 0 && (
        <div className="absolute top-1 left-1 z-10 bg-purple-500 text-white text-xs px-2 py-0.5 rounded">
          Seleccionados: {selectedVertices.length}
        </div>
      )}
    </div>
  )
}

// Función para crear objetos 3D predefinidos
export function createGeometry3DObject(
  figureType: Geometry3DFigureType,
  x: number,
  y: number,
  width: number = 300,
  height: number = 300
): Geometry3DObject {
  const vertices: Geometry3DVertex[] = []
  const edges: Geometry3DEdge[] = []
  const faces: Geometry3DFace[] = []

  switch (figureType) {
    case 'cube': {
      const v = [
        [-2, -2, -2], [2, -2, -2], [2, 2, -2], [-2, 2, -2],
        [-2, -2, 2], [2, -2, 2], [2, 2, 2], [-2, 2, 2]
      ]
      v.forEach((coords, i) => {
        vertices.push({ id: `v${i}`, x: coords[0], y: coords[1], z: coords[2] })
      })
      const e = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
      e.forEach((pair, i) => {
        edges.push({ id: `e${i}`, startVertexId: `v${pair[0]}`, endVertexId: `v${pair[1]}` })
      })
      break
    }
    case 'tetrahedron': {
      const v = [[2, 2, 2], [-2, -2, 2], [-2, 2, -2], [2, -2, -2]]
      v.forEach((coords, i) => {
        vertices.push({ id: `v${i}`, x: coords[0], y: coords[1], z: coords[2] })
      })
      const e = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]
      e.forEach((pair, i) => {
        edges.push({ id: `e${i}`, startVertexId: `v${pair[0]}`, endVertexId: `v${pair[1]}` })
      })
      break
    }
    case 'cone': {
      // Ápice
      vertices.push({ id: 'apex', x: 0, y: 3, z: 0 })
      // Base circular
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2
        vertices.push({
          id: `v${i}`,
          x: Math.cos(angle) * 2.5,
          y: -1,
          z: Math.sin(angle) * 2.5
        })
      }
      // Aristas de la base
      for (let i = 0; i < 12; i++) {
        edges.push({ id: `eb${i}`, startVertexId: `v${i}`, endVertexId: `v${(i + 1) % 12}` })
        edges.push({ id: `ea${i}`, startVertexId: `v${i}`, endVertexId: 'apex' })
      }
      break
    }
    case 'sphere': {
      // Crear puntos en una malla esférica
      let idx = 0
      for (let j = 0; j <= 4; j++) {
        const phi = (j / 4) * Math.PI
        for (let i = 0; i < 8; i++) {
          const theta = (i / 8) * Math.PI * 2
          vertices.push({
            id: `v${idx}`,
            x: 2.5 * Math.sin(phi) * Math.cos(theta),
            y: 2.5 * Math.cos(phi),
            z: 2.5 * Math.sin(phi) * Math.sin(theta)
          })
          idx++
        }
      }
      // Conectar puntos
      let edgeIdx = 0
      for (let j = 0; j <= 4; j++) {
        for (let i = 0; i < 8; i++) {
          const current = j * 8 + i
          if (i < 7) {
            edges.push({ id: `e${edgeIdx++}`, startVertexId: `v${current}`, endVertexId: `v${current + 1}` })
          } else {
            edges.push({ id: `e${edgeIdx++}`, startVertexId: `v${current}`, endVertexId: `v${current - 7}` })
          }
          if (j < 4) {
            edges.push({ id: `e${edgeIdx++}`, startVertexId: `v${current}`, endVertexId: `v${current + 8}` })
          }
        }
      }
      break
    }
    case 'pyramid': {
      // Base cuadrada
      const base = [[-2, -1, -2], [2, -1, -2], [2, -1, 2], [-2, -1, 2]]
      base.forEach((coords, i) => {
        vertices.push({ id: `v${i}`, x: coords[0], y: coords[1], z: coords[2] })
      })
      // Ápice
      vertices.push({ id: 'apex', x: 0, y: 3, z: 0 })
      // Aristas de la base
      for (let i = 0; i < 4; i++) {
        edges.push({ id: `eb${i}`, startVertexId: `v${i}`, endVertexId: `v${(i + 1) % 4}` })
        edges.push({ id: `ea${i}`, startVertexId: `v${i}`, endVertexId: 'apex' })
      }
      break
    }
    case 'cylinder': {
      // Crear dos círculos (superior e inferior)
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2
        vertices.push({
          id: `vt${i}`,
          x: Math.cos(angle) * 2,
          y: 2,
          z: Math.sin(angle) * 2
        })
        vertices.push({
          id: `vb${i}`,
          x: Math.cos(angle) * 2,
          y: -2,
          z: Math.sin(angle) * 2
        })
      }
      // Conectar
      for (let i = 0; i < 12; i++) {
        edges.push({ id: `et${i}`, startVertexId: `vt${i}`, endVertexId: `vt${(i + 1) % 12}` })
        edges.push({ id: `eb${i}`, startVertexId: `vb${i}`, endVertexId: `vb${(i + 1) % 12}` })
        edges.push({ id: `ev${i}`, startVertexId: `vt${i}`, endVertexId: `vb${i}` })
      }
      break
    }
    case 'prism': {
      // Prisma triangular
      const topY = 2, bottomY = -2
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2
        vertices.push({ id: `vt${i}`, x: Math.cos(angle) * 2, y: topY, z: Math.sin(angle) * 2 })
        vertices.push({ id: `vb${i}`, x: Math.cos(angle) * 2, y: bottomY, z: Math.sin(angle) * 2 })
      }
      // Aristas
      for (let i = 0; i < 3; i++) {
        edges.push({ id: `et${i}`, startVertexId: `vt${i}`, endVertexId: `vt${(i + 1) % 3}` })
        edges.push({ id: `eb${i}`, startVertexId: `vb${i}`, endVertexId: `vb${(i + 1) % 3}` })
        edges.push({ id: `ev${i}`, startVertexId: `vt${i}`, endVertexId: `vb${i}` })
      }
      break
    }
  }

  return {
    id: generateId(),
    figureType,
    x,
    y,
    width,
    height,
    rotationX: 0,
    rotationY: 0,
    scale: 1,
    vertices,
    edges,
    faces,
    angles: []
  }
}
