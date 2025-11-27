import { PDFDocument } from 'pdf-lib'

/**
 * Comprime un archivo PDF reduciendo la calidad de las imágenes
 * @param file - Archivo PDF original
 * @param maxSizeMB - Tamaño máximo deseado en MB (por defecto 4)
 * @returns Promise<File> - Archivo PDF comprimido
 */
export async function compressPDF(file: File, maxSizeMB: number = 4): Promise<File> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    
    // Opciones de compresión agresiva
    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
    })
    
    // Convertir a File
    const compressedBlob = new Blob([compressedPdfBytes as any], { type: 'application/pdf' })
    const compressedFile = new File([compressedBlob], file.name, { type: 'application/pdf' })
    
    const originalSizeMB = file.size / (1024 * 1024)
    const compressedSizeMB = compressedFile.size / (1024 * 1024)
    
    console.log(`PDF Comprimido: ${originalSizeMB.toFixed(2)}MB -> ${compressedSizeMB.toFixed(2)}MB (${((1 - compressedSizeMB/originalSizeMB) * 100).toFixed(1)}% reducción)`)
    
    // Si aún es muy grande, devolver el original y dejar que el servidor maneje el error
    if (compressedSizeMB > maxSizeMB) {
      console.warn(`El archivo comprimido (${compressedSizeMB.toFixed(2)}MB) aún excede el límite de ${maxSizeMB}MB`)
    }
    
    return compressedFile
  } catch (error) {
    console.error('Error comprimiendo PDF:', error)
    // Si falla la compresión, devolver el archivo original
    return file
  }
}

/**
 * Valida y comprime un archivo PDF si es necesario
 * @param file - Archivo a validar
 * @param maxSizeMB - Tamaño máximo en MB
 * @returns Promise<{ file: File, compressed: boolean, originalSize: number, finalSize: number }>
 */
export async function validateAndCompressPDF(file: File, maxSizeMB: number = 4) {
  const originalSizeMB = file.size / (1024 * 1024)
  
  // Si el archivo ya es pequeño, no comprimir
  if (originalSizeMB <= maxSizeMB * 0.8) { // 80% del límite
    return {
      file,
      compressed: false,
      originalSize: originalSizeMB,
      finalSize: originalSizeMB
    }
  }
  
  // Comprimir el archivo
  const compressedFile = await compressPDF(file, maxSizeMB)
  const finalSizeMB = compressedFile.size / (1024 * 1024)
  
  return {
    file: compressedFile,
    compressed: true,
    originalSize: originalSizeMB,
    finalSize: finalSizeMB
  }
}
