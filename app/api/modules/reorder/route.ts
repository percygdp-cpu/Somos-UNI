import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

export async function POST(request: Request) {
  try {
    const { modules } = await request.json()
    
    if (!modules || !Array.isArray(modules)) {
      return NextResponse.json(
        { error: 'Se requiere un array de módulos con id y order' },
        { status: 400 }
      )
    }

    // Actualizar cada módulo
    for (const module of modules) {
      await turso.execute({
        sql: 'UPDATE modules SET "order" = ? WHERE id = ?',
        args: [module.order, module.id]
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Se actualizaron ${modules.length} módulos correctamente`
    })
  } catch (error) {
    console.error('Error al actualizar orden de módulos:', error)
    return NextResponse.json(
      { error: 'Error al actualizar orden de módulos' },
      { status: 500 }
    )
  }
}
