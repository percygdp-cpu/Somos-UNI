const { createClient } = require('@libsql/client')
require('dotenv').config({ path: '.env.local' })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

async function addNameColumn() {
  try {
    // Intentar agregar la columna
    try {
      await client.execute('ALTER TABLE users ADD COLUMN name TEXT')
      console.log('✅ Columna name agregada')
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('⚠️  Columna name ya existe')
      } else {
        throw e
      }
    }

    // Actualizar usuarios existentes
    await client.execute("UPDATE users SET name = 'Administrador' WHERE username = 'admin'")
    console.log('✅ Admin actualizado')
    
    await client.execute("UPDATE users SET name = 'Estudiante Demo' WHERE username = 'estudiante'")
    console.log('✅ Estudiante actualizado')

    // Verificar
    const result = await client.execute('SELECT id, name, username FROM users')
    console.log('\n👥 Usuarios en la base de datos:')
    result.rows.forEach(row => console.log(`  ${row.id}. ${row.name} (${row.username})`))

    console.log('\n✨ ¡Migración completada!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

addNameColumn()
