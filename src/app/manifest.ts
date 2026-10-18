import type { MetadataRoute } from "next";

// Installable PWA shell (section 3); offline reading is wired in a later phase.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Money & Me",
    short_name: "Money & Me",
    description: "Free financial education for India.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#0f6e56",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
