import type { Metadata, Viewport } from "next";
import { QueryProvider } from "@/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eco-Sense Cồn Hô",
  description: "Farmer dashboard for brackish-water monitoring in Cồn Hô",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Eco-Sense",
  },
};

export const viewport: Viewport = {
  themeColor: "#071014",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
