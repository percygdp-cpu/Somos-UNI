import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener pagos con filtros
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let sql = `SELECT p.*, i.period, i.user_id, u.name as user_name
               FROM payments p
               JOIN invoices i ON i.id = p.invoice_id
               JOIN users u ON u.id = i.user_id
               WHERE 1=1`
    const args: any[] = []

    if (invoiceId) {
      sql += ` AND p.invoice_id = ?`
      args.push(invoiceId)
    }
    if (userId) {
      sql += ` AND i.user_id = ?`
      args.push(userId)
    }
    if (startDate) {
      sql += ` AND p.payment_date >= ?`
      args.push(startDate)
    }
    if (endDate) {
      sql += ` AND p.payment_date <= ?`
      args.push(endDate)
    }

    sql += ` ORDER BY p.payment_date DESC, p.created_at DESC`

    const result = await client.execute({ sql, args })
    
    return NextResponse.json(result.rows)
  } catch (error: any) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Registrar nuevo pago
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { invoiceId, amount, paymentDate, paymentMethod, notes } = body

    if (!invoiceId || !amount || !paymentDate || !paymentMethod) {
      return NextResponse.json(
        { error: 'invoiceId, amount, paymentDate y paymentMethod son requeridos' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser mayor a 0' },
        { status: 400 }
      )
    }

    // Obtener la cuota actual
    const invoiceResult = await client.execute({
      sql: 'SELECT * FROM invoices WHERE id = ?',
      args: [invoiceId]
    })

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Cuota no encontrada' },
        { status: 404 }
      )
    }

    const invoice = invoiceResult.rows[0]
    const currentPaid = Number(invoice.paid_amount) || 0
    const totalAmount = Number(invoice.amount)
    const newPaidAmount = currentPaid + amount

    // Validar que no se pague más de lo debido
    if (newPaidAmount > totalAmount) {
      return NextResponse.json(
        { error: `El pago excede el monto pendiente. Pendiente: S/ ${(totalAmount - currentPaid).toFixed(2)}` },
        { status: 400 }
      )
    }

    // Determinar nuevo estado de la cuota
    let newStatus: string
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid'
    } else if (newPaidAmount > 0) {
      newStatus = 'partial'
    } else {
      newStatus = 'pending'
    }

    // Registrar el pago
    const paymentResult = await client.execute({
      sql: `INSERT INTO payments (invoice_id, amount, payment_date, payment_method, notes)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *`,
      args: [invoiceId, amount, paymentDate, paymentMethod, notes || null]
    })

    // Actualizar la cuota
    await client.execute({
      sql: `UPDATE invoices 
            SET paid_amount = ?, status = ?, updated_at = datetime('now')
            WHERE id = ?`,
      args: [newPaidAmount, newStatus, invoiceId]
    })

    return NextResponse.json({
      payment: paymentResult.rows[0],
      invoice: {
        id: invoiceId,
        paidAmount: newPaidAmount,
        status: newStatus,
        remainingAmount: totalAmount - newPaidAmount
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar pago (y recalcular cuota)
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

    // Obtener el pago antes de eliminarlo
    const paymentResult = await client.execute({
      sql: 'SELECT * FROM payments WHERE id = ?',
      args: [id]
    })

    if (paymentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pago no encontrado' },
        { status: 404 }
      )
    }

    const payment = paymentResult.rows[0]
    const invoiceId = payment.invoice_id
    const paymentAmount = Number(payment.amount)

    // Eliminar el pago
    await client.execute({
      sql: 'DELETE FROM payments WHERE id = ?',
      args: [id]
    })

    // Recalcular el monto pagado de la cuota
    const invoiceResult = await client.execute({
      sql: 'SELECT * FROM invoices WHERE id = ?',
      args: [invoiceId]
    })

    if (invoiceResult.rows.length > 0) {
      const invoice = invoiceResult.rows[0]
      const newPaidAmount = Math.max(0, Number(invoice.paid_amount) - paymentAmount)
      const totalAmount = Number(invoice.amount)
      const today = new Date().toISOString().split('T')[0]
      const dueDate = invoice.due_date as string

      // Determinar nuevo estado
      let newStatus: string
      if (newPaidAmount >= totalAmount) {
        newStatus = 'paid'
      } else if (newPaidAmount > 0) {
        newStatus = 'partial'
      } else if (dueDate < today) {
        newStatus = 'overdue'
      } else {
        newStatus = 'pending'
      }

      await client.execute({
        sql: `UPDATE invoices 
              SET paid_amount = ?, status = ?, updated_at = datetime('now')
              WHERE id = ?`,
        args: [newPaidAmount, newStatus, invoiceId]
      })
    }

    return NextResponse.json({ message: 'Pago eliminado exitosamente' })
  } catch (error: any) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
