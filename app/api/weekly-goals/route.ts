import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener metas semanales
export async function GET(request: Request) {
  try {
    const sql = `
      SELECT 
        wg.*,
        GROUP_CONCAT(wgt.test_id) as test_ids
      FROM weekly_goals wg
      LEFT JOIN weekly_goal_tests wgt ON wg.id = wgt.weekly_goal_id
      GROUP BY wg.id 
      ORDER BY wg.week_number
    `
    
    const result = await client.execute({ sql, args: [] })
    
    const goals = result.rows.map((row: any) => ({
      id: row.id,
      weekNumber: row.week_number,
      title: row.title,
      startDate: row.start_date,
      endDate: row.end_date,
      testIds: row.test_ids ? row.test_ids.split(',').map((id: string) => parseInt(id)) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
    
    return NextResponse.json(goals)
  } catch (error: any) {
    console.error('Error fetching weekly goals:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear meta semanal
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { weekNumber, title, startDate, endDate, testIds } = body
    
    if (!weekNumber || !title || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'weekNumber, title, startDate y endDate son requeridos' },
        { status: 400 }
      )
    }
    
    // Insertar la meta semanal
    const result = await client.execute({
      sql: 'INSERT INTO weekly_goals (week_number, title, start_date, end_date) VALUES (?, ?, ?, ?)',
      args: [weekNumber, title, startDate, endDate]
    })
    
    const goalId = Number(result.lastInsertRowid)
    
    // Insertar los tests asociados
    if (testIds && testIds.length > 0) {
      for (const testId of testIds) {
        await client.execute({
          sql: 'INSERT INTO weekly_goal_tests (weekly_goal_id, test_id) VALUES (?, ?)',
          args: [goalId, testId]
        })
      }
    }
    
    return NextResponse.json(
      { 
        id: goalId,
        weekNumber,
        title,
        startDate,
        endDate,
        testIds: testIds || []
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating weekly goal:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar meta semanal
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, weekNumber, title, startDate, endDate, testIds } = body
    
    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }
    
    // Actualizar la meta semanal
    await client.execute({
      sql: `UPDATE weekly_goals 
            SET week_number = ?, title = ?, start_date = ?, end_date = ?, updated_at = datetime('now')
            WHERE id = ?`,
      args: [weekNumber, title, startDate, endDate, id]
    })
    
    // Actualizar los tests asociados
    if (testIds) {
      // Eliminar asociaciones anteriores
      await client.execute({
        sql: 'DELETE FROM weekly_goal_tests WHERE weekly_goal_id = ?',
        args: [id]
      })
      
      // Insertar nuevas asociaciones
      for (const testId of testIds) {
        await client.execute({
          sql: 'INSERT INTO weekly_goal_tests (weekly_goal_id, test_id) VALUES (?, ?)',
          args: [id, testId]
        })
      }
    }
    
    return NextResponse.json({ 
      id, 
      weekNumber, 
      title, 
      startDate, 
      endDate, 
      testIds: testIds || [] 
    })
  } catch (error: any) {
    console.error('Error updating weekly goal:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar meta semanal
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }
    
    // Los tests asociados se eliminan automáticamente por CASCADE
    await client.execute({
      sql: 'DELETE FROM weekly_goals WHERE id = ?',
      args: [parseInt(id)]
    })
    
    return NextResponse.json({ message: 'Meta semanal eliminada exitosamente' })
  } catch (error: any) {
    console.error('Error deleting weekly goal:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
