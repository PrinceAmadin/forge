import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/**" }]
      : [],
  },
  // sharp runs in the Node runtime; keep it external to the server bundle.
  serverExternalPackages: ["sharp"],

  async redirects() {
    return [
      {
        // The original single-challenge route, shared widely over WhatsApp.
        //
        // permanent: false (307) on purpose. A 308 is cached by browsers
        // indefinitely, and these are auth-gated app URLs with no SEO value —
        // a permanent redirect would mean never being able to reclaim the path,
        // and would also make reverting this release useless for anyone who had
        // already hit it once.
        source: "/exam-flame",
        destination: "/c/exam-flame",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
