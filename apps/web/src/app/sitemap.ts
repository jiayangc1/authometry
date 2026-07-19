import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";
  const publicRoutes = ["", "/docs", "/privacy", "/terms", "/data-deletion"];

  return publicRoutes.map((route, index) => ({
    url: `${origin}${route}`,
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : route === "/docs" ? 0.8 : 0.4,
  }));
}
