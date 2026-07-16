import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Authometry",
    short_name: "Authometry",
    description: "Transparent OAuth 2.0 and OpenID Connect infrastructure.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#635bff",
    icons: [
      {
        src: "/brand/authometry-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/authometry-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/authometry-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
