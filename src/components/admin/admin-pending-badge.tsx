import { getAdminPendingCounts } from "@/lib/admin/pending-counts";

// A 7px amber dot — ambient "you have review work" marker. Server component:
// renders nothing for participants (null counts) or when the queue is clear
// (total 0). No number, no animation, no red — numbers live on /settings and
// the queue/appeals titles; red is reserved for danger. §design-restraint
//
// Anchors absolutely to a position:relative parent, so it overlays the cog glyph.
export async function AdminPendingBadge() {
  const counts = await getAdminPendingCounts();
  if (!counts || counts.total === 0) return null;

  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full bg-accent"
    />
  );
}
