// Modificar el tipo para incluir los complementos de pago emitidos y recibidos
export type TipoDocumento = "Ingreso" | "Gasto" | "ComplementoPagoEmitido" | "ComplementoPagoRecibido" | "Desconocido"

// Modificar la interfaz CFDIData para incluir una estructura jerárquica para pagos
interface CFDIData {
  TIPO_DOCUMENTO: TipoDocumento
  FOLIO: string
  FOLIO_FISCAL: string
  FECHA_CFDI: string
  NOMBRE_EMISOR: string
  RFC_EMISOR: string
  FORMA_DE_PAGO: string
  METODO_DE_PAGO: string
  REGIMEN_RECEPTOR: string
  CONCEPTO: string
  SUBTOTAL: number
  DESCUENTO: number
  IVA: number
  IEPS: number
  IMPUESTO_LOCAL: number
  RETENCION_ISR: number
  RETENCION_IVA: number
  TOTAL: number
  MONEDA: string
  TIPO_DE_CAMBIO: number
  USO_DE_CFDI: string
  NOMBRE_RECEPTOR: string
  RFC_RECEPTOR: string
  REGIMEN_EMISOR: string
  // Campos adicionales para complementos de pago
  VERSION_PAGOS?: string
  VERSION_CFDI?: string
  TOTAL_RETENCIONES_IVA?: number
  TOTAL_RETENCIONES_ISR?: number
  TOTAL_TRASLADOS_BASE_IVA16?: number
  TOTAL_TRASLADOS_IMPUESTO_IVA16?: number
  TOTAL_TRASLADOS_BASE_IVA0?: number
  TOTAL_TRASLADOS_IMPUESTO_IVA0?: number
  TOTAL_TRASLADOS_BASE_IVA_EXENTO?: number
  // Estructura jerárquica para pagos
  pagos?: PagoData[]
  // Campos para mantener compatibilidad con la estructura plana
  [key: string]: any
}

interface PagoData {
  indice: number
  fechaPago: string
  formaDePago: string
  monedaPago: string
  montoPago: number
  tipoCambioPago: number
  numOperacion?: string
  rfcEmisorCtaOrd?: string
  nomBancoOrdExt?: string
  ctaOrdenante?: string
  rfcEmisorCtaBen?: string
  ctaBeneficiario?: string
  tipoCadPago?: string
  certPago?: string
  cadPago?: string
  selloPago?: string
  impuestos?: {
    retenciones: RetencionPagoData[]
    traslados: TrasladoPagoData[]
  }
  documentosRelacionados: DoctoRelacionadoData[]
}

interface RetencionPagoData {
  impuesto: string
  importe: number
}

interface TrasladoPagoData {
  impuesto: string
  tipoFactor: string
  tasa: string
  base: number
  importe: number
}

interface DoctoRelacionadoData {
  indice: number
  idDocumento: string
  serie?: string
  folio?: string
  moneda?: string
  numParcialidad?: string
  impSaldoAnt: number
  impPagado: number
  impSaldoInsoluto: number
  objetoImpDR?: string
  equivalenciaDR?: number
  impuestos?: {
    retenciones: RetencionDRData[]
    traslados: TrasladoDRData[]
  }
}

interface RetencionDRData {
  impuesto: string
  importe: number
}

interface TrasladoDRData {
  impuesto: string
  tipoFactor: string
  tasa: string
  base: number
  importe: number
}

