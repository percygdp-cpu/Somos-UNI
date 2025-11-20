import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
})

// GET - Obtener todos los tests con preguntas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('id')
    
    // Si se especifica un ID, obtener solo ese test (optimización)
    if (testId) {
      const testResult = await client.execute({
        sql: 'SELECT id, course_id as courseId, module_id as moduleId, title, created_at as createdAt, updated_at as updatedAt FROM tests WHERE id = ?',
        args: [parseInt(testId)]
      })
      
      if (testResult.rows.length === 0) {
        return NextResponse.json({ error: 'Test not found' }, { status: 404 })
      }
      
      const test = testResult.rows[0]
      
      // Obtener preguntas del test
      const questionsResult = await client.execute({
        sql: 'SELECT id, test_id as testId, question, options, correct_answer as correctAnswer, "order" FROM questions WHERE test_id = ? ORDER BY "order"',
        args: [test.id]
      })
      
      const questions = questionsResult.rows.map((q: any) => {
        let parsedOptions = []
        try {
          parsedOptions = JSON.parse(String(q.options || '[]'))
        } catch (e) {
          console.error('Error parsing options:', e)
          parsedOptions = []
        }
        
        let formattedOptions = []
        if (parsedOptions.length > 0 && typeof parsedOptions[0] === 'object' && 'text' in parsedOptions[0]) {
          formattedOptions = parsedOptions
        } else {
          formattedOptions = parsedOptions.map((opt: string, idx: number) => ({
            text: opt,
            isCorrect: idx === q.correctAnswer
          }))
        }
        
        return {
          id: q.id,
          testId: q.testId,
          text: q.question,
          options: formattedOptions,
          order: q.order
        }
      })
      
      return NextResponse.json({ ...test, questions })
    }
    
    // Si no hay ID, obtener todos los tests (sin preguntas para ser más rápido)
    const result = await client.execute(
      'SELECT id, course_id as courseId, module_id as moduleId, title, created_at as createdAt, updated_at as updatedAt FROM tests ORDER BY created_at DESC'
    )

    // Para cada test, obtener sus preguntas
    const testsWithQuestions = await Promise.all(
      result.rows.map(async (test: any) => {
        const questionsResult = await client.execute({
          sql: 'SELECT id, test_id as testId, question, options, correct_answer as correctAnswer, "order" FROM questions WHERE test_id = ? ORDER BY "order"',
          args: [test.id]
        })
        
        const questions = questionsResult.rows.map((q: any) => {
          let parsedOptions = []
          try {
            parsedOptions = JSON.parse(String(q.options || '[]'))
          } catch (e) {
            console.error('Error parsing options:', e)
            parsedOptions = []
          }
          
          // Detectar si las opciones ya tienen el formato nuevo (con text e isCorrect)
          // o si es el formato antiguo (array de strings)
          let formattedOptions = []
          if (parsedOptions.length > 0 && typeof parsedOptions[0] === 'object' && 'text' in parsedOptions[0]) {
            // Formato nuevo: las opciones ya tienen text e isCorrect
            formattedOptions = parsedOptions
          } else {
            // Formato antiguo: convertir array de strings al formato nuevo
            formattedOptions = parsedOptions.map((opt: string, idx: number) => ({
              text: opt,
              isCorrect: idx === q.correctAnswer
            }))
          }
          
          return {
            id: q.id,
            testId: q.testId,
            text: q.question, // Usar 'text' en lugar de 'question' para consistencia
            options: formattedOptions,
            order: q.order
          }
        })
        
        return {
          ...test,
          questions
        }
      })
    )
    
    return NextResponse.json(testsWithQuestions)
  } catch (error: any) {
    console.error('Error fetching tests:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear nuevo test con preguntas
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { courseId, moduleId, title, questions } = body

    if (!courseId || !moduleId || !title) {
      return NextResponse.json(
        { error: 'courseId, moduleId y title son requeridos' },
        { status: 400 }
      )
    }

    // Crear el test
    const testResult = await client.execute({
      sql: 'INSERT INTO tests (course_id, module_id, title) VALUES (?, ?, ?) RETURNING id, course_id as courseId, module_id as moduleId, title, created_at as createdAt, updated_at as updatedAt',
      args: [courseId, moduleId, title]
    })

    const test = testResult.rows[0]
    const createdQuestions = []

    // Crear las preguntas si existen
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const qResult = await client.execute({
          sql: 'INSERT INTO questions (test_id, question, options, correct_answer, "order") VALUES (?, ?, ?, ?, ?) RETURNING id, test_id as testId, question, options, correct_answer as correctAnswer, "order"',
          args: [
            test.id,
            q.question,
            JSON.stringify(q.options),
            q.correctAnswer,
            i
          ]
        })
        const createdQ = {
          ...qResult.rows[0],
          options: JSON.parse(String(qResult.rows[0].options))
        }
        createdQuestions.push(createdQ)
      }
    }

    return NextResponse.json(
      { ...test, questions: createdQuestions },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating test:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar test y sus preguntas
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, courseId, moduleId, title, questions } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID es requerido' },
        { status: 400 }
      )
    }

    // Construir la query dinámicamente solo con campos proporcionados
    const updates = []
    const args = []
    
    if (courseId !== undefined) {
      updates.push('course_id = ?')
      args.push(courseId)
    }
    if (moduleId !== undefined) {
      updates.push('module_id = ?')
      args.push(moduleId)
    }
    if (title !== undefined) {
      updates.push('title = ?')
      args.push(title)
    }
    
    if (updates.length === 0 && (!questions || questions.length === 0)) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }
    
    let result
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')")
      args.push(id)

      result = await client.execute({
        sql: `UPDATE tests 
              SET ${updates.join(', ')}
              WHERE id = ?
              RETURNING id, course_id as courseId, module_id as moduleId, title, created_at as createdAt, updated_at as updatedAt`,
        args: args
      })

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Test no encontrado' },
          { status: 404 }
        )
      }
    } else {
      // Si no hay actualizaciones de campos, solo obtener el test actual
      result = await client.execute({
        sql: 'SELECT id, course_id as courseId, module_id as moduleId, title, created_at as createdAt, updated_at as updatedAt FROM tests WHERE id = ?',
        args: [id]
      })
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Test no encontrado' },
          { status: 404 }
        )
      }
    }

    // Si se envían preguntas, actualizar
    if (questions && questions.length > 0) {
      // Eliminar preguntas existentes
      await client.execute({
        sql: 'DELETE FROM questions WHERE test_id = ?',
        args: [id]
      })

      // Crear nuevas preguntas
      const createdQuestions = []
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        
        // Validar que options sea un array
        const options = Array.isArray(q.options) ? q.options : []
        const correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer : (typeof q.correct_answer === 'number' ? q.correct_answer : 0)
        
        const qResult = await client.execute({
          sql: 'INSERT INTO questions (test_id, question, options, correct_answer, "order") VALUES (?, ?, ?, ?, ?) RETURNING id, test_id as testId, question, options, correct_answer as correctAnswer, "order"',
          args: [
            id,
            q.question || '',
            JSON.stringify(options),
            correctAnswer,
            i
          ]
        })
        const createdQ = {
          ...qResult.rows[0],
          options: JSON.parse(String(qResult.rows[0].options))
        }
        createdQuestions.push(createdQ)
      }

      return NextResponse.json({ ...result.rows[0], questions: createdQuestions })
    }

    // Si no se envían preguntas, obtener las existentes
    const questionsResult = await client.execute({
      sql: 'SELECT id, test_id as testId, question, options, correct_answer as correctAnswer, "order" FROM questions WHERE test_id = ? ORDER BY "order"',
      args: [id]
    })

    const existingQuestions = questionsResult.rows.map(q => ({
      ...q,
      options: JSON.parse(String(q.options))
    }))

    return NextResponse.json({ ...result.rows[0], questions: existingQuestions })
  } catch (error: any) {
    console.error('Error updating test:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar test (cascade eliminará preguntas)
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
      sql: 'DELETE FROM tests WHERE id = ?',
      args: [id]
    })

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: 'Test no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Test eliminado exitosamente' })
  } catch (error: any) {
    console.error('Error deleting test:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
