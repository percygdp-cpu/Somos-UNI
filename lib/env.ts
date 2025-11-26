/**
 * Configuración centralizada de variables de entorno
 * Valida que todas las variables críticas estén presentes
 */

// Validar variables de entorno al inicio
const requiredEnvVars = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
] as const

const optionalEnvVars = [
  'BLOB_READ_WRITE_TOKEN',
  'NODE_ENV',
] as const

export function validateEnv() {
  const missing: string[] = []
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `❌ Variables de entorno faltantes: ${missing.join(', ')}\n` +
      `Por favor, configura estas variables en tu archivo .env.local o en Vercel`
    )
  }
}

// Exportar variables con tipos seguros
export const env = {
  // Base de datos
  tursoUrl: process.env.TURSO_DATABASE_URL!,
  tursoToken: process.env.TURSO_AUTH_TOKEN!,
  
  // Storage
  blobToken: process.env.BLOB_READ_WRITE_TOKEN,
  
  // Configuración
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  isProd: process.env.NODE_ENV === 'production',
} as const

// Ejecutar validación en tiempo de importación (solo en servidor)
if (typeof window === 'undefined') {
  try {
    validateEnv()
    console.log('✅ Variables de entorno validadas correctamente')
  } catch (error) {
    console.error(error)
    if (env.isProd) {
      throw error // En producción, fallar si faltan variables
    }
  }
}
