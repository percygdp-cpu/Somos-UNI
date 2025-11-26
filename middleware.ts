import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Middleware para validar variables de entorno críticas
export function middleware(request: NextRequest) {
  // Verificar que las variables de entorno estén configuradas
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ Variables de entorno de base de datos no configuradas')
    
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }
  }

  // Proteger rutas de administración
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  
  // Aquí deberías implementar validación de sesión JWT
  // Por ahora, solo validamos que existan las rutas
  
  return NextResponse.next()
}

// Configurar qué rutas ejecutan el middleware
export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
  ],
}
