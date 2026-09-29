import type { Metadata } from "next";
import { PlatformPage } from "@/components/landing/platform-page";

const description =
  "Protocol flow, standards coverage, configuration as code, agent delegation, events, and security controls in Authometry.";

export const metadata: Metadata = {
  title: "Platform reference",
  description,
  alternates: { canonical: "/platform" },
  openGraph: { title: "Authometry platform reference", description, url: "/platform" },
};

export default function Page() {
  return <PlatformPage />;
}
