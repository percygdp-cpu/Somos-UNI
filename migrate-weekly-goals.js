// Migración para crear tablas de metas semanales
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function migrate() {
  try {
    console.log('Iniciando migración de metas semanales...');
    
    // Crear tabla weekly_goals
    await client.execute(`
      CREATE TABLE IF NOT EXISTS weekly_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        week_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Tabla weekly_goals creada');

    // Crear tabla weekly_goal_tests
    await client.execute(`
      CREATE TABLE IF NOT EXISTS weekly_goal_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weekly_goal_id INTEGER NOT NULL,
        test_id INTEGER NOT NULL,
        FOREIGN KEY (weekly_goal_id) REFERENCES weekly_goals(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
        UNIQUE(weekly_goal_id, test_id)
      )
    `);
    console.log('✓ Tabla weekly_goal_tests creada');

    // Crear tabla user_weekly_goals
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_weekly_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        weekly_goal_id INTEGER NOT NULL,
        assigned_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (weekly_goal_id) REFERENCES weekly_goals(id) ON DELETE CASCADE,
        UNIQUE(user_id, weekly_goal_id)
      )
    `);
    console.log('✓ Tabla user_weekly_goals creada');

    // Crear índices
    await client.execute('CREATE INDEX IF NOT EXISTS idx_weekly_goals_course ON weekly_goals(course_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_weekly_goal_tests_goal ON weekly_goal_tests(weekly_goal_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_weekly_goal_tests_test ON weekly_goal_tests(test_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_user_weekly_goals_user ON user_weekly_goals(user_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_user_weekly_goals_goal ON user_weekly_goals(weekly_goal_id)');
    console.log('✓ Índices creados');

    console.log('\n✅ Migración completada exitosamente!');
    console.log('\nAhora puedes:');
    console.log('1. Ir a http://localhost:3000/admin/goals para crear metas semanales');
    console.log('2. Asignar las metas a estudiantes');
    console.log('3. Ver las metas en http://localhost:3000/student/courses');
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  }
}

migrate();
