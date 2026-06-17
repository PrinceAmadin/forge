"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps the board fresh: refreshes server data when the tab regains focus
// (covers the "check between classes" pattern) without client-side fetching. §13.5
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
  return null;
}
