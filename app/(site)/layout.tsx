import type { Metadata, Viewport } from "next";
import { fontVars } from "../fonts";
import { Footer, Nav } from "./chrome";
import "../brand.css";
import "./site.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fde.traversaal.ai"),
  title: "Forward Deployed Engineering | Traversaal",
  description:
    "Traversaal builds enterprise AI agents and teaches engineers to build them. Work with our forward deployed engineers, or start with our free Level 1 course, Claude Code in Practice.",
  openGraph: {
    title: "We build enterprise AI agents. We teach you how.",
    description: "Learn FDE with Traversaal, starting with a free course, or work with our forward deployed engineers.",
    url: "https://fde.traversaal.ai",
    siteName: "Traversaal",
    type: "website",
    images: ["/site/og.png"],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
