import Link from "next/link";

// The Forge wordmark, always a route home to the active challenge leaderboard.
// §FIX-3 / PROBLEM-3. Instrument Serif, amber. The desktop SideRail renders its
// own larger wordmark (also → /leaderboard); this is the compact mobile one used
// at the top-right of the top-level destinations.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/leaderboard"
      aria-label="Forge — home"
      className={`font-serif text-[16px] leading-none text-accent ${className}`}
    >
      Forge
    </Link>
  );
}
