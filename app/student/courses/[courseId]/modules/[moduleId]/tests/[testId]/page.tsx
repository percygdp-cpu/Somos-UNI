'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import { Confetti, type ConfettiRef } from '@/components/magicui/confetti'
import anime from 'animejs'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [showResult, setShowResult] = useState(false)
  const [testCompleted, setTestCompleted] = useState(false)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [courseProgress, setCourseProgress] = useState(0)
  const [prevProgress, setPrevProgress] = useState(0)
  const [shouldShowConfetti, setShouldShowConfetti] = useState(false)

  useEffect(() => {
    loadTestData()
  }, [params.testId])

  // Efecto para lanzar confetti cuando se aprueba
  useEffect(() => {
    if (testCompleted && shouldShowConfetti && confettiRef.current) {
      const timer = setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [testCompleted, shouldShowConfetti])
    loadTestData()
  }, [params.testId])

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
      // Mezclar preguntas y sus opciones para hacer el test aleatorio
      const shuffled = [...foundTest.questions].sort(() => Math.random() - 0.5).map((question: any) => ({
        ...question,
        options: [...question.options].sort(() => Math.random() - 0.5)
      }))
      setShuffledQuestions(shuffled)
      setLoading(false)
    } catch (error) {
      console.error('Error cargando test:', error)
    }
  }

  useEffect(() => {
    if (!loading && test) {
      // Animar pregunta
      anime({
        targets: '.question-container',
        translateY: [30, 0],
        opacity: [0, 1],
        duration: 600,
        easing: 'easeOutQuart'
      })
    }
  }, [loading, currentQuestionIndex])

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return // No permitir cambiar respuesta
    
    setSelectedAnswer(answerIndex)
    const currentQuestion = shuffledQuestions[currentQuestionIndex]
    const selectedOption = currentQuestion.options[answerIndex]
    const isCorrect = selectedOption?.isCorrect || false
    
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      selectedAnswer: answerIndex,
      isCorrect
    }
    
    const updatedAnswers = [...answers, newAnswer]
    setAnswers(updatedAnswers)
    
    // Mostrar resultado después de un breve retraso
    setTimeout(() => {
      setShowResult(true)
      
      setTimeout(() => {
        if (currentQuestionIndex < shuffledQuestions.length - 1) {
          // Pasar a la siguiente pregunta
          setCurrentQuestionIndex(currentQuestionIndex + 1)
          setSelectedAnswer(null)
          setShowResult(false)
        } else {
          // Completar test con las respuestas actualizadas
          completeTest(updatedAnswers)
        }
      }, 1500)
    }, 500)
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

  const currentQuestion = shuffledQuestions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / shuffledQuestions.length) * 100

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
                  Pregunta {currentQuestionIndex + 1} de {shuffledQuestions.length}
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
            <div className="question-container">
              {/* Question */}
              <div className="card mb-6">
                <h2 className="text-2xl font-semibold text-secondary-900 mb-6">
                  {currentQuestion.text}
                </h2>
                
                <div className="space-y-3">
                  {currentQuestion.options.map((option: any, index: number) => {
                    const isSelected = selectedAnswer === index
                    const isCorrect = option.isCorrect
                    const showCorrect = showResult && isCorrect
                    const showIncorrect = showResult && isSelected && !isCorrect
                    
                    let buttonClass = 'w-full p-4 text-left border-2 rounded-lg transition-all duration-300 '
                    
                    if (showCorrect) {
                      buttonClass += 'border-green-500 bg-green-50 text-green-800'
                    } else if (showIncorrect) {
                      buttonClass += 'border-red-500 bg-red-50 text-red-800'
                    } else if (isSelected) {
                      buttonClass += 'border-primary-500 bg-primary-50 text-primary-800'
                    } else {
                      buttonClass += 'border-secondary-300 hover:border-primary-300 hover:bg-primary-50'
                    }
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(index)}
                        disabled={selectedAnswer !== null}
                        className={buttonClass}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            showCorrect ? 'border-green-500 bg-green-500' :
                            showIncorrect ? 'border-red-500 bg-red-500' :
                            isSelected ? 'border-primary-500 bg-primary-500' :
                            'border-secondary-400'
                          }`}>
                            {showCorrect && <span className="text-white text-sm">✓</span>}
                            {showIncorrect && <span className="text-white text-sm">✗</span>}
                            {isSelected && !showResult && <span className="text-white text-sm">●</span>}
                          </div>
                          <span>{option.text}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Feedback */}
              {showResult && (
                <div className={`card ${
                  answers[answers.length - 1]?.isCorrect 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="text-center">
                    <div className="text-4xl mb-2">
                      {answers[answers.length - 1]?.isCorrect ? '✅' : '❌'}
                    </div>
                    <div className={`text-lg font-semibold ${
                      answers[answers.length - 1]?.isCorrect 
                        ? 'text-green-800' 
                        : 'text-red-800'
                    }`}>
                      {answers[answers.length - 1]?.isCorrect ? '¡Correcto!' : 'Incorrecto'}
                    </div>
                    {answers[answers.length - 1]?.isCorrect === false && (
                      <p className="text-red-600 mt-2">
                        La respuesta correcta es: {currentQuestion.options.find((opt: any) => opt.isCorrect)?.text}
                      </p>
                    )}
                  </div>
                </div>
              )}
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
                          {qIndex + 1}. {question.text}
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
                            {question.options[answer?.selectedAnswer || 0]?.text}
                          </p>
                        </div>
                        {!isCorrect && (
                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                            <p className="text-xs font-medium text-slate-500">CORRECT ANSWER</p>
                            <p className="text-sm text-slate-700">
                              {question.options.find((opt: any) => opt.isCorrect)?.text}
                            </p>
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