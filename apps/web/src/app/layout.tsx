import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { AppProviders } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Authometry", template: "%s · Authometry" },
  description: "Transparent OAuth 2.0 and OpenID Connect infrastructure.",
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
