'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import { Course } from '@/types'
import anime from 'animejs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [courseProgress, setCourseProgress] = useState<{ [key: number]: any }>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const { user, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/courses')
      if (response.ok) {
        const data = await response.json()
        setCourses(data)
        
        // Cargar progreso para cada curso
        if (user?.id) {
          await loadAllProgress(data)
        }
      }
    } catch (error) {
      console.error('Error cargando cursos:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadAllProgress = async (coursesData: Course[]) => {
    try {
      // Cargar todos los módulos y tests
      const [modulesRes, testsRes, resultsRes] = await Promise.all([
        fetch('/api/modules'),
        fetch('/api/tests'),
        fetch(`/api/test-results?userId=${user?.id}`)
      ])
      
      if (!modulesRes.ok || !testsRes.ok || !resultsRes.ok) return
      
      const [allModules, allTests, results] = await Promise.all([
        modulesRes.json(),
        testsRes.json(),
        resultsRes.json()
      ])
      
      const progressMap: { [key: number]: any } = {}
      
      coursesData.forEach(course => {
        const courseModules = allModules.filter((m: any) => m.courseId === course.id)
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
    } catch (error) {
      console.error('Error cargando progreso:', error)
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
