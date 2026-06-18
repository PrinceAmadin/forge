"use client";

import { useRouter } from "next/navigation";

// Discoverable back affordance for sub-pages (not top-level tabs). §FIX-3
// Inline chevron-left (lucide glyph) rather than importing lucide-react, per
// §19.6. 44px tap target. Uses an explicit `href` when given, else router.back()
// with a `fallback` for when there's no history (e.g. opened via deep link).
export function BackButton({
  href,
  fallback = "/leaderboard",
  label,
}: {
  href?: string;
  fallback?: string;
  label?: string;
}) {
  const router = useRouter();

  function onClick() {
    if (href) {
      router.push(href);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="-ml-2.5 inline-flex h-11 items-center gap-1 pr-2 text-secondary transition-colors active:text-primary sm:hover:text-primary"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label && <span className="text-[14px]">{label}</span>}
    </button>
  );
}
