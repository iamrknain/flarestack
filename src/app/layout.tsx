import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FlareStack | Edge Security & Automated Cloudflare WAF Blocklists",
    template: "%s | FlareStack"
  },
  description: "Stop volumetric DDoS, scrapers, and bad bots directly at the Cloudflare edge. Automated IP reputation lists, real-time telemetry, and zero-origin-latency security rules.",
  applicationName: "FlareStack",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "FlareStack | Edge Security & Automated Cloudflare WAF Blocklists",
    description: "Stop volumetric DDoS, scrapers, and bad bots directly at the Cloudflare edge. Automated IP reputation lists, real-time telemetry, and zero-origin-latency security rules.",
    url: "/",
    siteName: "FlareStack",
    images: [
      {
        url: "/assets/og-image.png",
        width: 1200,
        height: 630,
        alt: "FlareStack - Edge Security & Automated Cloudflare WAF Blocklists",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlareStack | Edge Security & Automated Cloudflare WAF Blocklists",
    description: "Stop volumetric DDoS, scrapers, and bad bots directly at the Cloudflare edge. Automated IP reputation lists, real-time telemetry, and zero-origin-latency security rules.",
    images: ["/assets/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/assets/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/assets/apple-touch-icon.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
