import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

export async function POST() {
  try {
    // Obtener todos los módulos
    const result = await turso.execute('SELECT * FROM modules ORDER BY courseId, createdAt')
    const modules = result.rows as any[]

    // Agrupar por curso
    const modulesByCourse: { [key: string]: any[] } = {}
    modules.forEach(module => {
      if (!modulesByCourse[module.courseId]) {
        modulesByCourse[module.courseId] = []
      }
      modulesByCourse[module.courseId].push(module)
    })

    // Reordenar cada curso
    let updatedCount = 0
    for (const courseId in modulesByCourse) {
      const courseModules = modulesByCourse[courseId]
      
      // Ordenar por createdAt (los más antiguos primero)
      courseModules.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return dateA - dateB
      })

      // Asignar orden secuencial 1, 2, 3...
      for (let i = 0; i < courseModules.length; i++) {
        const module = courseModules[i]
        const newOrder = i + 1
        
        // Solo actualizar si el orden cambió
        if (module.order !== newOrder) {
          await turso.execute({
            sql: 'UPDATE modules SET "order" = ? WHERE id = ?',
            args: [newOrder, module.id]
          })
          updatedCount++
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Se reordenaron ${updatedCount} módulos correctamente`,
      updatedCount 
    })
  } catch (error) {
    console.error('Error al reordenar módulos:', error)
    return NextResponse.json(
      { error: 'Error al reordenar módulos' },
      { status: 500 }
    )
  }
}
