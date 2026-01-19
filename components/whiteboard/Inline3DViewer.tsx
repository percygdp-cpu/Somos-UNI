'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Inline3DViewerProps {
  shapeId?: string
  shapeType: string
  x?: number
  y?: number
  scale?: number
  width?: number
  height?: number
  onClose: () => void
  onCapture: (imageDataUrl: string, width?: number, height?: number) => void
  onRotationChange?: (rotationX: number, rotationY: number) => void
  initialRotationX?: number
  initialRotationY?: number
}

type Modo3D = 'giro' | 'mover' | 'escalar' | 'punto' | 'segmento' | 'area' | 'angulo'

export default function Inline3DViewer({
  shapeId,
  shapeType,
  x = 0,
  y = 0,
  scale = 1,
  width = 300,
  height = 300,
  onClose,
  onCapture,
  onRotationChange,
  initialRotationX = 0.5,
  initialRotationY = 0.5
}: Inline3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const mainGroupRef = useRef<THREE.Group | null>(null)
  const animationIdRef = useRef<number>(0)
  
  const [modo, setModo] = useState<Modo3D>('giro')
  const [colorActual, setColorActual] = useState(0xf1c40f)
  const [isDragging, setIsDragging] = useState(false)
  const [seleccionCount, setSeleccionCount] = useState(0)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const labelsRef = useRef<HTMLDivElement[]>([])
  const puntosTemporalesRef = useRef<THREE.Mesh[]>([])
  const seleccionPuntosRef = useRef<THREE.Mesh[]>([])

  const crearPuntoFisico = useCallback((pos: THREE.Vector3, temp = false): THREE.Mesh => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(temp ? 0.08 : 0.12),
      new THREE.MeshBasicMaterial({ color: temp ? 0xe74c3c : 0x2980b9, depthTest: false })
    )
    dot.position.copy(pos)
    dot.userData = { isVertex: true, isTemp: temp }
    dot.renderOrder = 100
    mainGroupRef.current?.add(dot)
    if (temp) puntosTemporalesRef.current.push(dot)
    return dot
  }, [])

  const crearLineaFisica = useCallback((p1: THREE.Mesh, p2: THREE.Mesh, col = 0x7f8c8d, op = 0.6) => {
    const geo = new THREE.BufferGeometry().setFromPoints([p1.position, p2.position])
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }))
    line.userData = { isEdge: true, p1, p2 }
    mainGroupRef.current?.add(line)
    return line
  }, [])

  const cambiarForma = useCallback((tipo: string) => {
    if (!mainGroupRef.current) return
    while (mainGroupRef.current.children.length > 0) {
      mainGroupRef.current.remove(mainGroupRef.current.children[0])
    }
    
    let dots: THREE.Mesh[] = []
    
    // Cubo
    if (tipo.includes('cube') || tipo === 'cubo') {
      const v = [[-2,-2,-2],[2,-2,-2],[2,2,-2],[-2,2,-2],[-2,-2,2],[2,-2,2],[2,2,2],[-2,2,2]]
      dots = v.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      ;[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(e => crearLineaFisica(dots[e[0]], dots[e[1]]))
    }
    // Tetraedro
    else if (tipo.includes('tetra')) {
      const v = [[2,2,2], [-2,-2,2], [-2,2,-2], [2,-2,-2]]
      dots = v.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      ;[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].forEach(e => crearLineaFisica(dots[e[0]], dots[e[1]]))
    }
    // Pirámide
    else if (tipo.includes('pyramid')) {
      const apex = crearPuntoFisico(new THREE.Vector3(0, 3, 0))
      const base = [[-2, -1, -2], [2, -1, -2], [2, -1, 2], [-2, -1, 2]]
      const baseDots = base.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      baseDots.forEach((d, i) => {
        crearLineaFisica(d, baseDots[(i + 1) % 4])
        crearLineaFisica(d, apex)
      })
    }
    // Cono
    else if (tipo.includes('cone')) {
      const apex = crearPuntoFisico(new THREE.Vector3(0, 3, 0))
      const basePoints: THREE.Mesh[] = []
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2
        basePoints.push(crearPuntoFisico(new THREE.Vector3(Math.cos(ang) * 2.5, -1, Math.sin(ang) * 2.5)))
      }
      basePoints.forEach((d, i) => {
        crearLineaFisica(d, basePoints[(i + 1) % 12])
        crearLineaFisica(d, apex)
      })
    }
    // Cilindro
    else if (tipo.includes('cylinder')) {
      const topPoints: THREE.Mesh[] = []
      const bottomPoints: THREE.Mesh[] = []
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2
        topPoints.push(crearPuntoFisico(new THREE.Vector3(Math.cos(ang) * 2, 2, Math.sin(ang) * 2)))
        bottomPoints.push(crearPuntoFisico(new THREE.Vector3(Math.cos(ang) * 2, -2, Math.sin(ang) * 2)))
      }
      topPoints.forEach((d, i) => {
        crearLineaFisica(d, topPoints[(i + 1) % 12])
        crearLineaFisica(bottomPoints[i], bottomPoints[(i + 1) % 12])
        crearLineaFisica(d, bottomPoints[i])
      })
    }
    // Esfera
    else if (tipo.includes('sphere')) {
      const sphereDots: THREE.Mesh[] = []
      for (let j = 0; j <= 4; j++) {
        const phi = (j / 4) * Math.PI
        for (let i = 0; i < 8; i++) {
          const theta = (i / 8) * Math.PI * 2
          sphereDots.push(crearPuntoFisico(new THREE.Vector3(
            2.5 * Math.sin(phi) * Math.cos(theta), 2.5 * Math.cos(phi), 2.5 * Math.sin(phi) * Math.sin(theta)
          )))
        }
      }
      for (let j = 0; j <= 4; j++) {
        for (let i = 0; i < 8; i++) {
          const idx = j * 8 + i
          if (i < 7) crearLineaFisica(sphereDots[idx], sphereDots[idx + 1])
          else crearLineaFisica(sphereDots[idx], sphereDots[idx - 7])
          if (j < 4) crearLineaFisica(sphereDots[idx], sphereDots[idx + 8])
        }
      }
    }
    // Prisma
    else if (tipo.includes('prism')) {
      const topVerts = [[0, 2, -2], [-2, 2, 1.5], [2, 2, 1.5]]
      const bottomVerts = [[0, -2, -2], [-2, -2, 1.5], [2, -2, 1.5]]
      const topDots = topVerts.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      const bottomDots = bottomVerts.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      topDots.forEach((d, i) => {
        crearLineaFisica(d, topDots[(i + 1) % 3])
        crearLineaFisica(bottomDots[i], bottomDots[(i + 1) % 3])
        crearLineaFisica(d, bottomDots[i])
      })
    }
    // Default: cubo
    else {
      const v = [[-2,-2,-2],[2,-2,-2],[2,2,-2],[-2,2,-2],[-2,-2,2],[2,-2,2],[2,2,2],[-2,2,2]]
      dots = v.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      ;[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(e => crearLineaFisica(dots[e[0]], dots[e[1]]))
    }
  }, [crearPuntoFisico, crearLineaFisica])

  const limpiarTemporales = useCallback(() => {
    puntosTemporalesRef.current.forEach(p => mainGroupRef.current?.remove(p))
    puntosTemporalesRef.current = []
    seleccionPuntosRef.current = []
    setSeleccionCount(0)
  }, [])

  const crearLabel = useCallback((text: string, worldPos: THREE.Vector3) => {
    if (!containerRef.current || !cameraRef.current) return
    const label = document.createElement('div')
    label.textContent = text
    label.style.cssText = `
      position: absolute; background: #fff; color: #d35400; border: 2px solid #d35400;
      padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold; pointer-events: none; z-index: 100;
    `
    containerRef.current.appendChild(label)
    labelsRef.current.push(label)
    
    const updatePos = () => {
      if (!cameraRef.current || !containerRef.current) return
      const v = worldPos.clone().project(cameraRef.current)
      label.style.left = `${(v.x + 1) / 2 * width}px`
      label.style.top = `${(-v.y + 1) / 2 * height}px`
    }
    updatePos()
  }, [width, height])

  const calcularAngulo = (p1: THREE.Vector3, vertex: THREE.Vector3, p2: THREE.Vector3): number => {
    const v1 = new THREE.Vector3().subVectors(p1, vertex).normalize()
    const v2 = new THREE.Vector3().subVectors(p2, vertex).normalize()
    return Math.acos(Math.max(-1, Math.min(1, v1.dot(v2)))) * (180 / Math.PI)
  }

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf5f5f5)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(8, 8, 10)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const sun = new THREE.DirectionalLight(0xffffff, 0.5)
    sun.position.set(5, 10, 7)
    scene.add(sun)

    const mainGroup = new THREE.Group()
    scene.add(mainGroup)
    mainGroupRef.current = mainGroup

    cambiarForma(shapeType)

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationIdRef.current)
      renderer.dispose()
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement)
      }
      labelsRef.current.forEach(l => l.remove())
    }
  }, [shapeType, width, height, cambiarForma])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)

    if (['punto', 'segmento', 'area', 'angulo'].includes(modo)) {
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.params.Line = { threshold: 0.5 }
      raycaster.setFromCamera(mouse, cameraRef.current!)
      
      const edges = mainGroupRef.current?.children.filter(c => c.userData.isEdge) || []
      const hits = raycaster.intersectObjects(edges, false)
      
      if (hits.length > 0) {
        const hit = hits[0]
        if (modo === 'punto') {
          crearPuntoFisico(hit.point.clone(), true)
        } else {
          const tempPoint = crearPuntoFisico(hit.point.clone(), true)
          seleccionPuntosRef.current.push(tempPoint)
          const count = seleccionPuntosRef.current.length
          setSeleccionCount(count)
          
          if (modo === 'segmento' && count === 2) {
            const [p1, p2] = seleccionPuntosRef.current
            const geo = new THREE.BufferGeometry().setFromPoints([p1.position, p2.position])
            const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colorActual, linewidth: 3 }))
            mainGroupRef.current?.add(line)
            limpiarTemporales()
          } else if (modo === 'area' && count === 3) {
            const [p1, p2, p3] = seleccionPuntosRef.current
            const geo = new THREE.BufferGeometry()
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
              p1.position.x, p1.position.y, p1.position.z,
              p2.position.x, p2.position.y, p2.position.z,
              p3.position.x, p3.position.y, p3.position.z
            ]), 3))
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
              color: colorActual, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthTest: false
            }))
            mesh.renderOrder = 50
            mainGroupRef.current?.add(mesh)
            limpiarTemporales()
          } else if (modo === 'angulo' && count === 3) {
            const [p1, v, p2] = seleccionPuntosRef.current
            const angle = calcularAngulo(p1.position, v.position, p2.position)
            crearLabel(`${angle.toFixed(1)}°`, v.position.clone())
            limpiarTemporales()
          }
        }
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !mainGroupRef.current) return
    const deltaX = e.clientX - lastPosRef.current.x
    const deltaY = e.clientY - lastPosRef.current.y
    lastPosRef.current = { x: e.clientX, y: e.clientY }

    if (modo === 'giro') {
      mainGroupRef.current.rotation.y += deltaX * 0.01
      mainGroupRef.current.rotation.x += deltaY * 0.01
    } else if (modo === 'mover') {
      mainGroupRef.current.position.x += deltaX * 0.02
      mainGroupRef.current.position.y -= deltaY * 0.02
    } else if (modo === 'escalar') {
      mainGroupRef.current.scale.multiplyScalar(1 + (deltaX + deltaY) * 0.005)
    }
  }

  const handleCapture = () => {
    if (rendererRef.current) {
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png')
      onCapture(dataUrl, width, height)
    }
  }

  const colores = [
    { hex: '#f1c40f', value: 0xf1c40f },
    { hex: '#e74c3c', value: 0xe74c3c },
    { hex: '#2ecc71', value: 0x2ecc71 },
    { hex: '#3498db', value: 0x3498db },
  ]

  return (
    <div
      className="absolute bg-white rounded-lg shadow-2xl border-2 border-blue-500 overflow-hidden z-[1000]"
      style={{ left: x, top: y, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Mini toolbar */}
      <div className="bg-slate-700 px-2 py-1 flex items-center gap-1 text-[10px]">
        {(['giro', 'mover', 'escalar'] as Modo3D[]).map(m => (
          <button
            key={m}
            onClick={() => { setModo(m); limpiarTemporales() }}
            className={`px-1.5 py-0.5 rounded font-medium ${modo === m ? 'bg-blue-500 text-white' : 'bg-slate-600 text-slate-200'}`}
          >
            {m === 'giro' ? '🔄' : m === 'mover' ? '↔️' : '📐'}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-500 mx-1" />
        {(['punto', 'segmento', 'area', 'angulo'] as Modo3D[]).map(m => (
          <button
            key={m}
            onClick={() => { setModo(m); limpiarTemporales() }}
            className={`px-1.5 py-0.5 rounded font-medium ${modo === m ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-200'}`}
          >
            {m === 'punto' ? '•' : m === 'segmento' ? '/' : m === 'area' ? '△' : '∠'}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-500 mx-1" />
        {colores.map(c => (
          <button
            key={c.hex}
            onClick={() => setColorActual(c.value)}
            className={`w-4 h-4 rounded-full border ${colorActual === c.value ? 'border-white' : 'border-transparent'}`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <div className="flex-1" />
        <button onClick={handleCapture} className="px-1.5 py-0.5 rounded bg-green-600 text-white font-medium" title="Capturar">
          📷
        </button>
        <button onClick={onClose} className="px-1.5 py-0.5 rounded bg-red-600 text-white font-medium" title="Cerrar">
          ✕
        </button>
      </div>
      
      {/* Canvas 3D */}
      <div
        ref={containerRef}
        className="relative cursor-grab active:cursor-grabbing"
        style={{ width, height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      />
      
      {/* Status bar */}
      <div className="bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 border-t">
        {modo === 'giro' && 'Arrastra para rotar'}
        {modo === 'mover' && 'Arrastra para mover'}
        {modo === 'escalar' && 'Arrastra para escalar'}
        {modo === 'punto' && 'Clic en arista para punto'}
        {modo === 'segmento' && `Selecciona 2 pts (${seleccionCount}/2)`}
        {modo === 'area' && `Selecciona 3 pts (${seleccionCount}/3)`}
        {modo === 'angulo' && `Selecciona 3 pts (${seleccionCount}/3)`}
      </div>
    </div>
  )
}
