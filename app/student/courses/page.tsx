// @ts-nocheck
'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import { Course } from '@/types'
import anime from 'animejs'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

interface WeeklyGoal {
  id: number
  weekNumber: number
  title: string
  startDate: string
  endDate: string
  testIds: number[]
}

interface TestResult {
  testId: number
  percentage: number
  completedAt: string
}

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [courseProgress, setCourseProgress] = useState<{ [key: number]: any }>({})
  const [loading, setLoading] = useState(true)
  const [loadingGoals, setLoadingGoals] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([])
  const [allTests, setAllTests] = useState<any[]>([])
  const [allModules, setAllModules] = useState<any[]>([])
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null)
  const { user, logout } = useAuth()
  const router = useRouter()

  // Cargar cursos y metas semanales de forma independiente
  useEffect(() => {
    loadCourses()
  }, [])

  useEffect(() => {
    if (user?.id) {
      loadWeeklyGoals()
    }
  }, [user?.id])

  // Cargar cursos y su progreso
  const loadCourses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/courses')
      if (response.ok) {
        const data = await response.json()
        setCourses(data)
        
        // Cargar progreso para cada curso
        if (user?.id) {
          await loadCourseProgress(data)
        }
      }
    } catch (error) {
      console.error('Error cargando cursos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Cargar progreso de cursos (módulos, tests, resultados)
  const loadCourseProgress = async (coursesData: Course[]) => {
    try {
      const [modulesRes, testsRes, resultsRes] = await Promise.all([
        fetch('/api/modules'),
        fetch('/api/tests'),
        fetch(`/api/test-results?userId=${user?.id}`)
      ])
      
      const modules = modulesRes.ok ? await modulesRes.json() : []
      const tests = testsRes.ok ? await testsRes.json() : []
      const results = resultsRes.ok ? await resultsRes.json() : []
      
      // Guardar para uso general
      setAllModules(modules)
      setAllTests(tests)
      setTestResults(results)
      
      const progressMap: { [key: number]: any } = {}
      
      coursesData.forEach(course => {
        const courseModules = modules.filter((m: any) => m.courseId === course.id)
        const courseTests = tests.filter((t: any) => t.courseId === course.id)
        
        let completedTests = 0
        courseTests.forEach((test: any) => {
          const latestResult = results
            .filter((r: any) => r.testId === test.id)
            .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
          
          if (latestResult && latestResult.percentage >= 70) {
            completedTests++
          }
        })
        
        progressMap[course.id] = {
          completed: completedTests,
          total: courseTests.length,
          percentage: courseTests.length > 0 ? Math.round((completedTests / courseTests.length) * 100) : 0
        }
      })
      
      setCourseProgress(progressMap)
    } catch (error) {
      console.error('Error cargando progreso de cursos:', error)
    }
  }

  // Cargar metas semanales de forma independiente
  const loadWeeklyGoals = async () => {
    try {
      setLoadingGoals(true)
      
      const [goalsRes, assignmentsRes, testsRes, modulesRes, resultsRes] = await Promise.all([
        fetch('/api/weekly-goals'),
        fetch(`/api/goal-assignments?userId=${user?.id}`),
        fetch('/api/tests'),
        fetch('/api/modules'),
        fetch(`/api/test-results?userId=${user?.id}`)
      ])
      
      const allGoals = goalsRes.ok ? await goalsRes.json() : []
      const assignments = assignmentsRes.ok ? await assignmentsRes.json() : []
      const tests = testsRes.ok ? await testsRes.json() : []
      const modules = modulesRes.ok ? await modulesRes.json() : []
      const results = resultsRes.ok ? await resultsRes.json() : []
      
      // Actualizar datos de tests/modules/results si aún no están cargados
      if (allTests.length === 0) setAllTests(tests)
      if (allModules.length === 0) setAllModules(modules)
      if (testResults.length === 0) setTestResults(results)
      
      // Filtrar metas asignadas al usuario
      if (assignments.length > 0 && allGoals.length > 0) {
        const assignedGoalIds = assignments.map((a: any) => a.weeklyGoalId)
        const userGoals = allGoals.filter((g: any) => assignedGoalIds.includes(g.id))
        setWeeklyGoals(userGoals)
      } else {
        setWeeklyGoals([])
      }
    } catch (error) {
      console.error('Error cargando metas semanales:', error)
      setWeeklyGoals([])
    } finally {
      setLoadingGoals(false)
    }
  }

  useEffect(() => {
    if (!loading && courses.length > 0) {
      // Animar tarjetas de cursos
      anime({
        targets: '.course-card',
        translateY: [20, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        duration: 600,
        easing: 'easeOutQuart'
      })
      
      // Animar barras de progreso
      setTimeout(() => {
        courses.forEach((course, index) => {
          const progress = courseProgress[course.id]
          if (progress && progress.total > 0) {
            anime({
              targets: `.progress-bar-${course.id}`,
              width: ['0%', `${progress.percentage}%`],
              duration: 1000,
              delay: index * 150,
              easing: 'easeOutQuart'
            })
          }
        })
      }, 400)
    }
  }, [loading, courses, courseProgress])

  const handleCourseClick = (courseId: string) => {
    router.push(`/student/courses/${courseId}`)
  }

  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Funciones para metas semanales
  const getTestResultForGoal = (testId: number) => {
    const results = testResults
      .filter((r: any) => r.testId === testId)
      .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    return results[0] || null
  }

  const getGoalStats = (goal: WeeklyGoal) => {
    const completedTests = goal.testIds.filter(testId => {
      const result = getTestResultForGoal(testId)
      return result && result.percentage >= 70
    }).length
    const pendingTests = goal.testIds.length - completedTests
    return { completedTests, pendingTests, total: goal.testIds.length }
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
    return `${start.toLocaleDateString('es-PE', options)} - ${end.toLocaleDateString('es-PE', options)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 to-secondary-50">
        <StudentHeader />

        {/* Main Content */}
        <main className="container mx-auto flex-grow p-4 md:p-6 lg:p-8">
          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <label className="sr-only" htmlFor="search-courses">
                Buscar cursos...
              </label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-secondary-500">
                <span className="text-xl">🔍</span>
              </div>
              <input
                className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-12 pr-4 text-base placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 outline-none"
                id="search-courses"
                placeholder="Buscar cursos..."
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Categorías - Oculto temporalmente */}
            {false && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-secondary-600 mr-2">
                  Categorías:
                </span>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`flex h-8 shrink-0 items-center justify-center gap-x-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-secondary-900 hover:bg-gray-300'
                  }`}
                >
                  <span>Todos</span>
                </button>
                <button
                  onClick={() => setSelectedCategory('development')}
                  className={`flex h-8 shrink-0 items-center justify-center gap-x-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                    selectedCategory === 'development'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-secondary-900 hover:bg-gray-300'
                  }`}
                >
                  <span>Desarrollo</span>
                </button>
                <button
                  onClick={() => setSelectedCategory('design')}
                  className={`flex h-8 shrink-0 items-center justify-center gap-x-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                    selectedCategory === 'design'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-secondary-900 hover:bg-gray-300'
                  }`}
                >
                  <span>Diseño</span>
                </button>
              </div>
            )}
          </div>

          {/* Sección de Metas Semanales - Vista responsive */}
          {loadingGoals ? (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-secondary-900">Metas Semanales</h2>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-4 bg-secondary-200 rounded w-1/3 mb-4"></div>
                <div className="h-3 bg-secondary-100 rounded w-full mb-2"></div>
                <div className="h-3 bg-secondary-100 rounded w-2/3"></div>
              </div>
            </div>
          ) : weeklyGoals.length > 0 && (
            <div className="mb-8">
              {/* Header con título y contador de tests pendientes */}
              {(() => {
                const totalPending = weeklyGoals.reduce((acc, goal) => {
                  const stats = getGoalStats(goal)
                  return acc + stats.pendingTests
                }, 0)
                return (
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-bold text-secondary-900">Metas Semanales</h2>
                    {totalPending > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                        {totalPending} test{totalPending !== 1 ? 's' : ''} pendiente{totalPending !== 1 ? 's' : ''}
                      </span>
                    )}
                    {totalPending === 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        Completado
                      </span>
                    )}
                  </div>
                )
              })()}
              
              {/* Vista móvil - Cards apiladas */}
              <div className="md:hidden space-y-4">
                {weeklyGoals
                  .sort((a, b) => a.weekNumber - b.weekNumber)
                  .map((goal) => {
                    const stats = getGoalStats(goal)
                    const isExpanded = expandedGoal === goal.id
                    
                    return (
                      <div key={goal.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                        {/* Header de la meta */}
                        <div 
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                                S{goal.weekNumber}
                              </span>
                              <div>
                                <h3 className="font-semibold text-secondary-900">{goal.title}</h3>
                                <p className="text-xs text-secondary-500">{formatDateRange(goal.startDate, goal.endDate)}</p>
                              </div>
                            </div>
                            <svg className={`w-5 h-5 text-secondary-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          
                          {/* Barra de progreso */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-secondary-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${stats.pendingTests === 0 ? 'bg-green-500' : 'bg-primary-500'}`}
                                style={{ width: `${stats.totalTests > 0 ? ((stats.totalTests - stats.pendingTests) / stats.totalTests) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-secondary-700">
                              {stats.totalTests - stats.pendingTests}/{stats.totalTests}
                            </span>
                          </div>
                        </div>
                        
                        {/* Contenido expandido */}
                        {isExpanded && (
                          <div className="border-t border-secondary-100">
                            {(() => {
                              const moduleGroups: { [key: number]: { module: any, tests: any[] } } = {}
                              
                              goal.testIds.forEach(testId => {
                                const test = allTests.find((t: any) => t.id === testId)
                                if (test) {
                                  const moduleId = test.moduleId
                                  if (!moduleGroups[moduleId]) {
                                    const module = allModules.find((m: any) => m.id === moduleId)
                                    moduleGroups[moduleId] = { module, tests: [] }
                                  }
                                  moduleGroups[moduleId].tests.push(test)
                                }
                              })
                              
                              return Object.values(moduleGroups).map(({ module, tests }) => {
                                const moduleTestsCompleted = tests.filter(t => {
                                  const result = getTestResultForGoal(t.id)
                                  return result && result.percentage >= 70
                                }).length
                                
                                return (
                                  <div key={module?.id || 'unknown'}>
                                    {/* Header del módulo */}
                                    <div 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (module?.courseId) router.push(`/student/courses/${module.courseId}/modules/${module.id}`)
                                      }}
                                      className="px-4 py-2 bg-secondary-50 flex items-center justify-between cursor-pointer hover:bg-secondary-100"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-secondary-600">{moduleTestsCompleted}/{tests.length}</span>
                                        <span className="text-sm font-medium text-secondary-800">{module?.title || 'Módulo'}</span>
                                      </div>
                                      <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                    
                                    {/* Tests */}
                                    <div className="divide-y divide-secondary-50">
                                      {tests.map(test => {
                                        const result = getTestResultForGoal(test.id)
                                        const isCompleted = result && result.percentage >= 70
                                        
                                        return (
                                          <div 
                                            key={test.id}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              router.push(`/student/courses/${test.courseId}/modules/${test.moduleId}/tests/${test.id}`)
                                            }}
                                            className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-primary-50 active:bg-primary-100"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                isCompleted ? 'bg-green-100' : 'bg-secondary-100'
                                              }`}>
                                                {isCompleted ? (
                                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                  </svg>
                                                ) : (
                                                  <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                  </svg>
                                                )}
                                              </div>
                                              <span className="text-sm text-secondary-900">{test.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {result ? (
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                  result.percentage >= 70 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : result.percentage >= 50
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                  {result.percentage}%
                                                </span>
                                              ) : (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-600">
                                                  Iniciar
                                                </span>
                                              )}
                                              <svg className="w-4 h-4 text-secondary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                              </svg>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
              
              {/* Vista desktop - Tabla con tests como columnas */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  {(() => {
                    // Obtener todos los tests únicos de todas las metas para las columnas
                    const allTestIds = [...new Set(weeklyGoals.flatMap(g => g.testIds))]
                    const testsForColumns = allTestIds.map(testId => {
                      const test = allTests.find((t: any) => t.id === testId)
                      return test || { id: testId, title: `Test ${testId}` }
                    })
                    
                    return (
                      <table className="w-full">
                        <thead>
                          <tr className="bg-secondary-50 border-b border-secondary-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-700 sticky left-0 bg-secondary-50 min-w-[180px]">
                              Meta Semanal
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-secondary-700 min-w-[140px]">
                              Período
                            </th>
                            {testsForColumns.map((test: any) => (
                              <th key={test.id} className="text-center py-3 px-3 text-xs font-semibold text-secondary-700 min-w-[100px]">
                                <div className="truncate max-w-[100px]" title={test.title}>
                                  {test.title}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {weeklyGoals
                            .sort((a, b) => a.weekNumber - b.weekNumber)
                            .map((goal) => {
                              const stats = getGoalStats(goal)
                              const isExpanded = expandedGoal === goal.id
                              
                              return (
                                <React.Fragment key={goal.id}>
                                  <tr 
                                    className="border-b border-secondary-100 hover:bg-secondary-50 transition-colors cursor-pointer"
                                    onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                                  >
                                    {/* Meta semanal */}
                                    <td className="py-3 px-4 sticky left-0 bg-white">
                                      <div className="flex items-center gap-2">
                                        <svg className={`w-4 h-4 text-primary-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        <div>
                                          <span className="font-medium text-secondary-900 text-sm">Semana {goal.weekNumber}</span>
                                          {stats.pendingTests > 0 ? (
                                            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                              {stats.pendingTests} pendiente{stats.pendingTests > 1 ? 's' : ''}
                                            </span>
                                          ) : (
                                            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                              Completado
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    
                                    {/* Período */}
                                    <td className="py-3 px-4 text-sm text-secondary-600">
                                      {formatDateRange(goal.startDate, goal.endDate)}
                                    </td>
                                    
                                    {/* Celdas de cada test */}
                                    {testsForColumns.map((test: any) => {
                                      const isInGoal = goal.testIds.includes(test.id)
                                      if (!isInGoal) {
                                        return (
                                          <td key={test.id} className="py-3 px-3 text-center">
                                            <span className="text-secondary-300">-</span>
                                          </td>
                                        )
                                      }
                                      
                                      const result = getTestResultForGoal(test.id)
                                      
                                      return (
                                        <td key={test.id} className="py-3 px-3 text-center">
                                          {result ? (
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                              result.percentage >= 70 
                                                ? 'bg-green-100 text-green-800' 
                                                : result.percentage >= 50
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                              {result.percentage}%
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary-100 text-secondary-500">
                                              No realizado
                                            </span>
                                          )}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                  
                                  {/* Detalle expandido - Módulos de la meta */}
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={2 + testsForColumns.length} className="bg-primary-50 p-0">
                                        <div className="p-4 border-l-4 border-primary-500">
                                          <h4 className="font-semibold text-secondary-900 mb-3 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                            </svg>
                                            Detalle de {goal.title}
                                          </h4>
                                          
                                          {/* Agrupar tests por módulo */}
                                          {(() => {
                                            const moduleGroups: { [key: number]: { module: any, tests: any[] } } = {}
                                            
                                            goal.testIds.forEach(testId => {
                                              const test = allTests.find((t: any) => t.id === testId)
                                              if (test) {
                                                const moduleId = test.moduleId
                                                if (!moduleGroups[moduleId]) {
                                                  const module = allModules.find((m: any) => m.id === moduleId)
                                                  moduleGroups[moduleId] = { module, tests: [] }
                                                }
                                                moduleGroups[moduleId].tests.push(test)
                                              }
                                            })
                                            
                                            return (
                                              <div className="space-y-4">
                                                {Object.values(moduleGroups).map(({ module, tests }) => {
                                                  const moduleTestsCompleted = tests.filter(t => {
                                                    const result = getTestResultForGoal(t.id)
                                                    return result && result.percentage >= 70
                                                  }).length
                                                  const isModuleComplete = moduleTestsCompleted === tests.length
                                                  
                                                  return (
                                                    <div key={module?.id || 'unknown'} className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
                                                      {/* Header del módulo - Clickeable */}
                                                      <div 
                                                        onClick={() => module?.courseId && router.push(`/student/courses/${module.courseId}/modules/${module.id}`)}
                                                        className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity ${isModuleComplete ? 'bg-green-50' : 'bg-secondary-50'}`}
                                                      >
                                                        <div className="flex items-center gap-3">
                                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isModuleComplete ? 'bg-green-500' : 'bg-secondary-300'}`}>
                                                            {isModuleComplete ? (
                                                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                              </svg>
                                                            ) : (
                                                              <span className="text-white text-sm font-bold">{moduleTestsCompleted}/{tests.length}</span>
                                                            )}
                                                          </div>
                                                          <div>
                                                            <h5 className="font-medium text-secondary-900">{module?.title || 'Módulo'}</h5>
                                                            <p className="text-xs text-secondary-500">
                                                              {moduleTestsCompleted} de {tests.length} tests completados
                                                            </p>
                                                          </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                            isModuleComplete 
                                                              ? 'bg-green-100 text-green-700' 
                                                              : 'bg-orange-100 text-orange-700'
                                                          }`}>
                                                            {isModuleComplete ? 'Completado' : 'Pendiente'}
                                                          </span>
                                                          <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                          </svg>
                                                        </div>
                                                      </div>
                                                      
                                                      {/* Tests del módulo */}
                                                      <div className="divide-y divide-secondary-100">
                                                        {tests.map(test => {
                                                          const result = getTestResultForGoal(test.id)
                                                          const isCompleted = result && result.percentage >= 70
                                                          
                                                          return (
                                                            <div 
                                                              key={test.id} 
                                                              onClick={() => router.push(`/student/courses/${test.courseId}/modules/${test.moduleId}/tests/${test.id}`)}
                                                              className="px-4 py-3 flex items-center justify-between hover:bg-primary-50 cursor-pointer transition-colors group"
                                                            >
                                                              <div className="flex items-center gap-3">
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                                                  isCompleted ? 'bg-green-100' : 'bg-secondary-100 group-hover:bg-primary-100'
                                                                }`}>
                                                                  {isCompleted ? (
                                                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                  ) : (
                                                                    <svg className="w-4 h-4 text-secondary-400 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                  )}
                                                                </div>
                                                                <span className="text-sm text-secondary-900 group-hover:text-primary-700">{test.title}</span>
                                                              </div>
                                                              <div className="flex items-center gap-2">
                                                                {result ? (
                                                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                                                                    result.percentage >= 70 
                                                                      ? 'bg-green-100 text-green-800' 
                                                                      : result.percentage >= 50
                                                                      ? 'bg-yellow-100 text-yellow-800'
                                                                      : 'bg-red-100 text-red-800'
                                                                  }`}>
                                                                    {result.percentage}%
                                                                  </span>
                                                                ) : (
                                                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-secondary-100 text-secondary-500 group-hover:bg-primary-100 group-hover:text-primary-600">
                                                                    Iniciar
                                                                  </span>
                                                                )}
                                                                <svg className="w-4 h-4 text-secondary-300 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                </svg>
                                                              </div>
                                                            </div>
                                                          )
                                                        })}
                                                      </div>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )
                                          })()}
                                          
                                          {goal.testIds.length === 0 && (
                                            <p className="text-sm text-secondary-500 text-center py-4">
                                              No hay tests asignados a esta meta
                                            </p>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              )
                            })}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Course List */}
          <div className="flex flex-col space-y-3">
            {filteredCourses.map((course) => {
              const progress = courseProgress[course.id] || { completed: 0, total: 0, percentage: 0 }
              const hasStarted = progress.completed > 0
              
              return (
                <div
                  key={course.id}
                  className="course-card flex flex-col rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-lg cursor-pointer"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {hasStarted && (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            En Progreso
                          </span>
                        )}
                        {progress.percentage === 100 && (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Completado
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold leading-tight tracking-tight text-secondary-900 mb-1">
                        {course.title}
                      </h3>
                      <p className="text-xs text-secondary-600 mb-2">
                        {progress.completed} de {progress.total} tests completados
                      </p>
                      <p className="text-sm text-secondary-600 line-clamp-2">
                        {course.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button className={`flex w-32 shrink-0 items-center justify-center rounded-lg h-9 px-4 text-sm font-medium leading-normal transition-colors ${
                        hasStarted 
                          ? 'bg-primary-600 text-white hover:bg-primary-700' 
                          : 'bg-white border-2 border-primary-600 text-primary-600 hover:bg-primary-50'
                      }`}>
                        <span className="truncate">
                          {hasStarted ? 'Continuar' : 'Comenzar'}
                        </span>
                      </button>
                      {hasStarted && (
                        <span className="text-xs font-semibold text-secondary-600">
                          {progress.percentage}% Completado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {progress.total > 0 && (
                    <div className="mt-3 w-full">
                      <div className="mb-1 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`progress-bar-${course.id} h-1.5 rounded-full ${
                            progress.percentage === 100 ? 'bg-green-500' : 'bg-primary-600'
                          }`}
                          style={{ width: '0%' }}
                        ></div>
                      </div>
                      <p className="text-xs text-secondary-600">{progress.percentage}% Completado</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filteredCourses.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                No se encontraron cursos
              </h3>
              <p className="text-secondary-600">
                Intenta con otros términos de búsqueda.
              </p>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
}
