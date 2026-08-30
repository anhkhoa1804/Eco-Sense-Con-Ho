import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/query-provider";
import { BackgroundAtmosphere } from "@/components/layout/background-atmosphere";
import { ParallaxRoot } from "@/components/ui/parallax-root";
import { LocaleProvider } from "@/lib/i18n/client";
import { HTML_LANG } from "@/lib/i18n/config";
import { getI18n, getLocale } from "@/lib/i18n/server";
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

/**
 * Metadata is generated per request so `description` follows the reader's
 * language cookie, the same way the rendered page does. `generateMetadata`
 * rather than a static export because the locale is only known at request
 * time — a static object would always describe the site in Vietnamese even
 * when the page itself rendered in English.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();

  return {
    title: {
      default: dict.meta.titleDefault,
      template: "%s — HORIZON",
    },
    description: dict.meta.description,
    applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",

  /*
   * NO `icons` KEY HERE — deliberately.
   *
   * The icons come from the App Router file convention (`app/icon.png` and
   * `app/apple-icon.png`), which emits the <link> tags itself. Declaring
   * `metadata.icons` as well would emit a SECOND, competing set of tags, and
   * the two would disagree about which file the tab should use.
   *
   * Every slot resolves to one source: horizon-icon.png, the owner's own mark
   * (green H under an orange nón lá). Never the wordmark — an 829×301 lockup
   * is illegible squeezed into a 32px tab.
   *
   * The supplied PNG is 464×333 with the artwork occupying only 236×246 of
   * it, off-centre, the rest transparent padding. Every icon slot expects a
   * square, so browsers scaled the whole letterboxed canvas and the tile
   * landed at roughly half size in the tab — the "cropped or badly scaled"
   * symptom. The derivatives are that exact artwork cropped to its own
   * bounding box and centred on a square; nothing was redrawn.
   */

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
      title: dict.meta.titleDefault,
      description: dict.meta.description,
      locale: locale === "en" ? "en_US" : "vi_VN",
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.titleDefault,
      description: dict.meta.description,
    },
  };
}

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved on the server so `lang` is correct in the very first byte of
  // HTML — assistive tech and translation tooling read it before any script
  // runs, so deriving it on the client would be too late.
  const locale = await getLocale();

  return (
    // suppressHydrationWarning: the boot script below mutates <html>'s
    // data-theme before React hydrates, so the client tree legitimately
    // differs from the server tree on this one attribute.
    <html lang={HTML_LANG[locale]} className={dataMono.variable} suppressHydrationWarning>
      <head>
        {/* Must run before first paint — see lib/theme.ts for why this is a
            raw inline script rather than a component or effect. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        {/* The one global background. Grid, gradient, vignette and parallax
            all live inside it — see the component for why nothing else may
            add a viewport-spanning texture. */}
        <BackgroundAtmosphere />
        {/* Publishes --parallax once per frame for every depth layer. */}
        <ParallaxRoot />
        {/* Locale is resolved once here and handed down, so no client
            component re-reads the cookie and risks a hydration mismatch. */}
        <LocaleProvider locale={locale}>
          <QueryProvider>{children}</QueryProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
