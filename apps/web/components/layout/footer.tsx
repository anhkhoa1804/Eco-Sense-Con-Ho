import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { PUBLIC_NAV_LINKS } from "@/lib/publicNav";

/**
 * A project/observatory footer, not a marketing footer — brand + place +
 * navigation + required map attribution + a restrained status line. No
 * "project/technical links" column: this repository has no verified public
 * URL (no `repository`/`homepage` field in package.json) to point at, and
 * inventing one would violate the same data-honesty rule this whole
 * redesign is built around. Add that column back only once a real, public
 * link exists to put in it.
 */
export function Footer() {
  return (
    <footer className="relative border-t border-border/60 pb-24 md:pb-0">
      {/* pb-24 clears the fixed mobile bottom nav (PublicShell) so the
          footer's own tail is never hidden behind it — md:pb-0 because that
          nav is md:hidden. The short accent tick echoes the same
          border-accent treatment the Monitoring map zone uses, a small
          deliberate touch rather than a plain flat rule. */}
      <div className="absolute left-4 top-0 h-0.5 w-10 bg-accent/60 sm:left-6" aria-hidden />
      <div className="mx-auto max-w-[var(--width-content-wide)] space-y-10 px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-3">
          <div className="space-y-3">
            <Wordmark />
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              Nền tảng quan trắc môi trường quy mô thí điểm — mực nước, độ mặn và tình trạng đất, trình bày công khai
              và trung thực.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Điều hướng</p>
            <ul className="space-y-2 text-sm">
              {PUBLIC_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted transition-colors duration-[var(--motion-base)] hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Địa điểm</p>
            <p className="text-sm text-muted">Cồn Hô · Vĩnh Long</p>
            <p className="text-sm text-muted">Dự án thí điểm quy mô nhỏ, ba điểm quan trắc.</p>
            <p className="text-xs text-muted [font-family:var(--font-data)]">10.2419°N · 105.8260°E</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/50 pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Dữ liệu bản đồ © OpenStreetMap contributors, nền bản đồ © CARTO.</p>
          <p>HORIZON — giai đoạn thí điểm.</p>
        </div>
      </div>
    </footer>
  );
}
