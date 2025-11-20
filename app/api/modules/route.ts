import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener todos los módulos con conteo de tests
export async function GET() {
  try {
    const result = await client.execute(
      'SELECT id, course_id as courseId, title, description, "order", pdf_files as pdfFiles, created_at as createdAt, updated_at as updatedAt FROM modules ORDER BY course_id, "order"'
    )

    // Para cada módulo, obtener sus tests
    const modulesWithTests = await Promise.all(
      result.rows.map(async (module: any) => {
        const testsResult = await client.execute({
          sql: 'SELECT id FROM tests WHERE module_id = ?',
          args: [module.id]
        })
        return {
          ...module,
          pdfFiles: module.pdfFiles ? JSON.parse(String(module.pdfFiles)) : [],
          tests: testsResult.rows.map(t => t.id)
        }
      })
    )
    
    return NextResponse.json(modulesWithTests)
  } catch (error: any) {
    console.error('Error fetching modules:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear nuevo módulo
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { courseId, title, description, order, pdfFiles } = body

    if (!courseId || !title) {
      return NextResponse.json(
        { error: 'courseId y title son requeridos' },
        { status: 400 }
      )
    }

    const result = await client.execute({
      sql: `INSERT INTO modules (course_id, title, description, "order", pdf_files)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id, course_id as courseId, title, description, "order", pdf_files as pdfFiles, created_at as createdAt, updated_at as updatedAt`,
      args: [
        courseId,
        title,
        description || '',
        order || 0,
        JSON.stringify(pdfFiles || [])
      ]
    })

    const module = {
      ...result.rows[0],
      pdfFiles: JSON.parse(String(result.rows[0].pdfFiles || '[]')),
      tests: []
    }

    return NextResponse.json(module, { status: 201 })
  } catch (error: any) {
    console.error('Error creating module:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar módulo
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, courseId, title, description, order, pdfFiles } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const result = await client.execute({
      sql: `UPDATE modules 
            SET course_id = COALESCE(?, course_id),
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                "order" = COALESCE(?, "order"),
                pdf_files = COALESCE(?, pdf_files),
                updated_at = datetime('now')
            WHERE id = ?
            RETURNING id, course_id as courseId, title, description, "order", pdf_files as pdfFiles, created_at as createdAt, updated_at as updatedAt`,
      args: [
        courseId,
        title,
        description,
        order,
        pdfFiles ? JSON.stringify(pdfFiles) : null,
        id
      ]
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Módulo no encontrado' },
        { status: 404 }
      )
    }

    // Obtener tests
    const testsResult = await client.execute({
      sql: 'SELECT id FROM tests WHERE module_id = ?',
      args: [id]
    })

    const module = {
      ...result.rows[0],
      pdfFiles: JSON.parse(String(result.rows[0].pdfFiles || '[]')),
      tests: testsResult.rows.map(t => t.id)
    }

    return NextResponse.json(module)
  } catch (error: any) {
    console.error('Error updating module:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar módulo (cascade eliminará tests y preguntas)
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
      sql: 'DELETE FROM modules WHERE id = ?',
      args: [id]
    })

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Módulo no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Módulo eliminado exitosamente' })
  } catch (error: any) {
    console.error('Error deleting module:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
