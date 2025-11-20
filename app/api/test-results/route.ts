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
    
    let sql = 'SELECT * FROM test_results'
    let args: any[] = []
    
    if (userId && testId) {
      sql += ' WHERE user_id = ? AND test_id = ? ORDER BY completed_at DESC LIMIT 1'
      args = [parseInt(userId), parseInt(testId)]
    } else if (userId) {
      sql += ' WHERE user_id = ? ORDER BY completed_at DESC'
      args = [parseInt(userId)]
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
      completedAt: row.completed_at
    }))
    
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
        id: result.lastInsertRowid,
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
