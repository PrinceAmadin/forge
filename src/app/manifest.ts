import type { MetadataRoute } from "next";

// §15 PWA. theme + background near-black; standalone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Forge",
    short_name: "Forge",
    description: "Where readers go to war.",
    start_url: "/leaderboard",
    display: "standalone",
    background_color: "#0A0A0B",
    theme_color: "#0A0A0B",
    icons: [
      { src: "/icons/32.png", sizes: "32x32", type: "image/png", purpose: "any" },
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
