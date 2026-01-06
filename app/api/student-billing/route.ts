import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener configuración de billing de estudiantes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const includeWithout = searchParams.get('includeWithout') // Incluir estudiantes sin billing

    if (includeWithout === 'true') {
      // Obtener todos los estudiantes activos, con o sin billing
      const result = await client.execute({
        sql: `SELECT u.id, u.name, u.username, u.start_date, u.phone, u.guardian_name,
              sb.id as billing_id, sb.monthly_amount, sb.due_day, sb.start_date as billing_start_date, sb.status as billing_status
              FROM users u
              LEFT JOIN student_billing sb ON sb.user_id = u.id
              WHERE u.role = 'student' AND u.status = 'active'
              ORDER BY u.name ASC`
      })
      return NextResponse.json(result.rows)
    }

    if (userId) {
      const result = await client.execute({
        sql: `SELECT sb.*, u.name as user_name 
              FROM student_billing sb 
              JOIN users u ON u.id = sb.user_id 
              WHERE sb.user_id = ?`,
        args: [userId]
      })
      return NextResponse.json(result.rows[0] || null)
    }

    // Obtener todos los billing activos
    const result = await client.execute({
      sql: `SELECT sb.*, u.name as user_name 
            FROM student_billing sb 
            JOIN users u ON u.id = sb.user_id 
            ORDER BY u.name ASC`
    })
    
    return NextResponse.json(result.rows)
  } catch (error: any) {
    console.error('Error fetching student billing:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear configuración de billing para un estudiante
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, monthlyAmount, dueDay, startDate } = body

    if (!userId || !monthlyAmount || !startDate) {
      return NextResponse.json(
        { error: 'userId, monthlyAmount y startDate son requeridos' },
        { status: 400 }
      )
    }

    if (monthlyAmount <= 0) {
      return NextResponse.json(
        { error: 'El monto mensual debe ser mayor a 0' },
        { status: 400 }
      )
    }

    const result = await client.execute({
      sql: `INSERT INTO student_billing (user_id, monthly_amount, due_day, start_date, status)
            VALUES (?, ?, ?, ?, 'active')
            RETURNING *`,
      args: [userId, monthlyAmount, dueDay || 5, startDate]
    })

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    console.error('Error creating student billing:', error)
    if (error.message?.includes('UNIQUE')) {
      return NextResponse.json(
        { error: 'Este estudiante ya tiene configuración de pago' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar configuración de billing
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, monthlyAmount, dueDay, status } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const updates = []
    const args: any[] = []

    if (monthlyAmount !== undefined) {
      updates.push('monthly_amount = ?')
      args.push(monthlyAmount)
    }
    if (dueDay !== undefined) {
      updates.push('due_day = ?')
      args.push(dueDay)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      args.push(status)
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
      sql: `UPDATE student_billing SET ${updates.join(', ')} WHERE id = ? RETURNING *`,
      args
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Configuración no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('Error updating student billing:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar configuración de billing
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
      sql: 'DELETE FROM student_billing WHERE id = ?',
      args: [id]
    })

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Configuración no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Configuración eliminada exitosamente' })
  } catch (error: any) {
    console.error('Error deleting student billing:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
