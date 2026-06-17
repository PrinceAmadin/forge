"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Functional icons only, inline SVG (§7 / §13.9).
function BarsIcon({ active }: { active: boolean }) {
  const c = active ? "#F59E0B" : "#71717A";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="11" width="3.5" height="7" fill={c} />
      <rect x="8.25" y="6" width="3.5" height="12" fill={c} />
      <rect x="14.5" y="2" width="3.5" height="16" fill={c} />
    </svg>
  );
}

function PlusIcon({ active }: { active: boolean }) {
  const c = active ? "#F59E0B" : "#71717A";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 3v14M3 10h14" stroke={c} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  const c = active ? "#F59E0B" : "#71717A";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="6" r="3.25" fill={c} />
      <path d="M3.5 17c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" fill={c} />
    </svg>
  );
}

const TABS = [
  { href: "/leaderboard", label: "Leaderboard", icon: BarsIcon },
  { href: "/submit", label: "Submit", icon: PlusIcon },
  { href: "/you", label: "You", icon: PersonIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#27272a] bg-bg pb-safe sm:hidden"
      style={{ boxShadow: "0 -1px 0 0 rgba(255,255,255,0.02)" }}
    >
      <ul className="grid h-16 grid-cols-3">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex w-full flex-col items-center justify-center gap-1"
              >
                <Icon active={active} />
                <span className={`text-[10px] ${active ? "text-accent" : "text-tertiary"}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Desktop: the same three destinations as a slim left rail (§3 / §14).
export function SideRail() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-40 hidden w-[200px] flex-col border-r border-[#27272a] bg-bg px-4 py-7 sm:flex"
    >
      <Link href="/leaderboard" className="mb-10 px-2 font-serif text-[22px] italic text-accent">
        Forge
      </Link>
      <ul className="flex flex-col gap-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] transition-colors ${
                  active ? "text-accent" : "text-secondary hover:text-primary"
                }`}
              >
                <Icon active={active} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
