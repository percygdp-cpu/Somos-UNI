'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import anime from 'animejs'
import confetti from 'canvas-confetti'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// Función para renderizar texto con subíndices, superíndices e imágenes
const renderFormattedText = (text: string) => {
  if (!text) return null
  
  const parts: any[] = []
  
  // Regex para detectar imágenes markdown: ![alt](url) o ![alt](url){width}
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\s*\{(\d+)\})?/g
  const formatRegex = /([_^])(\{([^}]+)\}|(\d+)|([a-zA-Z]))/g
  
  // Primero procesar imágenes
  let imageMatch
  const segments: any[] = []
  let lastIndex = 0
  
  while ((imageMatch = imageRegex.exec(text)) !== null) {
    // Agregar texto antes de la imagen
    if (imageMatch.index > lastIndex) {
      segments.push({ type: 'text', content: text.substring(lastIndex, imageMatch.index), index: lastIndex })
    }
    
    // Agregar imagen
    segments.push({ 
      type: 'image', 
      alt: imageMatch[1] || 'imagen',
      url: imageMatch[2],
      width: imageMatch[3] ? parseInt(imageMatch[3]) : 300,
      index: imageMatch.index
    })
    
    lastIndex = imageMatch.index + imageMatch[0].length
  }
  
  // Agregar texto restante
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.substring(lastIndex), index: lastIndex })
  }
  
  // Si no hay imágenes, procesar todo como texto
  if (segments.length === 0) {
    segments.push({ type: 'text', content: text, index: 0 })
  }
  
  // Procesar cada segmento
  segments.forEach((segment, segIndex) => {
    if (segment.type === 'image') {
      parts.push(
        <img 
          key={`img-${segment.index}`}
          src={segment.url} 
          alt={segment.alt}
          style={{ maxWidth: `${segment.width}px`, width: '100%', height: 'auto', display: 'block', margin: '8px 0' }}
          className="rounded border border-gray-300"
        />
      )
    } else {
      // Procesar formato de texto (sub/superíndices)
      const textParts: any[] = []
      let textIndex = 0
      let match
      formatRegex.lastIndex = 0
      
      while ((match = formatRegex.exec(segment.content)) !== null) {
        if (match.index > textIndex) {
          textParts.push(segment.content.substring(textIndex, match.index))
        }
        
        const type = match[1]
        const content = match[3] || match[4] || match[5]
        
        if (type === '_') {
          textParts.push(<sub key={`sub-${segment.index}-${match.index}`}>{content}</sub>)
        } else if (type === '^') {
          textParts.push(<sup key={`sup-${segment.index}-${match.index}`}>{content}</sup>)
        }
        
        textIndex = match.index + match[0].length
      }
      
      if (textIndex < segment.content.length) {
        textParts.push(segment.content.substring(textIndex))
      }
      
      // Agregar las partes de texto procesadas
      textParts.forEach(part => parts.push(part))
    }
  })
  
  return parts.length > 0 ? <>{parts}</> : text
}

interface Question {
  id: string
  text: string
  options: Array<{ text: string; isCorrect: boolean }>
  explanation?: string
}

interface Answer {
  questionId: string
  selectedAnswer: number
  isCorrect: boolean
}

