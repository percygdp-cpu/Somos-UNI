/**
 * Utilidades de validación para producción
 */

/**
 * Valida que un email tenga formato correcto
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Valida que un username sea válido (alfanumérico, 3-20 caracteres)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  return usernameRegex.test(username)
}

/**
 * Valida que una contraseña cumpla requisitos mínimos
 */
export function isValidPassword(password: string): boolean {
  // Mínimo 6 caracteres (actualizar a requisitos más estrictos en producción)
  return password.length >= 6
}

/**
 * Sanitiza input de usuario para prevenir XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Valida que un ID sea un número positivo válido
 */
export function isValidId(id: any): boolean {
  const num = Number(id)
  return !isNaN(num) && num > 0 && Number.isInteger(num)
}

/**
 * Valida que un porcentaje esté en el rango correcto
 */
export function isValidPercentage(percentage: any): boolean {
  const num = Number(percentage)
  return !isNaN(num) && num >= 0 && num <= 100
}

/**
 * Valida que un rol sea válido
 */
export function isValidRole(role: string): boolean {
  return ['student', 'admin'].includes(role)
}

/**
 * Valida que un status sea válido
 */
export function isValidStatus(status: string): boolean {
  return ['active', 'inactive'].includes(status)
}

/**
 * Valida que un rango de frase motivacional sea válido
 */
export function isValidPhraseRange(range: string): boolean {
  return ['0-30', '31-50', '51-70', '71-90', '91-100'].includes(range)
}

/**
 * Limita la longitud de un string
 */
export function limitString(str: string, maxLength: number): string {
  return str.length > maxLength ? str.substring(0, maxLength) : str
}

/**
 * Valida request body para evitar payloads demasiado grandes
 */
export function isValidPayloadSize(data: any, maxSizeKB: number = 1024): boolean {
  const sizeInBytes = new Blob([JSON.stringify(data)]).size
  const sizeInKB = sizeInBytes / 1024
  return sizeInKB <= maxSizeKB
}

/**
 * Valida que los campos requeridos estén presentes
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter(field => !data[field])
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Genera mensaje de error para campos faltantes
 */
export function getMissingFieldsError(missingFields: string[]): string {
  return `Campos requeridos faltantes: ${missingFields.join(', ')}`
}
