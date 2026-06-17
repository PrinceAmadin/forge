export type CellState =
  | "done" // verified / completed past day — solid amber
  | "pending" // awaiting review — striped amber
  | "rejected" // solid red
  | "today" // 1px amber border
  | "future" // 1px zinc border
  | "skipped"; // 1px quaternary border (missed past day)

function cellClass(state: CellState): string {
  switch (state) {
    case "done":
      return "bg-accent";
    case "pending":
      return "cell-pending";
    case "rejected":
      return "bg-rejected";
    case "today":
      return "border border-accent";
    case "skipped":
      return "border border-[#52525b]";
    case "future":
    default:
      return "border border-[#27272a]";
  }
}

// Derives the simple progress states for the leaderboard header from the
// current day (no per-user data). §6.1
export function progressStates(duration: number, currentDay: number): CellState[] {
  return Array.from({ length: duration }, (_, i) => {
    const day = i + 1;
    if (day < currentDay) return "done";
    if (day === currentDay) return "today";
    return "future";
  });
}

export function CampaignStrip({
  states,
  size = "sm",
}: {
  states: CellState[];
  size?: "sm" | "lg";
}) {
  const dims =
    size === "lg"
      ? { w: 12, h: 20, gap: 3 }
      : { w: 7, h: 12, gap: 2 };

  return (
    <div className="flex" style={{ gap: dims.gap }} aria-hidden>
      {states.map((s, i) => (
        <span
          key={i}
          className={cellClass(s)}
          style={{ width: dims.w, height: dims.h, borderRadius: 1 }}
        />
      ))}
    </div>
  );
}
