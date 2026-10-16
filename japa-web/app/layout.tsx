import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SITE, SITE_URL } from "./launch/site";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import "./lagos-2d.css";
import "./canada-2d.css";
import "./cinematic.css";
import "./avatar.css";
import "./maps.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The Kovacs boardroom uses a serif for names and verdicts.
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE.name,
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["japa", "Nigeria", "Canada", "immigration game", "Express Entry", "study permit", "IELTS", "Naija"],
  openGraph: { type: "website", url: "/", siteName: SITE.name, title: SITE.title, description: SITE.description, locale: "en_NG" },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
  appleWebApp: { capable: true, title: SITE.short, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#09090b", width: "device-width", initialScale: 1, viewportFit: "cover" };

const PLAUSIBLE = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        {children}
        {PLAUSIBLE ? (
          <>
            <Script id="plausible-queue" strategy="afterInteractive">
              {"window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}"}
            </Script>
            <Script defer data-domain={PLAUSIBLE} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
          </>
        ) : null}
      </body>
    </html>
  );
}
