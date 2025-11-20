'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import anime from 'animejs'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ModuleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [module, setModule] = useState<any>(null)
  const [tests, setTests] = useState<any[]>([])
  const [testResults, setTestResults] = useState<{ [key: number]: any }>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadModuleData()
  }, [params.moduleId])

  const loadModuleData = async () => {
    try {
      setLoading(true)
      const moduleId = params.moduleId as string
      
      // Cargar módulo
      const modulesRes = await fetch('/api/modules')
      if (modulesRes.ok) {
        const modules = await modulesRes.json()
        const foundModule = modules.find((m: any) => m.id === parseInt(moduleId))
        
        if (!foundModule) {
          router.push('/student/courses')
          return
        }
        
        console.log('Módulo cargado:', foundModule)
        console.log('PDFs del módulo:', foundModule.pdfFiles)
        
        setModule(foundModule)
        
        // Cargar tests del módulo
        const testsRes = await fetch('/api/tests')
        if (testsRes.ok) {
          const allTests = await testsRes.json()
          const moduleTests = allTests.filter((t: any) => t.moduleId === parseInt(moduleId))
          setTests(moduleTests)
          
          // Cargar resultados de los tests para el usuario actual
          if (user?.id) {
            const resultsRes = await fetch(`/api/test-results?userId=${user.id}`)
            if (resultsRes.ok) {
              const results = await resultsRes.json()
              const resultsMap: { [key: number]: any } = {}
              results.forEach((result: any) => {
                // Guardar solo el resultado más reciente de cada test
                if (!resultsMap[result.testId] || new Date(result.completedAt) > new Date(resultsMap[result.testId].completedAt)) {
                  resultsMap[result.testId] = result
                }
              })
              setTestResults(resultsMap)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cargando módulo:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && module) {
      // Animar contenido
      anime({
        targets: '.module-content',
        translateY: [30, 0],
        opacity: [0, 1],
        duration: 800,
        easing: 'easeOutQuart'
      })
    }
  }, [loading, module])

  const handlePdfView = (pdfUrl: string) => {
    console.log('Visualizando PDF:', pdfUrl)
    if (!pdfUrl) {
      alert('URL del PDF no disponible')
      return
    }
    // Abrir PDF directamente en nueva pestaña
    window.open(pdfUrl, '_blank')
  }

  const handlePdfDownload = async (pdfUrl: string, fileName: string) => {
    console.log('Descargando PDF:', pdfUrl, fileName)
    if (!pdfUrl) {
      alert('URL del PDF no disponible')
      return
    }
    
    // Crear un enlace temporal para forzar descarga
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleTestClick = (testId: number) => {
    router.push(`/student/courses/${params.courseId}/modules/${module?.id}/tests/${testId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!module) {
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
              onClick={() => router.push(`/student/courses/${params.courseId}`)}
              className="btn-secondary mb-4"
            >
              ← Volver al Curso
            </button>
            
            <div className="module-content">
              <h1 className="text-3xl font-bold text-secondary-900 mb-3">
                {module.title}
              </h1>
              <p className="text-secondary-600 text-lg mb-6">
                {module.description || 'Sin descripción'}
              </p>
            </div>
          </div>

          {/* PDF Download Section */}
          {module.pdfFiles && Array.isArray(module.pdfFiles) && module.pdfFiles.length > 0 && (
            <div className="module-content card mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-secondary-900 mb-4 flex items-center gap-2">
                <span className="text-red-600 text-xl sm:text-2xl">📄</span>
                Material de Estudio
              </h3>
              <div className="space-y-3">
                {module.pdfFiles.map((pdf: any, index: number) => (
                  <div key={index} className="bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors overflow-hidden">
                    <div className="flex flex-col gap-3 p-3 sm:p-4">
                      {/* Header con info del PDF */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 flex-shrink-0 bg-red-100 rounded-lg flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-secondary-900 line-clamp-2 sm:line-clamp-1">
                            {pdf.name || `Documento ${index + 1}`}
                          </p>
                          <p className="text-xs sm:text-sm text-secondary-600">PDF</p>
                        </div>
                      </div>
                      
                      {/* Botones de acción */}
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePdfView(pdf.url)
                          }}
                          className="flex-1 px-3 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                          </svg>
                          <span className="whitespace-nowrap">Visualizar</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePdfDownload(pdf.url, pdf.name || `documento-${index + 1}.pdf`)
                          }}
                          className="flex-1 px-3 py-2.5 bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
                          </svg>
                          <span className="whitespace-nowrap">Descargar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tests Section */}
          <div className="module-content">
            <h2 className="text-2xl font-semibold text-secondary-900 mb-6">
              Tests de Evaluación
            </h2>
            
            {tests.length > 0 ? (
              <div className="space-y-4">
                {tests.map((test: any) => {
                  const result = testResults[test.id]
                  const hasResult = !!result
                  
                  return (
                    <div
                      key={test.id}
                      className="card card-hover cursor-pointer"
                      onClick={() => handleTestClick(test.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            hasResult 
                              ? result.percentage >= 70 
                                ? 'bg-green-100' 
                                : 'bg-orange-100'
                              : 'bg-primary-100'
                          }`}>
                            <span className={`text-xl ${
                              hasResult 
                                ? result.percentage >= 70 
                                  ? 'text-green-600' 
                                  : 'text-orange-600'
                                : 'text-primary-600'
                            }`}>
                              {hasResult ? (result.percentage >= 70 ? '✓' : '📝') : '📝'}
                            </span>
                          </div>
                          
                          <div>
                            <h3 className="text-lg font-semibold text-secondary-900 mb-1">
                              {test.title}
                            </h3>
                            <p className="text-secondary-600">
                              {test.questions?.length || 0} preguntas • Tiempo estimado: {(test.questions?.length || 0) * 2} minutos
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {hasResult ? (
                            <div className="flex flex-col items-end">
                              <span className={`text-sm font-semibold px-3 py-1 rounded ${
                                result.percentage >= 70 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {result.percentage}%
                              </span>
                              <span className="text-xs text-secondary-500 mt-1">
                                Última nota
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded font-medium">
                              Por hacer
                            </span>
                          )}
                          <div className="w-6 h-6 text-secondary-400">
                            →
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                  No hay tests disponibles
                </h3>
                <p className="text-secondary-600">
                  Este módulo aún no tiene tests asignados.
                </p>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}