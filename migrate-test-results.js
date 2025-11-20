require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@libsql/client')

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

async function migrate() {
  try {
    // Crear tabla test_results
    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        test_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        percentage INTEGER NOT NULL,
        answers TEXT NOT NULL,
        completed_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
      )
    `)
    
    // Crear índices
    await client.execute('CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id)')
    await client.execute('CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id)')
    
    console.log('✅ Tabla test_results creada exitosamente')
  } catch (error) {
    console.error('❌ Error en migración:', error)
  }
}

migrate()
