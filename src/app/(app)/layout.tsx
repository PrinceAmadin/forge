import { TabBar, SideRail } from "@/components/TabBar";

// Shell for the three participant destinations: bottom tabs on mobile,
// slim left rail on desktop. §3 / §14
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideRail />
      <main className="min-h-dvh pb-20 sm:pb-0 sm:pl-[200px]">{children}</main>
      <TabBar />
    </>
  );
}
