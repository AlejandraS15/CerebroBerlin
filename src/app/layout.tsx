import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Gemelo Digital de Berlín",
  description:
    "Plataforma interactiva de datos abiertos urbanos de Berlín: movilidad, calidad del aire, demografía e infraestructura.",
  keywords: [
    "Berlín",
    "gemelo digital",
    "digital twin",
    "open data",
    "smart city",
    "VBB",
    "OpenAQ",
  ],
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Modo oscuro por defecto vía clase en <html>.
  return (
    <html lang="es" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
