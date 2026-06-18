"use client";

import { useRouter } from "next/navigation";

// Top app bar for sub-pages (and any screen that needs a title + a guaranteed
// way out). Replaces the old floating BackButton chevron. §FIX-3
//
// - 56px tall, sticky to the top of the scrollable content, full-width.
// - When `backHref` is given, the left chevron routes there; otherwise it calls
//   router.back() and falls back to `fallback` when there's no history (deep
//   links / PWA cold starts).
// - The chevron lives inside a 44x44 tap target (HIG) so it's instantly
//   findable — a 22px lucide-style glyph, inline per §19.6 (no lucide-react).
export function PageHeader({
  title,
  backHref,
  fallback = "/leaderboard",
  actions,
}: {
  title: string;
  backHref?: string;
  fallback?: string;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const hasBack = backHref !== undefined;

  function goBack() {
    if (backHref) {
      router.push(backHref);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg pt-safe">
      <div className="flex h-14 items-center gap-1 px-2 sm:px-3">
        {hasBack ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-secondary transition-colors active:text-primary sm:hover:text-primary"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="w-2 shrink-0" aria-hidden />
        )}

        <h1 className="min-w-0 flex-1 truncate text-[18px] font-medium text-primary">
          {title}
        </h1>

        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  );
}
