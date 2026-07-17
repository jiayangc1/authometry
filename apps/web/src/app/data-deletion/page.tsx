import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: "How to request deletion of information associated with an Authometry identity.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data deletion"
      description="You can ask us to remove an Authometry identity and the personal information associated with it."
    >
      <section>
        <h2>Request deletion</h2>
        <p>
          Email <a href="mailto:auth@cams.ch3n.cc">auth@cams.ch3n.cc</a> from the address associated
          with your Authometry identity. Use the subject “Authometry data deletion request” and
          identify the workspace or application where you signed in. Do not send a password,
          provider access token, OAuth code, or other secret.
        </p>
      </section>

      <section>
        <h2>Verification and processing</h2>
        <p>
          We will verify that you control the affected identity before deleting information. We may
          ask for limited additional details if the email address is not sufficient to locate the
          correct workspace identity. We will acknowledge the request and explain the result or any
          lawful exception.
        </p>
      </section>

      <section>
        <h2>What deletion covers</h2>
        <p>
          A completed request removes or de-identifies the social identity link and directly
          associated profile information where Authometry controls the data. A workspace
          administrator may need to handle records controlled by that workspace. Limited audit,
          security, fraud-prevention, legal, and backup records may remain for the period reasonably
          required for those purposes.
        </p>
      </section>

      <section>
        <h2>Revoke provider access</h2>
        <p>
          You can also revoke Authometry from your Google Account or GitHub application settings.
          Revocation prevents future provider sign-ins. It does not by itself delete information
          already stored in Authometry, so submit the request above if you also want deletion.
        </p>
      </section>
    </LegalPage>
  );
}
