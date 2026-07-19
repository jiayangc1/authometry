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
  title: { default: "Authometry — OAuth you can see", template: "%s · Authometry" },
  description:
    "Self-hosted OAuth 2.0 and OpenID Connect infrastructure with inspectable authorization decisions.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Authometry",
  },
  openGraph: {
    type: "website",
    siteName: "Authometry",
    title: "Authometry — OAuth you can see",
    description:
      "Self-hosted OAuth 2.0 and OpenID Connect infrastructure with inspectable authorization decisions.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Authometry — OAuth you can see",
    description:
      "Self-hosted OAuth 2.0 and OpenID Connect infrastructure with inspectable authorization decisions.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7ff" },
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
