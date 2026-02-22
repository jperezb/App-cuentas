import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "MisCuentas - Gestión Financiera Chile",
  description:
    "Aplicación de gestión financiera personal con integración de bancos chilenos, seguimiento de inversiones y gastos grupales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
