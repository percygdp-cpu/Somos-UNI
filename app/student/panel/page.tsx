'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import anime from 'animejs'
import { useEffect, useRef, useState } from 'react'

interface TestResult {
  id: number
  testId: number
  testTitle: string
  moduleTitle: string
  courseTitle: string
  score: number
  totalQuestions: number
  percentage: number
  completedAt: string
  approved: boolean
}

interface CourseProgress {
  courseId: number
  courseTitle: string
  totalModules: number
  completedModules: number
  totalTests: number
  completedTests: number
  averageScore: number
  progressPercentage: number
}

interface WeeklyGoal {
  id: number
  title: string
  weekNumber: number
  testIds: number[]
}

export default function PanelPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'panel' | 'cursos'>('panel')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [hasMoreTests, setHasMoreTests] = useState(false)
  const [totalTestResults, setTotalTestResults] = useState(0)
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([])
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([])
  const [allResults, setAllResults] = useState<any[]>([])
  const [testsPage, setTestsPage] = useState(1)
  const INITIAL_TESTS = 20
  const TESTS_PER_PAGE = 50
  const [stats, setStats] = useState({
    totalTests: 0,
    completedTests: 0,
    approvedTests: 0,
    averageScore: 0,
    totalCourses: 0,
    completedCourses: 0
  })
  
  // Refs para guardar datos necesarios al cargar más resultados
  const testsDataRef = useRef<any[]>([])
  const modulesDataRef = useRef<any[]>([])
  const coursesDataRef = useRef<any[]>([])
  const allProcessedResultsRef = useRef<TestResult[]>([])

  useEffect(() => {
    if (user?.id) {
      loadParentViewData()
    }
  }, [user])

  useEffect(() => {
    if (!loading) {
      anime({
        targets: '.animate-card',
        translateY: [20, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        duration: 500,
        easing: 'easeOutQuart'
      })
    }
  }, [loading, activeTab])

  // Función para cargar más resultados de tests (usa datos en memoria, sin queries adicionales)
  const loadMoreTests = () => {
    if (!hasMoreTests) return
    
    const currentCount = testResults.length
    const nextBatch = allProcessedResultsRef.current.slice(currentCount, currentCount + 50)
    
    setTestResults(prev => [...prev, ...nextBatch])
    
    // Verificar si hay más para mostrar
    const newTotal = currentCount + nextBatch.length
    setHasMoreTests(newTotal < allProcessedResultsRef.current.length)
  }

  const loadParentViewData = async () => {
    try {
      setLoading(true)
      
      // Cargar todos los datos en paralelo
      // Solo una query para test-results - usamos los primeros 50 para mostrar, el resto para estadísticas
      const [coursesRes, modulesRes, testsRes, resultsRes, goalsRes, assignmentsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/modules'),
        fetch('/api/tests'),
        fetch(`/api/test-results?userId=${user?.id}`),
        fetch('/api/weekly-goals'),
        fetch(`/api/goal-assignments?userId=${user?.id}`)
      ])
      
      const courses = coursesRes.ok ? await coursesRes.json() : []
      const modules = modulesRes.ok ? await modulesRes.json() : []
      const tests = testsRes.ok ? await testsRes.json() : []
      const results = resultsRes.ok ? await resultsRes.json() : []
      const allGoals = goalsRes.ok ? await goalsRes.json() : []
      const assignments = assignmentsRes.ok ? await assignmentsRes.json() : []

      setAllResults(results)
      setTotalTestResults(results.length)
      // Si hay más de 50 resultados, mostrar botón "Ver más"
      setHasMoreTests(results.length > 50)

      // Filtrar metas asignadas al usuario
      const assignedGoalIds = assignments.map((a: any) => a.weeklyGoalId)
      const userGoals = allGoals.filter((g: any) => assignedGoalIds.includes(g.id))
      setWeeklyGoals(userGoals)

      // Función auxiliar para procesar resultados
      const processResults = (resultsToProcess: any[]) => {
        return resultsToProcess.map((result: any) => {
          const test = tests.find((t: any) => t.id === result.testId)
          const module = modules.find((m: any) => m.id === test?.moduleId)
          const course = courses.find((c: any) => c.id === test?.courseId)
          
          return {
            id: result.id,
            testId: result.testId,
            testTitle: test?.title || 'Test',
            moduleTitle: module?.title || 'Módulo',
            courseTitle: course?.title || 'Curso',
            score: result.score,
            totalQuestions: result.totalQuestions,
            percentage: result.percentage,
            completedAt: result.completedAt,
            approved: result.percentage >= 70
          }
        })
      }

      // Procesar solo los primeros 50 resultados para la lista visual (ya vienen ordenados por fecha)
      const first50Results = results.slice(0, 50)
      const processedResults: TestResult[] = processResults(first50Results)
      
      setTestResults(processedResults)
      
      // Guardar todos los resultados procesados para "Ver más" sin hacer queries adicionales
      allProcessedResultsRef.current = processResults(results)
      
      // Guardar datos necesarios para referencia
      testsDataRef.current = tests
      modulesDataRef.current = modules
      coursesDataRef.current = courses

      // Calcular progreso por curso
      const courseProgressData: CourseProgress[] = courses.map((course: any) => {
        const courseModules = modules.filter((m: any) => m.courseId === course.id)
        const courseTests = tests.filter((t: any) => t.courseId === course.id)
        
        const latestTestResults = new Map()
        results.forEach((result: any) => {
          const test = courseTests.find((t: any) => t.id === result.testId)
          if (test) {
            const existing = latestTestResults.get(result.testId)
            if (!existing || new Date(result.completedAt) > new Date(existing.completedAt)) {
              latestTestResults.set(result.testId, result)
            }
          }
        })

        const latestResults = Array.from(latestTestResults.values())
        const approvedTests = latestResults.filter((r: any) => r.percentage >= 70).length
        
        const completedModules = courseModules.filter((module: any) => {
          const moduleTests = courseTests.filter((t: any) => t.moduleId === module.id)
          if (moduleTests.length === 0) return false
          return moduleTests.every((test: any) => {
            const result = latestTestResults.get(test.id)
            return result && result.percentage >= 70
          })
        }).length

        const avgScore = latestResults.length > 0 
          ? Math.round(latestResults.reduce((sum: number, r: any) => sum + r.percentage, 0) / latestResults.length)
          : 0

        return {
          courseId: course.id,
          courseTitle: course.title,
          totalModules: courseModules.length,
          completedModules,
          totalTests: courseTests.length,
          completedTests: approvedTests,
          averageScore: avgScore,
          progressPercentage: courseTests.length > 0 
            ? Math.round((approvedTests / courseTests.length) * 100) 
            : 0
        }
      })

      setCourseProgress(courseProgressData)

      // Calcular estadísticas generales
      const allLatestResults = new Map()
      results.forEach((result: any) => {
        const existing = allLatestResults.get(result.testId)
        if (!existing || new Date(result.completedAt) > new Date(existing.completedAt)) {
          allLatestResults.set(result.testId, result)
        }
      })

      const latestResultsArray = Array.from(allLatestResults.values())
      const approvedCount = latestResultsArray.filter((r: any) => r.percentage >= 70).length
      const avgScore = latestResultsArray.length > 0 
        ? Math.round(latestResultsArray.reduce((sum, r: any) => sum + r.percentage, 0) / latestResultsArray.length)
        : 0

      const completedCoursesCount = courseProgressData.filter(
        (c: CourseProgress) => c.totalTests > 0 && c.completedTests === c.totalTests
      ).length

      setStats({
        totalTests: tests.length,
        completedTests: latestResultsArray.length,
        approvedTests: approvedCount,
        averageScore: avgScore,
        totalCourses: courses.length,
        completedCourses: completedCoursesCount
      })

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calcular estadísticas de una meta
  const getGoalStats = (goal: WeeklyGoal) => {
    const completedTests = goal.testIds.filter(testId => {
      const result = allResults.find((r: any) => r.testId === testId && r.percentage >= 70)
      return !!result
    }).length
    const pendingTests = goal.testIds.length - completedTests
    const progressPercentage = goal.testIds.length > 0 
      ? Math.round((completedTests / goal.testIds.length) * 100) 
      : 0
    return { completedTests, pendingTests, total: goal.testIds.length, progressPercentage }
  }

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 70) return 'text-blue-600'
    return 'text-secondary-600'
  }

  const getScoreBg = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-100'
    if (percentage >= 70) return 'bg-blue-100'
    return 'bg-secondary-100'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-PE', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
        <StudentHeader />
        
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-secondary-900">Seguimiento Académico</h1>
            <p className="text-secondary-600 mt-1">Alumno: <span className="font-semibold">{user?.name || user?.username}</span></p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-secondary-200 mb-6">
            <button
              onClick={() => setActiveTab('panel')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'panel'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Panel
            </button>
            <button
              onClick={() => setActiveTab('cursos')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'cursos'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Cursos
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-secondary-600">Cargando información...</p>
            </div>
          ) : (
            <>
              {/* TAB: PANEL */}
              {activeTab === 'panel' && (
                <>
                  {/* Resumen General */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="animate-card bg-white rounded-xl shadow-sm p-4 border border-secondary-200 text-center">
                      <div className="text-3xl font-bold text-primary-600">{stats.averageScore}%</div>
                      <div className="text-sm text-secondary-600">Promedio General</div>
                    </div>
                    <div className="animate-card bg-white rounded-xl shadow-sm p-4 border border-secondary-200 text-center">
                      <div className="text-3xl font-bold text-green-600">{stats.approvedTests}</div>
                      <div className="text-sm text-secondary-600">Tests Aprobados</div>
                    </div>
                    <div className="animate-card bg-white rounded-xl shadow-sm p-4 border border-secondary-200 text-center">
                      <div className="text-3xl font-bold text-blue-600">{stats.completedTests}/{stats.totalTests}</div>
                      <div className="text-sm text-secondary-600">Tests Realizados</div>
                    </div>
                    <div className="animate-card bg-white rounded-xl shadow-sm p-4 border border-secondary-200 text-center">
                      <div className="text-3xl font-bold text-purple-600">{stats.completedCourses}/{stats.totalCourses}</div>
                      <div className="text-sm text-secondary-600">Cursos Completados</div>
                    </div>
                  </div>

                  {/* Tests Realizados */}
                  <div className="animate-card bg-white rounded-xl shadow-sm border border-secondary-200 p-4 sm:p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base sm:text-lg font-bold text-secondary-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Tests Realizados
                      </h2>
                      {testResults.length > 0 && (
                        <span className="text-xs sm:text-sm text-secondary-500">
                          {testResults.length} evaluación{testResults.length !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                    
                    {testResults.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-secondary-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-secondary-500 text-sm">Aún no se han realizado evaluaciones</p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <table className="w-full min-w-[700px]">
                            <thead className="bg-secondary-50 border-y border-secondary-200">
                              <tr>
                                <th className="px-2 py-1.5 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Evaluación</th>
                                <th className="px-2 py-1.5 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Curso / Módulo</th>
                                <th className="px-2 py-1.5 text-center text-xs font-semibold text-secondary-600 uppercase tracking-wider">Aciertos</th>
                                <th className="px-2 py-1.5 text-center text-xs font-semibold text-secondary-600 uppercase tracking-wider">Calif.</th>
                                <th className="px-2 py-1.5 text-right text-xs font-semibold text-secondary-600 uppercase tracking-wider">Fecha</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-100 bg-white">
                              {(() => {
                                const visibleCount = testsPage === 1 ? INITIAL_TESTS : INITIAL_TESTS + (testsPage - 1) * TESTS_PER_PAGE;
                                return testResults.slice(0, visibleCount).map((result, idx) => (
                                  <tr key={result.id} className={`hover:bg-secondary-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-secondary-25'}`}>
                                    <td className="px-2 py-1.5 text-sm font-medium text-secondary-900 whitespace-nowrap">{result.testTitle}</td>
                                    <td className="px-2 py-1.5 text-sm text-secondary-800 whitespace-nowrap">
                                      {result.courseTitle} <span className="text-secondary-400">/</span> <span className="text-secondary-600">{result.moduleTitle}</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                      <span className="text-sm font-medium text-secondary-700">{result.score}/{result.totalQuestions}</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                      <span className={`font-bold text-sm ${getScoreColor(result.percentage)}`}>
                                        {result.percentage}%
                                      </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-xs text-secondary-500 whitespace-nowrap">
                                      {formatDate(result.completedAt)}
                                    </td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Pagination */}
                        {(() => {
                          const visibleCount = testsPage === 1 ? INITIAL_TESTS : INITIAL_TESTS + (testsPage - 1) * TESTS_PER_PAGE;
                          const hasMore = testResults.length > visibleCount;
                          const totalPages = Math.ceil((testResults.length - INITIAL_TESTS) / TESTS_PER_PAGE) + 1;
                          
                          return (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-secondary-100">
                              <p className="text-xs text-secondary-500">
                                Mostrando {Math.min(visibleCount, testResults.length)} de {testResults.length} resultados
                              </p>
                              <div className="flex items-center gap-2">
                                {testsPage > 1 && (
                                  <button
                                    onClick={() => setTestsPage(1)}
                                    className="px-3 py-1.5 text-xs font-medium text-secondary-600 bg-secondary-100 hover:bg-secondary-200 rounded-md transition-colors"
                                  >
                                    ← Inicio
                                  </button>
                                )}
                                {hasMore && (
                                  <button
                                    onClick={() => setTestsPage(p => p + 1)}
                                    className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
                                  >
                                    Ver más ({TESTS_PER_PAGE})
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {/* Gráfica de Progreso por Curso */}
                  {courseProgress.length > 0 && (
                    <div className="animate-card bg-white rounded-xl shadow-sm border border-secondary-200 p-6 mb-6">
                      <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Progreso por Curso
                      </h2>
                      <div className="space-y-4">
                        {courseProgress.map((course, index) => {
                          const barColor = course.progressPercentage >= 70 
                            ? 'bg-gradient-to-r from-green-400 to-green-500' 
                            : course.progressPercentage >= 30 
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' 
                              : 'bg-gradient-to-r from-secondary-300 to-secondary-400'
                          
                          return (
                            <div key={course.courseId} className="relative">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-secondary-700 truncate max-w-[60%]">
                                  {course.courseTitle}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                    course.averageScore >= 70 ? 'bg-green-100 text-green-700' :
                                    course.averageScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                    course.averageScore > 0 ? 'bg-red-100 text-red-700' : 'bg-secondary-100 text-secondary-500'
                                  }`}>
                                    {course.averageScore > 0 ? `${course.averageScore}%` : 'N/A'}
                                  </span>
                                  <span className="text-sm font-bold text-secondary-900 w-12 text-right">
                                    {course.progressPercentage}%
                                  </span>
                                </div>
                              </div>
                              <div className="relative h-6 bg-secondary-100 rounded-lg overflow-hidden">
                                <div 
                                  className={`absolute top-0 left-0 h-full ${barColor} rounded-lg transition-all duration-500 shadow-sm`}
                                  style={{ 
                                    width: `${Math.max(course.progressPercentage, 2)}%`,
                                    animationDelay: `${index * 100}ms`
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-medium text-secondary-600">
                                    {course.completedModules}/{course.totalModules} módulos
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                    </div>
                  )}

                  {/* Progreso en las Metas */}
                  <div className="animate-card bg-white rounded-xl shadow-sm border border-secondary-200 p-6 mb-6">
                    <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Progreso en las Metas
                      {weeklyGoals.filter(g => getGoalStats(g).pendingTests > 0).length > 0 && (
                        <span className="bg-orange-100 text-orange-700 rounded-full px-2.5 py-0.5 text-xs font-bold ml-2">
                          {weeklyGoals.filter(g => getGoalStats(g).pendingTests > 0).length} pendientes
                        </span>
                      )}
                    </h2>
                    
                    {weeklyGoals.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-secondary-500">No hay metas asignadas</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {weeklyGoals.map((goal) => {
                          const goalStats = getGoalStats(goal)
                          const isCompleted = goalStats.pendingTests === 0 && goalStats.total > 0
                          
                          return (
                            <div 
                              key={goal.id} 
                              className={`border rounded-lg p-4 ${isCompleted ? 'border-green-200 bg-green-50' : 'border-secondary-200'}`}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  {isCompleted ? (
                                    <span className="text-green-600">✓</span>
                                  ) : (
                                    <span className="text-orange-500">○</span>
                                  )}
                                  <h3 className="font-medium text-secondary-900">{goal.title}</h3>
                                  <span className="text-xs text-secondary-500">Semana {goal.weekNumber}</span>
                                </div>
                                <span className={`text-sm font-medium ${isCompleted ? 'text-green-600' : 'text-secondary-600'}`}>
                                  {goalStats.completedTests}/{goalStats.total} tests
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-secondary-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${isCompleted ? 'bg-green-500' : 'bg-primary-500'}`}
                                    style={{ width: `${goalStats.progressPercentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-secondary-500 w-10 text-right">{goalStats.progressPercentage}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TAB: CURSOS */}
              {activeTab === 'cursos' && (
                <div className="animate-card bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
                  <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Progreso por Curso
                  </h2>
                  
                  {courseProgress.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-secondary-500">No hay cursos disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {courseProgress.map((course) => (
                        <div key={course.courseId} className="border border-secondary-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-secondary-900">{course.courseTitle}</h3>
                              <p className="text-sm text-secondary-600">
                                {course.completedModules}/{course.totalModules} módulos • {course.completedTests}/{course.totalTests} tests aprobados
                              </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBg(course.averageScore)} ${getScoreColor(course.averageScore)}`}>
                              {course.averageScore > 0 ? `${course.averageScore}%` : 'Sin intentos'}
                            </div>
                          </div>
                          <div className="w-full bg-secondary-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                course.progressPercentage >= 70 ? 'bg-green-500' : 
                                course.progressPercentage >= 30 ? 'bg-yellow-500' : 'bg-secondary-400'
                              }`}
                              style={{ width: `${course.progressPercentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-secondary-500 mt-1 text-right">{course.progressPercentage}% completado</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
}
