'use client'

import React, { useEffect, useRef, useState } from 'react'

interface OCRPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export default function OCRPanel({ canvasRef }: OCRPanelProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const workerRef = useRef<Tesseract.Worker | null>(null)

  // Pre-cargar el modelo de Tesseract
  useEffect(() => {
    const loadTesseract = async () => {
      try {
        const Tesseract = await import('tesseract.js')
        const worker = await Tesseract.createWorker('spa', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100))
            }
          }
        })
        workerRef.current = worker
        setIsModelLoaded(true)
      } catch (err) {
        console.error('Error loading Tesseract:', err)
        setError('Error al cargar el modelo de reconocimiento')
      }
    }

    loadTesseract()

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [])

  const handleRecognize = async () => {
    const canvas = canvasRef.current
    if (!canvas || !workerRef.current) return

    setIsProcessing(true)
    setError(null)
    setProgress(0)

    try {
      // Obtener imagen del canvas
      const imageData = canvas.toDataURL('image/png')

      // Reconocer texto
      const result = await workerRef.current.recognize(imageData)
      setRecognizedText(result.data.text.trim() || '(No se detectó texto)')
    } catch (err) {
      console.error('OCR Error:', err)
      setError('Error al procesar la imagen')
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const handleCopy = async () => {
    if (recognizedText && recognizedText !== '(No se detectó texto)') {
      await navigator.clipboard.writeText(recognizedText)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          📝 Reconocimiento de Texto
        </h3>
        {!isModelLoaded && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando modelo...
          </span>
        )}
      </div>

      <button
        onClick={handleRecognize}
        disabled={isProcessing || !isModelLoaded}
        className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
          isProcessing || !isModelLoaded
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-secondary-600 text-white hover:bg-secondary-700'
        }`}
      >
        {isProcessing ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Procesando... {progress}%
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Reconocer Texto
          </>
        )}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {recognizedText && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Texto detectado:</span>
            <button
              onClick={handleCopy}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              title="Copiar al portapapeles"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar
            </button>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {recognizedText}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        💡 Escribe con letra clara y separada para mejores resultados.
      </p>
    </div>
  )
}