export default function TestPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [test, setTest] = useState<any>(null)
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([])
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
  const [blockAnswers, setBlockAnswers] = useState<{ [questionId: string]: number }>({})
  const [answers, setAnswers] = useState<Answer[]>([])
  const [testCompleted, setTestCompleted] = useState(false)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [courseProgress, setCourseProgress] = useState(0)
  const [prevProgress, setPrevProgress] = useState(0)
  const [shouldShowConfetti, setShouldShowConfetti] = useState(false)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [showFinalCelebration, setShowFinalCelebration] = useState(false)
  const [milestoneBlockScore, setMilestoneBlockScore] = useState(0)
  const [motivationalPhrase, setMotivationalPhrase] = useState<string>('')
  const questionsPerBlock = 10

  useEffect(() => {
    loadTestData()
  }, [params.testId])

  // Efecto para lanzar confetti cuando se aprueba
  useEffect(() => {
    if (testCompleted && shouldShowConfetti) {
      // Lanzar confetti inmediatamente
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })
      
      // Lanzar más confetti para que sea más visible
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 100,
          origin: { y: 0.7 }
        })
      }, 250)
      
      setTimeout(() => {
        confetti({
          particleCount: 75,
          spread: 85,
          origin: { y: 0.65 }
        })
      }, 500)
    }
  }, [testCompleted, shouldShowConfetti])

  // Efecto para lanzar confetti cuando se muestra el modal motivacional
  useEffect(() => {
    if (showMilestoneModal) {
      // Lanzar confetti inmediatamente
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#9333ea', '#3b82f6', '#8b5cf6', '#60a5fa']
      })
      
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#9333ea', '#3b82f6', '#8b5cf6', '#60a5fa']
        })
      }, 200)
      
      setTimeout(() => {
        confetti({
          particleCount: 60,
          spread: 80,
          origin: { y: 0.7 },
          colors: ['#9333ea', '#3b82f6', '#8b5cf6', '#60a5fa']
        })
      }, 400)
    }
  }, [showMilestoneModal])

  // Efecto para lanzar confetti cuando se muestra el modal de celebración final
  useEffect(() => {
    if (showFinalCelebration) {
      const percentage = Math.round((score / shuffledQuestions.length) * 100)
      const colors = percentage >= 70 
        ? ['#10b981', '#059669', '#34d399', '#6ee7b7'] // Verde
        : ['#3b82f6', '#2563eb', '#60a5fa', '#93c5fd'] // Azul
      
      // Lanzar confetti inmediatamente
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors
      })
      
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 120,
          origin: { y: 0.5 },
          colors
        })
      }, 250)
      
      setTimeout(() => {
        confetti({
          particleCount: 120,
          spread: 100,
          origin: { y: 0.7 },
          colors
        })
      }, 500)
    }
  }, [showFinalCelebration, score, shuffledQuestions.length])

  // Función para mezclar array usando Fisher-Yates (sin repeticiones)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const loadTestData = async () => {
    try {
      setLoading(true)
      const testId = params.testId as string
      
      // Cargar solo el test específico usando el parámetro id
      const response = await fetch(`/api/tests?id=${testId}`)
      if (!response.ok) {
        console.error('Error en la respuesta de la API')
        return
      }
      
      const foundTest = await response.json()
      
      if (!foundTest || !foundTest.id) {
        console.error('Test no encontrado:', testId)
        return
      }
      
      // Verificar que el test tenga preguntas
      if (!foundTest.questions || foundTest.questions.length === 0) {
        console.error('El test no tiene preguntas')
        return
      }
      
      setTest(foundTest)
      // Mezclar preguntas y sus opciones usando Fisher-Yates (garantiza no repetición)
      const shuffled = shuffleArray(foundTest.questions).map((question: any) => ({
        ...question,
        options: shuffleArray(question.options)
      }))
      setShuffledQuestions(shuffled)
      setLoading(false)
    } catch (error) {
      console.error('Error cargando test:', error)
    }
  }

  useEffect(() => {
    if (!loading && test) {
      // Animar bloque de preguntas
      anime({
        targets: '.block-container',
        translateY: [30, 0],
        opacity: [0, 1],
        duration: 600,
        easing: 'easeOutQuart'
      })
    }
  }, [loading, currentBlockIndex])

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    // No permitir cambiar respuesta si ya fue seleccionada
    if (blockAnswers[questionId] !== undefined) {
      return
    }
    
    setBlockAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }))
  }
  
  const handleSubmitBlock = () => {
    const startIdx = currentBlockIndex * questionsPerBlock
    const endIdx = Math.min(startIdx + questionsPerBlock, shuffledQuestions.length)
    const currentBlockQuestions = shuffledQuestions.slice(startIdx, endIdx)
    
    // Verificar que todas las preguntas del bloque tengan respuesta
    const unansweredQuestions = currentBlockQuestions.filter(q => blockAnswers[q.id] === undefined)
    if (unansweredQuestions.length > 0) {
      alert(`Por favor responde todas las preguntas antes de continuar. Faltan ${unansweredQuestions.length} pregunta(s).`)
      return
    }
    
    // Guardar respuestas del bloque
    const newAnswers: Answer[] = currentBlockQuestions.map(question => {
      const selectedIndex = blockAnswers[question.id]
      const isCorrect = question.options[selectedIndex]?.isCorrect || false
      return {
        questionId: question.id,
        selectedAnswer: selectedIndex,
        isCorrect
      }
    })
    
    const updatedAnswers = [...answers, ...newAnswers]
    setAnswers(updatedAnswers)
    
    // Calcular puntaje del bloque actual
    const blockScore = newAnswers.filter(a => a.isCorrect).length
    setMilestoneBlockScore(blockScore)
    
    // Verificar si hay más bloques
    const nextBlockIndex = currentBlockIndex + 1
    const hasMoreBlocks = nextBlockIndex * questionsPerBlock < shuffledQuestions.length
    
    if (hasMoreBlocks) {
      // Mostrar modal de felicitaciones antes de ir al siguiente bloque
      // El confetti se lanzará automáticamente con el useEffect
      setShowMilestoneModal(true)
    } else {
      // Completar test
      completeTest(updatedAnswers)
    }
  }
  
  const handleContinueToNextBlock = () => {
    setShowMilestoneModal(false)
    setCurrentBlockIndex(currentBlockIndex + 1)
    setBlockAnswers({})
  }

  const completeTest = async (finalAnswers: Answer[]) => {
    const correctAnswers = finalAnswers.filter(a => a.isCorrect).length
    const totalQuestions = shuffledQuestions.length
    const percentage = Math.round((correctAnswers / totalQuestions) * 100)
    
    setScore(correctAnswers)
    
    // Mostrar modal de celebración final primero
    setShowFinalCelebration(true)
    
    // Activar confetti si aprobó (>= 70%)
    if (percentage >= 70) {
      setShouldShowConfetti(true)
    }
    
    // Obtener frase motivacional
    try {
      const phraseResponse = await fetch(`/api/motivational-phrases?percentage=${percentage}&userId=${user?.id}`)
      if (phraseResponse.ok) {
        const phraseData = await phraseResponse.json()
        setMotivationalPhrase(phraseData.phrase || '¡Sigue adelante!')
      }
    } catch (error) {
      console.error('Error obteniendo frase motivacional:', error)
      setMotivationalPhrase('¡Sigue adelante!')
    }
    
    // Guardar resultado en la base de datos
    try {
      await fetch('/api/test-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: parseInt(user?.id || '0'),
          testId: test?.id,
          score: correctAnswers,
          totalQuestions,
          percentage,
          answers: finalAnswers.map(a => ({
            questionId: a.questionId,
            selectedAnswer: a.selectedAnswer,
            isCorrect: a.isCorrect
          }))
        })
      })
      
      // Calcular progreso del curso después de guardar
      await calculateCourseProgress()
    } catch (error) {
      console.error('Error guardando resultado:', error)
    }
  }
  
  const calculateCourseProgress = async () => {
    try {
      const courseId = params.courseId as string
      
      // Obtener todos los tests del curso
      const testsRes = await fetch('/api/tests')
      if (!testsRes.ok) return
      
      const allTests = await testsRes.json()
      const courseTests = allTests.filter((t: any) => t.courseId === parseInt(courseId))
      const totalTests = courseTests.length
      
      if (totalTests === 0) {
        setCourseProgress(0)
        return
      }
      
      // Obtener resultados del usuario para este curso
      const resultsRes = await fetch(`/api/test-results?userId=${user?.id}`)
      if (!resultsRes.ok) return
      
      const results = await resultsRes.json()
      
      // Contar tests únicos completados en este curso
      const completedTestIds = new Set()
      results.forEach((result: any) => {
        const testBelongsToCourse = courseTests.some((t: any) => t.id === result.testId)
        if (testBelongsToCourse && result.percentage >= 70) {
          completedTestIds.add(result.testId)
        }
      })
      
      const completedTests = completedTestIds.size
      const oldProgress = Math.round((Math.max(0, completedTests - 1) / totalTests) * 100)
      const newProgress = Math.round((completedTests / totalTests) * 100)
      
      setPrevProgress(oldProgress)
      setCourseProgress(oldProgress)
      
      // Animar el progreso
      setTimeout(() => {
        anime({
          targets: { progress: oldProgress },
          progress: newProgress,
          duration: 1500,
          easing: 'easeOutQuart',
          update: function(anim: any) {
            const value = Math.round(anim.animations[0].currentValue)
            setCourseProgress(value)
          }
        })
      }, 500)
    } catch (error) {
      console.error('Error calculando progreso:', error)
    }
  }

  const handleContinue = () => {
    if (testCompleted) {
      router.push(`/student/courses/${params.courseId}/modules/${params.moduleId}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!test) {
    return null
  }

  const startIdx = currentBlockIndex * questionsPerBlock
  const endIdx = Math.min(startIdx + questionsPerBlock, shuffledQuestions.length)
  const currentBlockQuestions = shuffledQuestions.slice(startIdx, endIdx)
  const totalBlocks = Math.ceil(shuffledQuestions.length / questionsPerBlock)
  const progress = ((startIdx) / shuffledQuestions.length) * 100

  return (
    <ProtectedRoute allowedRoles={['student']}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary-50 to-secondary-50 relative">
        <StudentHeader />
        <div className="flex-grow p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => router.push(`/student/courses/${params.courseId}/modules/${params.moduleId}`)}
                className="btn-secondary"
              >
                ← Abandonar Test
              </button>
              
              <div className="text-right">
                <div className="text-sm text-secondary-600">
                  Bloque {currentBlockIndex + 1} de {totalBlocks} ({startIdx + 1}-{endIdx} de {shuffledQuestions.length})
                </div>
                <div className="text-lg font-semibold text-secondary-900">
                  {test.title}
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-secondary-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {!testCompleted ? (
            <div className="block-container">
              {/* Instrucción */}
              <div className="card mb-6 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">Instrucciones</h3>
                    <p className="text-sm text-blue-800">
                      Responde todas las preguntas de este bloque. Puedes cambiar tus respuestas antes de enviar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Preguntas del bloque */}
              <div className="space-y-6">
                {currentBlockQuestions.map((question, qIndex) => {
                  const globalIndex = startIdx + qIndex
                  const selectedAnswer = blockAnswers[question.id]
                  const hasAnswer = selectedAnswer !== undefined
                  const isCorrect = hasAnswer ? question.options[selectedAnswer]?.isCorrect : false
                  
                  return (
                    <div key={question.id} className="card">
                      <div className="mb-4">
                        <span className="inline-block bg-primary-100 text-primary-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
                          Pregunta {globalIndex + 1}
                        </span>
                        <div className="flex items-start gap-3">
                          <h3 className="text-lg font-semibold text-secondary-900 flex-1">
                            {renderFormattedText(question.text)}
                          </h3>
                          {hasAnswer && (
                            <div className="text-3xl flex-shrink-0">
                              {isCorrect ? '😄' : '😞'}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {question.options.map((option: any, optIndex: number) => {
                          const isSelected = selectedAnswer === optIndex
                          const isCorrectOption = option.isCorrect
                          
                          // Determinar el estilo según si ya respondió
                          let buttonClass = 'w-full p-4 text-left border-2 rounded-lg transition-all duration-300 '
                          if (hasAnswer) {
                            buttonClass += 'cursor-not-allowed '
                            if (isSelected && isCorrect) {
                              buttonClass += 'border-green-500 bg-green-50'
                            } else if (isSelected && !isCorrect) {
                              buttonClass += 'border-red-500 bg-red-50'
                            } else {
                              buttonClass += 'border-secondary-200 bg-gray-50 opacity-60'
                            }
                          } else {
                            buttonClass += isSelected 
                              ? 'border-primary-500 bg-primary-50' 
                              : 'border-secondary-300 hover:border-primary-300 hover:bg-primary-50 cursor-pointer'
                          }
                          
                          return (
                            <button
                              key={optIndex}
                              onClick={() => handleAnswerSelect(question.id, optIndex)}
                              disabled={hasAnswer}
                              className={buttonClass}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  hasAnswer && isSelected && isCorrect ? 'border-green-500 bg-green-500' :
                                  hasAnswer && isSelected && !isCorrect ? 'border-red-500 bg-red-500' :
                                  isSelected ? 'border-primary-500 bg-primary-500' : 
                                  'border-secondary-400'
                                }`}>
                                  {hasAnswer && isSelected && isCorrect && <span className="text-white text-sm">✓</span>}
                                  {hasAnswer && isSelected && !isCorrect && <span className="text-white text-sm">✗</span>}
                                  {!hasAnswer && isSelected && <span className="text-white text-sm">●</span>}
                                </div>
                                <span className="flex-1">{renderFormattedText(option.text)}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      
                      {/* Feedback y explicación */}
                      {hasAnswer && !isCorrect && (
                        <div className="mt-4 p-4 rounded-lg border-2 bg-yellow-50 border-yellow-200">
                          <p className="text-sm text-yellow-700 mb-2">
                            <strong>Respuesta correcta:</strong> {question.options.find((opt: any) => opt.isCorrect)?.text}
                          </p>
                          {question.explanation && (
                            <div className="mt-3 pt-3 border-t border-yellow-200">
                              <p className="text-xs font-semibold text-yellow-800 mb-2">💡 EXPLICACIÓN</p>
                              <p className="text-sm text-yellow-900">
                                {renderFormattedText(question.explanation)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Botón para enviar bloque */}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSubmitBlock}
                  className="px-8 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-all hover:scale-105 shadow-lg"
                >
                  {currentBlockIndex + 1 < totalBlocks ? 'Continuar al Siguiente Bloque' : 'Finalizar Test'}
                </button>
              </div>
            </div>
          ) : (
            /* Test Completion - Diseño profesional pero moderno */
            <div className="flex flex-col min-h-[calc(100vh-200px)] pb-32">
              {/* Header con resultado */}
              <div className={`rounded-xl p-8 mb-6 text-center ${
                Math.round((score / shuffledQuestions.length) * 100) >= 70 
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200' 
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200'
              }`}>
                {/* Icono */}
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                  Math.round((score / shuffledQuestions.length) * 100) >= 70 
                    ? 'bg-green-100' 
                    : 'bg-blue-100'
                }`}>
                  <span className="text-5xl">
                    {Math.round((score / shuffledQuestions.length) * 100) >= 70 ? '🎯' : '📘'}
                  </span>
                </div>
                
                {/* Título */}
                <h1 className={`text-3xl font-bold mb-2 ${
                  Math.round((score / shuffledQuestions.length) * 100) >= 70 ? 'text-green-700' : 'text-blue-700'
                }`}>
                  {Math.round((score / shuffledQuestions.length) * 100) >= 70 
                    ? '¡Felicitaciones!' 
                    : '¡Buen trabajo!'}
                </h1>
                
                {/* Nombre del estudiante */}
                <p className="text-xl font-semibold text-gray-700 mb-3">
                  {user?.name || 'Estudiante'}
                </p>
                
                {/* Frase motivacional */}
                <p className="text-base text-gray-600 italic">
                  {motivationalPhrase || 'Cargando...'}
                </p>
              </div>

              {/* Score Card */}
              <div className="mb-6">
                <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Tu Puntuación
                    </p>
                    
                    {/* Score */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className={`text-6xl font-bold ${
                        Math.round((score / shuffledQuestions.length) * 100) >= 70 ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        {score}
                      </span>
                      <span className="text-3xl text-gray-400">/</span>
                      <span className="text-4xl font-semibold text-gray-500">{shuffledQuestions.length}</span>
                    </div>
                    
                    {/* Porcentaje */}
                    <div className={`inline-block px-5 py-2 rounded-full text-xl font-bold ${
                      Math.round((score / shuffledQuestions.length) * 100) >= 70 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {Math.round((score / shuffledQuestions.length) * 100)}% Correcto
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Progress */}
              <div className="mb-6">
                <div className="bg-white rounded-xl border-2 border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-base font-semibold text-gray-700">Progreso del Curso</p>
                    <p className="text-lg font-bold text-primary-600">{courseProgress}%</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-3 rounded-full bg-primary-600 transition-all duration-500"
                      style={{ width: `${courseProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Review Answers */}
              <div className="mb-6">
                <div className="bg-white rounded-xl border-2 border-gray-200 p-5 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Revisión de Respuestas</h3>
                  
                  <div className="space-y-3">
                    {shuffledQuestions.map((question, qIndex) => {
                      const answer = answers[qIndex]
                      const isCorrect = answer?.isCorrect
                      return (
                        <div key={question.id} className={`rounded-lg border-2 p-4 ${
                          isCorrect 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}>
                          {/* Pregunta */}
                          <div className="flex items-start gap-3 mb-3">
                            <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                              isCorrect ? 'bg-green-500' : 'bg-red-500'
                            }`}>
                              {qIndex + 1}
                            </span>
                            <p className="text-sm font-medium text-gray-800 flex-1">
                              {renderFormattedText(question.text)}
                            </p>
                            <span className="text-xl">
                              {isCorrect ? '✓' : '✗'}
                            </span>
                          </div>
                          
                          {/* Respuesta del estudiante */}
                          <div className={`ml-10 p-3 rounded-md ${
                            isCorrect ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Tu respuesta:</p>
                            <p className="text-sm text-gray-800">
                              {renderFormattedText(question.options[answer?.selectedAnswer || 0]?.text)}
                            </p>
                          </div>
                          
                          {/* Respuesta correcta y explicación si falló */}
                          {!isCorrect && (
                            <div className="ml-10 mt-3 space-y-2">
                              <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200">
                                <p className="text-xs font-semibold text-yellow-800 mb-1">Respuesta correcta:</p>
                                <p className="text-sm font-medium text-yellow-900">
                                  {renderFormattedText(question.options.find((opt: any) => opt.isCorrect)?.text || '')}
                                </p>
                              </div>
                              
                              {question.explanation && (
                                <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
                                  <p className="text-xs font-semibold text-blue-800 mb-1">💡 Explicación:</p>
                                  <p className="text-sm text-blue-900">
                                    {renderFormattedText(question.explanation)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Sticky Bottom Buttons */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 pt-4 pb-4 shadow-lg">
                <div className="flex flex-col gap-3 px-4 max-w-4xl mx-auto">
                  <button
                    onClick={handleContinue}
                    className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold text-base transition-all hover:bg-primary-700 shadow-sm"
                  >
                    Siguiente Test
                  </button>
                  <button
                    onClick={() => router.push(`/student/courses/${params.courseId}/modules/${params.moduleId}`)}
                    className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold text-base border-2 border-gray-300 transition-all hover:bg-gray-200"
                  >
                    Volver al Módulo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Modal de Felicitaciones cada 10 preguntas */}
        {showMilestoneModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform animate-scaleIn relative">
              
              {/* Header con emoji y título */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-6 text-center relative">
                <div className="text-6xl mb-3">📚</div>
                <h2 className="text-2xl font-bold text-white mb-2">💪 ¡FUERZA GUERRERO!</h2>
                <p className="text-white/90 text-xl font-bold">BLOQUE {currentBlockIndex + 1} COMPLETADO</p>
              </div>

              {/* Body */}
              <div className="px-8 py-8 text-center">
                {/* Score grande */}
                <div className="mb-6">
                  <p className="text-7xl font-black text-purple-600 mb-2">
                    {milestoneBlockScore}/{questionsPerBlock}
                  </p>
                  <p className="text-2xl text-secondary-500 mb-4">
                    ({Math.round((milestoneBlockScore / questionsPerBlock) * 100)}%)
                  </p>
                </div>

                {/* Mensaje de felicitaciones épicas */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-purple-700 mb-4">
                    ¡FELICIDADES ÉPICAS!
                  </h3>
                  <p className="text-3xl font-black text-secondary-900 mb-3">
                    {user?.name?.toUpperCase() || 'GUERRERO'}
                  </p>
                  <p className="text-xl font-bold text-purple-600 mb-4">
                    ¡ERES INCREÍBLE!
                  </p>
                </div>

                {/* Mensaje motivacional personalizado */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
                  <p className="text-sm font-bold text-purple-900">
                    {milestoneBlockScore >= 7 
                      ? `¡${milestoneBlockScore}/${questionsPerBlock}! ${user?.name?.toUpperCase() || 'GUERRERO'}, ¡EXCELENTE TRABAJO! SIGUE ASÍ, ESTÁS DOMINANDO EL TEMA.`
                      : `¡${milestoneBlockScore}/${questionsPerBlock}! ${user?.name?.toUpperCase() || 'GUERRERO'}, SIGUE PRACTICANDO, CADA ERROR TE ACERCA A LA EXCELENCIA.`
                    }
                  </p>
                </div>

                {/* Progreso total */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-secondary-700">Preguntas contestadas:</span>
                    <span className="text-lg font-bold text-secondary-900">
                      {(currentBlockIndex + 1) * questionsPerBlock}/{shuffledQuestions.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${((currentBlockIndex + 1) * questionsPerBlock / shuffledQuestions.length) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-secondary-700">Progreso total:</span>
                    <span className="text-lg font-bold text-purple-600">
                      {Math.round(((currentBlockIndex + 1) * questionsPerBlock / shuffledQuestions.length) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Botón continuar */}
                <button
                  onClick={handleContinueToNextBlock}
                  className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <span>🚀 CONTINUAR CON LAS SIGUIENTES {questionsPerBlock} PREGUNTAS</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal de Celebración Final */}
        {showFinalCelebration && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform animate-scaleIn relative">
              
              {/* Header con emoji y título */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-6 text-center relative">
                <div className="text-6xl mb-3">📚</div>
                <h2 className="text-2xl font-bold text-white mb-2">💪 ¡FUERZA GUERRERO!</h2>
                <p className="text-white/90 text-xl font-bold">TEST COMPLETADO</p>
              </div>

              {/* Body */}
              <div className="px-8 py-8 text-center">
                {/* Nombre del estudiante */}
                <p className="text-2xl font-black text-gray-800 mb-2">
                  {user?.name?.toUpperCase() || 'GUERRERO'}
                </p>
                <p className="text-xl font-bold text-purple-600 mb-4">
                  ¡ERES INCREÍBLE!
                </p>

                {/* Mensaje motivacional personalizado */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
                  <p className="text-sm font-bold text-purple-900">
                    {score >= (shuffledQuestions.length * 0.7)
                      ? `¡${score}/${shuffledQuestions.length}! ${user?.name?.toUpperCase() || 'GUERRERO'}, ¡EXCELENTE TRABAJO! SIGUE ASÍ, ESTÁS DOMINANDO EL TEMA.`
                      : `¡${score}/${shuffledQuestions.length}! ${user?.name?.toUpperCase() || 'GUERRERO'}, SIGUE PRACTICANDO, CADA ERROR TE ACERCA A LA EXCELENCIA.`
                    }
                  </p>
                </div>

                {/* Botón continuar */}
                <button
                  onClick={() => {
                    setShowFinalCelebration(false)
                    setTestCompleted(true)
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <span>VER RESULTADOS DETALLADOS</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        </div>
      </div>
    </ProtectedRoute>
  )
}