// Hours are stored as decimal hours; users and displays think in h/m. §ISSUE-3

export function decimalHoursToHM(decimal: number): { h: number; m: number } {
  const totalMinutes = Math.round((decimal || 0) * 60);
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

export function hmToDecimalHours(h: number, m: number): number {
  // Carry-over: 90 minutes rolls into the hour total.
  const totalMinutes = (h || 0) * 60 + (m || 0);
  return totalMinutes / 60;
}

// 'compact' → clock-style "142:30" for dense/tabular contexts.
// 'long'    → "142h 30m" for narrative contexts.
// Compact drops ":00" when minutes are zero (cleaner hero display).
export function formatHM(decimal: number, style: "compact" | "long" = "compact"): string {
  const { h, m } = decimalHoursToHM(decimal);
  if (style === "compact") {
    return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, "0")}`;
  }
  if (h === 0 && m === 0) return "0h";
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Normalize an (h, m) pair so minutes are 0–59, carrying into hours.
export function normalizeHM(h: number, m: number): { h: number; m: number } {
  return decimalHoursToHM(hmToDecimalHours(h, m));
}
