import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/teams", "/work-with-us", "/jobs"].map((path) => ({
    url: new URL(path, "https://fde.traversaal.ai").href,
  }));
}
