import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Trellis — the Uncommon Schools AI platform sketch",
  description:
    "An IaC-configured AI platform for mission-driven education orgs. Skill catalog, policy engine, DLP scanner, audit trail — every manifest a git diff away from the UI.",
  openGraph: {
    title: "Trellis",
    description:
      "AI platform for mission-driven education. IaC-first, DLP-aware, audited by design.",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://rsms.me/"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
