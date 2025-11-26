#!/usr/bin/env node

/**
 * Script de validación pre-deploy
 * Ejecuta todas las verificaciones necesarias antes de hacer deploy
 */

const fs = require('fs')
const path = require('path')

console.log('\n🔍 Iniciando validación pre-deploy...\n')

let errors = 0
let warnings = 0

// 1. Verificar que exista .env.local o variables de entorno
console.log('📋 Verificando variables de entorno...')
const envFile = path.join(__dirname, '.env.local')
if (!fs.existsSync(envFile) && !process.env.TURSO_DATABASE_URL) {
  console.error('❌ No se encontró .env.local y TURSO_DATABASE_URL no está en el entorno')
  errors++
} else {
  console.log('✅ Variables de entorno configuradas')
}

// 2. Verificar archivos críticos
console.log('\n📁 Verificando archivos críticos...')
const criticalFiles = [
  'schema.sql',
  'migrate-motivational-phrases.js',
  'package.json',
  'next.config.js',
  'tsconfig.json',
]

criticalFiles.forEach(file => {
  if (!fs.existsSync(path.join(__dirname, file))) {
    console.error(`❌ Archivo faltante: ${file}`)
    errors++
  } else {
    console.log(`✅ ${file}`)
  }
})

// 3. Verificar que .env.local esté en .gitignore
console.log('\n🔒 Verificando .gitignore...')
const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8')
if (!gitignore.includes('.env')) {
  console.error('❌ .env no está en .gitignore - RIESGO DE SEGURIDAD')
  errors++
} else {
  console.log('✅ .env está en .gitignore')
}

// 4. Verificar que no haya console.logs en archivos de API
console.log('\n🐛 Verificando console.logs en APIs...')
const apiDir = path.join(__dirname, 'app', 'api')

function checkConsoleLogsInDir(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })
  
  files.forEach(file => {
    const fullPath = path.join(dir, file.name)
    
    if (file.isDirectory() && file.name !== 'node_modules') {
      checkConsoleLogsInDir(fullPath)
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const consoleCount = (content.match(/console\.(log|debug)/g) || []).length
      
      if (consoleCount > 0) {
        console.warn(`⚠️  ${fullPath.replace(__dirname, '.')} tiene ${consoleCount} console.log(s)`)
        warnings++
      }
    }
  })
}

if (fs.existsSync(apiDir)) {
  checkConsoleLogsInDir(apiDir)
  if (warnings === 0) {
    console.log('✅ No se encontraron console.logs en APIs')
  }
} else {
  console.error('❌ Directorio app/api no encontrado')
  errors++
}

// 5. Verificar package.json
console.log('\n📦 Verificando package.json...')
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'))

const requiredDeps = [
  '@libsql/client',
  'next',
  'react',
  'react-dom',
]

const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep])
if (missingDeps.length > 0) {
  console.error(`❌ Dependencias faltantes: ${missingDeps.join(', ')}`)
  errors++
} else {
  console.log('✅ Todas las dependencias críticas presentes')
}

// 6. Verificar scripts de build
if (!packageJson.scripts || !packageJson.scripts.build) {
  console.error('❌ Script de build no encontrado en package.json')
  errors++
} else {
  console.log('✅ Script de build configurado')
}

// 7. Resumen final
console.log('\n' + '='.repeat(50))
console.log('📊 RESUMEN DE VALIDACIÓN')
console.log('='.repeat(50))

if (errors === 0 && warnings === 0) {
  console.log('\n✅ ¡TODO LISTO PARA DEPLOY!')
  console.log('\nPróximos pasos:')
  console.log('1. npm run build')
  console.log('2. vercel --prod')
  console.log('3. Verificar en producción')
  console.log('4. CAMBIAR CONTRASEÑA DE ADMIN\n')
  process.exit(0)
} else {
  console.log(`\n❌ ${errors} error(es) encontrado(s)`)
  console.log(`⚠️  ${warnings} advertencia(s) encontrada(s)\n`)
  
  if (errors > 0) {
    console.log('Por favor, corrige los errores antes de hacer deploy.')
    process.exit(1)
  } else {
    console.log('Puedes continuar con el deploy, pero considera revisar las advertencias.')
    process.exit(0)
  }
}
