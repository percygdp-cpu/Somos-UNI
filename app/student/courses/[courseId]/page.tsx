'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import { calculateCourseProgress } from '@/lib/progress'
import { TestResult } from '@/types'
import anime from 'animejs'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [course, setCourse] = useState<any>(null)
  const [modules, setModules] = useState<any[]>([])
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [courseProgress, setCourseProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCourseData()
  }, [params.courseId])

  const loadCourseData = async () => {
    try {
      setLoading(true)
      const courseId = params.courseId as string
      
      // Cargar curso
      const courseRes = await fetch('/api/courses')
      if (courseRes.ok) {
        const courses = await courseRes.json()
        const foundCourse = courses.find((c: any) => c.id === parseInt(courseId))
        
        if (!foundCourse) {
          router.push('/student/courses')
          return
        }
        
        setCourse(foundCourse)
        
        // Cargar módulos del curso
        const modulesRes = await fetch('/api/modules')
        if (modulesRes.ok) {
          const allModules = await modulesRes.json()
          const courseModules = allModules.filter((m: any) => m.courseId === parseInt(courseId))
          setModules(courseModules)
          
          // Cargar tests de los módulos
          const testsRes = await fetch('/api/tests')
          if (testsRes.ok) {
            const allTests = await testsRes.json()
            
            // Cargar resultados de tests para el usuario actual
            if (user?.id) {
              const resultsRes = await fetch(`/api/test-results?userId=${user.id}`)
              if (resultsRes.ok) {
                const results = await resultsRes.json()
                setTestResults(results)
                
                // Calcular progreso del curso basado en tests
                const courseTests = allTests.filter((t: any) => t.courseId === parseInt(courseId))
                let completedTests = 0
                
                courseTests.forEach((test: any) => {
                  const latestResult = results
                    .filter((r: any) => r.testId === test.id)
                    .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
                  
                  if (latestResult && latestResult.percentage >= 70) {
                    completedTests++
                  }
                })
                
                // Calcular progreso de módulos para mostrar en la lista
                const moduleData = courseModules.map((module: any) => {
                  const moduleTests = allTests.filter((t: any) => t.moduleId === module.id)
                  return {
                    id: module.id,
                    testIds: moduleTests.map((t: any) => t.id)
                  }
                })
                
                const progress = calculateCourseProgress(
                  parseInt(courseId),
                  moduleData,
                  results
                )
                
                // Actualizar el progreso del curso con los tests completados
                const updatedProgress = {
                  ...progress,
                  completed: completedTests,
                  total: courseTests.length,
                  percentage: courseTests.length > 0 ? Math.round((completedTests / courseTests.length) * 100) : 0
                }
                
                setCourseProgress(updatedProgress)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cargando curso:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && modules.length > 0) {
      // Animar módulos
      anime({
        targets: '.module-card',
        translateX: [-100, 0],
        opacity: [0, 1],
        delay: anime.stagger(150),
        duration: 600,
        easing: 'easeOutQuart'
      })
      
      // Animar barra de progreso del curso
      if (courseProgress) {
        anime({
          targets: '.course-progress-bar',
          width: ['0%', `${courseProgress.percentage}%`],
          duration: 1200,
          delay: 300,
          easing: 'easeOutQuart'
        })
      }
    }
  }, [loading, modules, courseProgress])

  const handleModuleClick = (moduleId: number) => {
    router.push(`/student/courses/${course?.id}/modules/${moduleId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!course) {
    return null
  }

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 to-secondary-50">
        <StudentHeader />
        <div className="flex-grow p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/student/courses')}
              className="btn-secondary mb-4"
            >
              ← Volver a Cursos
            </button>
            
            <div className="card">
              <h1 className="text-3xl font-bold text-secondary-900 mb-3">
                {course.title}
              </h1>
              {course.description && (
                <p className="text-secondary-600 text-lg mb-4">
                  {course.description}
                </p>
              )}
              
              {/* Barra de progreso del curso */}
              {courseProgress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-secondary-700">
                      Progreso del curso
                    </span>
                    <span className="text-sm font-bold text-primary-600">
                      {courseProgress.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="course-progress-bar bg-primary-600 h-3 rounded-full"
                      style={{ width: `${courseProgress.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-secondary-500">
                      {courseProgress.completed} de {courseProgress.total} tests aprobados
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-4 text-sm text-secondary-500">
                <span>{modules.length} módulos</span>
                <span>•</span>
                <span>Actualizado: {course.updatedAt || course.createdAt ? new Date(course.updatedAt || course.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recientemente'}</span>
              </div>
            </div>
          </div>

          {/* Módulos */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-secondary-900 mb-6">
              Módulos del Curso
            </h2>
            
            {modules.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-secondary-600">No hay módulos disponibles en este curso</p>
              </div>
            ) : (
              modules.map((module: any, index: number) => {
                const moduleProgress = courseProgress?.moduleProgress?.[module.id]
                const isCompleted = moduleProgress?.percentage === 100
                
                return (
                  <div
                    key={module.id}
                    className="module-card card card-hover cursor-pointer"
                    onClick={() => handleModuleClick(module.id)}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? 'bg-green-100' : 'bg-primary-100'
                          }`}>
                            {isCompleted ? (
                              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-primary-600 font-bold text-xl">
                                {index + 1}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-secondary-900">
                                {module.title}
                              </h3>
                              {isCompleted && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">
                                  Completado
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-secondary-600">
                              {module.description || 'Sin descripción'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {module.pdfUrl && (
                            <div className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">PDF</span>
                            </div>
                          )}
                          <svg className="w-5 h-5 text-secondary-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      {moduleProgress && (
                        <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-secondary-600 font-medium">
                                {moduleProgress.completed} de {moduleProgress.total} tests completados
                              </span>
                              <span className={`text-sm font-bold ${
                                isCompleted ? 'text-green-600' : 'text-primary-600'
                              }`}>
                                {moduleProgress.percentage}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  isCompleted ? 'bg-green-500' : 'bg-primary-600'
                                }`}
                                style={{ width: `${moduleProgress.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
