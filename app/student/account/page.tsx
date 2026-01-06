'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import anime from 'animejs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function StudentAccountPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<any[]>([])
  const [courseProgress, setCourseProgress] = useState<{ [key: number]: any }>({})
  const [progress, setProgress] = useState({
    coursesEnrolled: 0,
    coursesCompleted: 0,
    testsCompleted: 0,
    averageScore: 0,
    totalTests: 0,
    approvedTests: 0,
    modulesTotal: 0,
    modulesCompleted: 0
  })

  useEffect(() => {
    loadAccountData()
  }, [user])

  const loadAccountData = async () => {
    try {
      // Cargar cursos
      const coursesRes = await fetch('/api/courses')
      if (!coursesRes.ok) return
      const coursesData = await coursesRes.json()
      setCourses(coursesData)
      
      // Cargar módulos
      const modulesRes = await fetch('/api/modules')
      if (!modulesRes.ok) return
      const allModules = await modulesRes.json()
      
      // Cargar todos los tests
      const testsRes = await fetch('/api/tests')
      if (!testsRes.ok) return
      const allTests = await testsRes.json()
      
      // Cargar resultados del usuario
      if (user?.id) {
        const resultsRes = await fetch(`/api/test-results?userId=${user.id}`)
        if (!resultsRes.ok) return
        const results = await resultsRes.json()
        
        // Calcular progreso por curso
        const progressMap: { [key: number]: any } = {}
        coursesData.forEach((course: any) => {
          const courseTests = allTests.filter((t: any) => t.courseId === course.id)
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
        
        // Calcular estadísticas - contar tests únicos con última nota aprobada
        const uniqueTestsApproved = new Set()
        allTests.forEach((test: any) => {
          const latestResult = results
            .filter((r: any) => r.testId === test.id)
            .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
          
          if (latestResult && latestResult.percentage >= 70) {
            uniqueTestsApproved.add(test.id)
          }
        })
        
        // Calcular promedio solo de tests realizados (último intento de cada test)
        const testScores = new Map()
        results.forEach((result: any) => {
          const existing = testScores.get(result.testId)
          if (!existing || new Date(result.completedAt) > new Date(existing.completedAt)) {
            testScores.set(result.testId, result)
          }
        })
        
        const latestResults = Array.from(testScores.values())
        const avgScore = latestResults.length > 0
          ? Math.round(latestResults.reduce((acc: number, r: any) => acc + r.percentage, 0) / latestResults.length)
          : 0
        
        // Contar cursos completados (todos los tests aprobados)
        let completedCourses = 0
        coursesData.forEach((course: any) => {
          const prog = progressMap[course.id]
          if (prog && prog.percentage === 100 && prog.total > 0) {
            completedCourses++
          }
        })
        
        // Contar módulos completados (todos los tests del módulo aprobados)
        let completedModules = 0
        allModules.forEach((module: any) => {
          const moduleTests = allTests.filter((t: any) => t.moduleId === module.id)
          if (moduleTests.length === 0) return
          
          let allTestsApproved = true
          moduleTests.forEach((test: any) => {
            const latestResult = results
              .filter((r: any) => r.testId === test.id)
              .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
            
            if (!latestResult || latestResult.percentage < 70) {
              allTestsApproved = false
            }
          })
          
          if (allTestsApproved) {
            completedModules++
          }
        })
        
        setProgress({
          coursesEnrolled: coursesData.length,
          coursesCompleted: completedCourses,
          testsCompleted: results.length,
          averageScore: avgScore,
          totalTests: allTests.length,
          approvedTests: uniqueTestsApproved.size,
          modulesTotal: allModules.length,
          modulesCompleted: completedModules
        })
      }
    } catch (error) {
      console.error('Error cargando datos de cuenta:', error)
    }
  }

  useEffect(() => {
    anime({
      targets: '.account-card',
      translateY: [30, 0],
      opacity: [0, 1],
      delay: anime.stagger(150),
      duration: 600,
      easing: 'easeOutQuart'
    })
  }, [])

  // Progreso basado en tests aprobados sobre total de tests
  const progressPercentage = progress.totalTests > 0 
    ? Math.round((progress.approvedTests / progress.totalTests) * 100) 
    : 0

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 to-secondary-50">
        <StudentHeader />
        <div className="flex-grow p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-4xl font-bold text-secondary-900 mb-2">
                Mi Cuenta
              </h1>
              <p className="text-secondary-600 text-base sm:text-lg">
                Información personal y progreso académico
              </p>
            </div>

            {/* Información Personal */}
            <div className="account-card bg-white rounded-xl shadow-lg border border-secondary-200 p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-3xl sm:text-4xl font-bold">
                    {user?.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                
                <div className="flex-1 w-full text-center sm:text-left">
                  <h2 className="text-xl sm:text-2xl font-bold text-secondary-900 mb-4">
                    Información Personal
                  </h2>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 justify-center sm:justify-start">
                      <div>
                        <p className="text-xs text-secondary-500 uppercase tracking-wide">Nombre de Usuario</p>
                        <p className="text-lg font-semibold text-secondary-900">{user?.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-center sm:justify-start">
                      <div className="min-w-0">
                        <p className="text-xs text-secondary-500 uppercase tracking-wide">Correo Electrónico</p>
                        <p className="text-base sm:text-lg font-semibold text-secondary-900 break-all">{user?.username}@lmsplatform.com</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-center sm:justify-start">
                      <div>
                        <p className="text-xs text-secondary-500 uppercase tracking-wide">Rol</p>
                        <p className="text-base sm:text-lg font-semibold text-secondary-900">Estudiante</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-center sm:justify-start">
                      <div>
                        <p className="text-xs text-secondary-500 uppercase tracking-wide">Miembro Desde</p>
                        <p className="text-base sm:text-lg font-semibold text-secondary-900">
                          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Progreso General */}
            <div className="account-card bg-white rounded-xl shadow-lg border border-secondary-200 p-4 sm:p-6 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-secondary-900 mb-4 sm:mb-6">
                Progreso General
              </h2>

              {/* Barra de Progreso Principal */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-secondary-700">Progreso Total</span>
                  <span className="text-sm font-bold text-primary-600">{progressPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Estadísticas en Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-blue-50 rounded-lg p-3 sm:p-4 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
                    {progress.coursesCompleted} / {progress.coursesEnrolled}
                  </div>
                  <div className="text-xs text-secondary-600">Cursos Completados</div>
                </div>

                <div className="bg-green-50 rounded-lg p-3 sm:p-4 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
                    {progress.modulesCompleted} / {progress.modulesTotal}
                  </div>
                  <div className="text-xs text-secondary-600">Módulos Completados</div>
                </div>

                <div className="bg-orange-50 rounded-lg p-3 sm:p-4 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-orange-600 mb-1">
                    {progress.averageScore}%
                  </div>
                  <div className="text-xs text-secondary-600">Promedio General</div>
                </div>
              </div>
            </div>

            {/* Cursos en Progreso */}
            <div className="account-card bg-white rounded-xl shadow-lg border border-secondary-200 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-secondary-900 mb-4 sm:mb-6">
                Cursos en Progreso
              </h2>

              <div className="space-y-4">
                {courses.slice(0, 3).map((course) => {
                  const prog = courseProgress[course.id] || { completed: 0, total: 0, percentage: 0 }
                  
                  return (
                    <div
                      key={course.id}
                      className="border border-secondary-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push(`/student/courses/${course.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-secondary-900">{course.title}</h3>
                        <span className="text-sm text-primary-600 font-medium">
                          {prog.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${prog.percentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-secondary-600">
                        {prog.completed} de {prog.total} tests completados
                      </p>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => router.push('/student/courses')}
                className="mt-6 w-full btn-primary"
              >
                Ver Todos los Cursos
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
