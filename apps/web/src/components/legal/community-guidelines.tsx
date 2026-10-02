import Link from "next/link";
import { LegalSection } from "./legal-page";

const li = "list-disc space-y-2 pl-5";

export function CommunityGuidelinesContent() {
  return (
    <>
      <LegalSection title="1. Be a good neighbour">
        <p>
          You&apos;re talking to real people who live near you, people you may greet at the gate tomorrow. Be civil,
          even when you disagree.
        </p>
        <ul className={li}>
          <li>No insults, name-calling, bullying or public shaming, in English, Pidgin or any other language.</li>
          <li>Criticise ideas, not people. Assume good intent.</li>
          <li>If a conversation turns heated, take it to private messages or step away.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Everyone is welcome: no discrimination">
        <p>
          Nigeria is home to hundreds of peoples, languages and faiths, and every neighbour belongs here. We do not
          allow content that attacks or excludes people because of their ethnicity or tribe, state of origin,
          religion, gender, disability, age, or any similar characteristic. This includes tribalist jokes and
          &ldquo;those people&rdquo; posts.
        </p>
      </LegalSection>

      <LegalSection title="3. Use your real identity">
        <ul className={li}>
          <li>Use the name people know you by, and only one account per person.</li>
          <li>Confirm the neighbourhood you actually live in. Don&apos;t join neighbourhoods where you don&apos;t live.</li>
          <li>Don&apos;t pretend to be someone else, including estate management, a residents&apos; association or a government agency.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Alerts: facts, not fear">
        <p>Alerts help neighbours stay safe, so they must be accurate and fair.</p>
        <ul className={li}>
          <li>Share what happened, where and when. Stick to what you saw or know.</li>
          <li>
            <strong className="text-foreground">Describe behaviour, not appearance.</strong> &ldquo;Two men checking
            car doors on Road 14 at 2am&rdquo; is helpful; describing someone only by their tribe, religion or how they
            look is not, and will be removed.
          </li>
          <li>Mark an alert as urgent only for danger happening right now, and mark it resolved when it&apos;s over.</li>
          <li>Don&apos;t post photos of people or number plates to shame or accuse them. Report crimes to the police.</li>
          <li>
            <strong className="text-foreground">Never encourage mob action or &ldquo;jungle justice&rdquo;.</strong>{" "}
            Content that calls for violence against anyone will be removed and the account suspended.
          </li>
        </ul>
        <p>
          myHoodora is not an emergency service. If someone is in danger, call <strong className="text-foreground">112</strong> first.
        </p>
      </LegalSection>

      <LegalSection title="5. No scams, fraud or spam">
        <ul className={li}>
          <li>No fake listings, advance-fee requests, &ldquo;send money to receive a gift&rdquo; schemes or investment offers.</li>
          <li>No collecting dues or levies unless you&apos;re authorised to, and never through private accounts you can&apos;t prove.</li>
          <li>Promote your business in the right places (recommendations when asked, and business groups), not repeatedly across the feed.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Buying, selling and giving away">
        <ul className={li}>
          <li>Only list items you own and can hand over. Describe them honestly, with real photos and a real price.</li>
          <li>
            Don&apos;t list weapons, drugs, prescription medicine, alcohol to minors, counterfeit goods, stolen items,
            animals for fighting, or anything illegal in Nigeria.
          </li>
          <li>Meet in public places such as your estate gate, inspect before paying, and never pay a stranger upfront.</li>
          <li>Sales are agreements between neighbours. myHoodora isn&apos;t a party to them.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Respect people's privacy">
        <ul className={li}>
          <li>Never share someone else&apos;s address, phone number, photos or private messages without their permission.</li>
          <li>Don&apos;t post photos of children who aren&apos;t yours.</li>
          <li>Private groups are private. Don&apos;t screenshot and share their posts elsewhere.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Keep it local and relevant">
        <p>
          myHoodora is for what&apos;s happening in your neighbourhood. Local civic issues, such as roads, power, the
          LGA or estate matters, are welcome. National politics and religious debate belong in groups set up for
          them. Religious and political events may be shared with their practical details (time, place, what to
          expect).
        </p>
      </LegalSection>

      <LegalSection title="9. Groups">
        <p>
          Group admins decide what their group is for and may remove posts or members, but they can&apos;t allow
          anything these guidelines forbid, and may not exclude people for discriminatory reasons.
        </p>
      </LegalSection>

      <LegalSection title="Reporting and enforcement">
        <p>
          If you see something that breaks these guidelines, report it using the ••• menu on posts, or
          &ldquo;Report&rdquo; on comments, listings, messages and profiles. Reports are private. You can also block
          anyone you don&apos;t want to hear from.
        </p>
        <p>
          Depending on how serious it is, we may remove content, warn you, limit features such as posting alerts, or
          suspend or permanently remove an account. Serious threats or illegal activity may be referred to the
          authorities.
        </p>
        <p>
          Please report content that breaks the guidelines, not just content you disagree with. Repeatedly misusing
          reports may affect your account. If you think we got a decision wrong, email{" "}
          <a href="mailto:hello@myhoodora.com" className="font-semibold text-primary hover:underline">
            hello@myhoodora.com
          </a>{" "}
          and we&apos;ll take another look.
        </p>
        <p>
          See also our{" "}
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </>
  );
}
