import Link from "next/link";
import { LegalSection } from "./legal-page";

const li = "list-disc space-y-2 pl-5";
const link = "font-semibold text-primary hover:underline";

/** Draft Terms of Use. Must be reviewed by a qualified Nigerian lawyer before launch. */
export function TermsContent() {
  return (
    <>
      <LegalSection title="1. About these terms">
        <p>
          These terms are an agreement between you and myHoodora about using our website and apps. By creating an
          account, you agree to them, to our{" "}
          <Link href="/guidelines" className={link}>
            Community Guidelines
          </Link>{" "}
          and to how we handle data as described in our{" "}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Who can join">
        <ul className={li}>
          <li>You must be at least 18 years old.</li>
          <li>You may only join the neighbourhood where you live, using your real identity.</li>
          <li>You may have one personal account. Organisations, such as residents&apos; associations, need our approval for an official account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Your account">
        <p>
          Keep your login details safe. You&apos;re responsible for what happens on your account. Tell us straight
          away at <a href="mailto:hello@myhoodora.com" className={link}>hello@myhoodora.com</a> if you think someone
          else has accessed it.
        </p>
      </LegalSection>

      <LegalSection title="4. What you post">
        <ul className={li}>
          <li>You own what you post. You&apos;re responsible for it being accurate, lawful and in line with our guidelines.</li>
          <li>
            You give myHoodora a non-exclusive, royalty-free licence to host, display and share your content with the
            audience you chose, so we can run the service. This ends when you delete the content, except where others
            have already shared or replied to it.
          </li>
          <li>We may remove content, or limit or suspend accounts, that break these terms or our guidelines.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Alerts and emergencies">
        <p>
          myHoodora helps neighbours share information, but it is <strong className="text-foreground">not an emergency service</strong>{" "}
          and we can&apos;t guarantee that alerts are accurate, complete or delivered in time. In an emergency, call{" "}
          <strong className="text-foreground">112</strong>.
        </p>
      </LegalSection>

      <LegalSection title="6. Buying, selling and recommendations">
        <p>
          Sales, giveaways and services arranged on myHoodora are between neighbours. myHoodora is not a party to
          them, doesn&apos;t handle payments, and isn&apos;t responsible for the items, services or people involved.
          Use common sense: meet in public and inspect before you pay.
        </p>
      </LegalSection>

      <LegalSection title="7. Things you must not do">
        <ul className={li}>
          <li>Break the law, or our Community Guidelines.</li>
          <li>Scrape, copy or collect other members&apos; information, or use it for marketing.</li>
          <li>Interfere with the service, try to get around security, or access accounts that aren&apos;t yours.</li>
          <li>Create fake accounts or misrepresent where you live.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Leaving or being removed">
        <p>
          You can deactivate your account at any time in Settings → Account. We may suspend or close accounts that
          break these terms, put others at risk, or that we&apos;re legally required to remove. Where we can, we&apos;ll
          tell you why.
        </p>
      </LegalSection>

      <LegalSection title="9. Our responsibility">
        <p>
          We work hard to keep myHoodora running and safe, but it&apos;s provided &ldquo;as is&rdquo;. To the extent
          the law allows, myHoodora isn&apos;t liable for content posted by members, for losses from arrangements
          between members, or for indirect losses. Nothing in these terms limits rights you have under Nigerian
          consumer protection law that can&apos;t be limited.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes and governing law">
        <p>
          We may update these terms. If changes are significant, we&apos;ll tell you before they take effect. These
          terms are governed by the laws of the Federal Republic of Nigeria.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions? Email <a href="mailto:hello@myhoodora.com" className={link}>hello@myhoodora.com</a>.
        </p>
      </LegalSection>
    </>
  );
}
