import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener resultados de tests
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const testId = searchParams.get('testId')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')
    
    let sql = 'SELECT * FROM test_results'
    let countSql = 'SELECT COUNT(*) as total FROM test_results'
    let args: any[] = []
    let countArgs: any[] = []
    
    if (userId && testId) {
      sql += ' WHERE user_id = ? AND test_id = ? ORDER BY completed_at DESC LIMIT 1'
      args = [parseInt(userId), parseInt(testId)]
    } else if (userId) {
      sql += ' WHERE user_id = ?'
      countSql += ' WHERE user_id = ?'
      args = [parseInt(userId)]
      countArgs = [parseInt(userId)]
      
      sql += ' ORDER BY completed_at DESC'
      
      // Aplicar paginación si se especifica
      if (limit) {
        sql += ` LIMIT ${parseInt(limit)}`
        if (offset) {
          sql += ` OFFSET ${parseInt(offset)}`
        }
      }
    } else if (testId) {
      sql += ' WHERE test_id = ? ORDER BY completed_at DESC'
      args = [parseInt(testId)]
    } else {
      sql += ' ORDER BY completed_at DESC'
    }
    
    const result = await client.execute({ sql, args })
    
    const results = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      testId: row.test_id,
      score: row.score,
      totalQuestions: row.total_questions,
      percentage: row.percentage,
      answers: JSON.parse(String(row.answers || '[]')),
      completedAt: row.completed_at ? row.completed_at.replace(' ', 'T') + 'Z' : null
    }))
    
    // Si hay paginación, incluir el total
    if (limit && userId) {
      const countResult = await client.execute({ sql: countSql, args: countArgs })
      const total = Number(countResult.rows[0]?.total || 0)
      return NextResponse.json({ results, total, hasMore: (parseInt(offset || '0') + results.length) < total })
    }
    
    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Error fetching test results:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Guardar resultado de test
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, testId, score, totalQuestions, percentage, answers } = body
    
    if (!userId || !testId || score === undefined || !totalQuestions || percentage === undefined) {
      return NextResponse.json(
        { error: 'userId, testId, score, totalQuestions y percentage son requeridos' },
        { status: 400 }
      )
    }
    
    const result = await client.execute({
      sql: 'INSERT INTO test_results (user_id, test_id, score, total_questions, percentage, answers) VALUES (?, ?, ?, ?, ?, ?)',
      args: [
        userId,
        testId,
        score,
        totalQuestions,
        percentage,
        JSON.stringify(answers || [])
      ]
    })
    
    return NextResponse.json(
      { 
        id: Number(result.lastInsertRowid),
        userId,
        testId,
        score,
        totalQuestions,
        percentage,
        answers
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error saving test result:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar todos los resultados de tests
export async function DELETE(request: Request) {
  try {
    await client.execute('DELETE FROM test_results')
    
    return NextResponse.json(
      { message: 'Todos los resultados han sido eliminados exitosamente' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error deleting test results:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