// Modificar la función clasificarXML para identificar correctamente los complementos de pago emitidos y recibidos
function clasificarXML(xmlDoc: Document, rfcReceptor: string): TipoDocumento {
  try {
    const comprobante = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0]
    if (!comprobante) return "Desconocido"

    const tipoComprobante = comprobante.getAttribute("TipoDeComprobante")

    // Verificar si es un complemento de pago (soportar ambas versiones)
    const pagosNode20 = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "Pagos")[0]
    const pagosNode10 = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "Pagos")[0]

    if (pagosNode20 || pagosNode10 || tipoComprobante === "P") {
      // Obtener el RFC del emisor y receptor del XML
      const emisor = xmlDoc.getElementsByTagName("cfdi:Emisor")[0]
      const receptor = xmlDoc.getElementsByTagName("cfdi:Receptor")[0]
      const rfcEmisorXML = emisor ? emisor.getAttribute("Rfc") : ""
      const rfcReceptorXML = receptor ? receptor.getAttribute("Rfc") : ""

      // Si el RFC del receptor en el XML coincide con el RFC proporcionado,
      // entonces es un complemento de pago recibido
      if (rfcReceptorXML === rfcReceptor) {
        return "ComplementoPagoRecibido"
      }

      // Si el RFC del emisor en el XML coincide con el RFC proporcionado,
      // entonces es un complemento de pago emitido
      if (rfcEmisorXML === rfcReceptor) {
        return "ComplementoPagoEmitido"
      }

      // Si no podemos determinar, asumimos que es un complemento de pago recibido
      return "ComplementoPagoRecibido"
    }

    // Obtener el RFC del receptor del XML
    const receptor = xmlDoc.getElementsByTagName("cfdi:Receptor")[0]
    const rfcReceptorXML = receptor ? receptor.getAttribute("Rfc") : ""

    // Si el RFC del receptor en el XML coincide con el RFC proporcionado,
    // entonces es un gasto (factura recibida)
    if (rfcReceptorXML === rfcReceptor && tipoComprobante === "I") {
      return "Gasto"
    }

    // Si el RFC del emisor en el XML coincide con el RFC proporcionado,
    // entonces es un ingreso (factura emitida)
    if (tipoComprobante === "I") {
      return "Ingreso"
    }

    return "Desconocido"
  } catch (error) {
    console.error("Error al clasificar XML:", error)
    return "Desconocido"
  }
}

// Modificar la función processCFDI para incluir el RFC del receptor y soportar múltiples versiones
export function processCFDI(xmlDoc: Document, rfcReceptor = "GOGR810728TV5"): CFDIData | null {
  try {
    // Verificar que sea un CFDI válido (aceptar 3.3 y 4.0)
    const comprobante = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0]
    if (!comprobante) {
      console.warn("El documento no es un CFDI válido")
      return null
    }

    const version = comprobante.getAttribute("Version") || "4.0"
    if (version !== "4.0" && version !== "3.3") {
      console.warn(`Versión de CFDI no soportada: ${version}`)
      return null
    }

    // Clasificar el documento usando el RFC del receptor
    const tipoDocumento = clasificarXML(xmlDoc, rfcReceptor)

    // Extraer datos básicos del CFDI
    const cfdiData: CFDIData = {
      TIPO_DOCUMENTO: tipoDocumento,
      VERSION_CFDI: version,
      FOLIO: comprobante.getAttribute("Folio") || "",
      FOLIO_FISCAL: extractUUID(xmlDoc),
      FECHA_CFDI: (comprobante.getAttribute("Fecha") || "").substring(0, 10),
      NOMBRE_EMISOR: extractEmisorAttribute(xmlDoc, "Nombre"),
      RFC_EMISOR: extractEmisorAttribute(xmlDoc, "Rfc"),
      FORMA_DE_PAGO: comprobante.getAttribute("FormaPago") || "",
      METODO_DE_PAGO: comprobante.getAttribute("MetodoPago") || "",
      REGIMEN_RECEPTOR: translateRegimenFiscal(extractReceptorAttribute(xmlDoc, "RegimenFiscalReceptor")),
      CONCEPTO: extractConceptos(xmlDoc),
      SUBTOTAL: Number.parseFloat(comprobante.getAttribute("SubTotal") || "0"),
      DESCUENTO: Number.parseFloat(comprobante.getAttribute("Descuento") || "0"),
      IVA: extractImpuestos(xmlDoc, "traslados", "002"),
      IEPS: extractImpuestos(xmlDoc, "traslados", "003"),
      IMPUESTO_LOCAL: extractImpuestosLocales(xmlDoc),
      RETENCION_ISR: extractImpuestos(xmlDoc, "retenciones", "001"),
      RETENCION_IVA: extractImpuestos(xmlDoc, "retenciones", "002"),
      TOTAL: Number.parseFloat(comprobante.getAttribute("Total") || "0"),
      MONEDA: comprobante.getAttribute("Moneda") || "",
      TIPO_DE_CAMBIO: Number.parseFloat(comprobante.getAttribute("TipoCambio") || "1"),
      USO_DE_CFDI: extractReceptorAttribute(xmlDoc, "UsoCFDI"),
      NOMBRE_RECEPTOR: extractReceptorAttribute(xmlDoc, "Nombre"),
      RFC_RECEPTOR: extractReceptorAttribute(xmlDoc, "Rfc"),
      REGIMEN_EMISOR: translateRegimenFiscal(extractEmisorAttribute(xmlDoc, "RegimenFiscal")),
      pagos: [],
    }

    // Extraer datos del complemento de pagos (soportar versiones 1.0 y 2.0)
    const pagosNode20 = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "Pagos")[0]
    const pagosNode10 = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "Pagos")[0]
    const pagosNode = pagosNode20 || pagosNode10

    if (pagosNode) {
      const versionPagos = pagosNode.getAttribute("Version") || (pagosNode20 ? "2.0" : "1.0")
      cfdiData.VERSION_PAGOS = versionPagos

      // Procesar según la versión del complemento
      if (versionPagos === "2.0" || pagosNode20) {
        procesarComplementoPago20(pagosNode, cfdiData)
      } else {
        procesarComplementoPago10(pagosNode, cfdiData)
      }
    }

    // Validar los datos extraídos
    const validacion = validarComplementoPago(cfdiData)
    if (!validacion.valido) {
      console.warn(`Advertencias en la validación: ${validacion.errores.join(", ")}`)
    }

    return cfdiData
  } catch (error) {
    console.error("Error al procesar CFDI:", error)
    return null
  }
}

