import { LegalSection } from "./legal-page";

export function PrivacyPolicyContent() {
  return (
    <>
      <LegalSection title="1. What Personal Information Is Collected?">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">From you:</strong> your name,
            email address, and phone number when you create an account, and
            your display name, neighborhood, and address when you set up your
            profile.
          </li>
          <li>
            <strong className="text-foreground">From your browser or device:</strong>{" "}
            how you use myHoodora, your device type, and technical logs needed
            to keep the service working.
          </li>
          <li>
            <strong className="text-foreground">From sign-in providers:</strong>{" "}
            when you sign in with Google or Apple, those providers share your
            name and email address with us.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How Is My Personal Information Used?">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Establish and develop neighborhoods:</strong>{" "}
            verify your address and place you in the right neighborhood.
          </li>
          <li>
            <strong className="text-foreground">Set you up on myHoodora:</strong>{" "}
            create your account and profile.
          </li>
          <li>
            <strong className="text-foreground">Provide, develop, and improve our services:</strong>{" "}
            show you relevant updates, deliver real-time neighborhood alerts,
            and improve the platform.
          </li>
          <li>
            <strong className="text-foreground">Create and maintain a trusted environment:</strong>{" "}
            detect abuse, spam, and fake accounts to keep the platform safe.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Your Location & Neighborhood">
        <p>
          We know how much your location matters to you. Your address is used
          for one purpose: to verify that you live where you say you live. We
          then place you in your neighborhood and show only that — never your
          street address, house number, or exact coordinates — to other users.
        </p>
        <p>
          Your address is not posted anywhere, sold, or shared with strangers.
          You control your profile visibility and decide which personal details
          you share with your neighbors.
        </p>
      </LegalSection>

      <LegalSection title="4. How Is My Personal Information Shared with Others?">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">We do not sell your personal information.</strong>{" "}
            Ever.
          </li>
          <li>
            <strong className="text-foreground">Content you share:</strong> what
            you choose to post publicly, such as your posts, comments, and
            display name.
          </li>
          <li>
            <strong className="text-foreground">Service providers:</strong>{" "}
            trusted vendors (hosting, analytics, support) who help us run
            myHoodora, under strict confidentiality obligations.
          </li>
          <li>
            <strong className="text-foreground">Legal and safety reasons:</strong>{" "}
            when required by law, or to protect the safety of our users.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. What Are My Choices?">
        <ul className="list-disc space-y-2 pl-5">
          <li>Update or correct your profile information at any time.</li>
          <li>Manage your notification and communication preferences.</li>
          <li>
            Request deletion of your account and the personal information we
            hold about you.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. How Long Is My Personal Information Kept?">
        <p>
          We keep your information for as long as your account is active, and
          we delete it when you close your account — except where we are
          required to retain it to meet legal or security obligations.
        </p>
      </LegalSection>

      <LegalSection title="7. How Is My Personal Information Protected?">
        <p>
          We use encryption in transit and reasonable technical and
          organizational safeguards to protect your information against
          unauthorized access, loss, or misuse.
        </p>
        <p>
          <strong className="text-foreground">Account security:</strong> keep
          your login details safe — you are responsible for protecting your own
          password. <strong className="text-foreground">Other services and websites:</strong>{" "}
          myHoodora may link to third-party services; their privacy practices
          are their own.
        </p>
      </LegalSection>

      <LegalSection title="8. Personal Information Relating to Children">
        <p>
          myHoodora is not directed at children under 18, and we do not
          knowingly collect personal information from them.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to this Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will post the updated version here with a new &ldquo;Last updated&rdquo; date.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          If you have questions about this Privacy Policy or how we handle your
          information, contact us at{" "}
          <a
            href="mailto:support@myhoodora.com"
            className="font-semibold text-primary hover:underline"
          >
            support@myhoodora.com
          </a>
          .
        </p>
      </LegalSection>
    </>
  );
}
