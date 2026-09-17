import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/teacher/",
          "/student/",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/accept-invite",
          "/auth/",
          "/api/",
          "/t/",
        ],
      },
    ],
    sitemap: "https://www.polymind.vn/sitemap.xml",
  };
}
