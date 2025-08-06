import { type NextRequest, NextResponse } from "next/server"
import { SATDescargaMasiva } from "@/lib/sat-descarga-masiva"

export async function POST(request: NextRequest) {
  try {
    const {
      accion,
      idSolicitud,
      idPaquete,
      fechaInicial,
      fechaFinal,
      tipoSolicitud,
      rfcEmisor,
      certificadoPath,
      llavePrivadaPath,
      passwordLlave,
      rfc,
    } = await request.json()

    // Validar parámetros requeridos
    if (!accion) {
      return NextResponse.json({ error: "Acción no especificada" }, { status: 400 })
    }

    if (!certificadoPath || !llavePrivadaPath || !passwordLlave || !rfc) {
      return NextResponse.json({ error: "Información de e.firma incompleta" }, { status: 400 })
    }

    // Crear instancia del cliente SAT
    const satClient = new SATDescargaMasiva(certificadoPath, llavePrivadaPath, passwordLlave, rfc)

    // Ejecutar la acción solicitada
    switch (accion) {
      case "autenticar":
        const token = await satClient.autenticar()
        return NextResponse.json({ token })

      case "crearSolicitud":
        if (!fechaInicial || !fechaFinal || !tipoSolicitud) {
          return NextResponse.json({ error: "Parámetros de solicitud incompletos" }, { status: 400 })
        }
        const { idSolicitud: idSolicitudNueva, codEstatus } = await satClient.crearSolicitud(
          fechaInicial,
          fechaFinal,
          tipoSolicitud,
          rfcEmisor,
        )
        return NextResponse.json({ idSolicitud: idSolicitudNueva, codEstatus })

      case "verificarSolicitud":
        if (!idSolicitud) {
          return NextResponse.json({ error: "ID de solicitud no especificado" }, { status: 400 })
        }
        const solicitud = await satClient.verificarSolicitud(idSolicitud)
        return NextResponse.json(solicitud)

      case "descargarPaquete":
        if (!idPaquete) {
          return NextResponse.json({ error: "ID de paquete no especificado" }, { status: 400 })
        }
        const contenido = await satClient.descargarPaquete(idPaquete)

        // Devolver el contenido como un archivo para descargar
        return new NextResponse(contenido, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${idPaquete}.zip"`,
          },
        })

      default:
        return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error en API de descarga SAT:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error desconocido" }, { status: 500 })
  }
}
