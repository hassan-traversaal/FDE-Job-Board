import type { NextConfig } from "next";

// The free Level 1 course (course/, a FastAPI app on Fly) is served on this domain.
// This site owns "/" and the marketing pages; the course's own pages, assets and API
// come from its app, so its sign-in, library and session player sit under
// fde.traversaal.ai and its "Back" and logo links land on this home page.
// Override with COURSE_ORIGIN (no trailing slash).
const course =
  process.env.COURSE_ORIGIN ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8300" : "https://fde-traversaal-academy.fly.dev");

// Everything the course's pages request (see course/app.py). /api/lead stays this site's.
const coursePaths = [
  "/signin",
  "/library",
  "/session/:n",
  "/assets/:path*",
  "/auth/config",
  "/media/:sid",
  "/api/course",
  "/api/featured",
  "/api/reviews",
  "/api/sessions",
  "/api/sessions/:path*",
  "/api/ask_stream",
  "/api/frame/:path*",
  "/api/progress",
];

const nextConfig: NextConfig = {
  images: {
    // Reviewer profile photos, served from the hosts Maven uses for them.
    remotePatterns: [
      { protocol: "https", hostname: "d2426xcxuh3ht5.cloudfront.net" },
      { protocol: "https", hostname: "pbs.twimg.com", pathname: "/profile_images/**" },
    ],
  },
  async rewrites() {
    return coursePaths.map((source) => ({ source, destination: `${course}${source}` }));
  },
};

export default nextConfig;
