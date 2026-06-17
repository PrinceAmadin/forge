// Presentation helpers. Pure, no side effects.

const ROMAN: [number, string][] = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
  [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
  [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];

// Lowercase roman by default (used in the day count "xiv ╱ xx").
export function toRoman(n: number): string {
  if (n <= 0) return "";
  let out = "";
  let rem = n;
  for (const [value, glyph] of ROMAN) {
    while (rem >= value) {
      out += glyph;
      rem -= value;
    }
  }
  return out;
}

// Uppercase roman for the podium (I, II, III).
export function toRomanUpper(n: number): string {
  return toRoman(n).toUpperCase();
}

// Two-digit Arabic for ranks 4+ (04, 05, …).
export function padRank(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// "2h", "4h", "1d" — switch to days past 24h, to date past 7d. §6.1
export function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days <= 7) return `${days}d`;
  return then.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// "8.5" / "8" — drop the trailing .0 so whole hours read clean.
export function fmtHours(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function fmtNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

// Delta glyph for the leaderboard movement column.
export function deltaGlyph(delta: number | null, isNew: boolean): string {
  if (isNew) return "↑new";
  if (delta === null || delta === 0) return "—";
  return delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`;
}
