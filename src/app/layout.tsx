import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StructuredData } from "@/components/StructuredData";
import { SITE_URL } from "@/lib/constants";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteName = "inthecircle";
const defaultTitle = "inthecircle – #1 Networking App for Creators | Connect & Collaborate";
const defaultDescription =
  "Join inthecircle – the #1 networking app for creators. Connect with founders, YouTubers, streamers & digital professionals. Download free on iOS. Build your circle.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  keywords: [
    "inthecircle",
    "in the circle app",
    "creator networking app",
    "networking app for creators",
    "connect with creators",
    "creator community",
    "founder networking",
    "YouTuber network",
    "streamer community",
    "digital creator app",
    "collaboration app",
    "creator platform",
  ],
  authors: [{ name: siteName, url: "https://inthecircle.co" }],
  creator: siteName,
  publisher: siteName,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "inthecircle – Creator networking app" }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: SITE_URL },
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteName,
  },
  category: "social networking",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const adminBasePath = headersList.get("x-admin-base-path");
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className="antialiased bg-[var(--bg)] text-[var(--text)]">
        <StructuredData />
        <ErrorBoundary>
          <AppShell adminBasePath={adminBasePath}>{children}</AppShell>
        </ErrorBoundary>
      </body>
    </html>
  );
}

