import { createClient } from '@libsql/client'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

async function migrate() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  })

  console.log('🔄 Ejecutando migraciones...\n')

  // Agregar columnas a users
  const userColumns = [
    { sql: 'ALTER TABLE users ADD COLUMN start_date TEXT', name: 'start_date' },
    { sql: 'ALTER TABLE users ADD COLUMN phone TEXT', name: 'phone' },
    { sql: 'ALTER TABLE users ADD COLUMN guardian_name TEXT', name: 'guardian_name' },
    { sql: 'ALTER TABLE users ADD COLUMN address TEXT', name: 'address' }
  ]

  console.log('📋 Actualizando tabla users...')
  for (const col of userColumns) {
    try {
      await client.execute(col.sql)
      console.log(`  ✓ Columna ${col.name} agregada`)
    } catch (e: any) {
      if (e.message.includes('duplicate column')) {
        console.log(`  - Columna ${col.name} (ya existe)`)
      } else {
        console.log(`  ! Error en ${col.name}: ${e.message}`)
      }
    }
  }

  // Crear tabla student_billing
  console.log('\n📋 Creando tabla student_billing...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS student_billing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      monthly_amount REAL NOT NULL,
      due_day INTEGER NOT NULL DEFAULT 5,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'completed')) DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
  console.log('  ✓ Tabla student_billing creada')

  // Crear tabla invoices
  console.log('\n📋 Creando tabla invoices...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'partial', 'paid', 'overdue')) DEFAULT 'pending',
      paid_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, period)
    )
  `)
  console.log('  ✓ Tabla invoices creada')

  // Crear tabla payments
  console.log('\n📋 Creando tabla payments...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'transferencia', 'yape_plin', 'otro')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `)
  console.log('  ✓ Tabla payments creada')

  // Crear índices
  console.log('\n📋 Creando índices...')
  const indices = [
    'CREATE INDEX IF NOT EXISTS idx_student_billing_user ON student_billing(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
    'CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)',
    'CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)',
    'CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)'
  ]

  for (const sql of indices) {
    await client.execute(sql)
  }
  console.log('  ✓ Índices creados')

  console.log('\n✅ ¡Migraciones completadas exitosamente!')
}

migrate().catch(console.error)
