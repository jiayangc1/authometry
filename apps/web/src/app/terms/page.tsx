import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms that apply to use of the hosted Authometry service.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These terms apply to the hosted Authometry service. The separately distributed source code remains governed by its open-source license."
    >
      <section>
        <h2>Acceptance and eligibility</h2>
        <p>
          By accessing or using Authometry, you agree to these terms. You must be legally able to
          enter into this agreement and must not use the service if applicable law prohibits it. If
          you use Authometry for an organization, you represent that you may accept these terms for
          that organization.
        </p>
      </section>

      <section>
        <h2>The service</h2>
        <p>
          Authometry provides OAuth 2.0 and OpenID Connect infrastructure, administrative tools,
          identity sign-in, authorization policies, and diagnostic traces. Features may change, be
          suspended, or be discontinued. We may set reasonable technical or usage limits to protect
          the service and its users.
        </p>
      </section>

      <section>
        <h2>Your accounts and responsibilities</h2>
        <ul className="space-y-2">
          <li>Provide accurate account information and keep credentials secure.</li>
          <li>Configure redirect URLs, applications, scopes, policies, and integrations safely.</li>
          <li>Obtain any notices and consents required for people whose data you process.</li>
          <li>Promptly report suspected compromise or unauthorized use.</li>
          <li>Remain responsible for activity performed through your account and workspace.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You may not use Authometry to:</p>
        <ul className="mt-3 space-y-2">
          <li>break the law, infringe rights, deceive users, or facilitate abuse;</li>
          <li>access accounts, systems, or information without authorization;</li>
          <li>distribute malware, phishing, spam, or harmful content;</li>
          <li>interfere with, overload, probe, or bypass service security; or</li>
          <li>
            misrepresent an application&apos;s identity, purpose, permissions, or data practices.
          </li>
        </ul>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          Google, GitHub, OAuth client applications, hosting providers, and other integrations are
          third-party services with their own terms and privacy practices. Authometry is not
          responsible for third-party services, and availability of an integration does not imply
          endorsement.
        </p>
      </section>

      <section>
        <h2>Open-source software and content</h2>
        <p>
          These hosted-service terms do not replace the license included with the Authometry source
          code. You retain ownership of content and configuration you submit and grant the project
          operator the limited rights needed to host, process, secure, and transmit that material to
          provide the service.
        </p>
      </section>

      <section>
        <h2>Suspension and termination</h2>
        <p>
          You may stop using the service at any time. We may restrict or terminate access when
          reasonably necessary to address a security risk, unlawful conduct, material breach, harm
          to others, or service discontinuation. Data requests remain subject to the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>Disclaimers and liability</h2>
        <p>
          To the maximum extent permitted by law, the service is provided “as is” and “as
          available,” without warranties of uninterrupted operation, fitness for a particular
          purpose, or non-infringement. To the maximum extent permitted by law, the project operator
          will not be liable for indirect, incidental, special, consequential, or punitive damages,
          or for lost data, revenue, profits, or goodwill arising from use of the service.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms as the service changes. Continued use after an update means you
          accept the revised terms. Questions can be sent to{" "}
          <a href="mailto:auth@cams.ch3n.cc">auth@cams.ch3n.cc</a>.
        </p>
      </section>
    </LegalPage>
  );
}
