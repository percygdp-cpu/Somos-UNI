const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function setupDatabase() {
  try {
    console.log('📦 Conectando a Turso...');
    console.log('URL:', process.env.TURSO_DATABASE_URL?.substring(0, 50) + '...');
    
    // Leer el archivo schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Ejecutar el schema completo línea por línea
    const lines = schema.split('\n');
    let currentStatement = '';
    let statementsExecuted = 0;
    
    console.log('📝 Ejecutando schema SQL...\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Ignorar comentarios vacíos
      if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Si la línea termina con ;, ejecutar la sentencia
      if (trimmedLine.endsWith(';')) {
        try {
          await client.execute(currentStatement);
          statementsExecuted++;
          const preview = currentStatement.substring(0, 50).replace(/\n/g, ' ').trim();
          console.log(`✅ ${statementsExecuted}: ${preview}...`);
        } catch (error) {
          // Ignorar errores de "ya existe"
          if (error.message.includes('already exists') || error.message.includes('UNIQUE constraint')) {
            console.log(`⚠️  ${statementsExecuted + 1}: Ya existe (ignorado)`);
          } else {
            console.error(`❌ Error:`, error.message);
            const preview = currentStatement.substring(0, 100).replace(/\n/g, ' ');
            console.error('Sentencia:', preview + '...');
          }
        }
        currentStatement = '';
      }
    }
    
    console.log(`\n🎉 Base de datos configurada exitosamente! (${statementsExecuted} sentencias)\n`);
    
    // Verificar que las tablas se crearon
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('📊 Tablas creadas:');
    tables.rows.forEach(row => console.log(`  ✓ ${row.name}`));
    
    // Verificar datos iniciales
    const users = await client.execute('SELECT username, role FROM users');
    console.log('\n👥 Usuarios iniciales:');
    users.rows.forEach(row => console.log(`  ✓ ${row.username} (${row.role})`));
    
    console.log('\n✨ ¡Listo! Ahora puedes ejecutar: npm run dev\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

setupDatabase();
