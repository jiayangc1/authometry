import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/docs", "/privacy", "/terms", "/data-deletion"],
      disallow: [
        "/api/",
        "/authorize/",
        "/login",
        "/bootstrap",
        "/accept-invite",
        "/select-workspace",
        "/forgot-password",
        "/reset-password",
        "/overview",
        "/applications",
        "/agents",
        "/users",
        "/sessions",
        "/traces",
        "/agent-grants",
        "/scopes",
        "/policies",
        "/events",
        "/deployments",
        "/settings",
        "/developer",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
