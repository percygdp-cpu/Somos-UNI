import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener progreso de metas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const goalId = searchParams.get('goalId')
    const userId = searchParams.get('userId')
    
    // Query base: obtener asignaciones con info de usuario y meta
    let sql = `
      SELECT 
        uwg.id as assignment_id,
        uwg.user_id,
        uwg.weekly_goal_id,
        uwg.assigned_at,
        u.name as user_name,
        u.username,
        wg.title as goal_title,
        wg.week_number,
        wg.start_date,
        wg.end_date,
        GROUP_CONCAT(DISTINCT wgt.test_id) as goal_test_ids
      FROM user_weekly_goals uwg
      JOIN users u ON uwg.user_id = u.id
      JOIN weekly_goals wg ON uwg.weekly_goal_id = wg.id
      LEFT JOIN weekly_goal_tests wgt ON wg.id = wgt.weekly_goal_id
      WHERE u.status = 'active'
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
    
    sql += ' GROUP BY uwg.id ORDER BY wg.week_number, u.name'
    
    const assignmentsResult = await client.execute({ sql, args })
    
    // Obtener todos los tests (para tener títulos de los pendientes)
    const allTestsQuery = `SELECT id, title FROM tests`
    const allTestsData = await client.execute({ sql: allTestsQuery, args: [] })
    
    // Crear mapa de títulos de tests
    const testTitlesMap: { [key: number]: string } = {}
    allTestsData.rows.forEach((row: any) => {
      testTitlesMap[row.id] = row.title
    })
    
    // Obtener todos los resultados de tests de una vez
    const testResultsQuery = `
      SELECT 
        tr.user_id,
        tr.test_id,
        tr.score,
        tr.total_questions,
        tr.percentage,
        tr.completed_at,
        t.title as test_title
      FROM test_results tr
      JOIN tests t ON tr.test_id = t.id
      ORDER BY tr.completed_at DESC
    `
    const testResultsData = await client.execute({ sql: testResultsQuery, args: [] })
    
    // Crear un mapa de resultados por usuario y test (solo el más reciente)
    const testResultsMap: { [key: string]: any } = {}
    testResultsData.rows.forEach((row: any) => {
      const key = `${row.user_id}-${row.test_id}`
      if (!testResultsMap[key]) {
        testResultsMap[key] = {
          testId: row.test_id,
          testTitle: row.test_title,
          score: row.score,
          totalQuestions: row.total_questions,
          percentage: row.percentage,
          completedAt: row.completed_at
        }
      }
    })
    
    // Procesar cada asignación y calcular progreso
    const progressData = assignmentsResult.rows.map((row: any) => {
      const testIds = row.goal_test_ids 
        ? row.goal_test_ids.split(',').map((id: string) => parseInt(id))
        : []
      
      const totalTests = testIds.length
      let completedTests = 0
      let totalPercentage = 0
      let lastActivity: string | null = null
      const testDetails: any[] = []
      
      testIds.forEach((testId: number) => {
        const key = `${row.user_id}-${testId}`
        const result = testResultsMap[key]
        
        if (result) {
          completedTests++
          totalPercentage += result.percentage
          
          if (!lastActivity || result.completedAt > lastActivity) {
            lastActivity = result.completedAt
          }
          
          testDetails.push({
            testId,
            testTitle: result.testTitle,
            completed: true,
            percentage: result.percentage,
            score: result.score,
            totalQuestions: result.totalQuestions,
            completedAt: result.completedAt
          })
        } else {
          testDetails.push({
            testId,
            testTitle: testTitlesMap[testId] || `Test ${testId}`,
            completed: false
          })
        }
      })
      
      const averagePercentage = completedTests > 0 
        ? Math.round(totalPercentage / completedTests) 
        : 0
      
      // Determinar estado
      let status: 'not-started' | 'in-progress' | 'completed' = 'not-started'
      if (completedTests === totalTests && totalTests > 0) {
        status = 'completed'
      } else if (completedTests > 0) {
        status = 'in-progress'
      }
      
      return {
        assignmentId: row.assignment_id,
        userId: row.user_id,
        userName: row.user_name,
        username: row.username,
        goalId: row.weekly_goal_id,
        goalTitle: row.goal_title,
        weekNumber: row.week_number,
        startDate: row.start_date,
        endDate: row.end_date,
        assignedAt: row.assigned_at,
        totalTests,
        completedTests,
        averagePercentage,
        status,
        lastActivity,
        testDetails
      }
    })
    
    // Calcular resumen
    const summary = {
      totalAssignments: progressData.length,
      completed: progressData.filter((p: any) => p.status === 'completed').length,
      inProgress: progressData.filter((p: any) => p.status === 'in-progress').length,
      notStarted: progressData.filter((p: any) => p.status === 'not-started').length,
      averageCompletion: progressData.length > 0
        ? Math.round(progressData.reduce((acc: number, p: any) => acc + (p.completedTests / (p.totalTests || 1)) * 100, 0) / progressData.length)
        : 0,
      averageScore: progressData.filter((p: any) => p.completedTests > 0).length > 0
        ? Math.round(progressData.filter((p: any) => p.completedTests > 0).reduce((acc: number, p: any) => acc + p.averagePercentage, 0) / progressData.filter((p: any) => p.completedTests > 0).length)
        : 0
    }
    
    return NextResponse.json({ progress: progressData, summary })
  } catch (error: any) {
    console.error('Error fetching goal progress:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
