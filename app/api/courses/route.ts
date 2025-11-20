import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener todos los cursos con conteo de módulos
export async function GET() {
  try {
    const result = await client.execute(
      'SELECT id, title, description, image, created_at, updated_at FROM courses ORDER BY created_at DESC'
    )

    // Para cada curso, obtener sus módulos
    const coursesWithModules = await Promise.all(
      result.rows.map(async (course: any) => {
        const modulesResult = await client.execute({
          sql: 'SELECT id FROM modules WHERE course_id = ? ORDER BY "order"',
          args: [course.id]
        })
        return {
          ...course,
          modules: modulesResult.rows.map(m => m.id)
        }
      })
    )
    
    return NextResponse.json(coursesWithModules)
  } catch (error: any) {
    console.error('Error fetching courses:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear nuevo curso
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, image } = body

    if (!title) {
      return NextResponse.json(
        { error: 'El título es requerido' },
        { status: 400 }
      )
    }

    const result = await client.execute({
      sql: 'INSERT INTO courses (title, description, image) VALUES (?, ?, ?) RETURNING id, title, description, image, created_at, updated_at',
      args: [title, description || '', image || '']
    })

    return NextResponse.json({ ...result.rows[0], modules: [] }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating course:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar curso
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, title, description, image } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    const result = await client.execute({
      sql: `UPDATE courses 
            SET title = COALESCE(?, title),
                description = COALESCE(?, description),
                image = COALESCE(?, image),
                updated_at = datetime('now')
            WHERE id = ?
            RETURNING id, title, description, image, created_at, updated_at`,
      args: [title, description, image, id]
    })

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Curso no encontrado' },
        { status: 404 }
      )
    }

    // Obtener módulos
    const modulesResult = await client.execute({
      sql: 'SELECT id FROM modules WHERE course_id = ?',
      args: [id]
    })

    return NextResponse.json({ 
      ...result.rows[0], 
      modules: modulesResult.rows.map(m => m.id) 
    })
  } catch (error: any) {
    console.error('Error updating course:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar curso (cascade eliminará módulos y tests)
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
      sql: 'DELETE FROM courses WHERE id = ?',
      args: [id]
    })

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Curso no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Curso eliminado exitosamente' })
  } catch (error: any) {
    console.error('Error deleting course:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
