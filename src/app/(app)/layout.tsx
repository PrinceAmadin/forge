import { TabBar, SideRail } from "@/components/TabBar";

// Shell for the three participant destinations: bottom tabs on mobile,
// slim left rail on desktop. §3 / §14
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideRail />
      {/* Bottom padding clears the fixed 64px tab bar + safe-area inset on
          mobile so no page's content (esp. the submit button) hides behind the
          nav. Desktop uses the side rail, so it only needs normal spacing. §FIX-2 */}
      <main className="min-h-dvh pb-[calc(80px+env(safe-area-inset-bottom))] sm:pb-10 sm:pl-[200px]">
        {children}
      </main>
      <TabBar />
    </>
  );
}
