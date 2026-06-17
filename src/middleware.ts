import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/", "/auth", "/auth/verify"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
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

  // Authenticated users shouldn't sit on the auth screens.
  if (user && (pathname === "/auth" || pathname === "/auth/verify")) {
    const url = request.nextUrl.clone();
    url.pathname = "/leaderboard";
    url.search = "";
    return NextResponse.redirect(url);
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
