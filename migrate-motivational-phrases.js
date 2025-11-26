// Script para crear las tablas de frases motivacionales
// Ejecutar con: node migrate-motivational-phrases.js

const { createClient } = require('@libsql/client')
require('dotenv').config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

async function migrate() {
  try {
    console.log('🔄 Ejecutando migración: Crear tablas de frases motivacionales...')
    
    // Crear tabla de frases motivacionales
    await client.execute({
      sql: `CREATE TABLE IF NOT EXISTS motivational_phrases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phrase TEXT NOT NULL,
        range_type TEXT NOT NULL CHECK (range_type IN ('0-30', '31-50', '51-70', '71-90', '91-100')),
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    })
    
    // Crear tabla de historial de frases usadas
    await client.execute({
      sql: `CREATE TABLE IF NOT EXISTS user_phrase_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        phrase_id INTEGER NOT NULL,
        used_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (phrase_id) REFERENCES motivational_phrases(id) ON DELETE CASCADE
      )`
    })
    
    // Crear índices
    await client.execute({
      sql: 'CREATE INDEX IF NOT EXISTS idx_motivational_phrases_range ON motivational_phrases(range_type)'
    })
    
    await client.execute({
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_phrase_history_user ON user_phrase_history(user_id)'
    })
    
    await client.execute({
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_phrase_history_phrase ON user_phrase_history(phrase_id)'
    })
    
    console.log('✅ Tablas creadas exitosamente')
    
    // Insertar frases motivacionales iniciales
    console.log('📝 Insertando frases motivacionales iniciales...')
    
    const defaultPhrases = [
      // 0-30%
      { phrase: 'No te desanimes, cada intento es una oportunidad para aprender.', range: '0-30' },
      { phrase: 'El camino al éxito comienza con el primer paso. ¡Sigue adelante!', range: '0-30' },
      { phrase: 'Recuerda: los grandes logros requieren práctica constante.', range: '0-30' },
      { phrase: '¡Ánimo! Cada pregunta te acerca más a tu meta.', range: '0-30' },
      
      // 31-50%
      { phrase: 'Vas por buen camino. Sigue practicando y mejorarás.', range: '31-50' },
      { phrase: '¡Bien hecho! Ya dominas algunos conceptos importantes.', range: '31-50' },
      { phrase: 'Estás progresando. La persistencia es clave para el éxito.', range: '31-50' },
      { phrase: 'Buen avance. Con un poco más de estudio, lo lograrás.', range: '31-50' },
      
      // 51-70%
      { phrase: '¡Excelente progreso! Estás en el camino correcto.', range: '51-70' },
      { phrase: '¡Muy bien! Ya dominas la mayoría de los conceptos.', range: '51-70' },
      { phrase: 'Gran trabajo. Solo necesitas reforzar algunos temas.', range: '51-70' },
      { phrase: '¡Buen desempeño! Estás muy cerca de la excelencia.', range: '51-70' },
      
      // 71-90%
      { phrase: '¡Felicitaciones! Demuestras un excelente dominio del tema.', range: '71-90' },
      { phrase: '¡Increíble trabajo! Tu esfuerzo está dando resultados.', range: '71-90' },
      { phrase: '¡Sobresaliente! Sigue así y alcanzarás la perfección.', range: '71-90' },
      { phrase: '¡Excelente! Tu dedicación se refleja en tus resultados.', range: '71-90' },
      
      // 91-100%
      { phrase: '¡Perfecto! Has demostrado un dominio total del tema.', range: '91-100' },
      { phrase: '¡Extraordinario! Tu esfuerzo y dedicación son ejemplares.', range: '91-100' },
      { phrase: '¡Impecable! Eres un ejemplo de excelencia académica.', range: '91-100' },
      { phrase: '¡Magistral! Has alcanzado el nivel más alto de conocimiento.', range: '91-100' }
    ]
    
    for (const { phrase, range } of defaultPhrases) {
      await client.execute({
        sql: 'INSERT INTO motivational_phrases (phrase, range_type) VALUES (?, ?)',
        args: [phrase, range]
      })
    }
    
    console.log(`✅ ${defaultPhrases.length} frases insertadas exitosamente`)
    console.log('🎉 Migración completada con éxito')
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

migrate()
