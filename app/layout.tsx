import { AuthProvider } from '@/components/AuthContext'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Somos UNI - Plataforma de Aprendizaje',
  description: 'Plataforma integral para gestión de cursos, estudiantes y evaluaciones',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}