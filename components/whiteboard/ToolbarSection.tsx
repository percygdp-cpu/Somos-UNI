'use client'

import { ReactNode, useState } from 'react'

interface ToolbarSectionProps {
  title: string
  icon: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}

export default function ToolbarSection({ title, icon, children, defaultOpen = false }: ToolbarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          isOpen 
            ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500' 
            : 'hover:bg-gray-100 text-gray-700'
        }`}
        title={title}
      >
        {icon}
        <span className="hidden sm:inline">{title}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-max animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  )
}
