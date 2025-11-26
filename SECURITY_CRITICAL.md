# 🔐 Guía de Seguridad - Implementaciones Críticas Pendientes

## ⚠️ IMPLEMENTACIONES OBLIGATORIAS ANTES DE PRODUCCIÓN

### 1. Hash de Contraseñas con Bcrypt

**ESTADO ACTUAL:** ❌ Las contraseñas se almacenan en texto plano  
**PRIORIDAD:** 🔴 CRÍTICA

**Implementación:**

```typescript
// 1. Instalar bcrypt
// npm install bcryptjs
// npm install --save-dev @types/bcryptjs

// 2. Actualizar app/api/users/route.ts

import bcrypt from 'bcryptjs'

// Al crear usuario (POST):
const hashedPassword = await bcrypt.hash(password, 10)

// Guardar hashedPassword en lugar de password
await client.execute({
  sql: 'INSERT INTO users (name, username, password, role, status) VALUES (?, ?, ?, ?, ?)',
  args: [name, username, hashedPassword, role, status]
})

// Al actualizar contraseña (PUT):
if (password) {
  const hashedPassword = await bcrypt.hash(password, 10)
  // Actualizar con hashedPassword
}
```

**Autenticación:**

```typescript
// app/api/auth/login/route.ts (crear este archivo)
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  const { username, password } = await request.json()
  
  // Buscar usuario
  const result = await client.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: [username]
  })
  
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 })
  }
  
  const user = result.rows[0]
  
  // Verificar contraseña
  const isValid = await bcrypt.compare(password, user.password as string)
  
  if (!isValid) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }
  
  // Aquí deberías crear un JWT token
  // Por ahora, retornar datos del usuario
  return NextResponse.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role
  })
}
```

### 2. Autenticación JWT

**ESTADO ACTUAL:** ❌ No hay validación de sesión  
**PRIORIDAD:** 🔴 CRÍTICA

**Implementación:**

```typescript
// 1. Instalar jsonwebtoken
// npm install jsonwebtoken
// npm install --save-dev @types/jsonwebtoken

// 2. Crear lib/jwt.ts
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production'

export function signToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

// 3. Actualizar login para incluir JWT
// app/api/auth/login/route.ts
import { signToken } from '@/lib/jwt'

// Después de verificar credenciales:
const token = signToken({
  id: user.id,
  username: user.username,
  role: user.role
})

return NextResponse.json({
  user: { id, name, username, role },
  token
})

// 4. Crear middleware de autenticación
// lib/auth-middleware.ts
import { verifyToken } from './jwt'

export function requireAuth(handler: Function) {
  return async (request: Request) => {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const payload = verifyToken(token)
    
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    
    // Agregar usuario al request
    (request as any).user = payload
    
    return handler(request)
  }
}

// 5. Usar en endpoints protegidos
// app/api/users/route.ts
import { requireAuth } from '@/lib/auth-middleware'

export const POST = requireAuth(async (request: Request) => {
  // Solo usuarios autenticados pueden acceder
  const user = (request as any).user
  
  // Verificar que sea admin
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }
  
  // Tu código aquí...
})
```

### 3. Validación de Roles y Permisos

**ESTADO ACTUAL:** ⚠️ Parcial (solo en frontend)  
**PRIORIDAD:** 🟠 ALTA

```typescript
// lib/permissions.ts
export function canAccessAdmin(role: string) {
  return role === 'admin'
}

export function canEditCourse(role: string) {
  return role === 'admin'
}

export function canTakeTest(role: string) {
  return role === 'student' || role === 'admin'
}

// Usar en cada endpoint
if (!canAccessAdmin(user.role)) {
  return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
}
```

### 4. Rate Limiting

**ESTADO ACTUAL:** ❌ No implementado  
**PRIORIDAD:** 🟡 MEDIA

```typescript
// lib/rate-limit.ts
const rateLimit = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(ip: string, maxRequests = 100, windowMs = 60000) {
  const now = Date.now()
  const record = rateLimit.get(ip)
  
  if (!record || record.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

// Usar en middleware.ts
export function middleware(request: NextRequest) {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes' },
      { status: 429 }
    )
  }
  
  return NextResponse.next()
}
```

### 5. Sanitización de Input

**ESTADO ACTUAL:** ✅ Funciones creadas en lib/validation.ts  
**PRIORIDAD:** 🟢 BAJA (ya implementado)

**Asegurarse de usar en todos los endpoints:**

```typescript
import { sanitizeInput, validateRequiredFields } from '@/lib/validation'

// En cada POST/PUT
const cleanTitle = sanitizeInput(title)
const cleanDescription = sanitizeInput(description)
```

### 6. HTTPS y Headers de Seguridad

**ESTADO ACTUAL:** ✅ Automático en Vercel  
**PRIORIDAD:** 🟢 BAJA (Vercel lo maneja)

**Headers adicionales recomendados:**

```javascript
// next.config.js
const nextConfig = {
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  }
}
```

### 7. Validación de Archivos Subidos

**ESTADO ACTUAL:** ⚠️ Básica  
**PRIORIDAD:** 🟠 ALTA

```typescript
// app/api/upload/route.ts
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf']

if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    { error: 'Archivo demasiado grande (máx 10MB)' },
    { status: 400 }
  )
}

if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json(
    { error: 'Solo se permiten archivos PDF' },
    { status: 400 }
  )
}
```

## 📋 Checklist de Seguridad Pre-Producción

- [ ] **Hash de contraseñas con bcrypt** (CRÍTICO)
- [ ] **Autenticación JWT** (CRÍTICO)
- [ ] **Validación de sesión en todos los endpoints** (CRÍTICO)
- [ ] **Cambiar contraseña de admin por defecto** (CRÍTICO)
- [ ] **Agregar JWT_SECRET a variables de entorno** (CRÍTICO)
- [ ] Validación de roles en backend
- [ ] Rate limiting implementado
- [ ] Headers de seguridad configurados
- [ ] Validación de tamaño y tipo de archivos
- [ ] CORS configurado apropiadamente
- [ ] Logging de errores implementado
- [ ] Monitoreo de seguridad activo

## 🚨 Recordatorio

**NO DEPLOYES A PRODUCCIÓN SIN:**
1. Hash de contraseñas
2. Autenticación JWT
3. Validación de sesión

Estas son vulnerabilidades críticas que pueden comprometer toda la aplicación.

---

**Tiempo estimado de implementación:** 4-6 horas  
**Desarrollador recomendado:** Senior con experiencia en seguridad
