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
        
        const avgScore = results.length > 0
          ? Math.round(results.reduce((acc: number, r: any) => acc + r.percentage, 0) / results.length)
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
        <div className="flex-grow p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-secondary-900 mb-2">
                Mi Cuenta
              </h1>
              <p className="text-secondary-600 text-lg">
                Información personal y progreso académico
              </p>
            </div>

            {/* Información Personal */}
            <div className="account-card bg-white rounded-xl shadow-lg border border-secondary-200 p-6 mb-6">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-4xl font-bold">
                    {user?.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-secondary-900 mb-4">
                    Información Personal
                  </h2>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-secondary-500 uppercase tracking-wide">Nombre de Usuario</p>
                        <p className="text-lg font-semibold text-secondary-900">{user?.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-secondary-500 uppercase tracking-wide">Correo Electrónico</p>
                        <p className="text-lg font-semibold text-secondary-900">{user?.username}@lmsplatform.com</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-purple-600 text-xl">🎓</span>
                      </div>
                      <div>
                        <p className="text-xs text-secondary-500 uppercase tracking-wide">Rol</p>
                        <p className="text-lg font-semibold text-secondary-900">Estudiante</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <span className="text-orange-600 text-xl">📅</span>
                      </div>
                      <div>
                        <p className="text-xs text-secondary-500 uppercase tracking-wide">Miembro Desde</p>
                        <p className="text-lg font-semibold text-secondary-900">
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
            <div className="account-card bg-white rounded-xl shadow-lg border border-secondary-200 p-6 mb-6">
              <h2 className="text-2xl font-bold text-secondary-900 mb-6">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {progress.coursesCompleted} / {progress.coursesEnrolled}
                  </div>
                  <div className="text-xs text-secondary-600">Cursos Completados</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {progress.modulesCompleted} / {progress.modulesTotal}
                  </div>
                  <div className="text-xs text-secondary-600">Módulos Completados</div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-1">
                    {progress.averageScore}%
                  </div>
                  <div className="text-xs text-secondary-600">Promedio General</div>
                </div>
              </div>
            </div>

            {/* Cursos en Progreso */}
            <div className="account-card bg-white rounded-xl shadow-lg border border-secondary-200 p-6">
              <h2 className="text-2xl font-bold text-secondary-900 mb-6">
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
