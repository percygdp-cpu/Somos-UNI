'use client'

import AdminHeader from '@/components/AdminHeader'
import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import anime from 'animejs'
import { useEffect, useState } from 'react'

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
                <h2 className="text-xl font-bold text-secondary-900 mb-2">
                  Dashboard de Tests Recientes
                </h2>
                <p className="text-secondary-600 text-sm">
                  Últimos 10 tests realizados por cada estudiante (1 = más reciente)
                </p>
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
                        const studentResults = testResults
                          .filter((r: any) => r.userId === student.id)
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
