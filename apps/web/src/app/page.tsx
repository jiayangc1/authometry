import type { Metadata } from "next";
import { LandingPage } from "./landing-page";

export const metadata: Metadata = {
  title: "OAuth and OpenID Connect infrastructure",
  description:
    "Authometry is transparent OAuth 2.0 and OpenID Connect infrastructure for applications, teams, and AI agents.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Authometry — OAuth you can see",
    description:
      "Authentication, authorization, and policy infrastructure with an explanation for every decision.",
    url: "/",
  },
  twitter: {
    title: "Authometry — OAuth you can see",
    description:
      "Authentication, authorization, and policy infrastructure with an explanation for every decision.",
  },
};

export default function Page() {
  return <LandingPage />;
}
