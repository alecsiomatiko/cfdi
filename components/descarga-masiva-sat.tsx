"use client"

import { useState } from "react"
import { CalendarIcon, Download, FileDown, Loader2, AlertCircle, FileText, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EstadoSolicitud, type SolicitudDescarga } from "@/lib/sat-descarga-masiva"

// Mapeo de estados a texto y color
const estadoSolicitudMap: Record<EstadoSolicitud, { texto: string; color: string }> = {
  [EstadoSolicitud.Aceptada]: { texto: "Aceptada", color: "bg-blue-50 text-blue-700 border-blue-200" },
  [EstadoSolicitud.EnProceso]: { texto: "En Proceso", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  [EstadoSolicitud.Terminada]: { texto: "Terminada", color: "bg-green-50 text-green-700 border-green-200" },
  [EstadoSolicitud.Error]: { texto: "Error", color: "bg-red-50 text-red-700 border-red-200" },
  [EstadoSolicitud.Rechazada]: { texto: "Rechazada", color: "bg-red-50 text-red-700 border-red-200" },
  [EstadoSolicitud.Vencida]: { texto: "Vencida", color: "bg-gray-50 text-gray-700 border-gray-200" },
}

export function DescargaMasivaSAT() {
  const [activeTab, setActiveTab] = useState("config")
  const [startDate, setStartDate] = useState<Date | undefined>(subMonths(new Date(), 1))
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [tipoSolicitud, setTipoSolicitud] = useState<"CFDI" | "Metadata">("CFDI")
  const [rfcEmisor, setRfcEmisor] = useState<string>("")
  const [certificadoPath, setCertificadoPath] = useState<string>("")
  const [llavePrivadaPath, setLlavePrivadaPath] = useState<string>("")
  const [passwordLlave, setPasswordLlave] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [solicitudes, setSolicitudes] = useState<SolicitudDescarga[]>([])
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudDescarga | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const rfcUsuario = "GOGR810728TV5" // RFC del usuario actual

  // Función para crear una nueva solicitud
  const handleCrearSolicitud = async () => {
    if (!startDate || !endDate) {
      setError("Debes seleccionar fechas de inicio y fin")
      return
    }

    if (!certificadoPath || !llavePrivadaPath || !passwordLlave) {
      setError("Debes proporcionar la información de tu e.firma")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/sat-descarga", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accion: "crearSolicitud",
          fechaInicial: format(startDate, "yyyy-MM-dd"),
          fechaFinal: format(endDate, "yyyy-MM-dd"),
          tipoSolicitud,
          rfcEmisor: rfcEmisor || undefined,
          certificadoPath,
          llavePrivadaPath,
          passwordLlave,
          rfc: rfcUsuario,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error al crear la solicitud")
      }

      const nuevaSolicitud: SolicitudDescarga = {
        id: data.idSolicitud,
        fechaSolicitud: new Date(),
        tipoSolicitud,
        fechaInicial: format(startDate, "yyyy-MM-dd"),
        fechaFinal: format(endDate, "yyyy-MM-dd"),
        rfcEmisor: rfcEmisor || undefined,
        rfcReceptor: rfcUsuario,
        estatus: EstadoSolicitud.Aceptada,
        mensaje: "Solicitud Aceptada",
        paquetes: [],
      }

      setSolicitudes([nuevaSolicitud, ...solicitudes])
      setSuccess(`Solicitud creada con ID: ${nuevaSolicitud.id}`)
      setActiveTab("solicitudes")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la solicitud")
    } finally {
      setLoading(false)
    }
  }

  // Función para verificar una solicitud
  const handleVerificarSolicitud = async (solicitud: SolicitudDescarga) => {
    setVerificando(true)
    setError(null)

    try {
      const response = await fetch("/api/sat-descarga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "verificarSolicitud",
          idSolicitud: solicitud.id,
          certificadoPath,
          llavePrivadaPath,
          passwordLlave,
          rfc: rfcUsuario,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error al verificar la solicitud")
      }

      const solicitudActualizada: SolicitudDescarga = {
        ...data,
        fechaSolicitud: new Date(data.fechaSolicitud),
      }

      setSolicitudes(solicitudes.map((s) => (s.id === solicitud.id ? solicitudActualizada : s)))
      setSolicitudSeleccionada(solicitudActualizada)
      setSuccess(`Solicitud verificada correctamente`)
      setVerificando(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al verificar la solicitud")
      setVerificando(false)
    }
  }

  // Función para descargar un paquete
  const handleDescargarPaquete = async (idPaquete: string) => {
    setDescargando(true)
    setError(null)

    try {
      const response = await fetch("/api/sat-descarga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "descargarPaquete",
          idPaquete,
          certificadoPath,
          llavePrivadaPath,
          passwordLlave,
          rfc: rfcUsuario,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Error al descargar el paquete")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${idPaquete}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      setSuccess(`Paquete ${idPaquete} descargado correctamente`)
      setDescargando(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descargar el paquete")
      setDescargando(false)
    }
  }

  // Función para seleccionar una solicitud
  const handleSeleccionarSolicitud = (solicitud: SolicitudDescarga) => {
    setSolicitudSeleccionada(solicitud)
    setActiveTab("detalle")
  }

  return (
    <Card className="w-full shadow-lg border-slate-200">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Download className="h-6 w-6 text-blue-500" />
          Descarga Masiva SAT
        </CardTitle>
        <CardDescription>Descarga masiva de CFDI y Metadata directamente desde el SAT</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b bg-slate-50 p-0">
            <TabsTrigger
              value="config"
              className="flex-1 rounded-none border-r data-[state=active]:bg-white data-[state=active]:shadow-none py-3"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              Configuración
            </TabsTrigger>
            <TabsTrigger
              value="solicitudes"
              className="flex-1 rounded-none border-r data-[state=active]:bg-white data-[state=active]:shadow-none py-3"
            >
              <FileText className="mr-2 h-4 w-4" />
              Solicitudes
            </TabsTrigger>
            <TabsTrigger
              value="detalle"
              disabled={!solicitudSeleccionada}
              className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none py-3"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Detalle y Descarga
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="p-6 bg-white">
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-medium mb-4">Parámetros de Solicitud</h3>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Fecha Inicial</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !startDate && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {startDate ? format(startDate, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={setStartDate}
                              initialFocus
                              locale={es}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Fecha Final</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !endDate && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {endDate ? format(endDate, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus locale={es} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipo de Solicitud</label>
                      <Select
                        value={tipoSolicitud}
                        onValueChange={(value: "CFDI" | "Metadata") => setTipoSolicitud(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CFDI">CFDI (XML Completo)</SelectItem>
                          <SelectItem value="Metadata">Metadata (Solo datos)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rfcEmisor">RFC Emisor (opcional)</Label>
                      <Input
                        id="rfcEmisor"
                        value={rfcEmisor}
                        onChange={(e) => setRfcEmisor(e.target.value)}
                        placeholder="RFC del emisor específico"
                      />
                      <p className="text-xs text-slate-500">Deja en blanco para obtener CFDI de todos los emisores</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Configuración de e.firma</h3>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="certificado">Certificado (.cer)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="certificado"
                          value={certificadoPath}
                          onChange={(e) => setCertificadoPath(e.target.value)}
                          placeholder="Ruta al archivo .cer"
                          className="flex-1"
                        />
                        <Button variant="outline" className="shrink-0">
                          Examinar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="llave">Llave Privada (.key)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="llave"
                          value={llavePrivadaPath}
                          onChange={(e) => setLlavePrivadaPath(e.target.value)}
                          placeholder="Ruta al archivo .key"
                          className="flex-1"
                        />
                        <Button variant="outline" className="shrink-0">
                          Examinar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña de la Llave Privada</Label>
                      <Input
                        id="password"
                        type="password"
                        value={passwordLlave}
                        onChange={(e) => setPasswordLlave(e.target.value)}
                        placeholder="Contraseña de la llave privada"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <Check className="h-4 w-4 text-green-500" />
                  <AlertTitle>Éxito</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleCrearSolicitud}
                  disabled={
                    loading || !startDate || !endDate || !certificadoPath || !llavePrivadaPath || !passwordLlave
                  }
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Crear Solicitud
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="solicitudes" className="p-6 bg-white">
            <div className="space-y-6">
              {solicitudes.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Solicitud</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {solicitudes.map((solicitud) => (
                        <TableRow key={solicitud.id}>
                          <TableCell className="font-medium">{solicitud.id}</TableCell>
                          <TableCell>{format(solicitud.fechaSolicitud, "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell>{solicitud.tipoSolicitud}</TableCell>
                          <TableCell>
                            {solicitud.fechaInicial} al {solicitud.fechaFinal}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={estadoSolicitudMap[solicitud.estatus].color}>
                              {estadoSolicitudMap[solicitud.estatus].texto}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVerificarSolicitud(solicitud)}
                                disabled={verificando}
                              >
                                {verificando ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                                <span className="sr-only">Verificar</span>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleSeleccionarSolicitud(solicitud)}>
                                <FileDown className="h-4 w-4" />
                                <span className="sr-only">Ver detalle</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-50 rounded-md">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
                    <FileText className="h-6 w-6 text-slate-500" />
                  </div>
                  <p className="text-slate-500 mb-4">No hay solicitudes de descarga.</p>
                  <Button variant="outline" onClick={() => setActiveTab("config")}>
                    Crear nueva solicitud
                  </Button>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <Check className="h-4 w-4 text-green-500" />
                  <AlertTitle>Éxito</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="detalle" className="p-6 bg-white">
            {solicitudSeleccionada ? (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Detalles de la Solicitud</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">ID de Solicitud</p>
                      <p className="font-medium">{solicitudSeleccionada.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Fecha de Solicitud</p>
                      <p className="font-medium">{format(solicitudSeleccionada.fechaSolicitud, "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Tipo de Solicitud</p>
                      <p className="font-medium">{solicitudSeleccionada.tipoSolicitud}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Período</p>
                      <p className="font-medium">
                        {solicitudSeleccionada.fechaInicial} al {solicitudSeleccionada.fechaFinal}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Estado</p>
                      <Badge variant="outline" className={estadoSolicitudMap[solicitudSeleccionada.estatus].color}>
                        {estadoSolicitudMap[solicitudSeleccionada.estatus].texto}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Mensaje</p>
                      <p className="font-medium">{solicitudSeleccionada.mensaje}</p>
                    </div>
                  </div>
                </div>

                {solicitudSeleccionada.estatus === EstadoSolicitud.Terminada &&
                solicitudSeleccionada.paquetes.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Paquetes Disponibles</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID Paquete</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {solicitudSeleccionada.paquetes.map((paquete) => (
                            <TableRow key={paquete}>
                              <TableCell className="font-medium">{paquete}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDescargarPaquete(paquete)}
                                  disabled={descargando}
                                >
                                  {descargando ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                  )}
                                  Descargar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-md">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
                      <FileDown className="h-6 w-6 text-slate-500" />
                    </div>
                    <p className="text-slate-500 mb-4">
                      {solicitudSeleccionada.estatus === EstadoSolicitud.Terminada
                        ? "No hay paquetes disponibles para esta solicitud."
                        : "La solicitud aún no está lista para descarga."}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => handleVerificarSolicitud(solicitudSeleccionada)}
                      disabled={verificando}
                    >
                      {verificando ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Verificar Estado
                    </Button>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-green-50 text-green-800 border-green-200">
                    <Check className="h-4 w-4 text-green-500" />
                    <AlertTitle>Éxito</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-50">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
                  <FileText className="h-6 w-6 text-slate-500" />
                </div>
                <p className="text-slate-500 mb-4">No hay solicitud seleccionada.</p>
                <Button variant="outline" onClick={() => setActiveTab("solicitudes")}>
                  Ver solicitudes
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="bg-slate-50 border-t p-4">
        <p className="text-xs text-slate-500">
          La descarga masiva de CFDI permite obtener los comprobantes emitidos y recibidos directamente desde el SAT.
          Los paquetes descargados estarán disponibles por 72 horas después de su generación.
        </p>
      </CardFooter>
    </Card>
  )
}
