'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import anime from 'animejs'
import { memo, useEffect, useState } from 'react'

// Tipos de filtro disponibles
type FilterType = 'all' | 'today' | 'week' | 'month' | 'custom'

// Componente de filtros con dropdown
const DateFilter = memo(function DateFilter({ 
  onApplyFilter, 
  onClearFilter,
  isFilterActive,
  appliedFromDate,
  appliedToDate,
  activeFilterType,
  setActiveFilterType
}: {
  onApplyFilter: (from: string, to: string) => void
  onClearFilter: () => void
  isFilterActive: boolean
  appliedFromDate: string
  appliedToDate: string
  activeFilterType: FilterType
  setActiveFilterType: (type: FilterType) => void
}) {
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customFromDate, setCustomFromDate] = useState('')
  const [customFromTime, setCustomFromTime] = useState('00:00')
  const [customToDate, setCustomToDate] = useState('')
  const [customToTime, setCustomToTime] = useState('23:59')
  
  // Manejar cambio en el select
  const handleSelectChange = (value: string) => {
    const type = value as FilterType
    
    if (type === 'custom') {
      // Por defecto, la fecha fin es hoy
      const today = new Date().toISOString().split('T')[0]
      setCustomToDate(today)
      setShowCustomModal(true)
      return
    }
    
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    let fromDate = ''
    let toDate = `${today}T23:59`
    
    switch (type) {
      case 'today':
        fromDate = `${today}T00:00`
        break
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        fromDate = `${weekAgo.toISOString().split('T')[0]}T00:00`
        break
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        fromDate = `${monthAgo.toISOString().split('T')[0]}T00:00`
        break
      case 'all':
        onClearFilter()
        setActiveFilterType('all')
        return
    }
    
    setActiveFilterType(type)
    onApplyFilter(fromDate, toDate)
  }
  
  // Aplicar filtro personalizado
  const applyCustomFilter = () => {
    if (!customFromDate && !customToDate) return
    
    const fromDateTime = customFromDate ? `${customFromDate}T${customFromTime}` : ''
    const toDateTime = customToDate ? `${customToDate}T${customToTime}` : ''
    
    setActiveFilterType('custom')
    onApplyFilter(fromDateTime, toDateTime)
    setShowCustomModal(false)
  }
  
  // Obtener label para el filtro personalizado
  const getCustomLabel = () => {
    if (activeFilterType !== 'custom') return ''
    const from = appliedFromDate ? new Date(appliedFromDate).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    const to = appliedToDate ? new Date(appliedToDate).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    return `${from}${from && to ? ' - ' : ''}${to}`
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-secondary-600">Mostrar:</label>
        
        {/* Select Dropdown */}
        <div className="relative">
          <select
            value={activeFilterType}
            onChange={(e) => handleSelectChange(e.target.value)}
            className="appearance-none bg-white border-2 border-secondary-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-secondary-700 cursor-pointer hover:border-primary-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all min-w-[180px]"
          >
            <option value="all">Todo</option>
            <option value="today">Hoy</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
            <option value="custom">Rango Personalizado</option>
          </select>
          
          {/* Flecha del dropdown */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {/* Indicador de rango personalizado */}
        {activeFilterType === 'custom' && isFilterActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span className="text-sm font-medium text-orange-700">{getCustomLabel()}</span>
            <button
              onClick={() => setShowCustomModal(true)}
              className="ml-1 text-orange-600 hover:text-orange-800 transition-colors"
              title="Editar fechas"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* Modal de Fecha Personalizada */}
      {showCustomModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📅</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Rango Personalizado</h3>
                    <p className="text-primary-100 text-sm">Selecciona las fechas del filtro</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Campo Desde */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-secondary-700 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-xs">▶</span>
                  Fecha de Inicio
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="flex-1 px-4 py-3 bg-secondary-50 border-2 border-secondary-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                  <input
                    type="time"
                    value={customFromTime}
                    onChange={(e) => setCustomFromTime(e.target.value)}
                    className="w-28 px-3 py-3 bg-secondary-50 border-2 border-secondary-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>
              
              {/* Separador visual */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-secondary-200"></div>
                <span className="text-secondary-400 text-sm">hasta</span>
                <div className="flex-1 h-px bg-secondary-200"></div>
              </div>
              
              {/* Campo Hasta */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-secondary-700 mb-2">
                  <span className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs">■</span>
                  Fecha de Fin
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="flex-1 px-4 py-3 bg-secondary-50 border-2 border-secondary-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                  <input
                    type="time"
                    value={customToTime}
                    onChange={(e) => setCustomToTime(e.target.value)}
                    className="w-28 px-3 py-3 bg-secondary-50 border-2 border-secondary-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-secondary-50 border-t border-secondary-200 flex gap-3">
              <button
                onClick={() => setShowCustomModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border-2 border-secondary-300 text-secondary-700 rounded-xl font-semibold text-sm hover:bg-secondary-100 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={applyCustomFilter}
                disabled={!customFromDate && !customToDate}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar Filtro
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

interface StudentProgress {
  id: number
  name: string
  coursesEnrolled: number
  testsCompleted: number
  averageScore: number
  lastActivity: string
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [testResults, setTestResults] = useState<any[]>([])
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([])
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  
  // Filtros aplicados (solo se actualizan al hacer click en Filtrar)
  const [appliedFromDate, setAppliedFromDate] = useState<string>('')
  const [appliedToDate, setAppliedToDate] = useState<string>('')
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [activeFilterType, setActiveFilterType] = useState<FilterType>('all')
  
  // Handlers para el filtro - memorizados para evitar re-renders
  const handleApplyFilter = (from: string, to: string) => {
    setAppliedFromDate(from)
    setAppliedToDate(to)
    setIsFilterActive(from !== '' || to !== '')
  }
  
  const handleClearFilter = () => {
    setAppliedFromDate('')
    setAppliedToDate('')
    setIsFilterActive(false)
    setActiveFilterType('all')
  }
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalCourses: 0,
    totalTests: 0,
    averageScore: 0,
    passRate: 0,
    avgModulesPerStudent: 0
  })

  useEffect(() => {
    loadAnalyticsData()
  }, [])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      
      // Cargar usuarios (solo estudiantes)
      const usersRes = await fetch('/api/users')
      const allUsers = await usersRes.json()
      const studentsList = allUsers.filter((u: any) => u.role === 'student')
      setStudents(studentsList)
      
      // Cargar cursos
      const coursesRes = await fetch('/api/courses')
      const coursesList = await coursesRes.json()
      setCourses(coursesList)
      
      // Cargar módulos
      const modulesRes = await fetch('/api/modules')
      const modulesList = await modulesRes.json()
      setModules(modulesList)
      
      // Cargar tests
      const testsRes = await fetch('/api/tests')
      const testsList = await testsRes.json()
      setTests(testsList)
      
      // Cargar resultados de tests
      const resultsRes = await fetch('/api/test-results')
      const resultsList = await resultsRes.json()
      setTestResults(resultsList)
      
      // Calcular estadísticas generales
      const activeStudents = studentsList.filter((s: any) => s.status === 'active').length
      const totalTests = resultsList.length
      const passedTests = resultsList.filter((r: any) => r.percentage >= 70).length
      const averageScore = totalTests > 0 
        ? Math.round(resultsList.reduce((acc: number, r: any) => acc + r.percentage, 0) / totalTests)
        : 0
      const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
      
      // Calcular promedio de módulos completados por alumno
      let totalModulesCompleted = 0
      studentsList.forEach((student: any) => {
        const studentResults = resultsList.filter((r: any) => r.userId === student.id && r.percentage >= 70)
        // Obtener módulos únicos completados por este estudiante
        const uniqueModules = new Set(studentResults.map((r: any) => r.moduleId))
        totalModulesCompleted += uniqueModules.size
      })
      const avgModulesPerStudent = studentsList.length > 0
        ? Math.round(totalModulesCompleted / studentsList.length)
        : 0
      
      setStats({
        totalStudents: studentsList.length,
        activeStudents,
        totalCourses: coursesList.length,
        totalTests: totalTests,
        averageScore,
        passRate,
        avgModulesPerStudent
      })
      
      // Calcular progreso por estudiante
      const progress = studentsList.map((student: any) => {
        const studentResults = resultsList.filter((r: any) => r.userId === student.id)
        
        // Obtener tests únicos completados
        const uniqueTests = new Set(studentResults.map((r: any) => r.testId))
        const testsCompleted = uniqueTests.size
        
        // Calcular promedio del último test de cada test único
        const lastTestScores: number[] = []
        uniqueTests.forEach((testId) => {
          const testAttempts = studentResults.filter((r: any) => r.testId === testId)
          if (testAttempts.length > 0) {
            // Obtener el último intento ordenado por fecha
            const lastAttempt = testAttempts.sort((a: any, b: any) => 
              new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
            )[0]
            lastTestScores.push(lastAttempt.percentage)
          }
        })
        
        const avgScore = lastTestScores.length > 0
          ? Math.round(lastTestScores.reduce((acc: number, score: number) => acc + score, 0) / lastTestScores.length)
          : 0
        
        // Última actividad
        const lastResult = studentResults.sort((a: any, b: any) => 
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        )[0]
        
        const lastActivity = lastResult 
          ? new Date(lastResult.completedAt).toLocaleDateString('es-ES')
          : 'Sin actividad'
        
        return {
          id: student.id,
          name: student.name || student.username,
          coursesEnrolled: coursesList.length,
          testsCompleted,
          averageScore: avgScore,
          lastActivity
        }
      })
      
      setStudentProgress(progress.sort((a: StudentProgress, b: StudentProgress) => b.averageScore - a.averageScore))
      
    } catch (error) {
      console.error('Error cargando analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      anime({
        targets: '.analytics-card',
        translateY: [30, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        duration: 600,
        easing: 'easeOutQuart'
      })
    }
  }, [loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 to-secondary-50">
        <AdminHeader />
        <div className="flex-grow p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-secondary-900 mb-2">
                Analytics Dashboard
              </h1>
              <p className="text-secondary-600">
                Métricas y rendimiento de los estudiantes
              </p>
            </div>

            {/* Stats Card - Hero Style */}
            <div className="analytics-card mb-8">
              <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-600 rounded-xl shadow-xl overflow-hidden">
                <div className="relative px-6 py-6">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-48 h-48 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full translate-x-1/3 translate-y-1/3"></div>
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    
                    <h2 className="text-white/90 text-base font-medium mb-2 tracking-wide uppercase">
                      Estudiantes Activos
                    </h2>
                    
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-6xl font-black text-white">
                        {stats.activeStudents}
                      </span>
                    </div>
                    
                    <p className="text-white/80 text-sm max-w-md mx-auto">
                      {stats.activeStudents === 1 
                        ? 'estudiante registrado y activo en la plataforma' 
                        : `estudiantes registrados y activos en la plataforma`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de Progreso de Estudiantes */}
            <div className="analytics-card card">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-secondary-900 mb-2">
                    Progreso por Estudiante
                  </h2>
                  <p className="text-secondary-600 text-sm">
                    Rendimiento y actividad de cada estudiante
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm('¿Estás seguro de que deseas eliminar todos los resultados de tests? Esta acción no se puede deshacer.')) {
                      try {
                        const response = await fetch('/api/test-results', {
                          method: 'DELETE',
                        })
                        
                        if (response.ok) {
                          alert('Todos los resultados han sido eliminados exitosamente')
                          loadAnalyticsData()
                        } else {
                          alert('Error al eliminar los resultados')
                        }
                      } catch (error) {
                        console.error('Error:', error)
                        alert('Error al eliminar los resultados')
                      }
                    }
                  }}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Resetear Todo
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-secondary-200">
                      <th className="text-left py-3 px-4 text-secondary-700 font-semibold text-sm">Estudiante</th>
                      <th className="text-center py-3 px-4 text-secondary-700 font-semibold text-sm">Tests Completados</th>
                      <th className="text-center py-3 px-4 text-secondary-700 font-semibold text-sm">Promedio</th>
                      <th className="text-center py-3 px-4 text-secondary-700 font-semibold text-sm">Última Actividad</th>
                      <th className="text-center py-3 px-4 text-secondary-700 font-semibold text-sm">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentProgress.length > 0 ? (
                      studentProgress.map((student) => (
                        <tr key={student.id} className="border-b border-secondary-100 hover:bg-secondary-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-600 font-semibold text-sm">
                                  {student.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-secondary-900">{student.name}</p>
                                <p className="text-xs text-secondary-500">ID: {student.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="text-secondary-900 font-medium">{student.testsCompleted}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                              student.averageScore >= 70 
                                ? 'bg-green-100 text-green-800' 
                                : student.averageScore >= 50
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {student.averageScore}%
                            </span>
                          </td>
                          <td className="text-center py-3 px-4 text-secondary-600 text-sm">
                            {student.lastActivity}
                          </td>
                          <td className="text-center py-3 px-4">
                            {student.testsCompleted > 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Sin actividad
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-secondary-500">
                          No hay datos de estudiantes disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dashboard de Tests por Estudiante */}
            <div className="analytics-card card mt-6">
              <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-secondary-900 mb-1">
                      Dashboard de Tests Recientes
                    </h2>
                    <p className="text-secondary-600 text-sm">
                      Últimos 10 tests realizados por cada estudiante (1 = más reciente)
                    </p>
                  </div>
                  
                  {/* Panel de Filtros - Componente separado para optimización */}
                  <DateFilter
                    onApplyFilter={handleApplyFilter}
                    onClearFilter={handleClearFilter}
                    isFilterActive={isFilterActive}
                    appliedFromDate={appliedFromDate}
                    appliedToDate={appliedToDate}
                    activeFilterType={activeFilterType}
                    setActiveFilterType={setActiveFilterType}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-max">
                  <thead>
                    <tr className="border-b-2 border-secondary-200">
                      <th className="text-left py-3 px-4 text-secondary-700 font-semibold text-sm sticky left-0 bg-white z-10 min-w-[180px]">
                        Estudiante
                      </th>
                      {/* Columnas del 1 al 10 */}
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <th key={num} className="text-center py-3 px-2 min-w-[100px]">
                          <span className="text-secondary-700 font-semibold text-sm">{num}</span>
                        </th>
                      ))}
                      <th className="text-center py-3 px-4 text-secondary-700 font-semibold text-sm min-w-[120px]">
                        Última Actividad
                      </th>
                      <th className="text-center py-3 px-4 text-secondary-700 font-semibold text-sm min-w-[100px]">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentProgress.length > 0 ? (
                      studentProgress.map((student) => {
                        // Obtener los últimos 10 resultados de este estudiante ordenados por fecha
                        // Aplicar filtros de fecha solo si están aplicados (no en vivo)
                        const studentResults = testResults
                          .filter((r: any) => {
                            if (r.userId !== student.id) return false
                            
                            // Solo filtrar si hay filtros aplicados
                            if (isFilterActive) {
                              const resultDate = new Date(r.completedAt)
                              
                              // Filtro Desde (usando valores aplicados)
                              if (appliedFromDate) {
                                const fromDate = new Date(appliedFromDate)
                                if (resultDate < fromDate) return false
                              }
                              
                              // Filtro Hasta (usando valores aplicados)
                              if (appliedToDate) {
                                const toDate = new Date(appliedToDate)
                                if (resultDate > toDate) return false
                              }
                            }
                            
                            return true
                          })
                          .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                          .slice(0, 10)
                        
                        return (
                          <tr key={student.id} className="border-b border-secondary-100 hover:bg-secondary-50 transition-colors">
                            <td className="py-3 px-4 sticky left-0 bg-white z-10">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-primary-600 font-semibold text-xs">
                                    {student.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-secondary-900 text-sm truncate max-w-[120px]" title={student.name}>
                                  {student.name}
                                </span>
                              </div>
                            </td>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => {
                              const result = studentResults[index]
                              
                              if (!result) {
                                return (
                                  <td key={index} className="text-center py-3 px-2">
                                    <span className="text-secondary-300 text-xs">—</span>
                                  </td>
                                )
                              }
                              
                              const percentage = result.percentage
                              const test = tests.find((t: any) => t.id === result.testId)
                              const testName = test?.title || `Test ${result.testId}`
                              
                              // Obtener módulo y curso desde el test
                              const module = modules.find((m: any) => m.id === test?.moduleId)
                              const moduleName = module?.title || 'Módulo'
                              const course = courses.find((c: any) => c.id === test?.courseId)
                              const courseName = course?.title || 'Curso'
                              
                              // Truncar nombre si es muy largo
                              const shortName = testName.length > 12 ? testName.substring(0, 10) + '...' : testName
                              
                              // ID único para el tooltip
                              const tooltipId = `${student.id}-${index}`
                              const isActive = activeTooltip === tooltipId
                              
                              return (
                                <td key={index} className="text-center py-2 px-2">
                                  <div 
                                    className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 transition-transform relative"
                                    onClick={() => setActiveTooltip(isActive ? null : tooltipId)}
                                    onMouseMove={() => activeTooltip === tooltipId && setActiveTooltip(null)}
                                  >
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                      percentage >= 70 
                                        ? 'bg-green-100 text-green-800' 
                                        : percentage >= 50
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {percentage}%
                                    </span>
                                    <span className="text-xs text-secondary-500 truncate max-w-[90px]">
                                      {shortName}
                                    </span>
                                  </div>
                                  
                                  {/* Tooltip personalizado - Modal centrado */}
                                  {isActive && (
                                    <div 
                                      className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-secondary-200 overflow-hidden animate-fadeIn pointer-events-none"
                                      style={{
                                        width: '300px',
                                        left: '50%',
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)'
                                      }}
                                    >
                                      {/* Header del tooltip */}
                                      <div className={`px-4 py-3 ${
                                        percentage >= 70 
                                          ? 'bg-gradient-to-r from-green-500 to-green-600' 
                                          : percentage >= 50
                                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                                          : 'bg-gradient-to-r from-red-500 to-red-600'
                                      }`}>
                                        <p className="text-white font-bold text-xl text-center">🎯 {percentage}%</p>
                                      </div>
                                      {/* Contenido */}
                                      <div className="p-4 space-y-3">
                                        <div className="flex items-start gap-3">
                                          <span className="text-xl">📚</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-secondary-500 font-medium uppercase tracking-wide">Curso</p>
                                            <p className="text-sm font-semibold text-secondary-900 break-words">{courseName}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                          <span className="text-xl">📁</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-secondary-500 font-medium uppercase tracking-wide">Módulo</p>
                                            <p className="text-sm font-semibold text-secondary-900 break-words">{moduleName}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                          <span className="text-xl">📝</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-secondary-500 font-medium uppercase tracking-wide">Test</p>
                                            <p className="text-sm font-semibold text-secondary-900 break-words">{testName}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-start gap-3 pt-2 border-t border-secondary-100 mt-2">
                                          <span className="text-xl">🕐</span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-secondary-500 font-medium uppercase tracking-wide">Completado</p>
                                            <p className="text-sm font-semibold text-secondary-900 break-words">
                                              {new Date(result.completedAt).toLocaleDateString('es-ES', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                              })} a las {new Date(result.completedAt).toLocaleTimeString('es-ES', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                            {/* Última Actividad */}
                            <td className="text-center py-3 px-4 text-secondary-600 text-sm">
                              {student.lastActivity}
                            </td>
                            {/* Estado */}
                            <td className="text-center py-3 px-4">
                              {student.testsCompleted > 0 ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Sin actividad
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={13} className="text-center py-12 text-secondary-500">
                          No hay datos de tests disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Avance por Curso */}
            <div className="analytics-card card mt-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-secondary-900 mb-2">
                  Rendimiento por Curso
                </h2>
                <p className="text-secondary-600 text-sm">
                  Estadísticas de cada curso disponible
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course) => {
                  // Obtener tests de este curso
                  const courseTests = tests.filter((t: any) => t.courseId === course.id)
                  
                  // Obtener IDs de tests del curso
                  const courseTestIds = courseTests.map((t: any) => t.id)
                  
                  // Filtrar resultados solo de tests de este curso
                  const courseResults = testResults.filter((r: any) => 
                    courseTestIds.includes(r.testId)
                  )
                  
                  const passedInCourse = courseResults.filter((r: any) => r.percentage >= 70).length
                  const avgInCourse = courseResults.length > 0
                    ? Math.round(courseResults.reduce((acc: number, r: any) => acc + r.percentage, 0) / courseResults.length)
                    : 0

                  return (
                    <div key={course.id} className="border border-secondary-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                      <h3 className="font-semibold text-secondary-900 mb-3">{course.title}</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-secondary-600">Tests disponibles:</span>
                          <span className="font-medium text-secondary-900">{courseTests.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-secondary-600">Tests realizados:</span>
                          <span className="font-medium text-secondary-900">{courseResults.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-secondary-600">Promedio:</span>
                          <span className={`font-medium ${avgInCourse >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
                            {avgInCourse}%
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-secondary-600">Aprobados:</span>
                          <span className="font-medium text-secondary-900">{passedInCourse}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
