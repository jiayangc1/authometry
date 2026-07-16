import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { AppProviders } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN ?? "http://localhost:3000"),
  applicationName: "Authometry",
  title: { default: "Authometry", template: "%s · Authometry" },
  description: "Transparent OAuth 2.0 and OpenID Connect infrastructure.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Authometry",
  },
  openGraph: {
    type: "website",
    siteName: "Authometry",
    title: "Authometry",
    description: "Transparent OAuth 2.0 and OpenID Connect infrastructure.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Authometry",
    description: "Transparent OAuth 2.0 and OpenID Connect infrastructure.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <AppProviders>
          <Suspense fallback={null}>{children}</Suspense>
        </AppProviders>
        <Toaster closeButton position="bottom-right" richColors={false} />
      </body>
    </html>
  );
}
