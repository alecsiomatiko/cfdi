import { type NextRequest, NextResponse } from "next/server"
import { DOMParser } from "@xmldom/xmldom"
import { processCFDI } from "@/lib/cfdi-processor"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ message: "No se proporcionaron archivos" }, { status: 400 })
    }

    // Procesar cada archivo XML
    const results = []
    const errors = []
    const logs = []

    for (const file of files) {
      try {
        logs.push(`Procesando archivo: ${file.name}`)
        const xmlContent = await file.text()
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml")

        // Verificar si el XML es válido
        const parserError = xmlDoc.getElementsByTagName("parsererror")
        if (parserError.length > 0) {
          const errorMsg = "XML inválido o mal formado"
          logs.push(`Error en archivo ${file.name}: ${errorMsg}`)
          errors.push({ file: file.name, error: errorMsg })
          continue
        }

        // Procesar el documento XML
        const cfdiData = processCFDI(xmlDoc)
        if (cfdiData) {
          results.push(cfdiData)
          logs.push(`Archivo ${file.name} procesado correctamente como ${cfdiData.TIPO_DOCUMENTO}`)

          // Registrar información sobre pagos si es un complemento de pago
          if (cfdiData.pagos && cfdiData.pagos.length > 0) {
            logs.push(`Se encontraron ${cfdiData.pagos.length} pagos en el complemento`)
            cfdiData.pagos.forEach((pago, index) => {
              logs.push(`Pago ${index + 1}: Monto ${pago.montoPago} ${pago.monedaPago}, Fecha: ${pago.fechaPago}`)
              logs.push(`Documentos relacionados: ${pago.documentosRelacionados.length}`)
            })
          }
        } else {
          const errorMsg = "No se pudo procesar el CFDI"
          logs.push(`Error en archivo ${file.name}: ${errorMsg}`)
          errors.push({ file: file.name, error: errorMsg })
        }
      } catch (fileError) {
        const errorMsg = fileError.message || "Error desconocido al procesar el archivo"
        logs.push(`Error en archivo ${file.name}: ${errorMsg}`)
        errors.push({ file: file.name, error: errorMsg })
      }
    }

    // Devolver los resultados y errores
    return NextResponse.json({
      results,
      errors,
      logs,
      totalProcessed: results.length,
      totalErrors: errors.length,
      totalFiles: files.length,
    })
  } catch (error) {
    console.error("Error al procesar los archivos:", error)
    return NextResponse.json(
      {
        message: "Error al procesar los archivos",
        error: error.message,
      },
      { status: 500 },
    )
  }
}
