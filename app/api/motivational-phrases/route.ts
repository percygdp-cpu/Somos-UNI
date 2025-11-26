import { getMissingFieldsError, isValidId, isValidPercentage, isValidPhraseRange, validateRequiredFields } from '@/lib/validation'
import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener todas las frases o una frase según porcentaje
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const percentage = searchParams.get('percentage')
    const userId = searchParams.get('userId')
    
    // Si se solicita una frase para un porcentaje específico
    if (percentage !== null && userId) {
      // Validar entrada
      if (!isValidPercentage(percentage)) {
        return NextResponse.json(
          { error: 'Porcentaje inválido' },
          { status: 400 }
        )
      }

      if (!isValidId(userId)) {
        return NextResponse.json(
          { error: 'ID de usuario inválido' },
          { status: 400 }
        )
      }

      const percent = parseInt(percentage)
      let rangeType = '0-30'
      
      if (percent >= 91) rangeType = '91-100'
      else if (percent >= 71) rangeType = '71-90'
      else if (percent >= 51) rangeType = '51-70'
      else if (percent >= 31) rangeType = '31-50'
      
      // Obtener frases del rango que no han sido usadas recientemente
      const recentlyUsedResult = await client.execute({
        sql: `SELECT phrase_id FROM user_phrase_history 
              WHERE user_id = ? 
              ORDER BY used_at DESC 
              LIMIT 5`,
        args: [userId]
      })
      
      const recentlyUsedIds = recentlyUsedResult.rows.map(r => r.phrase_id)
      
      // Construir query dinámicamente para excluir frases usadas
      let sql = `SELECT * FROM motivational_phrases 
                 WHERE range_type = ? AND is_active = 1`
      const args: any[] = [rangeType]
      
      if (recentlyUsedIds.length > 0) {
        const placeholders = recentlyUsedIds.map(() => '?').join(',')
        sql += ` AND id NOT IN (${placeholders})`
        args.push(...recentlyUsedIds)
      }
      
      const result = await client.execute({ sql, args })
      
      // Si todas las frases fueron usadas, usar cualquiera del rango
      let phrases = result.rows
      if (phrases.length === 0) {
        const fallbackResult = await client.execute({
          sql: 'SELECT * FROM motivational_phrases WHERE range_type = ? AND is_active = 1',
          args: [rangeType]
        })
        phrases = fallbackResult.rows
      }
      
      // Seleccionar una frase aleatoria
      if (phrases.length > 0) {
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)]
        
        // Registrar el uso de la frase
        await client.execute({
          sql: 'INSERT INTO user_phrase_history (user_id, phrase_id) VALUES (?, ?)',
          args: [userId, randomPhrase.id]
        })
        
        return NextResponse.json({ phrase: randomPhrase.phrase })
      }
      
      return NextResponse.json({ phrase: '¡Sigue adelante!' })
    }
    
    // Obtener todas las frases
    const result = await client.execute(
      'SELECT * FROM motivational_phrases ORDER BY range_type, created_at DESC'
    )
    
    return NextResponse.json(result.rows)
  } catch (error: any) {
    console.error('Error fetching phrases:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear nueva frase
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validar campos requeridos
    const validation = validateRequiredFields(body, ['phrase', 'rangeType'])
    if (!validation.valid) {
      return NextResponse.json(
        { error: getMissingFieldsError(validation.missing) },
        { status: 400 }
      )
    }

    const { phrase, rangeType, isActive } = body
    
    // Validar rango
    if (!isValidPhraseRange(rangeType)) {
      return NextResponse.json(
        { error: 'rangeType inválido. Debe ser: 0-30, 31-50, 51-70, 71-90, o 91-100' },
        { status: 400 }
      )
    }

    // Validar longitud de frase
    if (phrase.length < 10 || phrase.length > 500) {
      return NextResponse.json(
        { error: 'La frase debe tener entre 10 y 500 caracteres' },
        { status: 400 }
      )
    }
    
    const result = await client.execute({
      sql: `INSERT INTO motivational_phrases (phrase, range_type, is_active) 
            VALUES (?, ?, ?) 
            RETURNING *`,
      args: [phrase, rangeType, isActive !== false ? 1 : 0]
    })
    
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    console.error('Error creating phrase:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar frase
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, phrase, rangeType, isActive } = body
    
    // Validar ID
    if (!id || !isValidId(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      )
    }
    
    const updates = []
    const args = []
    
    if (phrase !== undefined) {
      if (phrase.length < 10 || phrase.length > 500) {
        return NextResponse.json(
          { error: 'La frase debe tener entre 10 y 500 caracteres' },
          { status: 400 }
        )
      }
      updates.push('phrase = ?')
      args.push(phrase)
    }
    
    if (rangeType !== undefined) {
      if (!isValidPhraseRange(rangeType)) {
        return NextResponse.json(
          { error: 'rangeType inválido' },
          { status: 400 }
        )
      }
      updates.push('range_type = ?')
      args.push(rangeType)
    }
    
    if (isActive !== undefined) {
      updates.push('is_active = ?')
      args.push(isActive ? 1 : 0)
    }
    
    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }
    
    updates.push("updated_at = datetime('now')")
    args.push(id)
    
    const result = await client.execute({
      sql: `UPDATE motivational_phrases 
            SET ${updates.join(', ')}
            WHERE id = ?
            RETURNING *`,
      args: args
    })
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Frase no encontrada' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('Error updating phrase:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar frase
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id || !isValidId(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      )
    }
    
    await client.execute({
      sql: 'DELETE FROM motivational_phrases WHERE id = ?',
      args: [parseInt(id)]
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting phrase:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
