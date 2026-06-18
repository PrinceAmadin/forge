import Link from "next/link";
import type { RankedRow } from "@/lib/types";
import { toRomanUpper, padRank, timeAgo, deltaGlyph } from "@/lib/format";
import { formatHM } from "@/lib/time/format";

type Zone = "top3" | "prize" | "dimmed" | "dq";

// Long course names blow out the single mobile metadata line. Collapse a long
// multi-word course to its first word ("Mechanical Engineering" → "Mechanical");
// the metadata line is also CSS-truncated, so single long words still ellipsize.
function shortCourse(course: string): string {
  const c = (course ?? "").trim();
  if (c.length <= 16) return c;
  return c.split(/\s+/)[0] ?? c;
}

function zoneOf(row: RankedRow, prizeLine: number): Zone {
  if (row.is_disqualified) return "dq";
  if (row.rank <= 3) return "top3";
  if (row.rank <= prizeLine) return "prize";
  return "dimmed";
}

function deltaColor(row: RankedRow, zone: Zone): string {
  if (zone === "dq") return "text-[#3f3f46]";
  if (row.crossedIntoPrize || row.ejectedFromPrize) return "text-accent";
  if (row.isNew) return "text-[#d4d4d8]";
  if (row.delta == null || row.delta === 0) return zone === "dimmed" ? "text-[#3f3f46]" : "text-[#52525b]";
  return row.delta > 0 ? "text-[#d4d4d8]" : "text-[#71717a]";
}