// Función para procesar complementos de pago versión 2.0
function procesarComplementoPago20(pagosNode: Element, cfdiData: CFDIData): void {
  // Extraer totales del nodo Pagos
  cfdiData.TOTAL_RETENCIONES_IVA = Number.parseFloat(pagosNode.getAttribute("TotalRetencionesIVA") || "0")
  cfdiData.TOTAL_RETENCIONES_ISR = Number.parseFloat(pagosNode.getAttribute("TotalRetencionesISR") || "0")
  cfdiData.TOTAL_TRASLADOS_BASE_IVA16 = Number.parseFloat(pagosNode.getAttribute("TotalTrasladosBaseIVA16") || "0")
  cfdiData.TOTAL_TRASLADOS_IMPUESTO_IVA16 = Number.parseFloat(
    pagosNode.getAttribute("TotalTrasladosImpuestoIVA16") || "0",
  )
  cfdiData.TOTAL_TRASLADOS_BASE_IVA0 = Number.parseFloat(pagosNode.getAttribute("TotalTrasladosBaseIVA0") || "0")
  cfdiData.TOTAL_TRASLADOS_IMPUESTO_IVA0 = Number.parseFloat(
    pagosNode.getAttribute("TotalTrasladosImpuestoIVA0") || "0",
  )
  cfdiData.TOTAL_TRASLADOS_BASE_IVA_EXENTO = Number.parseFloat(
    pagosNode.getAttribute("TotalTrasladosBaseIVAExento") || "0",
  )

  // Inicializar array de pagos si no existe
  if (!cfdiData.pagos) {
    cfdiData.pagos = []
  }

  // Procesar nodos de pago
  const pagos = pagosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "Pago")
  for (let i = 0; i < pagos.length; i++) {
    const pago = pagos[i]

    // Crear objeto de pago con estructura jerárquica
    const pagoObj: PagoData = {
      indice: i + 1,
      fechaPago: pago.getAttribute("FechaPago") || "",
      formaDePago: pago.getAttribute("FormaDePagoP") || "",
      monedaPago: pago.getAttribute("MonedaP") || "",
      montoPago: Number.parseFloat(pago.getAttribute("Monto") || "0"),
      tipoCambioPago: Number.parseFloat(pago.getAttribute("TipoCambioP") || "1"),
      numOperacion: pago.getAttribute("NumOperacion") || "",
      rfcEmisorCtaOrd: pago.getAttribute("RfcEmisorCtaOrd") || "",
      nomBancoOrdExt: pago.getAttribute("NomBancoOrdExt") || "",
      ctaOrdenante: pago.getAttribute("CtaOrdenante") || "",
      rfcEmisorCtaBen: pago.getAttribute("RfcEmisorCtaBen") || "",
      ctaBeneficiario: pago.getAttribute("CtaBeneficiario") || "",
      tipoCadPago: pago.getAttribute("TipoCadPago") || "",
      certPago: pago.getAttribute("CertPago") || "",
      cadPago: pago.getAttribute("CadPago") || "",
      selloPago: pago.getAttribute("SelloPago") || "",
      impuestos: {
        retenciones: [],
        traslados: [],
      },
      documentosRelacionados: [],
    }

    // Procesar impuestos del pago
    const impuestosPNode = pago.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "ImpuestosP")[0]
    if (impuestosPNode) {
      procesarImpuestosPago20(impuestosPNode, pagoObj)
    }

    // Procesar documentos relacionados
    const doctos = pago.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "DoctoRelacionado")
    for (let j = 0; j < doctos.length; j++) {
      const docto = doctos[j]

      const doctoObj: DoctoRelacionadoData = {
        indice: j + 1,
        idDocumento: docto.getAttribute("IdDocumento") || "",
        serie: docto.getAttribute("Serie") || "",
        folio: docto.getAttribute("Folio") || "",
        moneda: docto.getAttribute("MonedaDR") || "",
        numParcialidad: docto.getAttribute("NumParcialidad") || "",
        impSaldoAnt: Number.parseFloat(docto.getAttribute("ImpSaldoAnt") || "0"),
        impPagado: Number.parseFloat(docto.getAttribute("ImpPagado") || "0"),
        impSaldoInsoluto: Number.parseFloat(docto.getAttribute("ImpSaldoInsoluto") || "0"),
        objetoImpDR: docto.getAttribute("ObjetoImpDR") || "",
        equivalenciaDR: Number.parseFloat(docto.getAttribute("EquivalenciaDR") || "1"),
        impuestos: {
          retenciones: [],
          traslados: [],
        },
      }

      // Procesar impuestos del documento relacionado
      const impuestosDRNode = docto.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "ImpuestosDR")[0]
      if (impuestosDRNode) {
        procesarImpuestosDR20(impuestosDRNode, doctoObj)
      }

      pagoObj.documentosRelacionados.push(doctoObj)
    }

    // Añadir el pago a la lista de pagos
    cfdiData.pagos.push(pagoObj)

    // También mantener la estructura plana para compatibilidad
    cfdiData[`FECHA_PAGO_${i + 1}`] = pagoObj.fechaPago
    cfdiData[`FORMA_DE_PAGO_${i + 1}`] = pagoObj.formaDePago
    cfdiData[`MONEDA_PAGO_${i + 1}`] = pagoObj.monedaPago
    cfdiData[`MONTO_PAGO_${i + 1}`] = pagoObj.montoPago
    cfdiData[`TIPO_CAMBIO_PAGO_${i + 1}`] = pagoObj.tipoCambioPago
    cfdiData[`NUM_OPERACION_${i + 1}`] = pagoObj.numOperacion
    cfdiData[`RFC_EMISOR_CTA_ORD_${i + 1}`] = pagoObj.rfcEmisorCtaOrd
    cfdiData[`NOMBRE_BANCO_ORD_EXT_${i + 1}`] = pagoObj.nomBancoOrdExt
    cfdiData[`CTA_ORDENANTE_${i + 1}`] = pagoObj.ctaOrdenante
    cfdiData[`RFC_EMISOR_CTA_BEN_${i + 1}`] = pagoObj.rfcEmisorCtaBen
    cfdiData[`CTA_BENEFICIARIO_${i + 1}`] = pagoObj.ctaBeneficiario

    // Añadir impuestos del pago a la estructura plana
    if (pagoObj.impuestos) {
      pagoObj.impuestos.retenciones.forEach((retencion) => {
        cfdiData[`RETENCION_${retencion.impuesto}_PAGO_${i + 1}`] = retencion.importe
      })

      pagoObj.impuestos.traslados.forEach((traslado) => {
        cfdiData[`TRASLADO_${traslado.impuesto}_BASE_PAGO_${i + 1}`] = traslado.base
        cfdiData[`TRASLADO_${traslado.impuesto}_TASA_PAGO_${i + 1}`] = traslado.tasa
        cfdiData[`TRASLADO_${traslado.impuesto}_IMPORTE_PAGO_${i + 1}`] = traslado.importe
      })
    }

    // Añadir documentos relacionados a la estructura plana
    pagoObj.documentosRelacionados.forEach((docto, j) => {
      const docIndex = `${i + 1}_${j + 1}`
      cfdiData[`ID_DOCUMENTO_${docIndex}`] = docto.idDocumento
      cfdiData[`SERIE_DR_${docIndex}`] = docto.serie
      cfdiData[`FOLIO_DR_${docIndex}`] = docto.folio
      cfdiData[`MONEDA_DR_${docIndex}`] = docto.moneda
      cfdiData[`NUM_PARCIALIDAD_${docIndex}`] = docto.numParcialidad
      cfdiData[`IMP_SALDO_ANT_${docIndex}`] = docto.impSaldoAnt
      cfdiData[`IMP_PAGADO_${docIndex}`] = docto.impPagado
      cfdiData[`IMP_SALDO_INSOLUTO_${docIndex}`] = docto.impSaldoInsoluto
      cfdiData[`OBJETO_IMP_DR_${docIndex}`] = docto.objetoImpDR
      cfdiData[`EQUIVALENCIA_DR_${docIndex}`] = docto.equivalenciaDR

      // Añadir impuestos del documento relacionado a la estructura plana
      if (docto.impuestos) {
        docto.impuestos.retenciones.forEach((retencion) => {
          cfdiData[`RETENCION_${retencion.impuesto}_DR_${docIndex}`] = retencion.importe
        })

        docto.impuestos.traslados.forEach((traslado) => {
          cfdiData[`TRASLADO_${traslado.impuesto}_BASE_DR_${docIndex}`] = traslado.base
          cfdiData[`TRASLADO_${traslado.impuesto}_TASA_DR_${docIndex}`] = traslado.tasa
          cfdiData[`TRASLADO_${traslado.impuesto}_IMPORTE_DR_${docIndex}`] = traslado.importe
        })
      }
    })
  }
}

