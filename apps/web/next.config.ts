import type { NextConfig } from "next";
import path from "node:path";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
});

/**
 * Baseline security headers.
 *
 * Set here rather than in vercel.json so they survive the platform: they apply
 * identically under `next start`, a container, or any other host, and a change
 * of provider cannot silently drop them.
 *
 * No Content-Security-Policy yet, deliberately. Next's App Router injects
 * inline bootstrap scripts, so a useful CSP needs per-request nonces threaded
 * through the middleware — worth doing, but it is a change that fails closed
 * and visibly (a wrong directive blanks the page), so it belongs in a phase
 * where it can be verified against every route rather than bolted on here.
 * Tracked in docs/PRODUCTION_READINESS.md.
 */
const securityHeaders = [
  // Stop the browser second-guessing declared content types — the cheap
  // defence against a user-supplied file being sniffed as HTML and executed.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No framing at all: this app has no embeddable surface, and both admin
  // login and the report form are clickjacking targets.
  { key: "X-Frame-Options", value: "DENY" },
  // Send the origin cross-site, the full path same-origin. Report URLs and
  // admin paths should not leak to Open-Meteo or the tile provider.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation stays enabled for our own origin — the report form's
  // "use my location" needs it. Everything else is switched off.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withPWA(nextConfig);
