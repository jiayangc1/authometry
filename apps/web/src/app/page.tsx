import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

const description =
  "Open-source OAuth 2.0 and OpenID Connect infrastructure. See every authorization request, policy decision, scope, token, and denial — and why it happened.";

export const metadata: Metadata = {
  title: { absolute: "Authometry — Authentication, measured." },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Authometry — Authentication, measured.",
    description,
    url: "/",
  },
  twitter: {
    title: "Authometry — Authentication, measured.",
    description,
  },
};

export default function Page() {
  return <LandingPage />;
}
