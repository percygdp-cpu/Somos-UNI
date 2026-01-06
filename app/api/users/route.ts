import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener todos los usuarios
export async function GET() {
  try {
    const result = await client.execute(
      'SELECT id, name, username, password, role, status, start_date, phone, guardian_name, address, created_at, updated_at FROM users ORDER BY created_at DESC'
    )
    
    return NextResponse.json(result.rows)
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear nuevo usuario
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, username, password, role, status, startDate, phone, guardianName, address, monthlyAmount, dueDay } = body

    // Validaciones
    if (!name || !role) {
      return NextResponse.json(
        { error: 'Nombre y role son requeridos' },
        { status: 400 }
      )
    }

    // Validar fecha de inicio obligatoria para estudiantes
    if (role === 'student' && !startDate) {
      return NextResponse.json(
        { error: 'La fecha de inicio es obligatoria para estudiantes' },
        { status: 400 }
      )
    }

    // Generar username y password si no se proporcionan
    let finalUsername = username
    let finalPassword = password

    if (!finalUsername) {
      // Generar username: primera letra del nombre + apellido en minúsculas
      const nameParts = name.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts[nameParts.length - 1] || ''
      
      let baseUsername = (firstName.charAt(0) + lastName).toLowerCase().replace(/[^a-z0-9]/g, '')
      
      // Verificar si el usuario ya existe y agregar un número si es necesario
      let testUsername = baseUsername
      let counter = 1
      
      while (true) {
        const checkResult = await client.execute({
          sql: 'SELECT id FROM users WHERE username = ?',
          args: [testUsername]
        })
        
        if (checkResult.rows.length === 0) {
          finalUsername = testUsername
          break
        }
        
        testUsername = baseUsername + counter
        counter++
      }
    }

    if (!finalPassword) {
      // Generar password: 3 primeras letras del nombre + 3-4 números aleatorios
      const nameParts = name.trim().split(' ')
      const firstName = nameParts[0] || ''
      const namePrefix = firstName.substring(0, 3).toLowerCase().replace(/[^a-z]/g, '')
      const randomNum = Math.floor(100 + Math.random() * 9000) // 3-4 dígitos
      finalPassword = namePrefix + randomNum
    }

    const result = await client.execute({
      sql: `INSERT INTO users (name, username, password, role, status, start_date, phone, guardian_name, address) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
            RETURNING id, name, username, password, role, status, start_date, phone, guardian_name, address, created_at, updated_at`,
      args: [name, finalUsername, finalPassword, role, status || 'active', startDate || null, phone || null, guardianName || null, address || null]
    })

    const newUser = result.rows[0]

    // Si es estudiante y se proporcionó configuración de facturación, crear registro de billing
    if (role === 'student' && monthlyAmount && monthlyAmount > 0) {
      await client.execute({
        sql: `INSERT INTO student_billing (user_id, monthly_amount, due_day, start_date, status)
              VALUES (?, ?, ?, ?, 'active')`,
        args: [newUser.id, monthlyAmount, dueDay || 5, startDate]
      })
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (error: any) {
    console.error('Error creating user:', error)
    
    // Manejar errores de unicidad
    if (error.message?.includes('unique')) {
      return NextResponse.json(
        { error: 'El nombre de usuario ya existe' },
        { status: 409 }
      )
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar usuario
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, username, password, role, status, startDate, phone, guardianName, address } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    // Construir la query dinámicamente solo con campos proporcionados
    const updates = []
    const args = []
    
    if (name !== undefined) {
      updates.push('name = ?')
      args.push(name)
    }
    if (username !== undefined) {
      updates.push('username = ?')
      args.push(username)
    }
    if (password !== undefined) {
      updates.push('password = ?')
      args.push(password)
    }
    if (role !== undefined) {
      updates.push('role = ?')
      args.push(role)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      args.push(status)
    }
    if (startDate !== undefined) {
      updates.push('start_date = ?')
      args.push(startDate)
    }
    if (phone !== undefined) {
      updates.push('phone = ?')
      args.push(phone)
    }
    if (guardianName !== undefined) {
      updates.push('guardian_name = ?')
      args.push(guardianName)
    }
    if (address !== undefined) {
      updates.push('address = ?')
      args.push(address)
    }
    
    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }
    
    updates.push("updated_at = datetime('now')")
    args.push(id)

    const result = await client.execute({
      sql: `UPDATE users 
            SET ${updates.join(', ')}
            WHERE id = ?
            RETURNING id, name, username, password, role, status, start_date, phone, guardian_name, address, created_at, updated_at`,
      args: args
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar usuario
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const result = await client.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id]
    })

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Usuario eliminado exitosamente' })
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
