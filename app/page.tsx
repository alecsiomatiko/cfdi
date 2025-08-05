"use client"

import { useContext } from "react"
import { FileUploader, ProcessedDataContext } from "@/components/file-uploader"
import { Features } from "@/components/features"
import { Hero } from "@/components/hero"
import { DIOTModule } from "@/components/diot-module"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, FileSpreadsheet } from "lucide-react"

export default function Home() {
  const { processedData } = useContext(ProcessedDataContext)

  return (
    <main className="flex min-h-screen w-full flex-col items-center">
      <div className="w-full">
        <Hero />
      </div>

      <div className="w-full max-w-[95%] mx-auto">
        <Tabs defaultValue="cfdi" className="w-full">
          <TabsList className="w-full max-w-md mx-auto mb-6">
            <TabsTrigger value="cfdi" className="flex-1">
              <FileText className="mr-2 h-4 w-4" />
              Procesar CFDI
            </TabsTrigger>
            <TabsTrigger value="diot" className="flex-1">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Generar DIOT
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cfdi">
            <FileUploader />
          </TabsContent>

          <TabsContent value="diot">
            <DIOTModule processedData={processedData} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="w-full">
        <Features />
      </div>
    </main>
  )
}