// Función para procesar complementos de pago versión 1.0
function procesarComplementoPago10(pagosNode: Element, cfdiData: CFDIData): void {
  // Inicializar array de pagos si no existe
  if (!cfdiData.pagos) {
    cfdiData.pagos = []
  }

  // Procesar nodos de pago
  const pagos = pagosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "Pago")
  for (let i = 0; i < pagos.length; i++) {
    const pago = pagos[i]

    // Crear objeto de pago con estructura jerárquica
    const pagoObj: PagoData = {
      indice: i + 1,
      fechaPago: pago.getAttribute("FechaPago") || "",
      formaDePago: pago.getAttribute("FormaDePago") || "",
      monedaPago: pago.getAttribute("MonedaP") || "",
      montoPago: Number.parseFloat(pago.getAttribute("Monto") || "0"),
      tipoCambioPago: Number.parseFloat(pago.getAttribute("TipoCambioP") || "1"),
      numOperacion: pago.getAttribute("NumOperacion") || "",
      rfcEmisorCtaOrd: pago.getAttribute("RfcEmisorCtaOrd") || "",
      nomBancoOrdExt: pago.getAttribute("NomBancoOrdExt") || "",
      ctaOrdenante: pago.getAttribute("CtaOrdenante") || "",
      rfcEmisorCtaBen: pago.getAttribute("RfcEmisorCtaBen") || "",
      ctaBeneficiario: pago.getAttribute("CtaBeneficiario") || "",
      impuestos: {
        retenciones: [],
        traslados: [],
      },
      documentosRelacionados: [],
    }

    // Procesar documentos relacionados
    const doctos = pago.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "DoctoRelacionado")
    for (let j = 0; j < doctos.length; j++) {
      const docto = doctos[j]

      const doctoObj: DoctoRelacionadoData = {
        indice: j + 1,
        idDocumento: docto.getAttribute("IdDocumento") || "",
        serie: docto.getAttribute("Serie") || "",
        folio: docto.getAttribute("Folio") || "",
        moneda: docto.getAttribute("MonedaDR") || "",
        numParcialidad: docto.getAttribute("NumParcialidad") || "",
        impSaldoAnt: Number.parseFloat(docto.getAttribute("ImpSaldoAnt") || "0"),
        impPagado: Number.parseFloat(docto.getAttribute("ImpPagado") || "0"),
        impSaldoInsoluto: Number.parseFloat(docto.getAttribute("ImpSaldoInsoluto") || "0"),
        impuestos: {
          retenciones: [],
          traslados: [],
        },
      }

      // En Pagos 1.0 no hay impuestos a nivel de documento relacionado

      pagoObj.documentosRelacionados.push(doctoObj)
    }

    // Añadir el pago a la lista de pagos
    cfdiData.pagos.push(pagoObj)

    // También mantener la estructura plana para compatibilidad
    cfdiData[`FECHA_PAGO_${i + 1}`] = pagoObj.fechaPago
    cfdiData[`FORMA_DE_PAGO_${i + 1}`] = pagoObj.formaDePago
    cfdiData[`MONEDA_PAGO_${i + 1}`] = pagoObj.monedaPago
    cfdiData[`MONTO_PAGO_${i + 1}`] = pagoObj.montoPago
    cfdiData[`TIPO_CAMBIO_PAGO_${i + 1}`] = pagoObj.tipoCambioPago
    cfdiData[`NUM_OPERACION_${i + 1}`] = pagoObj.numOperacion
    cfdiData[`RFC_EMISOR_CTA_ORD_${i + 1}`] = pagoObj.rfcEmisorCtaOrd
    cfdiData[`NOMBRE_BANCO_ORD_EXT_${i + 1}`] = pagoObj.nomBancoOrdExt
    cfdiData[`CTA_ORDENANTE_${i + 1}`] = pagoObj.ctaOrdenante
    cfdiData[`RFC_EMISOR_CTA_BEN_${i + 1}`] = pagoObj.rfcEmisorCtaBen
    cfdiData[`CTA_BENEFICIARIO_${i + 1}`] = pagoObj.ctaBeneficiario

    // Añadir documentos relacionados a la estructura plana
    pagoObj.documentosRelacionados.forEach((docto, j) => {
      const docIndex = `${i + 1}_${j + 1}`
      cfdiData[`ID_DOCUMENTO_${docIndex}`] = docto.idDocumento
      cfdiData[`SERIE_DR_${docIndex}`] = docto.serie
      cfdiData[`FOLIO_DR_${docIndex}`] = docto.folio
      cfdiData[`MONEDA_DR_${docIndex}`] = docto.moneda
      cfdiData[`NUM_PARCIALIDAD_${docIndex}`] = docto.numParcialidad
      cfdiData[`IMP_SALDO_ANT_${docIndex}`] = docto.impSaldoAnt
      cfdiData[`IMP_PAGADO_${docIndex}`] = docto.impPagado
      cfdiData[`IMP_SALDO_INSOLUTO_${docIndex}`] = docto.impSaldoInsoluto
    })
  }
}

