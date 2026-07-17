import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Authometry collects, uses, protects, and deletes personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains what information Authometry handles when you use the hosted service, sign in with Google or GitHub, or authorize an application."
    >
      <section>
        <h2>Who operates Authometry</h2>
        <p>
          Authometry is an open-source OAuth 2.0 and OpenID Connect service operated through the
          Authometry project. Questions about this policy or personal information can be sent to{" "}
          <a href="mailto:auth@cams.ch3n.cc">auth@cams.ch3n.cc</a>. The source code and issue
          tracker are available on <a href="https://github.com/jiayangc1/authometry">GitHub</a>.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul className="space-y-2">
          <li>
            Account and identity information, such as your name, email address, account identifier,
            workspace membership, role, and verification status.
          </li>
          <li>
            Google sign-in information limited to the OpenID, email, and profile scopes. This can
            include your Google account identifier, name, email address, and email-verification
            status.
          </li>
          <li>
            GitHub sign-in information limited to your basic profile and email scopes. This can
            include your GitHub account identifier, display name, username, and a verified email
            address.
          </li>
          <li>
            OAuth activity, including the requesting application, requested permissions, consent
            decisions, sessions, authorization outcomes, and security traces. Secret-bearing fields
            are redacted before trace storage.
          </li>
          <li>
            Service and security data, such as IP address, browser user agent, timestamps, request
            identifiers, audit events, and error details.
          </li>
          <li>
            Configuration and content that workspace administrators submit, including application,
            policy, scope, webhook, and environment settings.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>We use this information only to:</p>
        <ul className="mt-3 space-y-2">
          <li>authenticate users and link the correct identity to a workspace;</li>
          <li>process OAuth and OpenID Connect requests and record consent;</li>
          <li>operate, secure, troubleshoot, and improve the service;</li>
          <li>prevent abuse, investigate incidents, and comply with legal obligations; and</li>
          <li>communicate service, account, recovery, and security information.</li>
        </ul>
        <p>
          Authometry does not sell personal information and does not use Google or GitHub user data
          for advertising. Provider access tokens are used to retrieve the identity information
          described above during sign-in and are not stored by Authometry.
        </p>
      </section>

      <section>
        <h2>Sharing and service providers</h2>
        <p>
          Information may be processed by infrastructure, database, email-delivery, security, and
          hosting providers that help operate Authometry. We may also disclose information when
          required by law, to protect users or the service, or during a business transfer. A
          workspace&apos;s administrators can access identity, authorization, and audit information
          belonging to that workspace.
        </p>
        <p>
          When you authorize a third-party OAuth application, Authometry shares only the information
          covered by the permissions displayed on the consent screen and that you approve. That
          application&apos;s own privacy policy governs its later use of the information.
        </p>
      </section>

      <section>
        <h2>Retention and security</h2>
        <p>
          We keep information for as long as needed to provide and secure the service, meet legal
          obligations, resolve disputes, and enforce agreements. Workspace-configured retention
          settings control authorization traces and audit events. Residual copies may remain for a
          limited period in encrypted backups and security records.
        </p>
        <p>
          Authometry uses encryption in transit, restricted administrative access, signed sessions,
          CSRF protection, rate limits, exact redirect validation, PKCE, secret redaction, and other
          safeguards. No online service can guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>Your choices and deletion</h2>
        <p>
          You can revoke Authometry&apos;s Google or GitHub access from your provider account
          settings. Revoking access prevents future provider sign-ins but does not automatically
          delete the Authometry identity previously created.
        </p>
        <p>
          You may request access, correction, export, or deletion of your personal information. See
          the <Link href="/data-deletion">data deletion instructions</Link>. Some records may be
          retained where required for security, fraud prevention, legal compliance, or the rights of
          others.
        </p>
      </section>

      <section>
        <h2>International use and children</h2>
        <p>
          Authometry may process information in countries other than your own. The service is not
          directed to children under 13, and we do not knowingly collect their personal information.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this policy as the service or legal requirements change. The effective date
          above identifies the current version. Material changes will be communicated through the
          service or repository when appropriate.
        </p>
      </section>
    </LegalPage>
  );
}
