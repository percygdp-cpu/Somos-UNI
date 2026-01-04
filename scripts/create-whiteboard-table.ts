// Script para crear la tabla whiteboards en Turso
// Ejecutar con: npx tsx scripts/create-whiteboard-table.ts

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
})

async function createWhiteboardTable() {
  try {
    console.log('🚀 Creando tabla whiteboards...')

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS whiteboards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '[]',
        thumbnail TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    console.log('✅ Tabla whiteboards creada exitosamente')

    await turso.execute(`
      CREATE INDEX IF NOT EXISTS idx_whiteboards_created_by ON whiteboards(created_by)
    `)

    console.log('✅ Índice creado exitosamente')

    // Verificar que la tabla existe
    const result = await turso.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='whiteboards'
    `)

    if (result.rows.length > 0) {
      console.log('✅ Verificación exitosa: tabla whiteboards existe')
    } else {
      console.log('❌ Error: la tabla no se creó correctamente')
    }

  } catch (error) {
    console.error('❌ Error creando tabla:', error)
    process.exit(1)
  }
}

createWhiteboardTable()
