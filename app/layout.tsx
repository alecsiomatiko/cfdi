import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Logo } from "@/components/logo"
import { ThemeProvider } from "@/components/theme-provider"
import { ProcessedDataProvider } from "@/components/file-uploader"

// Añadir la declaración de tipos para la API File System Access
// Esto es necesario porque TypeScript no incluye estas definiciones por defecto
declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterable<FileSystemHandle>
  }

  interface FileSystemHandle {
    kind: "file" | "directory"
    name: string
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    kind: "file"
    getFile(): Promise<File>
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: "directory"
    values(): AsyncIterable<FileSystemHandle>
  }
}

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Analizador XML Capital IDN",
  description: "Procesa tus archivos CFDI 4.0 y obtén reportes detallados en Excel con todos los complementos de pago",
  generator: "Capital IDN",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${inter.className} bg-slate-50 min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <ProcessedDataProvider>
            <header className="border-b bg-white shadow-sm">
              <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <Logo />
                <nav className="hidden md:flex gap-6">
                  <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Inicio
                  </a>
                  <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Características
                  </a>
                  <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Ayuda
                  </a>
                  <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                    Contacto
                  </a>
                </nav>
              </div>
            </header>
            <main className="container mx-auto px-4 py-8 md:py-12">{children}</main>
            <footer className="bg-slate-900 text-white mt-12">
              <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-center">
                  <div className="mb-4 md:mb-0">
                    <h3 className="text-xl font-bold mb-2">Analizador XML</h3>
                    <p className="text-slate-300 text-sm">
                      Procesa tus archivos CFDI 4.0 y obtén reportes detallados en Excel
                    </p>
                  </div>
                  <p className="text-sm text-slate-400">
                    © {new Date().getFullYear()} Capital IDN. Todos los derechos reservados.
                  </p>
                </div>
              </div>
            </footer>
          </ProcessedDataProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
