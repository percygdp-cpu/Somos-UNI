import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener asignaciones de metas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const goalId = searchParams.get('goalId')
    const userId = searchParams.get('userId')
    
    let sql = `
      SELECT 
        uwg.id,
        uwg.user_id,
        uwg.weekly_goal_id,
        uwg.assigned_at,
        u.name as user_name,
        u.username,
        wg.title as goal_title,
        wg.week_number,
        wg.start_date,
        wg.end_date
      FROM user_weekly_goals uwg
      JOIN users u ON uwg.user_id = u.id
      JOIN weekly_goals wg ON uwg.weekly_goal_id = wg.id
      WHERE 1=1
    `
    const args: any[] = []
    
    if (goalId) {
      sql += ' AND uwg.weekly_goal_id = ?'
      args.push(parseInt(goalId))
    }
    
    if (userId) {
      sql += ' AND uwg.user_id = ?'
      args.push(parseInt(userId))
    }
    
    sql += ' ORDER BY uwg.assigned_at DESC'
    
    const result = await client.execute({ sql, args })
    
    const assignments = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      weeklyGoalId: row.weekly_goal_id,
      assignedAt: row.assigned_at,
      userName: row.user_name,
      username: row.username,
      goalTitle: row.goal_title,
      weekNumber: row.week_number,
      startDate: row.start_date,
      endDate: row.end_date
    }))
    
    return NextResponse.json(assignments)
  } catch (error: any) {
    console.error('Error fetching goal assignments:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Asignar metas a usuarios
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { goalId, userIds, assignToAll } = body
    
    if (!goalId) {
      return NextResponse.json(
        { error: 'goalId es requerido' },
        { status: 400 }
      )
    }
    
    let targetUserIds = userIds || []
    
    // Si assignToAll es true, obtener todos los estudiantes
    if (assignToAll) {
      const usersResult = await client.execute({
        sql: "SELECT id FROM users WHERE role = 'student' AND status = 'active'",
        args: []
      })
      targetUserIds = usersResult.rows.map((row: any) => row.id)
    }
    
    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'No hay usuarios para asignar' },
        { status: 400 }
      )
    }
    
    let assignedCount = 0
    let skippedCount = 0
    
    for (const userId of targetUserIds) {
      try {
        await client.execute({
          sql: 'INSERT INTO user_weekly_goals (user_id, weekly_goal_id) VALUES (?, ?)',
          args: [userId, goalId]
        })
        assignedCount++
      } catch (err: any) {
        // Si ya existe la asignación (UNIQUE constraint), saltarla
        if (err.message?.includes('UNIQUE constraint')) {
          skippedCount++
        } else {
          throw err
        }
      }
    }
    
    return NextResponse.json(
      { 
        message: `Meta asignada exitosamente`,
        assigned: assignedCount,
        skipped: skippedCount,
        total: targetUserIds.length
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error assigning goal:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar asignación
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const goalId = searchParams.get('goalId')
    const userId = searchParams.get('userId')
    
    if (id) {
      // Eliminar por ID específico
      await client.execute({
        sql: 'DELETE FROM user_weekly_goals WHERE id = ?',
        args: [parseInt(id)]
      })
    } else if (goalId && userId) {
      // Eliminar por combinación goalId + userId
      await client.execute({
        sql: 'DELETE FROM user_weekly_goals WHERE weekly_goal_id = ? AND user_id = ?',
        args: [parseInt(goalId), parseInt(userId)]
      })
    } else if (goalId) {
      // Eliminar todas las asignaciones de una meta
      await client.execute({
        sql: 'DELETE FROM user_weekly_goals WHERE weekly_goal_id = ?',
        args: [parseInt(goalId)]
      })
    } else {
      return NextResponse.json(
        { error: 'Se requiere id, o goalId (con userId opcional)' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({ message: 'Asignación eliminada exitosamente' })
  } catch (error: any) {
    console.error('Error deleting assignment:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
