import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import "./globals.css";

/**
 * Self-hosted at build time by next/font (already part of the installed
 * `next` dependency — no new package, no runtime request, works offline in
 * the PWA). Data readouts only — see globals.css's --text-data role and
 * REDESIGN §3. Body/heading typography is untouched.
 */
const dataMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Horizon",
  description: "Mạng lưới quan trắc khí hậu và môi trường do thanh niên dẫn dắt tại Cồn Hô",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Horizon",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={dataMono.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
