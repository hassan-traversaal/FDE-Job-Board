import type { MetadataRoute } from "next";

// Palette preview branch: keep this deployment out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
