import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="font-serif text-[36px] italic text-primary">Nothing here.</h1>
      <p className="text-[14px] text-secondary">Find your way back to the cut.</p>
      <Link href="/leaderboard" className="mt-2 text-[14px] text-accent">
        Leaderboard →
      </Link>
    </div>
  );
}
