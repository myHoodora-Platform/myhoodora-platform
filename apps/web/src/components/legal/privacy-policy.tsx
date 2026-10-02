import { LegalSection } from "./legal-page";

const li = "list-disc space-y-2 pl-5";
const strong = "text-foreground";

/**
 * Written to match what the product actually does (see docs/api-contract.md
 * and the services listed below) and the Nigeria Data Protection Act 2023.
 * Must be reviewed by a qualified lawyer before launch.
 */
export function PrivacyPolicyContent() {
  return (
    <>
      <LegalSection title="1. Who we are">
        <p>
          myHoodora (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs the myHoodora neighbourhood network. We are the data
          controller for the personal data described here. We process personal data in line with the Nigeria Data
          Protection Act 2023 (NDPA). You can reach us about anything in this policy at{" "}
          <a href="mailto:hello@myhoodora.com" className="font-semibold text-primary hover:underline">
            hello@myhoodora.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <ul className={li}>
          <li>
            <strong className={strong}>Account details:</strong> your name, email address and how you sign in (email
            and password, or Google or Apple, who share your name and email with us).
          </li>
          <li>
            <strong className={strong}>Where you live:</strong> the address you enter and your device&apos;s location
            when you confirm your neighbourhood, and the neighbourhood we place you in.
          </li>
          <li>
            <strong className={strong}>Profile:</strong> anything you add, such as a photo or short bio.
          </li>
          <li>
            <strong className={strong}>What you share:</strong> posts, comments, reactions, poll votes, event RSVPs,
            listings, group activity, messages and reports.
          </li>
          <li>
            <strong className={strong}>Settings:</strong> your notification and privacy choices, and people you block.
          </li>
          <li>
            <strong className={strong}>Technical data:</strong> your IP address, device and browser type, and logs
            needed to keep the service secure and working. We may use your IP address to estimate your general area
            so we can suggest your neighbourhood during sign-up.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use it, and why we're allowed to">
        <ul className={li}>
          <li>
            <strong className={strong}>To provide myHoodora</strong> (performance of our contract with you): create
            your account, place you in your neighbourhood, show your feed, deliver messages and notifications.
          </li>
          <li>
            <strong className={strong}>To keep neighbourhoods safe and genuine</strong> (legitimate interests):
            verify that members live where they say, prevent fake accounts, spam and fraud, review reports and
            enforce our community guidelines.
          </li>
          <li>
            <strong className={strong}>To improve the service</strong> (legitimate interests): understand how
            features are used and fix problems.
          </li>
          <li>
            <strong className={strong}>With your consent:</strong> precise location from your device, optional
            notifications, and anything else we ask your permission for. You can withdraw consent at any time.
          </li>
          <li>
            <strong className={strong}>To meet legal obligations:</strong> for example, responding to lawful
            requests from Nigerian authorities.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. What your neighbours can see">
        <p>
          Neighbours see your name, photo (if you add one), neighbourhood, and what you post or share with them.
          <strong className={strong}> We never show your address, street, house number or exact location to anyone.</strong>{" "}
          You can choose who can see your full profile and who can message you in Settings → Privacy &amp; blocking.
          Private group posts are visible only to that group&apos;s members, and messages only to the people in the
          conversation.
        </p>
      </LegalSection>

      <LegalSection title="5. Who we share it with">
        <p>
          <strong className={strong}>We do not sell your personal data.</strong> We share it only with:
        </p>
        <ul className={li}>
          <li>
            <strong className={strong}>Service providers who run myHoodora for us</strong>, under contracts that
            require them to protect it:
            <ul className="mt-2 list-[circle] space-y-1 pl-5">
              <li>Google Firebase: sign-in and file storage (for example, photos you upload)</li>
              <li>MongoDB Atlas: our database hosting</li>
              <li>Map and address services (OpenFreeMap map tiles, maps.co address lookup, ip-api.com general location) to show maps and find your neighbourhood</li>
            </ul>
          </li>
          <li>
            <strong className={strong}>Authorities</strong>, when the law requires it or to protect someone from
            serious harm.
          </li>
          <li>
            <strong className={strong}>A new owner</strong>, if myHoodora is merged or sold. We&apos;ll tell you
            first, and this policy will continue to protect your data.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Data stored outside Nigeria">
        <p>
          Some of our service providers store or process data on servers outside Nigeria. When that happens, we rely
          on the safeguards the NDPA allows, such as contractual protections, to make sure your data gets the same
          level of protection as it would in Nigeria.
        </p>
      </LegalSection>

      <LegalSection title="7. How long we keep it">
        <ul className={li}>
          <li>We keep your data while your account is active.</li>
          <li>
            If you deactivate your account, your profile and posts are hidden straight away. You can restore them by
            logging back in within 30 days. After that, we delete or anonymise your personal data.
          </li>
          <li>
            We may keep some records for longer where the law requires it, or to resolve disputes, prevent fraud and
            enforce our terms, and only for as long as needed.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>Under the NDPA you have the right to:</p>
        <ul className={li}>
          <li>access the personal data we hold about you and get a copy of it;</li>
          <li>correct data that is wrong or incomplete (you can edit most of it yourself in Settings);</li>
          <li>ask us to delete your data;</li>
          <li>object to, or ask us to restrict, how we use it;</li>
          <li>receive your data in a portable format;</li>
          <li>withdraw consent you have given, at any time;</li>
          <li>
            complain to the <strong className={strong}>Nigeria Data Protection Commission (NDPC)</strong> if you
            think we have mishandled your data.
          </li>
        </ul>
        <p>
          To use any of these rights, email{" "}
          <a href="mailto:hello@myhoodora.com" className="font-semibold text-primary hover:underline">
            hello@myhoodora.com
          </a>
          . We&apos;ll respond within the time the law requires.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies and similar technology">
        <p>
          We use a small number of essential cookies and browser storage to keep you signed in, remember your
          settings, and keep the pages you&apos;ve already loaded available when your connection drops. We don&apos;t
          use advertising cookies. Cached posts are cleared from your device when you log out.
        </p>
      </LegalSection>

      <LegalSection title="10. Keeping your data secure">
        <p>
          Data is encrypted in transit, and access is limited to people and services that need it. No system is
          perfectly secure, so please use a strong password and keep your login details to yourself. If a data breach
          is likely to put your rights at risk, we&apos;ll notify you and the NDPC as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="11. Children">
        <p>
          myHoodora is for people aged 18 and over. We don&apos;t knowingly collect data from children. If you
          believe a child has joined, tell us and we&apos;ll remove the account.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to this policy">
        <p>
          We&apos;ll update this policy as myHoodora grows. If we make important changes, we&apos;ll tell you in the
          app or by email before they take effect. The date at the top shows when it last changed.
        </p>
      </LegalSection>
    </>
  );
}
