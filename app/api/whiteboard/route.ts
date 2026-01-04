import { turso } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET - Obtener todas las pizarras o una específica
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (id) {
      // Obtener pizarra específica
      const result = await turso.execute({
        sql: 'SELECT * FROM whiteboards WHERE id = ?',
        args: [id]
      })

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Pizarra no encontrada' }, { status: 404 })
      }

      const whiteboard = result.rows[0]
      return NextResponse.json({
        id: whiteboard.id?.toString(),
        title: whiteboard.title,
        content: JSON.parse(whiteboard.content as string || '{"strokes":[],"formulas":[]}'),
        thumbnail: whiteboard.thumbnail,
        createdBy: whiteboard.created_by?.toString(),
        createdAt: whiteboard.created_at,
        updatedAt: whiteboard.updated_at
      })
    }

    // Obtener todas las pizarras del usuario
    let query = 'SELECT id, title, thumbnail, created_by, created_at, updated_at FROM whiteboards'
    const args: (string | number)[] = []

    if (userId) {
      query += ' WHERE created_by = ?'
      args.push(userId)
    }

    query += ' ORDER BY updated_at DESC'

    const result = await turso.execute({ sql: query, args })

    const whiteboards = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id?.toString(),
      title: row.title,
      thumbnail: row.thumbnail,
      createdBy: row.created_by?.toString(),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return NextResponse.json(whiteboards)
  } catch (error) {
    console.error('Error fetching whiteboards:', error)
    return NextResponse.json({ error: 'Error al obtener pizarras' }, { status: 500 })
  }
}

// POST - Crear nueva pizarra
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, thumbnail, createdBy } = body

    if (!title || !createdBy) {
      return NextResponse.json({ error: 'Título y creador son requeridos' }, { status: 400 })
    }

    const contentJson = JSON.stringify(content || { strokes: [], formulas: [] })

    const result = await turso.execute({
      sql: `INSERT INTO whiteboards (title, content, thumbnail, created_by) VALUES (?, ?, ?, ?)`,
      args: [title, contentJson, thumbnail || null, createdBy]
    })

    return NextResponse.json({
      id: result.lastInsertRowid?.toString(),
      title,
      content: content || { strokes: [], formulas: [] },
      thumbnail,
      createdBy,
      message: 'Pizarra creada exitosamente'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating whiteboard:', error)
    return NextResponse.json({ error: 'Error al crear pizarra' }, { status: 500 })
  }
}

// PUT - Actualizar pizarra existente
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, content, thumbnail } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const updates: string[] = []
    const args: (string | number)[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      args.push(title)
    }

    if (content !== undefined) {
      updates.push('content = ?')
      args.push(JSON.stringify(content))
    }

    if (thumbnail !== undefined) {
      updates.push('thumbnail = ?')
      args.push(thumbnail)
    }

    updates.push("updated_at = datetime('now')")
    args.push(id)

    await turso.execute({
      sql: `UPDATE whiteboards SET ${updates.join(', ')} WHERE id = ?`,
      args
    })

    return NextResponse.json({ message: 'Pizarra actualizada exitosamente' })
  } catch (error) {
    console.error('Error updating whiteboard:', error)
    return NextResponse.json({ error: 'Error al actualizar pizarra' }, { status: 500 })
  }
}

// DELETE - Eliminar pizarra
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    await turso.execute({
      sql: 'DELETE FROM whiteboards WHERE id = ?',
      args: [id]
    })

    return NextResponse.json({ message: 'Pizarra eliminada exitosamente' })
  } catch (error) {
    console.error('Error deleting whiteboard:', error)
    return NextResponse.json({ error: 'Error al eliminar pizarra' }, { status: 500 })
  }
}
