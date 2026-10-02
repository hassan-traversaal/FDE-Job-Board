import { Geist, Geist_Mono } from "next/font/google";

// Same faces as the Arya landing page (v11): Geist for everything, Geist Mono for labels and data.
const sans = Geist({ subsets: ["latin"], variable: "--nf-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--nf-mono", display: "swap" });

export const fontVars = `${sans.variable} ${mono.variable}`;
