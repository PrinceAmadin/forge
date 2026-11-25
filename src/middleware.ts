import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { CHALLENGE_COOKIE } from "@/lib/challenge-cookie";

const PUBLIC_PATHS = ["/", "/auth", "/auth/verify", "/challenges"];

// A challenge's own landing page is public — the browse page links straight to
// it, and a sign-in wall behind every card would make browsing pointless. Only
// the landing page itself; everything under it stays gated.
const PUBLIC_CHALLENGE_LANDING = /^\/c\/[^/]+\/?$/;

// Captures the slug of any challenge-scoped route, for the cookie below.
const CHALLENGE_SCOPED = /^\/c\/([^/]+)(?:\/|$)/;

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_CHALLENGE_LANDING.test(pathname)) return true;
  // OG/social images and metadata routes must be crawlable without a session.
  return (
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname === "/manifest.webmanifest"
  );
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Unauthenticated → bounce to /auth, preserving intended destination. §9
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated users shouldn't sit on the auth screens. /leaderboard is a
  // redirect stub that resolves whichever challenge they belong to.
  if (user && (pathname === "/auth" || pathname === "/auth/verify")) {
    const url = request.nextUrl.clone();
    url.pathname = "/leaderboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Remember the challenge being viewed so the bare /leaderboard, /submit and
  // /you paths return the user to where they were. Written here rather than in
  // a page because it costs nothing at the edge — no database read, and the
  // value is only ever a hint (see lib/challenge-cookie.ts).
  const scoped = CHALLENGE_SCOPED.exec(pathname);
  if (scoped?.[1]) {
    response.cookies.set({
      name: CHALLENGE_COOKIE,
      value: scoped[1],
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 90,
    });
  }

  // Admin gating is re-verified server-side in the page; this is the fast edge
  // check. Role lookup happens in the page (it needs the DB); here we only
  // ensure a session exists for /admin.
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|apple-icon.png|.*\\.png$).*)",
  ],
};
