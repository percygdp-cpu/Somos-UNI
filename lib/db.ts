import { createClient } from '@libsql/client'

// Cliente de Turso
export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
})

// Helper para ejecutar queries
export async function executeQuery(query: string, params: any[] = []) {
  try {
    const result = await turso.execute({
      sql: query,
      args: params
    })
    return result
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
}

// Helper para manejar errores de DB
export function handleDbError(error: any) {
  console.error('Database error:', error)
  return {
    error: error.message || 'Database error occurred',
    details: process.env.NODE_ENV === 'development' ? error : undefined
  }
}

// Helper para formatear fechas
export function formatDbDate(date: Date | string | null): Date | null {
  if (!date) return null
  return new Date(date)
}
