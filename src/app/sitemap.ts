import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/gioi-thieu", "/tuyen-dung", "/cac-co-so"].map(
    (path, index) => ({
      url: `https://www.polymind.vn${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: index === 0 ? 1 : 0.8,
    }),
  );
}
