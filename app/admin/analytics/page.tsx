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
  const [testResults, setTestResults] = useState<any[]>([])
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([])
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalCourses: 0,
    totalTests: 0,
    averageScore: 0,
    passRate: 0,
    avgTestsPerStudent: 0
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
      
      // Calcular promedio de tests por alumno
      const avgTestsPerStudent = studentsList.length > 0
        ? Math.round(totalTests / studentsList.length)
        : 0
      
      setStats({
        totalStudents: studentsList.length,
        activeStudents,
        totalCourses: coursesList.length,
        totalTests: totalTests,
        averageScore,
        passRate,
        avgTestsPerStudent
      })
      
      // Calcular progreso por estudiante
      const progress = studentsList.map((student: any) => {
        const studentResults = resultsList.filter((r: any) => r.userId === student.id)
        
        // Obtener tests únicos completados
        const uniqueTests = new Set(studentResults.map((r: any) => r.testId))
        const testsCompleted = uniqueTests.size
        
        // Calcular promedio solo de tests aprobados
        const passedResults = studentResults.filter((r: any) => r.percentage >= 70)
        const avgScore = passedResults.length > 0
          ? Math.round(passedResults.reduce((acc: number, r: any) => acc + r.percentage, 0) / passedResults.length)
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="analytics-card card bg-white border border-gray-200">
                <div className="text-center py-6">
                  <p className="text-secondary-600 text-sm font-medium mb-2">Estudiantes Activos</p>
                  <p className="text-5xl font-bold text-secondary-900">{stats.activeStudents}</p>
                </div>
              </div>

              <div className="analytics-card card bg-white border border-gray-200">
                <div className="text-center py-6">
                  <p className="text-secondary-600 text-sm font-medium mb-2">Promedio General</p>
                  <p className="text-5xl font-bold text-secondary-900">{stats.averageScore}%</p>
                </div>
              </div>

              <div className="analytics-card card bg-white border border-gray-200">
                <div className="text-center py-6">
                  <p className="text-secondary-600 text-sm font-medium mb-2">Promedio Tests por Alumno</p>
                  <p className="text-5xl font-bold text-secondary-900">{stats.avgTestsPerStudent}</p>
                </div>
              </div>
            </div>

            {/* Tabla de Progreso de Estudiantes */}
            <div className="analytics-card card">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-secondary-900 mb-2">
                  Progreso por Estudiante
                </h2>
                <p className="text-secondary-600 text-sm">
                  Rendimiento y actividad de cada estudiante
                </p>
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
                  // Filtrar resultados solo de este curso
                  const courseResults = testResults.filter((r: any) => {
                    // Encontrar el test para obtener su courseId
                    return r.courseId === course.id
                  })
                  
                  const passedInCourse = courseResults.filter((r: any) => r.percentage >= 70).length
                  const avgInCourse = courseResults.length > 0
                    ? Math.round(courseResults.reduce((acc: number, r: any) => acc + r.percentage, 0) / courseResults.length)
                    : 0

                  return (
                    <div key={course.id} className="border border-secondary-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                      <h3 className="font-semibold text-secondary-900 mb-3">{course.title}</h3>
                      <div className="space-y-2">
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