// Función para procesar impuestos de pago versión 2.0
function procesarImpuestosPago20(impuestosNode: Element, pagoObj: PagoData): void {
  // Extraer retenciones del pago
  const retencionesNode = impuestosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "RetencionesP")[0]
  if (retencionesNode) {
    const retenciones = retencionesNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "RetencionP")
    for (let i = 0; i < retenciones.length; i++) {
      const retencion = retenciones[i]
      const impuesto = retencion.getAttribute("ImpuestoP") || ""
      const importe = Number.parseFloat(retencion.getAttribute("ImporteP") || "0")

      pagoObj.impuestos.retenciones.push({
        impuesto,
        importe,
      })
    }
  }

  // Extraer traslados del pago
  const trasladosNode = impuestosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "TrasladosP")[0]
  if (trasladosNode) {
    const traslados = trasladosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "TrasladoP")
    for (let i = 0; i < traslados.length; i++) {
      const traslado = traslados[i]
      const impuesto = traslado.getAttribute("ImpuestoP") || ""
      const tipoFactor = traslado.getAttribute("TipoFactorP") || ""
      const tasa = traslado.getAttribute("TasaOCuotaP") || ""
      const base = Number.parseFloat(traslado.getAttribute("BaseP") || "0")
      const importe = Number.parseFloat(traslado.getAttribute("ImporteP") || "0")

      pagoObj.impuestos.traslados.push({
        impuesto,
        tipoFactor,
        tasa,
        base,
        importe,
      })
    }
  }
}

