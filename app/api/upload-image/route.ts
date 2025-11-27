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
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    // Generar nombre único
    const timestamp = Date.now()
    const filename = `questions/${timestamp}-${file.name}`

    // Subir a Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN
    })

    return NextResponse.json({ url: blob.url })
  } catch (error: any) {
    console.error('Error uploading image:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
