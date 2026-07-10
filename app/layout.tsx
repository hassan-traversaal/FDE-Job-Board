import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FDE Field Guide — Remote Forward Deployed Engineer Roles",
  description: "A nuanced, remote-first field guide to current Forward Deployed Engineer opportunities across the US, Europe, and India.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
