import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Open an account — Meridian Markets",
    template: "%s — Meridian Markets",
  },
  description:
    "A portfolio demonstration of a jurisdiction-aware KYC onboarding flow. Nothing entered is sent anywhere, uploaded or stored on a server.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${interTight.variable} ${jetBrainsMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
