'use client'

import { useState } from 'react'

interface FormulaEditorProps {
  onInsertFormula: (latex: string) => void
}

const FORMULA_BUTTONS = [
  { label: '½', latex: '\\frac{1}{2}', title: 'Fracción 1/2' },
  { label: 'a/b', latex: '\\frac{a}{b}', title: 'Fracción' },
  { label: '√', latex: '\\sqrt{x}', title: 'Raíz cuadrada' },
  { label: '∛', latex: '\\sqrt[3]{x}', title: 'Raíz cúbica' },
  { label: 'x²', latex: '^{2}', title: 'Cuadrado' },
  { label: 'xⁿ', latex: '^{n}', title: 'Potencia' },
  { label: 'π', latex: '\\pi', title: 'Pi' },
  { label: 'θ', latex: '\\theta', title: 'Theta' },
  { label: 'α', latex: '\\alpha', title: 'Alfa' },
  { label: 'β', latex: '\\beta', title: 'Beta' },
  { label: 'Σ', latex: '\\sum_{i=1}^{n}', title: 'Sumatoria' },
  { label: '∫', latex: '\\int_{a}^{b}', title: 'Integral' },
  { label: '∞', latex: '\\infty', title: 'Infinito' },
  { label: '±', latex: '\\pm', title: 'Más menos' },
  { label: '≠', latex: '\\neq', title: 'Diferente' },
  { label: '≤', latex: '\\leq', title: 'Menor o igual' },
  { label: '≥', latex: '\\geq', title: 'Mayor o igual' },
  { label: '÷', latex: '\\div', title: 'División' },
  { label: '×', latex: '\\times', title: 'Multiplicación' },
  { label: '∈', latex: '\\in', title: 'Pertenece' },
]

const COMMON_FORMULAS = [
  { label: 'Ecuación cuadrática', latex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' },
  { label: 'Pitágoras', latex: 'a^2 + b^2 = c^2' },
  { label: 'Área círculo', latex: 'A = \\pi r^2' },
  { label: 'Área triángulo', latex: 'A = \\frac{b \\cdot h}{2}' },
  { label: 'Derivada', latex: '\\frac{d}{dx}f(x)' },
  { label: 'Límite', latex: '\\lim_{x \\to \\infty}' },
]

export default function FormulaEditor({ onInsertFormula }: FormulaEditorProps) {
  const [showCommon, setShowCommon] = useState(false)
  const [customLatex, setCustomLatex] = useState('')

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">🔢 Símbolos Matemáticos</h3>
        <button
          onClick={() => setShowCommon(!showCommon)}
          className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
        >
          {showCommon ? 'Ver símbolos' : 'Fórmulas comunes'}
        </button>
      </div>

      {!showCommon ? (
        <div className="grid grid-cols-10 gap-1">
          {FORMULA_BUTTONS.map((btn, idx) => (
            <button
              key={idx}
              onClick={() => onInsertFormula(btn.latex)}
              className="w-10 h-10 flex items-center justify-center text-lg bg-gray-50 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-all border border-gray-200"
              title={btn.title}
            >
              {btn.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {COMMON_FORMULAS.map((formula, idx) => (
            <button
              key={idx}
              onClick={() => onInsertFormula(formula.latex)}
              className="px-3 py-2 text-sm bg-gray-50 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-all border border-gray-200 text-left"
              title={formula.latex}
            >
              {formula.label}
            </button>
          ))}
        </div>
      )}

      {/* Input personalizado */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={customLatex}
          onChange={(e) => setCustomLatex(e.target.value)}
          placeholder="LaTeX personalizado..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          onClick={() => {
            if (customLatex.trim()) {
              onInsertFormula(customLatex)
              setCustomLatex('')
            }
          }}
          disabled={!customLatex.trim()}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Insertar
        </button>
      </div>
    </div>
  )
}