// Función para procesar impuestos de documento relacionado versión 2.0
function procesarImpuestosDR20(impuestosNode: Element, doctoObj: DoctoRelacionadoData): void {
  // Extraer retenciones del documento relacionado
  const retencionesNode = impuestosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "RetencionesDR")[0]
  if (retencionesNode) {
    const retenciones = retencionesNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "RetencionDR")
    for (let i = 0; i < retenciones.length; i++) {
      const retencion = retenciones[i]
      const impuesto = retencion.getAttribute("ImpuestoDR") || ""
      const importe = Number.parseFloat(retencion.getAttribute("ImporteDR") || "0")

      doctoObj.impuestos.retenciones.push({
        impuesto,
        importe,
      })
    }
  }

  // Extraer traslados del documento relacionado
  const trasladosNode = impuestosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "TrasladosDR")[0]
  if (trasladosNode) {
    const traslados = trasladosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "TrasladoDR")
    for (let i = 0; i < traslados.length; i++) {
      const traslado = traslados[i]
      const impuesto = traslado.getAttribute("ImpuestoDR") || ""
      const tipoFactor = traslado.getAttribute("TipoFactorDR") || ""
      const tasa = traslado.getAttribute("TasaOCuotaDR") || ""
      const base = Number.parseFloat(traslado.getAttribute("BaseDR") || "0")
      const importe = Number.parseFloat(traslado.getAttribute("ImporteDR") || "0")

      doctoObj.impuestos.traslados.push({
        impuesto,
        tipoFactor,
        tasa,
        base,
        importe,
      })
    }
  }
}

