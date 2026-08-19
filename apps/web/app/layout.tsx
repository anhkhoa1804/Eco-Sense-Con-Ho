import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/**
 * Self-hosted at build time by next/font (already part of the installed
 * `next` dependency — no new package, no runtime request, works offline in
 * the PWA). Data readouts only — see globals.css's --text-data role.
 * Body/heading typography is untouched.
 */
const dataMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  display: "swap",
});

const SITE_NAME = "HORIZON";
const SITE_DESCRIPTION =
  "Mạng lưới quan trắc môi trường quy mô thí điểm tại Cồn Hô, Vĩnh Long — mực nước, độ mặn và tình trạng đất, trình bày công khai và trung thực.";

export const metadata: Metadata = {
  title: {
    default: "HORIZON - Frogsleap Vietnam",
    template: "%s — HORIZON",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",

  /**
   * The minimal HORIZON mark (green H monogram under an orange nón lá), never
   * the wordmark — an 829×301 lockup is illegible once squeezed into a 32px
   * tab or a square launcher tile.
   *
   * SVG for the tab, because it stays crisp at 16px. The project's own raster
   * icon is offered as the Apple touch icon, since iOS does not accept SVG for
   * the home-screen mark — the two are the same artwork, so the identity is
   * consistent wherever it lands.
   */
  icons: {
    icon: [{ url: "/assets/brand/horizon-mark.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/assets/brand/horizon-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/assets/brand/horizon-icon.png", type: "image/png" }],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },

  /**
   * No metadataBase is set deliberately: the canonical public origin is a
   * deployment concern, and hardcoding one here would emit wrong absolute
   * URLs on preview deployments. Next resolves the relative image against
   * the request origin, which is correct on every environment.
   */
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "HORIZON — Quan trắc môi trường tại Cồn Hô",
    description: SITE_DESCRIPTION,
    locale: "vi_VN",
  },
  twitter: {
    card: "summary_large_image",
    title: "HORIZON — Quan trắc môi trường tại Cồn Hô",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  /** Matches --h-background in each theme so the browser chrome agrees with the canvas. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1312" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the boot script below mutates <html>'s
    // data-theme before React hydrates, so the client tree legitimately
    // differs from the server tree on this one attribute.
    <html lang="vi" className={dataMono.variable} suppressHydrationWarning>
      <head>
        {/* Must run before first paint — see lib/theme.ts for why this is a
            raw inline script rather than a component or effect. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        {/* The shared drafting-grid canvas. One fixed layer behind every
            page, so header/footer/main can all be transparent over a single
            continuous surface instead of being separate colour panels. */}
        <div className="horizon-atmosphere" aria-hidden />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
