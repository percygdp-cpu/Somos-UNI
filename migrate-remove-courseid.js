// Migración para eliminar course_id de weekly_goals
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function migrate() {
  try {
    console.log('Iniciando migración para eliminar course_id de weekly_goals...');
    
    // SQLite no permite DROP COLUMN directamente, necesitamos recrear la tabla
    // 1. Renombrar la tabla actual
    console.log('1. Renombrando tabla weekly_goals a weekly_goals_old...');
    await client.execute(`ALTER TABLE weekly_goals RENAME TO weekly_goals_old`);
    
    // 2. Crear la nueva tabla sin course_id
    console.log('2. Creando nueva tabla weekly_goals sin course_id...');
    await client.execute(`
      CREATE TABLE weekly_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    // 3. Copiar datos de la tabla vieja a la nueva (sin course_id)
    console.log('3. Copiando datos existentes...');
    await client.execute(`
      INSERT INTO weekly_goals (id, week_number, title, start_date, end_date, created_at, updated_at)
      SELECT id, week_number, title, start_date, end_date, created_at, updated_at
      FROM weekly_goals_old
    `);
    
    // 4. Eliminar la tabla vieja
    console.log('4. Eliminando tabla vieja...');
    await client.execute(`DROP TABLE weekly_goals_old`);
    
    console.log('✅ Migración completada exitosamente!');
    console.log('La tabla weekly_goals ya no tiene la columna course_id');
    
  } catch (error) {
    // Si la tabla ya fue migrada, course_id no existirá
    if (error.message.includes('no such table: weekly_goals_old') || 
        error.message.includes('no such column') ||
        error.message.includes('already exists')) {
      console.log('La tabla ya parece estar actualizada. Verificando estructura...');
      
      try {
        // Verificar la estructura actual
        const result = await client.execute(`PRAGMA table_info(weekly_goals)`);
        console.log('Estructura actual de weekly_goals:');
        result.rows.forEach(row => {
          console.log(`  - ${row.name} (${row.type})`);
        });
        
        const hasCourseId = result.rows.some(row => row.name === 'course_id');
        if (hasCourseId) {
          console.log('\n⚠️  La tabla aún tiene course_id. Puede que necesites eliminarla manualmente.');
        } else {
          console.log('\n✅ La tabla ya está correcta (sin course_id)');
        }
      } catch (e) {
        console.error('Error verificando estructura:', e.message);
      }
    } else {
      console.error('Error durante la migración:', error.message);
      throw error;
    }
  }
}

migrate().catch(console.error);