// Función para validar los datos del complemento de pago
function validarComplementoPago(cfdiData: CFDIData): { valido: boolean; errores: string[] } {
  const errores = []

  // Validar datos básicos
  if (!cfdiData.FOLIO_FISCAL) {
    errores.push("Falta UUID (folio fiscal)")
  }

  // Validar pagos solo si es un complemento de pago
  if (cfdiData.TIPO_DOCUMENTO === "ComplementoPagoEmitido" || cfdiData.TIPO_DOCUMENTO === "ComplementoPagoRecibido") {
    if (!cfdiData.pagos || cfdiData.pagos.length === 0) {
      errores.push("No se encontraron nodos de pago")
    } else {
      // Validar cada pago
      cfdiData.pagos.forEach((pago, index) => {
        if (!pago.fechaPago) {
          errores.push(`Pago ${index + 1}: Falta fecha de pago`)
        }
        if (!pago.montoPago || pago.montoPago <= 0) {
          errores.push(`Pago ${index + 1}: Monto inválido`)
        }

        // Validar documentos relacionados
        if (pago.documentosRelacionados.length === 0) {
          errores.push(`Pago ${index + 1}: No tiene documentos relacionados`)
        } else {
          pago.documentosRelacionados.forEach((docto, docIndex) => {
            if (!docto.idDocumento) {
              errores.push(`Pago ${index + 1}, Documento ${docIndex + 1}: Falta ID de documento`)
            }
          })
        }
      })
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  }
}

// Mantener las funciones auxiliares existentes
function extractUUID(xmlDoc: Document): string {
  const timbreFiscal = xmlDoc.getElementsByTagNameNS(
    "http://www.sat.gob.mx/TimbreFiscalDigital",
    "TimbreFiscalDigital",
  )[0]
  return timbreFiscal ? timbreFiscal.getAttribute("UUID") || "" : ""
}

function extractEmisorAttribute(xmlDoc: Document, attribute: string): string {
  const emisor = xmlDoc.getElementsByTagName("cfdi:Emisor")[0]
  return emisor ? emisor.getAttribute(attribute) || "" : ""
}

function extractReceptorAttribute(xmlDoc: Document, attribute: string): string {
  const receptor = xmlDoc.getElementsByTagName("cfdi:Receptor")[0]
  return receptor ? receptor.getAttribute(attribute) || "" : ""
}

function extractConceptos(xmlDoc: Document): string {
  const conceptos = xmlDoc.getElementsByTagName("cfdi:Concepto")
  const descripciones = []

  for (let i = 0; i < conceptos.length; i++) {
    const descripcion = conceptos[i].getAttribute("Descripcion")
    if (descripcion) {
      descripciones.push(descripcion)
    }
  }

  return descripciones.join(" | ")
}

function extractImpuestos(xmlDoc: Document, tipo: "traslados" | "retenciones", impuesto: string): number {
  let total = 0
  const conceptos = xmlDoc.getElementsByTagName("cfdi:Concepto")

  for (let i = 0; i < conceptos.length; i++) {
    const concepto = conceptos[i]
    const impuestosNode = concepto.getElementsByTagName("cfdi:Impuestos")[0]

    if (impuestosNode) {
      const nodeName = tipo === "traslados" ? "cfdi:Traslado" : "cfdi:Retencion"
      const impuestosItems = concepto.getElementsByTagName(nodeName)

      for (let j = 0; j < impuestosItems.length; j++) {
        const item = impuestosItems[j]
        if (item.getAttribute("Impuesto") === impuesto) {
          total += Number.parseFloat(item.getAttribute("Importe") || "0")
        }
      }
    }
  }

  return total
}

function extractImpuestosLocales(xmlDoc: Document): number {
  let total = 0
  const impuestosLocales = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/implocal", "TrasladosLocales")

  for (let i = 0; i < impuestosLocales.length; i++) {
    total += Number.parseFloat(impuestosLocales[i].getAttribute("Importe") || "0")
  }

  return total
}

function translateRegimenFiscal(regimenCode: string): string {
  const regimenes: { [key: string]: string } = {
    "601": "General de Ley Personas Morales",
    "603": "Personas Morales con Fines no Lucrativos",
    "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
    "606": "Arrendamiento",
    "608": "Demás ingresos",
    "609": "Consolidación",
    "610": "Residentes en el Extranjero sin Establecimiento Permanente en México",
    "611": "Ingresos por Dividendos (socios y accionistas)",
    "612": "Personas Físicas con Actividades Empresariales y Profesionales",
    "614": "Ingresos por intereses",
    "616": "Sin obligaciones fiscales",
    "620": "Sociedades Cooperativas de Producción que optan por diferir sus ingresos",
    "621": "Incorporación Fiscal",
    "622": "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
    "623": "Opcional para Grupos de Sociedades",
    "624": "Coordinados",
    "625": "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
    "626": "Régimen Simplificado de Confianza",
  }

  return regimenes[regimenCode] || `Régimen no identificado: ${regimenCode}`
}
