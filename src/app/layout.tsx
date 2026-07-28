import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { DemoBanner } from "@/components/DemoBanner";
import {
  absoluteUrl,
  AUTHOR_NAME,
  LANDING_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  TITLE_TEMPLATE,
} from "@/config/seo";
import "./globals.css";

/**
 * Two faces, one job each.
 *
 * Inter Tight carries all the prose and every control. Its narrower widths
 * hold a long field label on one line where Inter would wrap, and it has the
 * weight range to build a hierarchy without a second display face.
 *
 * JetBrains Mono is reserved for values a machine produced or will parse —
 * application references, file sizes, masked identifiers, validation codes.
 * The split is a rule, not a texture: if a human wrote it, it is not mono.
 *
 * Both are loaded through `next/font`, which self-hosts them at build time.
 * That is a demo-safety requirement rather than a performance nicety: this
 * page promises it makes no third-party requests, and a stylesheet fetched
 * from fonts.googleapis.com on every visit would make that promise false.
 */
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

/*
 * This site was `robots: { index: false, follow: false }` until 2026-07-28, and
 * the comment that sat here made a real argument for it: a convincing
 * account-opening form for a brokerage that does not exist, asking for a date of
 * birth, a taxpayer number and a photograph of a passport, should not turn up in
 * front of someone who was looking for the real thing.
 *
 * That is reversed, deliberately, and the argument is answered rather than
 * dropped — in `@/config/seo`, which is where the three measures that answer it
 * live: titles that name the author instead of the fictional broker,
 * descriptions that lead with the disclaimer, and structured data that types the
 * page as source code written by a person. Read that file before changing any of
 * this; the reasoning is one paragraph and it is the whole reason indexing this
 * is defensible.
 *
 * `metadataBase` is set here, and only here: it is what lets every child segment
 * hand Next a relative URL and get an absolute one in the rendered `<head>`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: LANDING_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  authors: [{ name: AUTHOR_NAME }],
  creator: AUTHOR_NAME,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: LANDING_TITLE,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // The OG card is the only image worth previewing, and it carries the
      // "Portfolio demonstration" label — so a large preview works in favour of
      // the disambiguation rather than against it.
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${interTight.variable} ${jetBrainsMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/*
         * First child of <body> and above every route, so no screen can render
         * without it — including the success state, which is the screen most
         * likely to be shared as a screenshot.
         */}
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
