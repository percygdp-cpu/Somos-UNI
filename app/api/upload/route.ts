import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

// Aumentar el límite de tamaño para esta ruta
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 segundos timeout

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF' },
        { status: 400 }
      )
    }

    // Validar tamaño (máximo 15MB)
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo no debe superar los 15MB' },
        { status: 400 }
      )
    }

    // Verificar token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN no está configurado')
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta. Contacta al administrador.' },
        { status: 500 }
      )
    }

    // Generar nombre único para evitar colisiones
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const fileExtension = file.name.split('.').pop()
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    const uniqueFileName = `${fileNameWithoutExt}-${timestamp}-${randomSuffix}.${fileExtension}`

    // Subir a Vercel Blob
    const blob = await put(uniqueFileName, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN
    })

    return NextResponse.json({
      url: blob.url,
      name: file.name, // Devolver el nombre original para mostrar al usuario
      size: file.size
    })
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error.message || 'Error al subir el archivo' },
      { status: 500 }
    )
  }
}
