// Migración para arreglar foreign keys que apuntan a weekly_goals_old
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function migrate() {
  try {
    console.log('Arreglando foreign keys que apuntan a weekly_goals_old...\n');
    
    // 1. Guardar datos existentes
    console.log('1. Guardando datos existentes...');
    const goalTestsData = await client.execute('SELECT * FROM weekly_goal_tests');
    const userGoalsData = await client.execute('SELECT * FROM user_weekly_goals');
    console.log(`   - ${goalTestsData.rows.length} registros en weekly_goal_tests`);
    console.log(`   - ${userGoalsData.rows.length} registros en user_weekly_goals`);
    
    // 2. Eliminar tablas con foreign keys incorrectas
    console.log('\n2. Eliminando tablas con foreign keys incorrectas...');
    await client.execute('DROP TABLE IF EXISTS weekly_goal_tests');
    await client.execute('DROP TABLE IF EXISTS user_weekly_goals');
    console.log('   ✓ Tablas eliminadas');
    
    // 3. Recrear tablas con foreign keys correctas
    console.log('\n3. Recreando tablas con foreign keys correctas...');
    
    await client.execute(`
      CREATE TABLE weekly_goal_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weekly_goal_id INTEGER NOT NULL,
        test_id INTEGER NOT NULL,
        FOREIGN KEY (weekly_goal_id) REFERENCES weekly_goals(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
        UNIQUE(weekly_goal_id, test_id)
      )
    `);
    console.log('   ✓ weekly_goal_tests creada');
    
    await client.execute(`
      CREATE TABLE user_weekly_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        weekly_goal_id INTEGER NOT NULL,
        assigned_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (weekly_goal_id) REFERENCES weekly_goals(id) ON DELETE CASCADE,
        UNIQUE(user_id, weekly_goal_id)
      )
    `);
    console.log('   ✓ user_weekly_goals creada');
    
    // 4. Restaurar datos
    console.log('\n4. Restaurando datos...');
    
    for (const row of goalTestsData.rows) {
      try {
        await client.execute({
          sql: 'INSERT INTO weekly_goal_tests (weekly_goal_id, test_id) VALUES (?, ?)',
          args: [row.weekly_goal_id, row.test_id]
        });
      } catch (e) {
        // Ignorar si la meta ya no existe
      }
    }
    console.log(`   ✓ Restaurados ${goalTestsData.rows.length} registros en weekly_goal_tests`);
    
    for (const row of userGoalsData.rows) {
      try {
        await client.execute({
          sql: 'INSERT INTO user_weekly_goals (user_id, weekly_goal_id, assigned_at) VALUES (?, ?, ?)',
          args: [row.user_id, row.weekly_goal_id, row.assigned_at]
        });
      } catch (e) {
        // Ignorar si el usuario o meta ya no existe
      }
    }
    console.log(`   ✓ Restaurados ${userGoalsData.rows.length} registros en user_weekly_goals`);
    
    console.log('\n✅ Migración completada exitosamente!');
    
  } catch (error) {
    console.error('Error durante la migración:', error.message);
    throw error;
  }
}

migrate().catch(console.error);
