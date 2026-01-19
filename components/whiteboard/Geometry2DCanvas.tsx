'use client'

import { useCallback, useEffect, useRef, useState } from 'react';

interface Punto { id: string; x: number; y: number }
interface Linea { id: string; p1: string; p2: string }
interface Arco { id: string; p1: string; pV: string; p2: string; valor: string }
interface Area { id: string; puntos: string[]; color: string }
interface Marca { id: string; p1: string; p2: string; tipo: 'rayas' | 'circulo' | 'gruesa' | 'zigzag' }
interface Circulo { id: string; x: number; y: number; r: number }

interface Geometry2DCanvasProps {
  width: number
  height: number
  onClose: () => void
  onCapture: (imageDataUrl: string) => void
}

type Modo = 'mover' | 'escalar' | 'segmento' | 'angulo' | 'marcar' | 'area'

const COLORES_AREA = [
  { name: 'Rosa', value: 'rgba(255, 209, 220, 0.5)' },
  { name: 'Verde', value: 'rgba(224, 251, 226, 0.5)' },
  { name: 'Lila', value: 'rgba(230, 230, 250, 0.5)' },
  { name: 'Celeste', value: 'rgba(178, 235, 242, 0.5)' },
  { name: 'Amarillo', value: 'rgba(255, 249, 227, 0.5)' },
  { name: 'Durazno', value: 'rgba(255, 218, 185, 0.5)' },
]

const FIGURAS = [
  { tipo: 'triangulo', label: '△' },
  { tipo: 'cuadrado', label: '□' },
  { tipo: 'rectangulo', label: '▭' },
  { tipo: 'rombo', label: '♢' },
  { tipo: 'trapecio', label: '⏢' },
  { tipo: 'circulo', label: '◯' },
]

let idCounter = 0
const genId = () => `g2d-${++idCounter}`

