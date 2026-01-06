import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// Función auxiliar para generar cuotas automáticamente
async function generateMissingInvoices(period: string) {
  // Obtener todos los estudiantes con billing activo que no tienen cuota para este período
  const missingBilling = await client.execute({
    sql: `SELECT sb.user_id, sb.monthly_amount, sb.due_day, u.name
          FROM student_billing sb
          JOIN users u ON u.id = sb.user_id
          WHERE sb.status = 'active'
          AND u.status = 'active'
          AND sb.user_id NOT IN (
            SELECT user_id FROM invoices WHERE period = ?
          )`,
    args: [period]
  })

  // Crear cuotas faltantes
  for (const billing of missingBilling.rows) {
    const [year, month] = period.split('-')
    const dueDay = Math.min(Number(billing.due_day), 28) // Máximo día 28 para evitar problemas
    const dueDate = `${year}-${month}-${String(dueDay).padStart(2, '0')}`

    await client.execute({
      sql: `INSERT INTO invoices (user_id, period, amount, due_date, status, paid_amount)
            VALUES (?, ?, ?, ?, 'pending', 0)`,
      args: [billing.user_id, period, billing.monthly_amount, dueDate]
    })
  }

  return missingBilling.rows.length
}

// Función para actualizar estados de cuotas vencidas
async function updateOverdueInvoices() {
  const today = new Date().toISOString().split('T')[0]
  
  await client.execute({
    sql: `UPDATE invoices 
          SET status = 'overdue', updated_at = datetime('now')
          WHERE status = 'pending' 
          AND due_date < ?`,
    args: [today]
  })
}

// GET - Obtener cuotas con filtros
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') // Formato: YYYY-MM
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const summary = searchParams.get('summary') // Para obtener resumen de alertas

    // Si se solicita resumen para dashboard
    if (summary === 'true') {
      const today = new Date()
      const fiveDaysFromNow = new Date(today)
      fiveDaysFromNow.setDate(today.getDate() + 5)
      
      const todayStr = today.toISOString().split('T')[0]
      const fiveDaysStr = fiveDaysFromNow.toISOString().split('T')[0]

      // Contar cuotas vencidas
      const overdueResult = await client.execute({
        sql: `SELECT COUNT(*) as count FROM invoices 
              WHERE (status = 'overdue' OR (status IN ('pending', 'partial') AND due_date < ?))`,
        args: [todayStr]
      })

      // Contar cuotas próximas a vencer (próximos 5 días)
      const upcomingResult = await client.execute({
        sql: `SELECT COUNT(*) as count FROM invoices 
              WHERE status IN ('pending', 'partial') 
              AND due_date >= ? AND due_date <= ?`,
        args: [todayStr, fiveDaysStr]
      })

      // Total pendiente de cobro
      const pendingAmountResult = await client.execute({
        sql: `SELECT COALESCE(SUM(amount - paid_amount), 0) as total 
              FROM invoices 
              WHERE status IN ('pending', 'partial', 'overdue')`
      })

      return NextResponse.json({
        overdue: Number(overdueResult.rows[0].count),
        upcoming: Number(upcomingResult.rows[0].count),
        pendingAmount: Number(pendingAmountResult.rows[0].total)
      })
    }

    // Si se solicita un período específico, generar cuotas faltantes primero
    if (period) {
      await generateMissingInvoices(period)
      await updateOverdueInvoices()
    }

    // Construir query con filtros
    let sql = `SELECT i.*, u.name as user_name, 
               (i.amount - i.paid_amount) as remaining_amount
               FROM invoices i
               JOIN users u ON u.id = i.user_id
               WHERE 1=1`
    const args: any[] = []

    if (period) {
      sql += ` AND i.period = ?`
      args.push(period)
    }
    if (userId) {
      sql += ` AND i.user_id = ?`
      args.push(userId)
    }
    if (status) {
      sql += ` AND i.status = ?`
      args.push(status)
    }

    sql += ` ORDER BY i.due_date ASC, u.name ASC`

    const result = await client.execute({ sql, args })
    
    return NextResponse.json(result.rows)
  } catch (error: any) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear cuota manualmente (para casos especiales)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, period, amount, dueDate } = body

    if (!userId || !period || !amount || !dueDate) {
      return NextResponse.json(
        { error: 'userId, period, amount y dueDate son requeridos' },
        { status: 400 }
      )
    }

    const result = await client.execute({
      sql: `INSERT INTO invoices (user_id, period, amount, due_date, status, paid_amount)
            VALUES (?, ?, ?, ?, 'pending', 0)
            RETURNING *`,
      args: [userId, period, amount, dueDate]
    })

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    console.error('Error creating invoice:', error)
    if (error.message?.includes('UNIQUE')) {
      return NextResponse.json(
        { error: 'Ya existe una cuota para este período' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar cuota (ajustar monto, cambiar estado)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, amount, status } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const updates = []
    const args: any[] = []

    if (amount !== undefined) {
      updates.push('amount = ?')
      args.push(amount)
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
      sql: `UPDATE invoices SET ${updates.join(', ')} WHERE id = ? RETURNING *`,
      args
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Cuota no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar cuota
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
      sql: 'DELETE FROM invoices WHERE id = ?',
      args: [id]
    })

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Cuota no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Cuota eliminada exitosamente' })
  } catch (error: any) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
