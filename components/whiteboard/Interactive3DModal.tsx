'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Interactive3DModalProps {
  isOpen: boolean
  onClose: () => void
  figureType: '3d-cube' | '3d-tetra' | '3d-cone' | '3d-sphere' | '3d-pyramid' | '3d-cylinder' | '3d-prism' | string
  onCapture?: (imageDataUrl: string) => void
}

type Modo3D = 'giro' | 'mover' | 'escalar' | 'puntoEje' | 'segmento' | 'area' | 'angulo'

export default function Interactive3DModal({ isOpen, onClose, figureType, onCapture }: Interactive3DModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const mainGroupRef = useRef<THREE.Group | null>(null)
  const animationIdRef = useRef<number>(0)
  
  const [modo, setModo] = useState<Modo3D>('giro')
  const [colorActual, setColorActual] = useState(0xf1c40f)
  const [isDragging, setIsDragging] = useState(false)
  const [seleccionPuntos, setSeleccionPuntos] = useState<THREE.Mesh[]>([])
  const lastPosRef = useRef({ x: 0, y: 0 })
  const labelsRef = useRef<HTMLDivElement[]>([])
  const puntosTemporalesRef = useRef<THREE.Mesh[]>([])

  // Crear punto físico en la escena
  const crearPuntoFisico = useCallback((pos: THREE.Vector3, temp = false): THREE.Mesh => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(temp ? 0.08 : 0.12),
      new THREE.MeshBasicMaterial({ 
        color: temp ? 0xe74c3c : 0x2980b9, 
        depthTest: false 
      })
    )
    dot.position.copy(pos)
    dot.userData = { isVertex: true, isTemp: temp }
    dot.renderOrder = 100
    mainGroupRef.current?.add(dot)
    if (temp) puntosTemporalesRef.current.push(dot)
    return dot
  }, [])

  // Crear línea entre dos puntos
  const crearLineaFisica = useCallback((p1: THREE.Mesh, p2: THREE.Mesh, col = 0x7f8c8d, op = 0.6) => {
    const geo = new THREE.BufferGeometry().setFromPoints([p1.position, p2.position])
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ 
      color: col, 
      transparent: true, 
      opacity: op 
    }))
    line.userData = { isEdge: true, p1, p2 }
    mainGroupRef.current?.add(line)
    return line
  }, [])

  // Cambiar la forma 3D
  const cambiarForma = useCallback((tipo: string) => {
    if (!mainGroupRef.current) return
    
    // Limpiar grupo
    while (mainGroupRef.current.children.length > 0) {
      mainGroupRef.current.remove(mainGroupRef.current.children[0])
    }
    labelsRef.current = []
    
    let dots: THREE.Mesh[] = []

    if (tipo.includes('cube') || tipo === 'cubo') {
      const v = [[-2,-2,-2],[2,-2,-2],[2,2,-2],[-2,2,-2],[-2,-2,2],[2,-2,2],[2,2,2],[-2,2,2]]
      dots = v.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
      edges.forEach(e => crearLineaFisica(dots[e[0]], dots[e[1]]))
    } else if (tipo.includes('tetra')) {
      const v = [[2,2,2], [-2,-2,2], [-2,2,-2], [2,-2,-2]]
      dots = v.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      const edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]
      edges.forEach(e => crearLineaFisica(dots[e[0]], dots[e[1]]))
    } else if (tipo.includes('cone') || tipo === 'cono') {
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
    } else if (tipo.includes('sphere') || tipo === 'esfera') {
      const sphereDots: THREE.Mesh[] = []
      for (let j = 0; j <= 4; j++) {
        const phi = (j / 4) * Math.PI
        for (let i = 0; i < 8; i++) {
          const theta = (i / 8) * Math.PI * 2
          sphereDots.push(crearPuntoFisico(new THREE.Vector3(
            2.5 * Math.sin(phi) * Math.cos(theta),
            2.5 * Math.cos(phi),
            2.5 * Math.sin(phi) * Math.sin(theta)
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
    } else if (tipo.includes('pyramid') || tipo === 'piramide') {
      const apex = crearPuntoFisico(new THREE.Vector3(0, 3, 0))
      const base = [[-2, -1, -2], [2, -1, -2], [2, -1, 2], [-2, -1, 2]]
      const baseDots = base.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      baseDots.forEach((d, i) => {
        crearLineaFisica(d, baseDots[(i + 1) % 4])
        crearLineaFisica(d, apex)
      })
    } else if (tipo.includes('cylinder') || tipo === 'cilindro') {
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
    } else if (tipo.includes('prism')) {
      // Prisma triangular
      const topVerts = [[0, 2, -2], [-2, 2, 1.5], [2, 2, 1.5]]
      const bottomVerts = [[0, -2, -2], [-2, -2, 1.5], [2, -2, 1.5]]
      const topDots = topVerts.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      const bottomDots = bottomVerts.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      topDots.forEach((d, i) => {
        crearLineaFisica(d, topDots[(i + 1) % 3])
        crearLineaFisica(bottomDots[i], bottomDots[(i + 1) % 3])
        crearLineaFisica(d, bottomDots[i])
      })
    } else {
      // Default: cubo
      const v = [[-2,-2,-2],[2,-2,-2],[2,2,-2],[-2,2,-2],[-2,-2,2],[2,-2,2],[2,2,2],[-2,2,2]]
      dots = v.map(p => crearPuntoFisico(new THREE.Vector3(...p)))
      const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
      edges.forEach(e => crearLineaFisica(dots[e[0]], dots[e[1]]))
    }
  }, [crearPuntoFisico, crearLineaFisica])

  // Limpiar puntos temporales
  const limpiarTemporales = useCallback(() => {
    puntosTemporalesRef.current.forEach(p => mainGroupRef.current?.remove(p))
    puntosTemporalesRef.current = []
    // Limpiar labels
    labelsRef.current.forEach(l => l.remove())
    labelsRef.current = []
  }, [])

  // Crear label de ángulo
  const crearLabel = useCallback((text: string, pos: THREE.Vector3) => {
    if (!containerRef.current || !cameraRef.current) return
    
    const label = document.createElement('div')
    label.className = 'label-3d'
    label.textContent = text
    label.style.cssText = `
      position: absolute;
      background: #fff;
      color: #d35400;
      border: 2px solid #d35400;
      padding: 4px 8px;
      border-radius: 5px;
      font-size: 14px;
      pointer-events: none;
      font-weight: bold;
      transform: translate(-50%, -50%);
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 1000;
    `
    containerRef.current.appendChild(label)
    labelsRef.current.push(label)
    
    // Actualizar posición
    const updateLabel = () => {
      if (!cameraRef.current || !containerRef.current) return
      const vector = pos.clone().project(cameraRef.current)
      const rect = containerRef.current.getBoundingClientRect()
      label.style.left = ((vector.x + 1) / 2 * rect.width) + 'px'
      label.style.top = ((-vector.y + 1) / 2 * rect.height) + 'px'
    }
    updateLabel()
    
    return { label, pos, update: updateLabel }
  }, [])

  // Calcular ángulo entre tres puntos
  const calcularAngulo = useCallback((p1: THREE.Vector3, vertex: THREE.Vector3, p2: THREE.Vector3): number => {
    const v1 = new THREE.Vector3().subVectors(p1, vertex).normalize()
    const v2 = new THREE.Vector3().subVectors(p2, vertex).normalize()
    return Math.acos(Math.max(-1, Math.min(1, v1.dot(v2)))) * (180 / Math.PI)
  }, [])

  // Inicializar Three.js
  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    // Crear escena
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf1f3f5)
    sceneRef.current = scene

    // Crear cámara
    const camera = new THREE.PerspectiveCamera(45, 600 / 450, 0.1, 1000)
    camera.position.set(10, 10, 12)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Crear renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(600, 450)
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

    // Crear forma inicial
    cambiarForma(figureType)

    // Animación
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      // Actualizar labels
      labelsRef.current.forEach((label) => {
        // Los labels se actualizan automáticamente
      })
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationIdRef.current)
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
      labelsRef.current.forEach(l => l.remove())
      labelsRef.current = []
    }
  }, [isOpen, figureType, cambiarForma])

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)

    if (modo === 'puntoEje' || modo === 'segmento' || modo === 'area' || modo === 'angulo') {
      // Raycast para detectar aristas
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      
      const raycaster = new THREE.Raycaster()
      raycaster.params.Line = { threshold: 0.4 }
      raycaster.setFromCamera(mouse, cameraRef.current!)
      
      const edgeObjects = mainGroupRef.current?.children.filter(c => c.userData.isEdge) || []
      const hits = raycaster.intersectObjects(edgeObjects, false)
      
      if (hits.length > 0) {
        const hit = hits[0]
        const edge = hit.object as THREE.Line
        
        if (modo === 'puntoEje') {
          // Crear punto en la arista
          crearPuntoFisico(hit.point.clone(), true)
        } else if (modo === 'segmento' || modo === 'area' || modo === 'angulo') {
          const tempPoint = crearPuntoFisico(hit.point.clone(), true)
          setSeleccionPuntos(prev => {
            const newSel = [...prev, tempPoint]
            
            if (modo === 'segmento' && newSel.length === 2) {
              // Crear segmento
              const geo = new THREE.BufferGeometry().setFromPoints([
                newSel[0].position, 
                newSel[1].position
              ])
              const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ 
                color: colorActual, 
                linewidth: 3 
              }))
              mainGroupRef.current?.add(line)
              return []
            }
            
            if (modo === 'area' && newSel.length === 3) {
              // Crear área triangular
              const geo = new THREE.BufferGeometry()
              const positions = new Float32Array([
                newSel[0].position.x, newSel[0].position.y, newSel[0].position.z,
                newSel[1].position.x, newSel[1].position.y, newSel[1].position.z,
                newSel[2].position.x, newSel[2].position.y, newSel[2].position.z
              ])
              geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
              const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
                color: colorActual,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide,
                depthTest: false
              }))
              mesh.renderOrder = 50
              mainGroupRef.current?.add(mesh)
              return []
            }
            
            if (modo === 'angulo' && newSel.length === 3) {
              // Calcular y mostrar ángulo
              const angle = calcularAngulo(
                newSel[0].position,
                newSel[1].position,
                newSel[2].position
              )
              crearLabel(`${angle.toFixed(1)}°`, newSel[1].position.clone())
              return []
            }
            
            return newSel
          })
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
      const scaleFactor = 1 + (deltaX + deltaY) * 0.005
      mainGroupRef.current.scale.multiplyScalar(scaleFactor)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Capturar imagen
  const handleCapture = () => {
    if (rendererRef.current && onCapture) {
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png')
      onCapture(dataUrl)
      onClose()
    }
  }

  // Reiniciar
  const handleReset = () => {
    limpiarTemporales()
    setSeleccionPuntos([])
    if (mainGroupRef.current) {
      mainGroupRef.current.rotation.set(0, 0, 0)
      mainGroupRef.current.position.set(0, 0, 0)
      mainGroupRef.current.scale.set(1, 1, 1)
    }
    cambiarForma(figureType)
  }

  if (!isOpen) return null

  const colores = [
    { hex: '#f1c40f', value: 0xf1c40f },
    { hex: '#e74c3c', value: 0xe74c3c },
    { hex: '#2ecc71', value: 0x2ecc71 },
    { hex: '#3498db', value: 0x3498db },
    { hex: '#9b59b6', value: 0x9b59b6 },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-[650px] w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold">Geometría 3D Interactiva</h3>
          <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-700 px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
          {/* Navegación */}
          <div className="flex items-center gap-1 border-r border-slate-500 pr-2">
            <span className="text-slate-400 uppercase text-[10px]">Navegar</span>
            {(['giro', 'mover', 'escalar'] as Modo3D[]).map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); limpiarTemporales(); setSeleccionPuntos([]) }}
                className={`px-2 py-1 rounded font-medium ${modo === m ? 'bg-blue-500 text-white' : 'bg-slate-600 text-slate-200 hover:bg-slate-500'}`}
              >
                {m === 'giro' ? 'GIRAR' : m === 'mover' ? 'MOVER' : 'ESCALAR'}
              </button>
            ))}
          </div>

          {/* Construcción */}
          <div className="flex items-center gap-1 border-r border-slate-500 pr-2">
            <span className="text-slate-400 uppercase text-[10px]">Construir</span>
            {(['puntoEje', 'segmento', 'area', 'angulo'] as Modo3D[]).map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); limpiarTemporales(); setSeleccionPuntos([]) }}
                className={`px-2 py-1 rounded font-medium ${modo === m ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-200 hover:bg-slate-500'}`}
              >
                {m === 'puntoEje' ? 'PUNTO' : m === 'segmento' ? 'SEGMENTO' : m === 'area' ? 'ÁREA' : 'ÁNGULO'}
              </button>
            ))}
          </div>

          {/* Colores */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 uppercase text-[10px]">Color</span>
            {colores.map(c => (
              <button
                key={c.hex}
                onClick={() => setColorActual(c.value)}
                className={`w-5 h-5 rounded-full border-2 ${colorActual === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        {/* Canvas container */}
        <div 
          ref={containerRef}
          className="relative bg-gray-100 cursor-grab active:cursor-grabbing"
          style={{ width: 600, height: 450 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {modo === 'giro' && 'Arrastra para rotar la figura'}
            {modo === 'mover' && 'Arrastra para mover la figura'}
            {modo === 'escalar' && 'Arrastra para escalar la figura'}
            {modo === 'puntoEje' && 'Clic en una arista para agregar un punto'}
            {modo === 'segmento' && `Selecciona 2 puntos (${seleccionPuntos.length}/2)`}
            {modo === 'area' && `Selecciona 3 puntos (${seleccionPuntos.length}/3)`}
            {modo === 'angulo' && `Selecciona 3 puntos: inicio, vértice, fin (${seleccionPuntos.length}/3)`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded transition"
            >
              Reiniciar
            </button>
            {onCapture && (
              <button
                onClick={handleCapture}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Capturar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
