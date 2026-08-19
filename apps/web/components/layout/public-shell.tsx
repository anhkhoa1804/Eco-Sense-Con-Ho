import Link from "next/link";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/footer";
import { SiteHeader } from "@/components/layout/site-header";
import { isPublicNavActive, PUBLIC_NAV_LINKS } from "@/lib/publicNav";

export function PublicShell({
  children,
  activePath,
}: {
  children: React.ReactNode;
  activePath?: string;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader register="public" activePath={activePath} />

      <main className="relative mx-auto max-w-[var(--width-content-wide)] px-4 pb-8 pt-4 md:pt-8">{children}</main>

      <Footer />

      <nav
        aria-label="Điều hướng di động"
        className="fixed inset-x-0 bottom-0 z-[var(--z-drawer)] border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-center justify-around px-3 py-2">
          {PUBLIC_NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = isPublicNavActive(href, activePath);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 min-w-16 flex-col items-center gap-1 rounded-sm px-3 py-2 text-xs transition-colors duration-[var(--motion-base)]",
                    active ? "nav-link-active text-accent" : "text-muted",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="font-medium">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