export default function Geometry2DCanvas({ width, height, onClose, onCapture }: Geometry2DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [modo, setModo] = useState<Modo>('mover')
  const [tipoMarca, setTipoMarca] = useState<'rayas' | 'circulo' | 'gruesa' | 'zigzag'>('rayas')
  const [colorArea, setColorArea] = useState(COLORES_AREA[0].value)
  
  const [puntos, setPuntos] = useState<Punto[]>([])
  const [lineas, setLineas] = useState<Linea[]>([])
  const [arcos, setArcos] = useState<Arco[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [circulos, setCirculos] = useState<Circulo[]>([])
  
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [puntoArrastrado, setPuntoArrastrado] = useState<string | null>(null)
  const [inputAngulo, setInputAngulo] = useState<{ arcoId: string; x: number; y: number } | null>(null)

  // Crear figura preset
  const crearFigura = useCallback((tipo: string) => {
    const cx = width / 2
    const cy = height / 2
    const size = 80
    
    let nuevos: Punto[] = []
    let nuevasLineas: Linea[] = []
    
    if (tipo === 'triangulo') {
      const p1 = { id: genId(), x: cx, y: cy - size }
      const p2 = { id: genId(), x: cx - size, y: cy + size * 0.7 }
      const p3 = { id: genId(), x: cx + size, y: cy + size * 0.7 }
      nuevos = [p1, p2, p3]
      nuevasLineas = [
        { id: genId(), p1: p1.id, p2: p2.id },
        { id: genId(), p1: p2.id, p2: p3.id },
        { id: genId(), p1: p3.id, p2: p1.id },
      ]
    } else if (tipo === 'cuadrado') {
      const p1 = { id: genId(), x: cx - size, y: cy - size }
      const p2 = { id: genId(), x: cx + size, y: cy - size }
      const p3 = { id: genId(), x: cx + size, y: cy + size }
      const p4 = { id: genId(), x: cx - size, y: cy + size }
      nuevos = [p1, p2, p3, p4]
      nuevasLineas = [
        { id: genId(), p1: p1.id, p2: p2.id },
        { id: genId(), p1: p2.id, p2: p3.id },
        { id: genId(), p1: p3.id, p2: p4.id },
        { id: genId(), p1: p4.id, p2: p1.id },
      ]
    } else if (tipo === 'rectangulo') {
      const p1 = { id: genId(), x: cx - size * 1.5, y: cy - size * 0.7 }
      const p2 = { id: genId(), x: cx + size * 1.5, y: cy - size * 0.7 }
      const p3 = { id: genId(), x: cx + size * 1.5, y: cy + size * 0.7 }
      const p4 = { id: genId(), x: cx - size * 1.5, y: cy + size * 0.7 }
      nuevos = [p1, p2, p3, p4]
      nuevasLineas = [
        { id: genId(), p1: p1.id, p2: p2.id },
        { id: genId(), p1: p2.id, p2: p3.id },
        { id: genId(), p1: p3.id, p2: p4.id },
        { id: genId(), p1: p4.id, p2: p1.id },
      ]
    } else if (tipo === 'rombo') {
      const p1 = { id: genId(), x: cx, y: cy - size }
      const p2 = { id: genId(), x: cx + size, y: cy }
      const p3 = { id: genId(), x: cx, y: cy + size }
      const p4 = { id: genId(), x: cx - size, y: cy }
      nuevos = [p1, p2, p3, p4]
      nuevasLineas = [
        { id: genId(), p1: p1.id, p2: p2.id },
        { id: genId(), p1: p2.id, p2: p3.id },
        { id: genId(), p1: p3.id, p2: p4.id },
        { id: genId(), p1: p4.id, p2: p1.id },
      ]
    } else if (tipo === 'trapecio') {
      const p1 = { id: genId(), x: cx - size * 0.6, y: cy - size * 0.7 }
      const p2 = { id: genId(), x: cx + size * 0.6, y: cy - size * 0.7 }
      const p3 = { id: genId(), x: cx + size * 1.2, y: cy + size * 0.7 }
      const p4 = { id: genId(), x: cx - size * 1.2, y: cy + size * 0.7 }
      nuevos = [p1, p2, p3, p4]
      nuevasLineas = [
        { id: genId(), p1: p1.id, p2: p2.id },
        { id: genId(), p1: p2.id, p2: p3.id },
        { id: genId(), p1: p3.id, p2: p4.id },
        { id: genId(), p1: p4.id, p2: p1.id },
      ]
    } else if (tipo === 'circulo') {
      setCirculos(prev => [...prev, { id: genId(), x: cx, y: cy, r: size }])
      return
    }
    
    setPuntos(prev => [...prev, ...nuevos])
    setLineas(prev => [...prev, ...nuevasLineas])
  }, [width, height])

  // Encontrar punto cercano
  const encontrarPunto = useCallback((x: number, y: number): Punto | null => {
    return puntos.find(p => Math.hypot(p.x - x, p.y - y) < 15) || null
  }, [puntos])

  // Dibujar
  const dibujar = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    
    // Áreas
    areas.forEach(area => {
      const pts = area.puntos.map(id => puntos.find(p => p.id === id)).filter(Boolean) as Punto[]
      if (pts.length < 3) return
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.fillStyle = area.color
      ctx.fill()
    })
    
    // Círculos
    circulos.forEach(c => {
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.stroke()
    })
    
    // Líneas
    lineas.forEach(l => {
      const p1 = puntos.find(p => p.id === l.p1)
      const p2 = puntos.find(p => p.id === l.p2)
      if (!p1 || !p2) return
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.stroke()
    })
    
    // Marcas
    marcas.forEach(m => {
      const p1 = puntos.find(p => p.id === m.p1)
      const p2 = puntos.find(p => p.id === m.p2)
      if (!p1 || !p2) return
      const mx = (p1.x + p2.x) / 2
      const my = (p1.y + p2.y) / 2
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      const perpAngle = angle + Math.PI / 2
      
      ctx.save()
      ctx.translate(mx, my)
      ctx.rotate(perpAngle)
      
      if (m.tipo === 'rayas') {
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-3, -8); ctx.lineTo(-3, 8)
        ctx.moveTo(3, -8); ctx.lineTo(3, 8)
        ctx.stroke()
      } else if (m.tipo === 'circulo') {
        ctx.fillStyle = '#333'
        ctx.beginPath()
        ctx.arc(0, 0, 5, 0, Math.PI * 2)
        ctx.fill()
      } else if (m.tipo === 'gruesa') {
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(-8, 0); ctx.lineTo(8, 0)
        ctx.stroke()
      } else if (m.tipo === 'zigzag') {
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-10, 5)
        ctx.lineTo(-5, -5)
        ctx.lineTo(0, 5)
        ctx.lineTo(5, -5)
        ctx.lineTo(10, 5)
        ctx.stroke()
      }
      ctx.restore()
    })
    
    // Arcos de ángulo
    arcos.forEach(a => {
      const p1 = puntos.find(p => p.id === a.p1)
      const pV = puntos.find(p => p.id === a.pV)
      const p2 = puntos.find(p => p.id === a.p2)
      if (!p1 || !pV || !p2) return
      
      const ang1 = Math.atan2(p1.y - pV.y, p1.x - pV.x)
      const ang2 = Math.atan2(p2.y - pV.y, p2.x - pV.x)
      
      ctx.beginPath()
      ctx.arc(pV.x, pV.y, 25, ang1, ang2, ang1 > ang2)
      ctx.strokeStyle = '#e74c3c'
      ctx.lineWidth = 2
      ctx.stroke()
      
      if (a.valor) {
        const midAng = (ang1 + ang2) / 2
        const tx = pV.x + Math.cos(midAng) * 40
        const ty = pV.y + Math.sin(midAng) * 40
        ctx.font = 'bold 14px sans-serif'
        ctx.fillStyle = '#e74c3c'
        ctx.fillText(a.valor + '°', tx - 10, ty + 5)
      }
    })
    
    // Puntos
    puntos.forEach(p => {
      const isSelected = seleccion.includes(p.id)
      ctx.beginPath()
      ctx.arc(p.x, p.y, isSelected ? 8 : 6, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? '#3498db' : '#2980b9'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [puntos, lineas, arcos, areas, marcas, circulos, seleccion, width, height])

  useEffect(() => {
    dibujar()
  }, [dibujar])

  // Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const punto = encontrarPunto(x, y)
    
    if (modo === 'mover' && punto) {
      setPuntoArrastrado(punto.id)
    } else if (modo === 'segmento') {
      if (punto) {
        setSeleccion(prev => {
          const next = [...prev, punto.id]
          if (next.length === 2) {
            setLineas(l => [...l, { id: genId(), p1: next[0], p2: next[1] }])
            return []
          }
          return next
        })
      } else {
        const nuevo = { id: genId(), x, y }
        setPuntos(prev => [...prev, nuevo])
        setSeleccion([nuevo.id])
      }
    } else if (modo === 'angulo' && punto) {
      setSeleccion(prev => {
        const next = [...prev, punto.id]
        if (next.length === 3) {
          const arcoId = genId()
          setArcos(a => [...a, { id: arcoId, p1: next[0], pV: next[1], p2: next[2], valor: '' }])
          setInputAngulo({ arcoId, x: punto.x, y: punto.y })
          return []
        }
        return next
      })
    } else if (modo === 'marcar' && punto) {
      setSeleccion(prev => {
        const next = [...prev, punto.id]
        if (next.length === 2) {
          setMarcas(m => [...m, { id: genId(), p1: next[0], p2: next[1], tipo: tipoMarca }])
          return []
        }
        return next
      })
    } else if (modo === 'area' && punto) {
      setSeleccion(prev => {
        if (prev.length > 1 && punto.id === prev[0]) {
          setAreas(a => [...a, { id: genId(), puntos: prev, color: colorArea }])
          return []
        }
        if (!prev.includes(punto.id)) {
          return [...prev, punto.id]
        }
        return prev
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!puntoArrastrado) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setPuntos(prev => prev.map(p => p.id === puntoArrastrado ? { ...p, x, y } : p))
  }

  const handleMouseUp = () => {
    setPuntoArrastrado(null)
  }

  const handleDblClick = (e: React.MouseEvent) => {
    if (modo === 'area') {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      // Eliminar área bajo el cursor
      setAreas(prev => prev.filter(area => {
        const pts = area.puntos.map(id => puntos.find(p => p.id === id)).filter(Boolean) as Punto[]
        return !puntoEnPoligono(x, y, pts)
      }))
    }
  }

  const puntoEnPoligono = (x: number, y: number, pts: Punto[]): boolean => {
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y
      const xj = pts[j].x, yj = pts[j].y
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    return inside
  }

  const handleCapture = () => {
    if (canvasRef.current) {
      onCapture(canvasRef.current.toDataURL('image/png'))
    }
  }

  const limpiar = () => {
    setPuntos([])
    setLineas([])
    setArcos([])
    setAreas([])
    setMarcas([])
    setCirculos([])
    setSeleccion([])
  }

  return (
    <div className="absolute inset-0 bg-white rounded-lg shadow-2xl border-2 border-emerald-500 overflow-hidden z-[1000] flex flex-col">
      {/* Toolbar */}
      <div className="bg-slate-700 px-2 py-1.5 flex items-center gap-1 flex-wrap text-[10px]">
        {/* Edición */}
        <div className="flex items-center gap-0.5 border-r border-slate-500 pr-2">
          <span className="text-slate-400 uppercase mr-1">Editar</span>
          <button onClick={() => { setModo('mover'); setSeleccion([]) }} className={`px-1.5 py-0.5 rounded ${modo === 'mover' ? 'bg-blue-500 text-white' : 'bg-slate-600 text-slate-200'}`}>
            MOVER
          </button>
          <button onClick={() => { setModo('escalar'); setSeleccion([]) }} className={`px-1.5 py-0.5 rounded ${modo === 'escalar' ? 'bg-blue-500 text-white' : 'bg-slate-600 text-slate-200'}`}>
            ESCALAR
          </button>
        </div>
        
        {/* Dibujo */}
        <div className="flex items-center gap-0.5 border-r border-slate-500 pr-2">
          <span className="text-slate-400 uppercase mr-1">Dibujo</span>
          <button onClick={() => { setModo('segmento'); setSeleccion([]) }} className={`px-1.5 py-0.5 rounded ${modo === 'segmento' ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-200'}`}>
            SEGMENTO
          </button>
          <button onClick={() => { setModo('angulo'); setSeleccion([]) }} className={`px-1.5 py-0.5 rounded ${modo === 'angulo' ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-200'}`}>
            ÁNGULO
          </button>
          <button onClick={() => { setModo('marcar'); setSeleccion([]) }} className={`px-1.5 py-0.5 rounded ${modo === 'marcar' ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-200'}`}>
            MARCAR
          </button>
          <select value={tipoMarca} onChange={e => setTipoMarca(e.target.value as typeof tipoMarca)} className="bg-slate-600 text-white rounded px-1 py-0.5 text-[10px]">
            <option value="rayas">||</option>
            <option value="circulo">●</option>
            <option value="gruesa">━</option>
            <option value="zigzag">〰</option>
          </select>
        </div>
        
        {/* Área */}
        <div className="flex items-center gap-0.5 border-r border-slate-500 pr-2">
          <button onClick={() => { setModo('area'); setSeleccion([]) }} className={`px-1.5 py-0.5 rounded ${modo === 'area' ? 'bg-pink-500 text-white' : 'bg-slate-600 text-slate-200'}`}>
            ÁREA
          </button>
          {COLORES_AREA.map(c => (
            <button
              key={c.value}
              onClick={() => setColorArea(c.value)}
              className={`w-4 h-4 rounded-full border-2 ${colorArea === c.value ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c.value.replace('0.5', '1') }}
            />
          ))}
        </div>
        
        {/* Figuras */}
        <div className="flex items-center gap-0.5 border-r border-slate-500 pr-2">
          <span className="text-slate-400 uppercase mr-1">Fig</span>
          {FIGURAS.map(f => (
            <button key={f.tipo} onClick={() => crearFigura(f.tipo)} className="px-1.5 py-0.5 rounded bg-slate-600 text-white hover:bg-slate-500">
              {f.label}
            </button>
          ))}
        </div>
        
        {/* Acciones */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={limpiar} className="px-1.5 py-0.5 rounded bg-red-600 text-white">
            🗑️
          </button>
          <button onClick={handleCapture} className="px-1.5 py-0.5 rounded bg-green-600 text-white">
            📷
          </button>
          <button onClick={onClose} className="px-1.5 py-0.5 rounded bg-gray-600 text-white">
            ✕
          </button>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDblClick}
        />
        
        {/* Input de ángulo */}
        {inputAngulo && (
          <div
            className="absolute bg-white border-2 border-red-500 rounded p-1 shadow-lg"
            style={{ left: inputAngulo.x, top: inputAngulo.y }}
          >
            <input
              type="text"
              autoFocus
              className="w-12 text-center font-bold outline-none"
              placeholder="°"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const valor = (e.target as HTMLInputElement).value
                  setArcos(prev => prev.map(a => a.id === inputAngulo.arcoId ? { ...a, valor } : a))
                  setInputAngulo(null)
                } else if (e.key === 'Escape') {
                  setInputAngulo(null)
                }
              }}
              onBlur={e => {
                const valor = e.target.value
                setArcos(prev => prev.map(a => a.id === inputAngulo.arcoId ? { ...a, valor } : a))
                setInputAngulo(null)
              }}
            />
          </div>
        )}
      </div>
      
      {/* Status */}
      <div className="bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 border-t">
        {modo === 'mover' && 'Arrastra los puntos para mover'}
        {modo === 'escalar' && 'Arrastra para escalar (no implementado)'}
        {modo === 'segmento' && `Selecciona 2 puntos (${seleccion.length}/2)`}
        {modo === 'angulo' && `Selecciona 3 puntos: p1, vértice, p2 (${seleccion.length}/3)`}
        {modo === 'marcar' && `Selecciona 2 puntos para marcar (${seleccion.length}/2)`}
        {modo === 'area' && `Selecciona puntos y cierra con el primero (${seleccion.length} pts) - Doble clic para eliminar`}
      </div>
    </div>
  )
}
