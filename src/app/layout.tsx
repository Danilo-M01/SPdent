import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SP DENT | Premium Stomatološka Ordinacija Beograd",
  description: "Moderna dentalna ordinacija u Beogradu. Spoj funkcionalne stomatologije i premium iskustva pacijenta kroz tehnologiju, estetiku i bezbolan pristup.",
  keywords: ["stomatolog Beograd", "zubar Beograd", "estetska stomatologija", "bezbolno vađenje zuba", "SP DENT"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr" className={`${inter.variable} ${sora.variable}`}>
      <body className="font-sans bg-[var(--background)] text-[var(--foreground)] antialiased selection:bg-accent selection:text-white">
        <SmoothScroll>
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
