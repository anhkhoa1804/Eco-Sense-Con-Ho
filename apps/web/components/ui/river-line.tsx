import { cn } from "@/lib/utils";

/**
 * Visual-signature element #5 — a single restrained river/coastal wave
 * motif (REDESIGN_SPECIFICATION.md §24.2/§24.6). Used deliberately rarely:
 * a brand-moment section transition, never inside functional UI (tables,
 * forms, charts, admin). One shared source so it's never reinvented per
 * page — see §24.6's shape-language rule.
 */
export function RiverLine({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 32"
      preserveAspectRatio="none"
      className={cn("h-6 w-full text-brand-green/50", className)}
      aria-hidden
    >
      <path
        d="M0 18 C 120 4, 240 32, 360 18 S 600 4, 720 18 S 960 32, 1080 18 S 1200 8, 1200 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