function Cell({ children, className, align = "left" }: { children: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return <td className={`${a} ${className ?? ""}`}>{children}</td>;
}

function Row({
  row,
  prizeLine,
  showMarks,
  marksCount,
  overtookName,
}: {
  row: RankedRow;
  prizeLine: number;
  showMarks: boolean;
  marksCount: number;
  overtookName: string | null;
}) {
  const zone = zoneOf(row, prizeLine);

  const rankCls =
    zone === "top3"
      ? "text-accent text-[32px] md:text-[38px]"
      : zone === "dimmed"
        ? "text-[#52525b] text-[22px] md:text-[26px]"
        : zone === "dq"
          ? "text-[#3f3f46] text-[22px] md:text-[26px]"
          : "text-[#a1a1aa] text-[22px] md:text-[26px]";

  const nameCls =
    zone === "dq"
      ? "text-[#52525b] line-through"
      : zone === "dimmed"
        ? "text-[#a1a1aa]"
        : "text-primary";

  const courseCls = zone === "dq" ? "text-[#3f3f46]" : zone === "dimmed" ? "text-[#52525b]" : "text-[#71717a]";
  const hallCls = zone === "dq" ? "text-[#52525b]" : zone === "dimmed" ? "text-[#71717a]" : "text-secondary";
  const daysCls = zone === "dq" ? "text-[#52525b]" : zone === "dimmed" ? "text-[#71717a]" : "text-secondary";
  const lastCls = zone === "dq" ? "text-[#3f3f46]" : zone === "dimmed" ? "text-[#52525b]" : "text-[#71717a]";
  const hoursCls =
    zone === "dq"
      ? "text-[#52525b] line-through"
      : zone === "top3"
        ? "text-primary text-[16px] md:text-[17px] font-medium"
        : zone === "dimmed"
          ? "text-[#a1a1aa] text-[14px] md:text-[15px]"
          : "text-primary text-[14px] md:text-[15px]";

  const rowCls = [
    "border-t",
    zone === "dimmed" || zone === "dq" ? "border-[#18181b]" : "border-[#27272a]",
    zone === "top3" ? "border-l-2 border-l-accent" : "",
    row.isYou ? "you-tint" : "",
    "transition-colors sm:hover:bg-zinc-900/40",
  ].join(" ");

  const padY = zone === "top3" ? "py-4" : "py-3.5";
  const rank = zone === "top3" ? toRomanUpper(row.rank) : padRank(row.rank);

  return (
    <tr className={rowCls}>
      <Cell align="right" className={`${padY} pr-3.5 align-middle font-serif italic leading-none ${rankCls}`}>
        {rank}
      </Cell>
      <Cell align="center" className={`${padY} align-middle font-mono text-[11px] ${deltaColor(row, zone)}`}>
        {deltaGlyph(row.delta, row.isNew)}
      </Cell>
      <Cell className={`${padY} pl-3 align-middle`}>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <Link
              href={`/readers/${row.participant_id}`}
              className={`line-clamp-2 break-words text-[15px] leading-[1.25] md:text-[14px] ${nameCls} ${row.isYou ? "font-medium" : "font-normal"} transition-colors active:text-accent sm:hover:text-accent`}
            >
              {row.full_name}
            </Link>
            {row.isYou && (
              <span className="shrink-0 font-serif text-[12px] italic text-accent" aria-label="your row">
                you
              </span>
            )}
            {zone === "dq" && (
              <span className="shrink-0 font-serif text-[12px] italic text-rejected">disqualified</span>
            )}
          </div>
          {/* Desktop: course on its own line under the name. On mobile it folds
              into the single metadata line below instead. */}
          <div className={`mt-[3px] hidden truncate text-[12px] md:block ${courseCls}`}>{row.course}</div>
          {/* Overtake badge — honors the achiever for 24h. §Marks-4 */}
          {overtookName && (
            <div className="mt-1 font-serif text-[12px] italic text-accent">↟ overtook {overtookName}</div>
          )}
          {/* Mobile-only: course · hall · days · last — one truncated line, no
              standalone "—" when there's no submission yet. §13.5 */}
          <div className={`mt-1 truncate font-mono text-[11px] md:hidden ${lastCls}`}>
            {[
              shortCourse(row.course),
              row.hall_name,
              `${row.verified_days}d`,
              row.last_submission ? timeAgo(row.last_submission) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </Cell>
      <Cell className={`hidden ${padY} align-middle text-[13px] md:table-cell ${hallCls}`}>
        {row.hall_name ?? "—"}
      </Cell>
      <Cell align="right" className={`hidden ${padY} align-middle font-mono text-[13px] tnum md:table-cell ${daysCls}`}>
        {row.verified_days}
      </Cell>
      <Cell align="right" className={`${padY} align-middle font-mono tnum ${hoursCls}`}>
        {formatHM(row.total_hours, "compact")}
      </Cell>
      <Cell align="right" className={`hidden ${padY} pr-3 align-middle font-mono text-[11px] md:table-cell ${lastCls}`}>
        {timeAgo(row.last_submission)}
      </Cell>
      {/* Marks against this reader (desktop only). §Marks-1 */}
      {showMarks && (
        <Cell align="right" className={`hidden ${padY} pr-3 align-middle font-mono text-[11px] md:table-cell ${marksCount >= 3 ? "text-accent" : "text-tertiary"}`}>
          {marksCount > 0 ? `● ${marksCount}` : ""}
        </Cell>
      )}
    </tr>
  );
}

function TheCut({ hrsToCross, cols }: { hrsToCross: number | null; cols: number }) {
  return (
    <tr className="border-t border-accent">
      <td colSpan={cols} className="pb-[18px] pt-[22px]">
        <div className="flex items-center gap-4">
          <span
            className="font-serif text-[13px] italic lowercase text-accent"
            style={{ letterSpacing: "0.04em" }}
          >
            the cut
          </span>
          <span className="h-px flex-1 bg-[#27272a]" />
          {hrsToCross != null && (
            <span className="font-mono text-[11px] text-tertiary">
              {formatHM(hrsToCross, "long")} to cross
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function LeaderboardTable({
  rows,
  prizeLine,
  marksAgainst,
  overtakes,
}: {
  rows: RankedRow[];
  prizeLine: number;
  marksAgainst?: Map<string, number>;
  overtakes?: Map<string, string[]>;
}) {
  const showMarks = marksAgainst != null;
  const cols = showMarks ? 8 : 7;
  const nameById = new Map(rows.map((r) => [r.participant_id, r.full_name]));

  function overtookNameFor(markerId: string): string | null {
    const targets = overtakes?.get(markerId);
    if (!targets || targets.length === 0) return null;
    const names = targets.map((t) => nameById.get(t)).filter(Boolean) as string[];
    if (names.length === 0) return null;
    return names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`;
  }

  // Find where to drop the cut: before the first active row past the prize line.
  const cutBeforeId =
    rows.find((r) => !r.is_disqualified && r.rank === prizeLine + 1)?.participant_id ?? null;

  // hrsToCross is computed by the caller and passed via the firstOut row context;
  // we recompute the simple gap here from the two adjacent rows to keep the
  // component self-contained.
  const lastIn = rows.find((r) => !r.is_disqualified && r.rank === prizeLine);
  const firstOut = rows.find((r) => !r.is_disqualified && r.rank === prizeLine + 1);
  const hrsToCross =
    lastIn && firstOut
      ? Math.max(0, Math.round((lastIn.total_hours - firstOut.total_hours) * 10) / 10)
      : null;

  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col style={{ width: 56 }} />
        <col style={{ width: 32 }} />
        <col />
        <col className="hidden md:table-column" style={{ width: 96 }} />
        <col className="hidden md:table-column" style={{ width: 44 }} />
        <col style={{ width: 64 }} />
        <col className="hidden md:table-column" style={{ width: 52 }} />
        {showMarks && <col className="hidden md:table-column" style={{ width: 50 }} />}
      </colgroup>
      <thead>
        <tr className="text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.18em" }}>
          <th className="pb-3 pr-3.5 text-right font-normal">rank</th>
          <th className="pb-3 font-normal" />
          <th className="pb-3 pl-3 text-left font-normal">reader</th>
          <th className="hidden pb-3 text-left font-normal md:table-cell">hall</th>
          <th className="hidden pb-3 text-right font-normal md:table-cell">days</th>
          <th className="pb-3 text-right font-normal">hours</th>
          <th className="hidden pb-3 pr-3 text-right font-normal md:table-cell">last</th>
          {showMarks && <th className="hidden pb-3 pr-3 text-right font-normal md:table-cell">marks</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <ReactRowGroup
            key={row.participant_id}
            renderCut={row.participant_id === cutBeforeId}
            hrsToCross={hrsToCross}
            cols={cols}
          >
            <Row
              row={row}
              prizeLine={prizeLine}
              showMarks={showMarks}
              marksCount={marksAgainst?.get(row.participant_id) ?? 0}
              overtookName={overtookNameFor(row.participant_id)}
            />
          </ReactRowGroup>
        ))}
      </tbody>
    </table>
  );
}

// Renders the cut divider immediately before a given row when needed.
function ReactRowGroup({
  renderCut,
  hrsToCross,
  cols,
  children,
}: {
  renderCut: boolean;
  hrsToCross: number | null;
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {renderCut && <TheCut hrsToCross={hrsToCross} cols={cols} />}
      {children}
    </>
  );
}
