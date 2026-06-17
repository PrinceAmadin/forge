"use client";

// App-level error boundary. Banner copy per §15 — never "oops" or "sorry".
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-dvh px-5 pt-10">
      <div className="mx-auto flex max-w-[480px] items-center justify-between gap-4 rounded-md border border-[#27272a] px-4 py-3">
        <p className="text-[14px] text-secondary">Something didn&rsquo;t go through. Try again.</p>
        <button
          onClick={reset}
          className="rounded-md border border-[#3f3f46] px-4 py-2 text-[13px] text-primary active:border-[#52525b]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
