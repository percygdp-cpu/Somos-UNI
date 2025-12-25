'use client'

import { useAuth } from '@/components/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import StudentHeader from '@/components/StudentHeader'
import anime from 'animejs'
import confetti from 'canvas-confetti'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

// Función para renderizar LaTeX con KaTeX
const renderKaTeX = (latex: string, displayMode: boolean = false): string => {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      trust: true,
      strict: false
    })
  } catch (e) {
    console.error('KaTeX error:', e)
    return latex
  }
}

// Función para renderizar texto con LaTeX, subíndices, superíndices e imágenes
const renderFormattedText = (text: string) => {
  if (!text) return null
  
  // Dividir por saltos de línea y procesar cada línea
  const lines = text.split('\n')
  
  const processLine = (lineText: string, lineIndex: number) => {
    const parts: any[] = []
    
    // Regex para detectar imágenes markdown: ![alt](url) o ![alt](url){width}
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\s*\{(\d+)\})?/g
    // Regex para LaTeX: $...$ (inline) o $$...$$ (block)
    const latexBlockRegex = /\$\$([^$]+)\$\$/g
    const latexInlineRegex = /\$([^$]+)\$/g
    // Regex para formato legacy (sub/superíndices simples)
    const formatRegex = /([_^])(\{([^}]+)\}|(\d+)|([a-zA-Z]))/g
    
    // Primero procesar imágenes
    let imageMatch
    const segments: any[] = []
    let lastIndex = 0
    
    while ((imageMatch = imageRegex.exec(lineText)) !== null) {
      if (imageMatch.index > lastIndex) {
        segments.push({ type: 'text', content: lineText.substring(lastIndex, imageMatch.index), index: lastIndex })
      }
      segments.push({ 
        type: 'image', 
        alt: imageMatch[1] || 'imagen',
        url: imageMatch[2],
        width: imageMatch[3] ? parseInt(imageMatch[3]) : 300,
        index: imageMatch.index
      })
      lastIndex = imageMatch.index + imageMatch[0].length
    }
    
    if (lastIndex < lineText.length) {
      segments.push({ type: 'text', content: lineText.substring(lastIndex), index: lastIndex })
    }
    
    if (segments.length === 0) {
      segments.push({ type: 'text', content: lineText, index: 0 })
    }
    
    // Procesar cada segmento
    segments.forEach((segment, segIndex) => {
      if (segment.type === 'image') {
        parts.push(
          <img 
            key={`img-${lineIndex}-${segment.index}`}
            src={segment.url} 
            alt={segment.alt}
            style={{ maxWidth: `${segment.width}px`, width: '100%', height: 'auto', display: 'block', margin: '8px 0' }}
            className="rounded border border-gray-300"
          />
        )
      } else {
        // Procesar LaTeX y formato de texto
        let content = segment.content
        const textParts: any[] = []
        let currentIndex = 0
        
        // Combinar procesamiento de LaTeX block, inline y formato legacy
        const allMatches: Array<{start: number, end: number, type: string, content: string, displayMode?: boolean}> = []
        
        // Encontrar LaTeX block $$...$$
        let blockMatch: RegExpExecArray | null
        latexBlockRegex.lastIndex = 0
        while ((blockMatch = latexBlockRegex.exec(content)) !== null) {
          allMatches.push({
            start: blockMatch.index,
            end: blockMatch.index + blockMatch[0].length,
            type: 'latex',
            content: blockMatch[1],
            displayMode: true
          })
        }
        
        // Encontrar LaTeX inline $...$
        let inlineMatch: RegExpExecArray | null
        latexInlineRegex.lastIndex = 0
        while ((inlineMatch = latexInlineRegex.exec(content)) !== null) {
          // Verificar que no está dentro de un bloque $$
          const isInsideBlock = allMatches.some(m => 
            m.displayMode && inlineMatch!.index >= m.start && inlineMatch!.index < m.end
          )
          if (!isInsideBlock) {
            allMatches.push({
              start: inlineMatch.index,
              end: inlineMatch.index + inlineMatch[0].length,
              type: 'latex',
              content: inlineMatch[1],
              displayMode: false
            })
          }
        }
        
        // Encontrar formato legacy _{ } y ^{ }
        let legacyMatch: RegExpExecArray | null
        formatRegex.lastIndex = 0
        while ((legacyMatch = formatRegex.exec(content)) !== null) {
          // Verificar que no está dentro de LaTeX
          const isInsideLatex = allMatches.some(m => 
            legacyMatch!.index >= m.start && legacyMatch!.index < m.end
          )
          if (!isInsideLatex) {
            const matchType = legacyMatch[1]
            const matchContent = legacyMatch[3] || legacyMatch[4] || legacyMatch[5]
            allMatches.push({
              start: legacyMatch.index,
              end: legacyMatch.index + legacyMatch[0].length,
              type: matchType === '_' ? 'sub' : 'sup',
              content: matchContent
            })
          }
        }
        
        // Si no hay matches, agregar todo el contenido y salir
        if (allMatches.length === 0) {
          parts.push(content)
          return
        }
        
        // Ordenar por posición
        allMatches.sort((a, b) => a.start - b.start)
        
        // Procesar en orden
        allMatches.forEach((match, idx) => {
          // Texto antes del match
          if (match.start > currentIndex) {
            textParts.push(content.substring(currentIndex, match.start))
          }
          
          // El match
          if (match.type === 'latex') {
            textParts.push(
              <span 
                key={`latex-${lineIndex}-${segment.index}-${idx}`}
                dangerouslySetInnerHTML={{ __html: renderKaTeX(match.content, match.displayMode) }}
                style={match.displayMode ? { display: 'block', textAlign: 'center', margin: '8px 0' } : { display: 'inline' }}
              />
            )
          } else if (match.type === 'sub') {
            textParts.push(<sub key={`sub-${lineIndex}-${segment.index}-${idx}`}>{match.content}</sub>)
          } else if (match.type === 'sup') {
            textParts.push(<sup key={`sup-${lineIndex}-${segment.index}-${idx}`}>{match.content}</sup>)
          }
          
          currentIndex = match.end
        })
        
        // Texto restante después del último match
        if (currentIndex < content.length) {
          textParts.push(content.substring(currentIndex))
        }
        
        textParts.forEach(part => parts.push(part))
      }
    })
    
    return parts
  }
  
  // Procesar cada línea y agregar saltos de línea entre ellas
  return (
    <>
      {lines.map((line, idx) => (
        <React.Fragment key={`line-${idx}`}>
          {processLine(line, idx)}
          {idx < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  )
}

interface Question {
  id: string
  text: string
  options: Array<{ text: string; isCorrect: boolean; explanation?: string }>
  explanation?: string
  useOptionExplanations?: boolean
  optionExplanations?: string[]
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
  const [modalScale, setModalScale] = useState(1)
  const questionsPerBlock = 10

  // Calcular escala del modal según tamaño de ventana
  useEffect(() => {
    const calculateScale = () => {
      const windowHeight = window.innerHeight
      const modalBaseHeight = 650 // Altura base del modal en px
      const padding = 40 // Padding vertical mínimo
      const availableHeight = windowHeight - padding
      const scale = Math.min(1, availableHeight / modalBaseHeight)
      setModalScale(scale)
    }
    
    calculateScale()
    window.addEventListener('resize', calculateScale)
    return () => window.removeEventListener('resize', calculateScale)
  }, [])

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
      const blockPercentage = Math.round((milestoneBlockScore / questionsPerBlock) * 100)
      const colors = blockPercentage >= 80 
        ? ['#FFD700', '#FFA500', '#FF8C00', '#FFFF00'] // Oro
        : blockPercentage >= 60
        ? ['#C0C0C0', '#D3D3D3', '#E8E8E8', '#A9A9A9'] // Plata
        : [] // Bronce sin confeti
      
      if (colors.length > 0) {
        // Lanzar confetti inmediatamente
        confetti({
          particleCount: blockPercentage >= 80 ? 100 : 80,
          spread: 70,
          origin: { y: 0.6 },
          colors
        })
        
        setTimeout(() => {
          confetti({
            particleCount: blockPercentage >= 80 ? 80 : 60,
            spread: 100,
            origin: { y: 0.5 },
            colors
          })
        }, 200)
        
        setTimeout(() => {
          confetti({
            particleCount: blockPercentage >= 80 ? 60 : 40,
            spread: 80,
            origin: { y: 0.7 },
            colors
          })
        }, 400)
        
        // Globos solo para oro
        if (blockPercentage >= 80) {
          const createBalloon = (delay: number) => {
            setTimeout(() => {
              confetti({
                particleCount: 1,
                startVelocity: 0,
                ticks: 300,
                origin: {
                  x: Math.random() * 0.8 + 0.1,
                  y: 1
                },
                colors: [colors[Math.floor(Math.random() * colors.length)]],
                shapes: ['circle'],
                scalar: 3,
                gravity: -0.5,
                drift: Math.random() * 0.5 - 0.25
              })
            }, delay)
          }
          
          // Crear 6 globos con diferentes delays
          for (let i = 0; i < 6; i++) {
            createBalloon(i * 100 + 600)
          }
        }
      }
    }
  }, [showMilestoneModal, milestoneBlockScore])

  // Efecto para lanzar confetti cuando se muestra el modal de celebración final
  useEffect(() => {
    if (showFinalCelebration) {
      const percentage = Math.round((score / shuffledQuestions.length) * 100)
      
      // Sistema de medallas:
      // 🏆 Oro (80-100%): Confeti intenso + globos
      // 🥈 Plata (60-79%): Confeti moderado
      // 🥉 Bronce (0-59%): Sin confeti
      
      if (percentage >= 80) {
        // 🏆 MEDALLA DE ORO - Apoteósico
        const goldColors = ['#FFD700', '#FFA500', '#FF8C00', '#FFFF00']
        
        // Confeti intenso
        confetti({
          particleCount: 500,
          spread: 90,
          origin: { y: 0.6 },
          colors: goldColors,
          ticks: 300
        })
        
        setTimeout(() => {
          confetti({
            particleCount: 300,
            spread: 120,
            origin: { y: 0.5 },
            colors: goldColors
          })
        }, 250)
        
        setTimeout(() => {
          confetti({
            particleCount: 400,
            spread: 100,
            origin: { y: 0.7 },
            colors: goldColors
          })
        }, 500)
        
        // Globos flotantes (círculos que suben)
        const createBalloon = (delay: number) => {
          setTimeout(() => {
            confetti({
              particleCount: 1,
              startVelocity: 0,
              ticks: 300,
              origin: {
                x: Math.random() * 0.8 + 0.1,
                y: 1
              },
              colors: [goldColors[Math.floor(Math.random() * goldColors.length)]],
              shapes: ['circle'],
              scalar: 3,
              gravity: -0.5,
              drift: Math.random() * 0.5 - 0.25
            })
          }, delay)
        }
        
        // Crear 8 globos con diferentes delays
        for (let i = 0; i < 8; i++) {
          createBalloon(i * 100)
        }
      } else if (percentage >= 60) {
        // 🥈 MEDALLA DE PLATA
        const silverColors = ['#C0C0C0', '#D3D3D3', '#E8E8E8', '#A9A9A9']
        
        // Confeti moderado
        confetti({
          particleCount: 300,
          spread: 90,
          origin: { y: 0.6 },
          colors: silverColors,
          ticks: 200
        })
        
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.5 },
            colors: silverColors
          })
        }, 300)
      }
      // 🥉 MEDALLA DE BRONCE - Sin confeti
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
    // Scroll al inicio de la página para ver las nuevas preguntas
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
                          
                          {/* Determinar si hay explicaciones por opción */}
                          {(() => {
                            const hasOptionExplanations = question.useOptionExplanations || 
                              question.options.some((opt: any) => opt.explanation && opt.explanation.trim() !== '')
                            
                            if (hasOptionExplanations) {
                              const selectedIdx = answers.find(a => a.questionId === question.id)?.selectedAnswer
                              const hasAnyExplanation = question.options.some((opt: any) => opt.explanation && opt.explanation.trim() !== '')
                              
                              if (hasAnyExplanation) {
                                return (
                                  <div className="mt-3 pt-3 border-t border-yellow-200">
                                    <p className="text-xs font-semibold text-yellow-800 mb-2">💡 EXPLICACIÓN</p>
                                    <div className="text-sm text-yellow-900 space-y-2">
                                      {/* Mostrar explicación de TODAS las opciones */}
                                      {question.options.map((opt: any, optIdx: number) => {
                                        if (!opt.explanation || opt.explanation.trim() === '') return null
                                        
                                        const isSelected = optIdx === selectedIdx
                                        const isCorrectOpt = opt.isCorrect
                                        
                                        let letterBg = 'bg-yellow-600 text-white'
                                        let tag = ''
                                        
                                        if (isCorrectOpt) {
                                          letterBg = 'bg-green-500 text-white'
                                          tag = ' (Correcta)'
                                        } else if (isSelected) {
                                          letterBg = 'bg-red-500 text-white'
                                          tag = ' (Tu respuesta)'
                                        }
                                        
                                        return (
                                          <div key={optIdx} className="flex gap-2 items-start">
                                            <div className={`flex-shrink-0 w-6 h-6 rounded-full ${letterBg} flex items-center justify-center text-xs font-bold`}>
                                              {String.fromCharCode(65 + optIdx)}
                                            </div>
                                            <div className="flex-1">
                                              <span className={`${isCorrectOpt ? 'text-green-700 font-semibold' : isSelected ? 'text-red-700 font-semibold' : ''}`}>
                                                {tag && <span className="text-xs">{tag}</span>}
                                              </span>
                                              <span> {renderFormattedText(opt.explanation)}</span>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              }
                            }
                            
                            // Explicación normal (bloque)
                            if (question.explanation) {
                              return (
                                <div className="mt-3 pt-3 border-t border-yellow-200">
                                  <p className="text-xs font-semibold text-yellow-800 mb-2">💡 EXPLICACIÓN</p>
                                  <p className="text-sm text-yellow-900">
                                    {renderFormattedText(question.explanation)}
                                  </p>
                                </div>
                              )
                            }
                            
                            return null
                          })()}
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
              {(() => {
                const finalPercentage = Math.round((score / shuffledQuestions.length) * 100)
                const isGoldFinal = finalPercentage >= 80
                const isSilverFinal = finalPercentage >= 60 && finalPercentage < 80
                const isBronzeFinal = finalPercentage < 60
                
                const finalMedalEmoji = isGoldFinal ? '🏆' : isSilverFinal ? '🥈' : '🥉'
                const finalGradient = isGoldFinal 
                  ? 'from-yellow-50 to-orange-50 border-2 border-yellow-300'
                  : isSilverFinal 
                  ? 'from-gray-50 to-gray-100 border-2 border-gray-300'
                  : 'from-orange-50 to-amber-50 border-2 border-orange-300'
                const finalBgColor = isGoldFinal
                  ? 'bg-yellow-100'
                  : isSilverFinal
                  ? 'bg-gray-100'
                  : 'bg-orange-100'
                const finalTextColor = isGoldFinal
                  ? 'text-yellow-700'
                  : isSilverFinal
                  ? 'text-gray-700'
                  : 'text-orange-700'
                const finalTitle = isGoldFinal
                  ? '¡Apoteósico!'
                  : isSilverFinal
                  ? '¡Muy bien!'
                  : '¡Buen trabajo!'
                
                return (
                  <>
                    {/* Header con resultado */}
                    <div className={`rounded-xl p-8 mb-6 text-center bg-gradient-to-br ${finalGradient}`}>
                      {/* Icono de medalla */}
                      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${finalBgColor}`}>
                        <span className="text-5xl">
                          {finalMedalEmoji}
                        </span>
                      </div>
                      
                      {/* Título */}
                      <h1 className={`text-3xl font-bold mb-2 ${finalTextColor}`}>
                        {finalTitle}
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
                              isGoldFinal ? 'text-yellow-600' : isSilverFinal ? 'text-gray-500' : 'text-orange-600'
                            }`}>
                              {score}
                            </span>
                            <span className="text-3xl text-gray-400">/</span>
                            <span className="text-4xl font-semibold text-gray-500">{shuffledQuestions.length}</span>
                          </div>
                          
                          {/* Porcentaje */}
                          <div className={`inline-block px-5 py-2 rounded-full text-xl font-bold ${
                            isGoldFinal
                              ? 'bg-yellow-100 text-yellow-700' 
                              : isSilverFinal
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {finalPercentage}% Correcto
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}

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
                              
                              {/* Determinar si hay explicaciones por opción */}
                              {(() => {
                                const hasOptionExplanations = question.useOptionExplanations || 
                                  question.options.some((opt: any) => opt.explanation && opt.explanation.trim() !== '')
                                
                                if (hasOptionExplanations) {
                                  const hasAnyExplanation = question.options.some((opt: any) => opt.explanation && opt.explanation.trim() !== '')
                                  
                                  if (hasAnyExplanation) {
                                    return (
                                      <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
                                        <p className="text-xs font-semibold text-blue-800 mb-2">💡 Explicación:</p>
                                        <div className="text-sm text-blue-900 space-y-2">
                                          {/* Mostrar explicación de TODAS las opciones */}
                                          {question.options.map((opt: any, optIdx: number) => {
                                            if (!opt.explanation || opt.explanation.trim() === '') return null
                                            
                                            const isSelected = optIdx === answer?.selectedAnswer
                                            const isCorrectOpt = opt.isCorrect
                                            
                                            let letterBg = 'bg-blue-600 text-white'
                                            let tag = ''
                                            
                                            if (isCorrectOpt) {
                                              letterBg = 'bg-green-500 text-white'
                                              tag = ' (Correcta)'
                                            } else if (isSelected) {
                                              letterBg = 'bg-red-500 text-white'
                                              tag = ' (Tu respuesta)'
                                            }
                                            
                                            return (
                                              <div key={optIdx} className="flex gap-2 items-start">
                                                <div className={`flex-shrink-0 w-6 h-6 rounded-full ${letterBg} flex items-center justify-center text-xs font-bold`}>
                                                  {String.fromCharCode(65 + optIdx)}
                                                </div>
                                                <div className="flex-1">
                                                  <span className={`${isCorrectOpt ? 'text-green-700 font-semibold' : isSelected ? 'text-red-700 font-semibold' : ''}`}>
                                                    {tag && <span className="text-xs">{tag}</span>}
                                                  </span>
                                                  <span> {renderFormattedText(opt.explanation)}</span>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  }
                                }
                                
                                // Explicación normal
                                if (question.explanation) {
                                  return (
                                    <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
                                      <p className="text-xs font-semibold text-blue-800 mb-1">💡 Explicación:</p>
                                      <p className="text-sm text-blue-900">
                                        {renderFormattedText(question.explanation)}
                                      </p>
                                    </div>
                                  )
                                }
                                
                                return null
                              })()}
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
        {showMilestoneModal && (() => {
          const blockPercentage = Math.round((milestoneBlockScore / questionsPerBlock) * 100)
          const isGold = blockPercentage >= 80
          const isSilver = blockPercentage >= 60 && blockPercentage < 80
          const isBronze = blockPercentage < 60
          
          // Configuración por medalla del bloque
          const medalConfig = isGold ? {
            emoji: '🏆',
            medal: '🏆 ORO',
            gradient: 'from-yellow-400 via-yellow-500 to-orange-500',
            bgGradient: 'from-yellow-50 to-orange-50',
            borderColor: 'border-yellow-300',
            textColor: 'text-yellow-900',
            message: '¡APOTEÓSICO!',
            nameClass: 'animate-neon'
          } : isSilver ? {
            emoji: '🥈',
            medal: '🥈 PLATA',
            gradient: 'from-gray-300 via-gray-400 to-gray-500',
            bgGradient: 'from-gray-50 to-gray-100',
            borderColor: 'border-gray-300',
            textColor: 'text-gray-700',
            message: '¡MUY BIEN!',
            nameClass: ''
          } : {
            emoji: '🥉',
            medal: '🥉 BRONCE',
            gradient: 'from-orange-300 via-orange-400 to-orange-500',
            bgGradient: 'from-orange-50 to-amber-50',
            borderColor: 'border-orange-300',
            textColor: 'text-orange-900',
            message: '¡SIGUE ADELANTE!',
            nameClass: ''
          }
          
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scaleIn relative origin-center"
                style={{ transform: `scale(${modalScale})` }}
              >
                
                {/* Icono de medalla flotante grande en el fondo */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none z-0">
                  <div className="text-[180px]">{medalConfig.emoji}</div>
                </div>
                
                {/* Header con gradiente según medalla */}
                <div className={`bg-gradient-to-r ${medalConfig.gradient} px-6 py-4 text-center relative z-10`}>
                  <div className="text-5xl mb-2">{medalConfig.emoji}</div>
                  <h2 className="text-xl font-bold text-white mb-1 drop-shadow-lg">💪 ¡FUERZA GUERRERO!</h2>
                  <p className="text-white/90 text-lg font-bold drop-shadow-lg">BLOQUE {currentBlockIndex + 1} COMPLETADO</p>
                </div>

                {/* Body */}
                <div className="px-6 py-5 text-center relative z-10">
                  {/* Score grande */}
                  <div className="mb-4">
                    <p className="text-6xl font-black mb-2 text-gray-700">
                      {milestoneBlockScore}/{questionsPerBlock}
                    </p>
                    <p className="text-2xl font-bold text-gray-600">
                      ({blockPercentage}%)
                    </p>
                  </div>

                  {/* Mensaje de felicitaciones épicas */}
                  <div className="mb-4">
                    <h3 className={`text-2xl font-bold mb-2 bg-gradient-to-r ${medalConfig.gradient} bg-clip-text text-transparent`}>
                      {medalConfig.message}
                    </h3>
                    <p 
                      className={`text-3xl font-black mb-1 ${medalConfig.nameClass}`}
                      style={{
                        color: isGold ? '#1f2937' : isSilver ? '#1f2937' : '#1f2937',
                        textShadow: isGold ? '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 165, 0, 0.6)' : 'none'
                      }}
                    >
                      {user?.name?.toUpperCase() || 'GUERRERO'}
                    </p>
                    <p className="text-xl font-bold text-gray-700">
                      ¡ERES INCREÍBLE!
                    </p>
                  </div>

                  {/* Mensaje motivacional personalizado */}
                  <div className={`bg-gradient-to-r ${medalConfig.bgGradient} border-2 ${medalConfig.borderColor} rounded-lg p-3 mb-4`}>
                    <p className={`text-sm font-bold ${medalConfig.textColor}`}>
                      {isGold
                        ? `¡${milestoneBlockScore}/${questionsPerBlock}! ${user?.name?.toUpperCase() || 'GUERRERO'}, ¡ERES UN CAMPEÓN! DOMINAS EL BLOQUE A LA PERFECCIÓN.`
                        : isSilver
                        ? `¡${milestoneBlockScore}/${questionsPerBlock}! ${user?.name?.toUpperCase() || 'GUERRERO'}, ¡MUY BUEN TRABAJO! ESTÁS EN EL CAMINO CORRECTO.`
                        : `¡${milestoneBlockScore}/${questionsPerBlock}! ${user?.name?.toUpperCase() || 'GUERRERO'}, SIGUE PRACTICANDO, CADA ERROR TE ACERCA A LA EXCELENCIA.`
                      }
                    </p>
                  </div>

                  {/* Progreso total */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-secondary-700">Preguntas contestadas:</span>
                      <span className="text-base font-bold text-secondary-900">
                        {(currentBlockIndex + 1) * questionsPerBlock}/{shuffledQuestions.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`bg-gradient-to-r ${medalConfig.gradient} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${((currentBlockIndex + 1) * questionsPerBlock / shuffledQuestions.length) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-secondary-700">Progreso total:</span>
                      <span className={`text-base font-bold bg-gradient-to-r ${medalConfig.gradient} bg-clip-text text-transparent`}>
                        {Math.round(((currentBlockIndex + 1) * questionsPerBlock / shuffledQuestions.length) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Botón continuar */}
                  <button
                    onClick={handleContinueToNextBlock}
                    className={`w-full px-5 py-3 bg-gradient-to-r ${medalConfig.gradient} text-white rounded-xl font-bold text-base shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2`}
                  >
                    <span>🚀 CONTINUAR CON LAS SIGUIENTES 10 PREGUNTAS</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
        
        {/* Modal de Celebración Final */}
        {showFinalCelebration && (() => {
          const percentage = Math.round((score / shuffledQuestions.length) * 100)
          const isGold = percentage >= 80
          const isSilver = percentage >= 60 && percentage < 80
          const isBronze = percentage < 60
          
          // Configuración por medalla
          const medalConfig = isGold ? {
            emoji: '🏆',
            medal: '🏆 MEDALLA DE ORO',
            gradient: 'from-yellow-400 via-yellow-500 to-orange-500',
            bgGradient: 'from-yellow-50 to-orange-50',
            borderColor: 'border-yellow-300',
            textColor: 'text-yellow-900',
            message: '¡APOTEÓSICO!',
            nameClass: 'animate-neon',
            textShadow: ''
          } : isSilver ? {
            emoji: '🥈',
            medal: '🥈 MEDALLA DE PLATA',
            gradient: 'from-gray-300 via-gray-400 to-gray-500',
            bgGradient: 'from-gray-50 to-gray-100',
            borderColor: 'border-gray-300',
            textColor: 'text-gray-700',
            message: '¡MUY BIEN!',
            nameClass: '',
            textShadow: ''
          } : {
            emoji: '🥉',
            medal: '🥉 MEDALLA DE BRONCE',
            gradient: 'from-orange-300 via-orange-400 to-orange-500',
            bgGradient: 'from-orange-50 to-amber-50',
            borderColor: 'border-orange-300',
            textColor: 'text-orange-900',
            message: '¡SIGUE ADELANTE!',
            nameClass: '',
            textShadow: ''
          }
          
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform animate-scaleIn relative origin-center"
                style={{ transform: `scale(${modalScale})` }}
              >
                
                {/* Icono de medalla flotante grande en el fondo */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none z-0">
                  <div className="text-[180px]">{medalConfig.emoji}</div>
                </div>
                
                {/* Header con gradiente según medalla */}
                <div className={`bg-gradient-to-r ${medalConfig.gradient} px-6 py-4 text-center relative z-10`}>
                  <div className="text-5xl mb-2">{medalConfig.emoji}</div>
                  <h2 className="text-xl font-bold text-white mb-1 drop-shadow-lg">💪 ¡FUERZA GUERRERO!</h2>
                  <p className="text-white/90 text-lg font-bold drop-shadow-lg">TEST COMPLETADO</p>
                </div>

                {/* Body */}
                <div className="px-6 py-5 text-center relative z-10">
                  {/* Puntaje */}
                  <div className="mb-4">
                    <p className="text-6xl font-black mb-2 text-gray-700">
                      {score}/{shuffledQuestions.length}
                    </p>
                    <p className="text-2xl font-bold text-gray-600">({percentage}%)</p>
                  </div>

                  {/* Mensaje */}
                  <div className="mb-4">
                    <h3 className={`text-2xl font-bold mb-2 bg-gradient-to-r ${medalConfig.gradient} bg-clip-text text-transparent`}>
                      {medalConfig.message}
                    </h3>
                    <p 
                      className={`text-3xl font-black mb-1 ${medalConfig.nameClass}`}
                      style={{
                        color: isGold ? '#1f2937' : isSilver ? '#1f2937' : '#1f2937',
                        textShadow: isGold ? '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 165, 0, 0.6)' : 'none'
                      }}
                    >
                      {user?.name?.toUpperCase() || 'GUERRERO'}
                    </p>
                    <p className="text-xl font-bold text-gray-700">
                      ¡ERES INCREÍBLE!
                    </p>
                  </div>

                  {/* Mensaje motivacional personalizado */}
                  <div className={`bg-gradient-to-r ${medalConfig.bgGradient} border-2 ${medalConfig.borderColor} rounded-lg p-3 mb-4`}>
                    <p className={`text-sm font-bold ${medalConfig.textColor}`}>
                      {isGold
                        ? `¡${score}/${shuffledQuestions.length}! ${user?.name?.toUpperCase() || 'GUERRERO'}, ¡ERES UN CAMPEÓN! DOMINAS EL TEMA A LA PERFECCIÓN.`
                        : isSilver
                        ? `¡${score}/${shuffledQuestions.length}! ${user?.name?.toUpperCase() || 'GUERRERO'}, ¡MUY BUEN TRABAJO! ESTÁS EN EL CAMINO CORRECTO.`
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
                    className={`w-full px-5 py-3 bg-gradient-to-r ${medalConfig.gradient} text-white rounded-xl font-bold text-base shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2`}
                  >
                    <span>VER RESULTADOS DETALLADOS</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
        
        </div>
      </div>
    </ProtectedRoute>
  )
}