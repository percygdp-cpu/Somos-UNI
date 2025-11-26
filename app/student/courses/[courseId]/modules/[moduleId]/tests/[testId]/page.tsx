'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import { Confetti, type ConfettiRef } from '@/components/magicui/confetti'
import anime from 'animejs'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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
  const confettiRef = useRef<ConfettiRef>(null)
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
  const questionsPerBlock = 10

  useEffect(() => {
    loadTestData()
  }, [params.testId])

  // Efecto para lanzar confetti cuando se aprueba
  useEffect(() => {
    if (testCompleted && shouldShowConfetti) {
      console.log('🎉 Test aprobado! Intentando lanzar confetti...')
      console.log('confettiRef.current:', confettiRef.current)
      
      // Esperar más tiempo para asegurar que el componente y el script estén listos
      const timer = setTimeout(() => {
        if (confettiRef.current) {
          console.log('✅ Lanzando confetti!')
          confettiRef.current.fire({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          })
          
          // Lanzar más confetti para que sea más visible
          setTimeout(() => {
            confettiRef.current?.fire({
              particleCount: 50,
              spread: 100,
              origin: { y: 0.7 }
            })
          }, 250)
        } else {
          console.log('❌ confettiRef.current es null')
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [testCompleted, shouldShowConfetti])

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
      
      console.log('Test encontrado:', foundTest)
      
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
    
    // Verificar si hay más bloques
    const nextBlockIndex = currentBlockIndex + 1
    const hasMoreBlocks = nextBlockIndex * questionsPerBlock < shuffledQuestions.length
    
    if (hasMoreBlocks) {
      // Ir al siguiente bloque
      setCurrentBlockIndex(nextBlockIndex)
      setBlockAnswers({})
    } else {
      // Completar test
      completeTest(updatedAnswers)
    }
  }

  const completeTest = async (finalAnswers: Answer[]) => {
    const correctAnswers = finalAnswers.filter(a => a.isCorrect).length
    const totalQuestions = shuffledQuestions.length
    const percentage = Math.round((correctAnswers / totalQuestions) * 100)
    
    setScore(correctAnswers)
    setTestCompleted(true)
    
    // Activar confetti si aprobó (>= 70%)
    if (percentage >= 70) {
      setShouldShowConfetti(true)
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
        {testCompleted && Math.round((score / shuffledQuestions.length) * 100) >= 70 && (
          <Confetti
            ref={confettiRef}
            className="absolute inset-0 z-50 size-full pointer-events-none"
          />
        )}
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
                        <div className="mt-4 p-4 rounded-lg border-2 bg-red-50 border-red-200">
                          <p className="font-bold text-lg mb-1 text-red-800">
                            ¡Incorrecto!
                          </p>
                          <p className="text-sm text-red-700 mb-2">
                            <strong>Respuesta correcta:</strong> {question.options.find((opt: any) => opt.isCorrect)?.text}
                          </p>
                          {question.explanation && (
                            <div className="mt-3 pt-3 border-t border-red-200">
                              <p className="text-xs font-semibold text-red-800 mb-2">💡 EXPLICACIÓN</p>
                              <p className="text-sm text-red-900">
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
            /* Test Completion */
            <div className="flex flex-col min-h-[calc(100vh-200px)]">
              {/* Congratulations Section */}
              <div className="flex flex-col items-center justify-center pt-8 pb-4">
                <div className={`flex items-center justify-center w-24 h-24 rounded-full mb-4 ${
                  Math.round((score / shuffledQuestions.length) * 100) >= 70 
                    ? 'bg-green-500/10' 
                    : 'bg-orange-500/10'
                }`}>
                  <div className={`flex items-center justify-center w-20 h-20 rounded-full ${
                    Math.round((score / shuffledQuestions.length) * 100) >= 70 
                      ? 'bg-green-500/20' 
                      : 'bg-orange-500/20'
                  }`}>
                    {Math.round((score / shuffledQuestions.length) * 100) >= 70 ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                    )}
                  </div>
                </div>
                <h1 className="text-secondary-900 tracking-tight text-[32px] font-bold leading-tight px-4 text-center">
                  {Math.round((score / shuffledQuestions.length) * 100) >= 70 ? '¡Felicitaciones!' : '¡Sigue Practicando!'}
                </h1>
                <p className="text-secondary-500 mt-2">
                  {Math.round((score / shuffledQuestions.length) * 100) >= 70 
                    ? 'Has completado exitosamente el test.' 
                    : 'Puedes volver a intentarlo para mejorar tu puntaje.'}
                </p>
              </div>

              {/* Score Card */}
              <div className="p-4">
                <div className="flex flex-col items-stretch justify-start rounded-xl bg-slate-100 p-6">
                  <div className="flex w-full grow flex-col items-stretch justify-center gap-1">
                    <p className="text-secondary-500 text-sm font-medium leading-normal">YOUR SCORE</p>
                    <div className="flex items-end gap-3 justify-between">
                      <p className="text-secondary-900 text-4xl font-bold leading-tight tracking-[-0.015em]">
                        {score}/{shuffledQuestions.length}
                      </p>
                      <div className="flex flex-col gap-1 items-end">
                        <p className={`text-lg font-bold leading-tight ${
                          Math.round((score / shuffledQuestions.length) * 100) >= 70 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {Math.round((score / shuffledQuestions.length) * 100) >= 70 ? 'Great Job!' : 'Keep Trying!'}
                        </p>
                        <p className="text-secondary-500 text-base font-normal leading-normal">
                          {Math.round((score / shuffledQuestions.length) * 100)}% Correct
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Progress */}
              <div className="flex flex-col gap-2 px-4 pt-4">
                <div className="flex gap-6 justify-between items-center">
                  <p className="text-secondary-900 text-base font-medium leading-normal">Progreso del Curso</p>
                  <p className="text-secondary-500 text-sm font-normal leading-normal">{courseProgress}%</p>
                </div>
                <div className="rounded-full bg-slate-200 h-2 overflow-hidden">
                  <div 
                    className="h-2 rounded-full bg-primary-600 transition-all duration-500"
                    style={{ width: `${courseProgress}%` }}
                  ></div>
                </div>
              </div>

              {/* Review Answers */}
              <div className="flex flex-col gap-4 px-4 pt-8 pb-32">
                <h3 className="text-secondary-900 text-lg font-bold leading-tight">Review Your Answers</h3>
                <div className="flex flex-col gap-4">
                  {shuffledQuestions.map((question, qIndex) => {
                    const answer = answers[qIndex]
                    const isCorrect = answer?.isCorrect
                    return (
                      <div key={question.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-100/50 p-4">
                        <p className="text-slate-800 font-medium">
                          {qIndex + 1}. {renderFormattedText(question.text)}
                        </p>
                        <div className={`flex items-center gap-2 rounded-md p-3 ${
                          isCorrect ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isCorrect ? 'text-green-600' : 'text-red-600'}`} viewBox="0 0 24 24" fill="currentColor">
                            {isCorrect ? (
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            ) : (
                              <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                            )}
                          </svg>
                          <p className="text-slate-700 text-sm flex-1">
                            {renderFormattedText(question.options[answer?.selectedAnswer || 0]?.text)}
                          </p>
                        </div>
                        {!isCorrect && (
                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                            <p className="text-xs font-medium text-slate-500">CORRECT ANSWER</p>
                            <p className="text-sm text-slate-700">
                              {renderFormattedText(question.options.find((opt: any) => opt.isCorrect)?.text)}
                            </p>
                            {question.explanation && (
                              <div className="mt-2 pt-2 border-t border-slate-200">
                                <p className="text-xs font-medium text-slate-500 mb-1">EXPLICACIÓN</p>
                                <p className="text-sm text-slate-600 bg-amber-50 p-3 rounded-md border border-amber-200">
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

              {/* Sticky Bottom Buttons */}
              <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-primary-50 to-secondary-50 pt-4 pb-4 shadow-lg">
                <div className="flex flex-col gap-3 px-4 max-w-4xl mx-auto">
                  <button
                    onClick={handleContinue}
                    className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-6 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-primary-700 focus:ring-2 focus:ring-primary-500"
                  >
                    Start Next Test
                  </button>
                  <button
                    onClick={() => router.push(`/student/courses/${params.courseId}/modules/${params.moduleId}`)}
                    className="flex w-full items-center justify-center rounded-lg bg-transparent px-6 py-3.5 text-base font-bold text-secondary-900 ring-1 ring-inset ring-slate-300 transition-all hover:bg-slate-100 focus:ring-2 focus:ring-primary-500"
                  >
                    Back to Module
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        
        </div>
      </div>
    </ProtectedRoute>
  )
}