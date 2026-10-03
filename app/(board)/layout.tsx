import type { Metadata, Viewport } from "next";
import { Footer, Nav } from "../(site)/chrome";
import { fontVars } from "../fonts";
import "../brand.css";
import "../palettes.css";
import PaletteSwitcher from "../PaletteSwitcher";
import "./board.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fde.traversaal.ai"),
  title: "FDE Job Board | Forward Deployed Engineer Jobs | Traversaal",
  alternates: { canonical: "/jobs" },
  description: "A curated board of vetted Forward Deployed Engineer (FDE) roles. Browse remote-friendly openings across the US, Europe, and India, with salary, location, and role details.",
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Nav />
        {children}
        <Footer />
        <PaletteSwitcher />
      </body>
    </html>
  );
}
