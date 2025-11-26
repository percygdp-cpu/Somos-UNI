// Script para ejecutar la migración de agregar columna explanation
// Ejecutar con: node migrate-explanation.js

const { createClient } = require('@libsql/client')
require('dotenv').config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

async function migrate() {
  try {
    console.log('🔄 Ejecutando migración: Agregar columna explanation...')
    
    // Verificar si la columna ya existe
    const tableInfo = await client.execute({
      sql: 'PRAGMA table_info(questions)'
    })
    
    const hasExplanation = tableInfo.rows.some(row => row.name === 'explanation')
    
    if (hasExplanation) {
      console.log('✅ La columna explanation ya existe')
      return
    }
    
    // Agregar la columna
    await client.execute({
      sql: 'ALTER TABLE questions ADD COLUMN explanation TEXT'
    })
    
    console.log('✅ Migración completada exitosamente')
    console.log('📊 La columna "explanation" ha sido agregada a la tabla "questions"')
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

migrate()
