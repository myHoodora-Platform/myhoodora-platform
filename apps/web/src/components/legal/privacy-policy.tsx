import Link from "next/link";
import { DPO_EMAIL, DPO_NAME, PRIVACY_EMAIL } from "@/lib/site";
import { LegalSection } from "./legal-page";

const li = "list-disc space-y-2 pl-5";
const strong = "text-foreground";
const link = "font-semibold text-primary hover:underline";

const PRIVACY = (
  <a href={`mailto:${PRIVACY_EMAIL}`} className={link}>
    {PRIVACY_EMAIL}
  </a>
);
const DPO = (
  <a href={`mailto:${DPO_EMAIL}`} className={link}>
    {DPO_EMAIL}
  </a>
);

/** The headings, in order, so the contents list and the anchors can't drift apart. */
const SECTIONS = [
  { id: "who-we-are", title: "1. Who we are" },
  { id: "what-we-collect", title: "2. What we collect" },
  { id: "permissions", title: "3. Permissions on your phone" },
  { id: "how-we-use-it", title: "4. How we use it, and why we're allowed to" },
  { id: "what-neighbours-see", title: "5. What your neighbours can see" },
  { id: "sharing", title: "6. Who we share it with" },
  { id: "transfers", title: "7. Data stored outside Nigeria" },
  { id: "retention", title: "8. How long we keep it" },
  { id: "your-rights", title: "9. Your rights" },
  { id: "cookies", title: "10. Cookies and similar technology" },
  { id: "security", title: "11. Keeping your data secure" },
  { id: "children", title: "12. Children" },
  { id: "changes", title: "13. Changes to this policy" },
  { id: "contact", title: "14. Contact us" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];
const title = (id: SectionId) => SECTIONS.find((s) => s.id === id)!.title;

/**
 * Written to match what the product actually does (see docs/api-contract.md, the services listed
 * below and docs/compliance/ndpa.md) and covers what NDPA s.27 says a notice must: who we are and how
 * to reach us, purposes and lawful bases, recipients, transfers, retention, rights, the right to
 * complain to the NDPC and automated decisions. Must be reviewed by a qualified lawyer before launch.
 */
export function PrivacyPolicyContent() {
  return (
    <>
      <div className="rounded-2xl border border-border bg-canvas p-5 sm:p-6">
        <h2 className="text-base font-bold text-foreground">The short version</h2>
        <ul className={`${li} mt-3 text-[15px] leading-relaxed text-muted-foreground`}>
          <li>We use your address only to place you in your neighbourhood. We never show it to anyone.</li>
          <li>We never sell your data, and we don&apos;t build an advertising profile of you.</li>
          <li>myHoodora is for adults. We check your age once and don&apos;t keep your date of birth.</li>
          <li>You can see, correct and delete your data. Deleting your account really deletes it.</li>
          <li>No tracking cookies, analytics or ad trackers on the website.</li>
          <li>The app counts how it&apos;s used only if you say yes, and never sees your name or what you write.</li>
        </ul>
      </div>

      <nav aria-label="On this page">
        <h2 className="text-base font-bold text-foreground">On this page</h2>
        <ol className="mt-3 gap-x-6 text-[15px] sm:columns-2">
          {SECTIONS.map((s) => (
            <li key={s.id} className="mb-1.5 break-inside-avoid">
              <a href={`#${s.id}`} className="text-muted-foreground hover:text-primary hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <LegalSection title={title("who-we-are")} id="who-we-are">
        <p>
          myHoodora (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs the myHoodora neighbourhood network: the website and the
          iPhone and Android apps. We are the data controller for the personal data described here, and we process it
          in line with the Nigeria Data Protection Act 2023 (NDPA). This policy covers the website and the apps alike.
        </p>
        <p>
          Questions about this policy and requests to use your rights go to {PRIVACY}. You can reach our Data
          Protection Officer, {DPO_NAME}, directly at {DPO}. More ways to reach us are in{" "}
          <a href="#contact" className={link}>
            section 14
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title={title("what-we-collect")} id="what-we-collect">
        <p>
          <strong className={strong}>What you give us</strong>
        </p>
        <ul className={li}>
          <li>
            <strong className={strong}>Account details:</strong> your name, email address and how you sign in (email
            and password, or Google or Apple, who share your name and email with us).
          </li>
          <li>
            <strong className={strong}>Your age check:</strong> when you join we ask your date of birth, only to
            check you&apos;re 18 or over. We don&apos;t store the date: we keep only that you passed, and when.
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
            listings, photos, videos and PDF files, group activity, messages and reports.
          </li>
          <li>
            <strong className={strong}>Your answers to our questions:</strong> ratings, polls and feedback you choose
            to give when we ask how myHoodora is working for you.
          </li>
          <li>
            <strong className={strong}>Business pages:</strong> if you apply to list a business, its name, category,
            description, the areas it serves and its address, plus the contact person&apos;s name, phone number and
            email, and its CAC number if you give one.
          </li>
          <li>
            <strong className={strong}>Support:</strong> what you write to us, and your email address.
          </li>
          <li>
            <strong className={strong}>Settings:</strong> your notification and privacy choices, and people you block.
          </li>
        </ul>
        <p>
          <strong className={strong}>What we collect automatically</strong>
        </p>
        <ul className={li}>
          <li>
            <strong className={strong}>Technical data:</strong> your IP address, device and browser type, app version
            and logs needed to keep the service secure and working. We may use your IP address to estimate your general
            area so we can suggest your neighbourhood during sign-up.
          </li>
          <li>
            <strong className={strong}>Ad views and clicks:</strong> which local ads you&apos;ve seen, tapped or hidden,
            so each ad is counted fairly and ads you&apos;ve hidden stay hidden.
          </li>
          <li>
            <strong className={strong}>Push notification token:</strong> if you allow notifications, an ID for your
            phone that lets us deliver them.
          </li>
          <li>
            <strong className={strong}>Crash reports</strong> from the app, which carry your account ID only (see
            section 4).
          </li>
          <li>
            <strong className={strong}>App usage analytics, only if you say yes:</strong> which screens of the app you
            open (by type, such as &ldquo;a post&rdquo;, never which one), which features you use and for how long, your
            app version, phone model, operating system, language, your country (worked out from your IP address, which
            Google doesn&apos;t keep), and an ID made up for this install of the app. Never your name, email, account
            ID, address, exact location, messages or anything you post. The app asks you once, and
            you can change your answer in Settings → Privacy.
          </li>
        </ul>
        <p>
          <strong className={strong}>What we get from others</strong>
        </p>
        <ul className={li}>
          <li>Google or Apple, if you sign in with them: your name, email address and an account ID.</li>
          <li>
            Other members, when they mention you, add you to a group, message you or report something you posted.
          </li>
        </ul>
        <p>
          We don&apos;t collect your phone number (unless you list a business), your ID documents, your contacts, or
          anything from your microphone.
        </p>
      </LegalSection>

      <LegalSection title={title("permissions")} id="permissions">
        <p>The app asks before it uses any of these, and works without them:</p>
        <ul className={li}>
          <li>
            <strong className={strong}>Location:</strong> only while you&apos;re using the app, once, to find the
            neighbourhood you live in. You can type your address instead. We never track your location in the
            background.
          </li>
          <li>
            <strong className={strong}>Camera and photos:</strong> only when you choose to take or add a photo for a
            post, listing or your profile. The app sees only the photos you pick. The same goes for files: the app
            sees only a PDF you choose to attach.
          </li>
          <li>
            <strong className={strong}>Notifications:</strong> to tell you about messages, replies and alerts in your
            neighbourhood. You choose which ones in Settings → Notifications.
          </li>
          <li>
            <strong className={strong}>Calendar:</strong> &ldquo;Add to calendar&rdquo; opens your phone&apos;s own new
            event screen for you to save. The app doesn&apos;t read your calendar.
          </li>
        </ul>
        <p>
          The app doesn&apos;t ask for your contacts or microphone, and doesn&apos;t track you across other apps and
          websites. You can turn any permission off at any time in your phone&apos;s settings. On the website, your
          browser asks before sharing your location.
        </p>
      </LegalSection>

      <LegalSection title={title("how-we-use-it")} id="how-we-use-it">
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
            <strong className={strong}>To show local ads</strong> (legitimate interests): ads and promoted listings
            are chosen by the neighbourhood and city you&apos;re looking at, not by a profile of you. We count views and
            clicks so each ad is counted fairly. Advertisers never get your name or details.
          </li>
          <li>
            <strong className={strong}>To improve the service</strong> (legitimate interests): understand how
            features are used, ask for your feedback and fix problems. The mobile app sends crash reports that carry
            your account ID only, never your name, email, messages or screenshots.
          </li>
          <li>
            <strong className={strong}>To see how the app is used</strong> (your consent): if you say yes to
            &ldquo;Help improve myHoodora&rdquo;, the app counts which screens and features are used, so we know what
            to fix and build next. It&apos;s off until you choose, and saying no changes nothing else about the app.
            We don&apos;t use it for advertising or to build a profile of you.
          </li>
          <li>
            <strong className={strong}>To send service emails</strong> (performance of our contract): confirming
            your email, account and safety notices, and the notification emails you switch on in Settings →
            Notifications. We don&apos;t send marketing email. If we ever do, we&apos;ll ask first, separately from
            these terms, and every such email will have a one-click unsubscribe.
          </li>
          <li>
            <strong className={strong}>With your consent:</strong> precise location from your device, push
            notifications, app usage analytics, and anything else we ask your permission for. You can withdraw consent at any time.
          </li>
          <li>
            <strong className={strong}>To meet legal obligations:</strong> for example, responding to lawful
            requests from Nigerian authorities.
          </li>
        </ul>
        <p>
          <strong className={strong}>Automated decisions.</strong> We place you in a neighbourhood automatically from
          the address you give us. If we get it wrong, or can&apos;t place you, you can ask for a person to look at it.
          Limits on how many messages or listings a new account can send are also automatic. We don&apos;t make
          decisions with legal or similarly significant effects about you by automated means alone: reports and
          account suspensions are reviewed by people.
        </p>
      </LegalSection>

      <LegalSection title={title("what-neighbours-see")} id="what-neighbours-see">
        <p>
          Neighbours see your name, photo (if you add one), neighbourhood, and what you post or share with them.
          <strong className={strong}> We never show your address, street, house number or exact location to anyone.</strong>{" "}
          You can choose who can see your full profile and who can message you in Settings → Privacy &amp; blocking.
          Private group posts are visible only to that group&apos;s members, and messages only to the people in the
          conversation.
        </p>
      </LegalSection>

      <LegalSection title={title("sharing")} id="sharing">
        <p>
          <strong className={strong}>We do not sell your personal data.</strong> We share it only with:
        </p>
        <ul className={li}>
          <li>
            <strong className={strong}>Other members</strong>, as described in section 5 and as you choose when you
            post, message or join a group.
          </li>
          <li>
            <strong className={strong}>Service providers who run myHoodora for us</strong>, under contracts that
            allow them to use it only to provide their service to us and require them to protect it. They provide
            sign-in, our database, hosting for the app and website, photo and video storage, email delivery, push
            notifications, crash reports, app usage analytics (if you say yes), and maps and address lookup.{" "}
            <Link href="/privacy/providers" className={link}>
              See every provider, what they handle and where they store it
            </Link>
            .
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
        <p>
          If you sign in with Google or Apple, or open a link to another website, their own privacy policies apply to
          what they collect.
        </p>
      </LegalSection>

      <LegalSection title={title("transfers")} id="transfers">
        <p>
          Our service providers store or process data on servers outside Nigeria (mainly in the United States and
          the European Union), so using myHoodora involves sending your data abroad. The country for each one is on{" "}
          <Link href="/privacy/providers" className={link}>
            our service providers page
          </Link>
          . We rely on the safeguards the
          NDPA allows (sections 41 to 43): contracts with each provider that require them to protect your data to the
          NDPA&apos;s standard, and where a provider offers them, standard contractual clauses. You can ask us for the
          details of the safeguard for any provider at the address below. Our fonts are served from our own servers,
          and the website loads no analytics, advertising or session-recording scripts.
        </p>
      </LegalSection>

      <LegalSection title={title("retention")} id="retention">
        <p>We keep data only as long as we need it for the purposes in section 4:</p>
        <ul className={li}>
          <li>Your account and what you share: while your account is open.</li>
          <li>Address checks: only your last 10, so a person can review a failed check.</li>
          <li>Your date of birth: not kept at all.</li>
          <li>
            App usage analytics: kept by Google for up to 14 months, then deleted. Turning analytics off in Settings →
            Privacy also clears what&apos;s stored on your phone and gives the app a new, unconnected ID.
          </li>
          <li>
            If you deactivate your account (Settings → Account → Deactivate account), your profile, posts, listings and
            comments are hidden until you log in and choose Reactivate. Nothing is deleted, and we stop emailing you.
          </li>
          <li>
            If you delete your account (Settings → Account → Delete account), they&apos;re hidden straight away, and you
            can cancel by logging in within 7 days. After that, we delete your profile, posts, comments, listings, photos and videos, address and location history, groups you
            created alone, notifications, push registrations, support conversations, join requests, ad views and clicks,
            email delivery records, and your sign-in.
          </li>
          <li>
            Messages you sent stay in the other person&apos;s copy of the conversation, shown as from &ldquo;Deleted
            User&rdquo;. Reports and moderation decisions keep only your account ID, so the safety record stays
            accurate; nothing else about you remains.
          </li>
          <li>
            We may keep some records for longer where the law requires it, or to resolve disputes, prevent fraud and
            enforce our terms, and only for as long as needed.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title={title("your-rights")} id="your-rights">
        <p>Under the NDPA you have the right to:</p>
        <ul className={li}>
          <li>be told how your data is used (this policy);</li>
          <li>access the personal data we hold about you and get a copy of it;</li>
          <li>correct data that is wrong or incomplete (you can edit most of it yourself in Settings);</li>
          <li>
            delete your account and data (you can do this yourself in Settings → Account → Delete account), or just
            deactivate it for a while;
          </li>
          <li>object to, or ask us to restrict, how we use it;</li>
          <li>receive your data in a portable format;</li>
          <li>not be subject to decisions made only by automated means that significantly affect you;</li>
          <li>
            withdraw consent you have given, at any time, without penalty: turn off location, camera or notifications
            in your phone&apos;s settings, turn off &ldquo;Help improve myHoodora&rdquo; in Settings → Privacy, change
            your emails in Settings → Notifications, or email us;
          </li>
          <li>
            complain to the <strong className={strong}>Nigeria Data Protection Commission (NDPC)</strong> if you
            think we have mishandled your data (
            <a href="https://ndpc.gov.ng" className={link} target="_blank" rel="noopener noreferrer">
              ndpc.gov.ng
            </a>
            ). We&apos;d like the chance to put it right first, so please tell us too.
          </li>
        </ul>
        <p>
          To use any of these rights, email {PRIVACY} from the address on your account, or choose &ldquo;Privacy &amp;
          data request&rdquo; on our{" "}
          <Link href="/contact?topic=privacy#message" className={link}>
            contact page
          </Link>
          . We may ask you to confirm
          it&apos;s you, and we&apos;ll respond within the time the law requires. It&apos;s free.
        </p>
      </LegalSection>

      <LegalSection title={title("cookies")} id="cookies">
        <p>
          We use only essential cookies and browser storage: to keep you signed in, protect your account, remember
          your settings, and keep the pages you&apos;ve already loaded available when your connection drops. Because
          they&apos;re all strictly necessary we don&apos;t ask for consent for them, and there&apos;s no cookie banner.
          The website doesn&apos;t use analytics, advertising or session-recording cookies or scripts. If we ever add
          any, we&apos;ll ask you first and you&apos;ll be able to say no. The app works the same way: its usage
          analytics (section 2) stay off unless you say yes, and it has no advertising or session-recording tools.
          Cached posts are cleared from your device when you log out.
        </p>
      </LegalSection>

      <LegalSection title={title("security")} id="security">
        <p>
          Data is encrypted in transit and our database is encrypted at rest. Access is limited to the people and
          services that need it. No system is perfectly secure, so
          please use a strong password and keep your login details to yourself. If a data breach is likely to put your
          rights at risk, we&apos;ll notify the NDPC within 72 hours of finding out, and tell you without delay if
          the risk to you is high.
        </p>
      </LegalSection>

      <LegalSection title={title("children")} id="children">
        <p>
          myHoodora is for people aged 18 and over. Under the NDPA a child is anyone under 18, and we don&apos;t
          collect children&apos;s data. That&apos;s why everyone is asked their date of birth when they join, before
          they give us their name or address.
        </p>
        <p>
          If someone says they&apos;re under 18, we close the account on the spot and delete it and everything in it
          straight away, without the usual 30 days. If you believe a child is using myHoodora, report their profile
          or email {PRIVACY} and we&apos;ll do the same.
        </p>
      </LegalSection>

      <LegalSection title={title("changes")} id="changes">
        <p>
          We&apos;ll update this policy as myHoodora grows. If we make important changes, we&apos;ll tell you in the
          app or by email before they take effect. The date at the top shows when it last changed.
        </p>
      </LegalSection>

      <LegalSection title={title("contact")} id="contact">
        <p>Questions, requests or complaints about your data:</p>
        <ul className={li}>
          <li>
            <strong className={strong}>Privacy and data requests:</strong> {PRIVACY}
          </li>
          <li>
            <strong className={strong}>Data Protection Officer:</strong> {DPO_NAME}, {DPO}
          </li>
          <li>
            <strong className={strong}>Online:</strong> the{" "}
            <Link href="/contact" className={link}>
              contact page
            </Link>
            , or Settings → Contact us in the app
          </li>
          <li>
            <strong className={strong}>The regulator:</strong> Nigeria Data Protection Commission,{" "}
            <a href="https://ndpc.gov.ng" className={link} target="_blank" rel="noopener noreferrer">
              ndpc.gov.ng
            </a>
          </li>
        </ul>
      </LegalSection>
    </>
  );
}
