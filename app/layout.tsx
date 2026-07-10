import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FDE Field Guide | Forward Deployed Engineer Jobs",
  description: "A curated board of vetted Forward Deployed Engineer (FDE) roles. Browse remote-friendly openings across the US, Europe, and India, with salary, location, and role details.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
