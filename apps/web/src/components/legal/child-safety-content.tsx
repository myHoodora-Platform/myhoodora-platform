import Link from "next/link";
import { COMPANY, SAFETY_EMAIL, SAFETY_LEAD } from "@/lib/site";
import { LegalSection } from "./legal-page";

const li = "list-disc space-y-2 pl-5";
const strong = "text-foreground";
const link = "font-semibold text-primary hover:underline";

const SAFETY = (
  <a href={`mailto:${SAFETY_EMAIL}`} className={link}>
    {SAFETY_EMAIL}
  </a>
);

/**
 * Our published standards against child sexual abuse and exploitation (CSAE), which Google Play requires
 * of social apps (Child Safety Standards policy). Keep it true to what moderation actually does
 * (docs/moderation.md, docs/compliance/ndpa.md). Must be reviewed by a qualified lawyer.
 */
export function ChildSafetyContent() {
  return (
    <>
      <LegalSection title="1. Zero tolerance for child sexual abuse and exploitation (CSAE)">
        <p>
          <strong className={strong}>
            myHoodora strictly prohibits child sexual abuse and exploitation (CSAE), including all forms of child
            sexual abuse material (CSAM), grooming, sexual exploitation, sextortion, child trafficking for sexual
            purposes, and any activity that sexually abuses, exploits or endangers a child.
          </strong>
        </p>
        <p>
          This prohibition applies to every user, account, feature and service operated by myHoodora, including our
          website, our Android and iPhone apps, posts, comments, photos, videos, marketplace listings, groups and
          private messages.
        </p>
        <p>
          Any content, behaviour or activity that facilitates, promotes, requests, distributes or attempts to
          facilitate CSAE is strictly prohibited. Violations result in enforcement action, including content removal,
          account suspension or permanent termination, and reporting to the relevant authorities.
        </p>
        <p>We do not allow, and we remove:</p>
        <ul className={li}>
          <li>child sexual abuse material (CSAM) of any kind, real, drawn or computer-generated;</li>
          <li>content that sexualises children, including comments, jokes or &ldquo;compliments&rdquo;;</li>
          <li>grooming: trying to build contact with a child for sexual purposes, or asking a child for images;</li>
          <li>sextortion: threatening to share intimate images of a young person;</li>
          <li>trafficking, selling or offering children, or advertising anything that puts children at risk;</li>
          <li>links to, or requests for, any of the above.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. myHoodora is for adults">
        <p>
          Everyone must be 18 or over to join, and everyone confirms their age before they give us their name or
          address. If we learn that an account belongs to someone under 18, we close it and delete it straight away
          (see our{" "}
          <Link href="/privacy#children" className={link}>
            Privacy Policy
          </Link>
          ). Our{" "}
          <Link href="/guidelines" className={link}>
            Community Guidelines
          </Link>{" "}
          also forbid posting photos of children who aren&apos;t yours.
        </p>
      </LegalSection>

      <LegalSection title="3. How to report a concern">
        <ul className={li}>
          <li>
            <strong className={strong}>In the app or on the website:</strong> tap <strong className={strong}>⋯</strong>{" "}
            on any post, comment, listing, message or profile, choose <strong className={strong}>Report</strong>, then{" "}
            <strong className={strong}>Child safety or exploitation</strong>. These reports go straight to our staff,
            never to volunteer moderators.
          </li>
          <li>
            <strong className={strong}>By email:</strong> write to {SAFETY} with a link or a description. Please
            don&apos;t send us copies of any images.
          </li>
          <li>
            <strong className={strong}>If a child is in immediate danger,</strong> call the police on 112 first.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. What we do when something is reported">
        <ul className={li}>
          <li>Child-safety reports are top priority in our staff&apos;s review queue.</li>
          <li>We remove the content and permanently suspend the account.</li>
          <li>We keep the evidence securely, and only for as long as the law requires, so the authorities can act.</li>
          <li>
            We report child sexual abuse material and exploitation to the authorities: the National Agency for the
            Prohibition of Trafficking in Persons (NAPTIP) and the Nigeria Police Force, and to the National Center
            for Missing &amp; Exploited Children (NCMEC) through its CyberTipline.
          </li>
          <li>We cooperate with lawful requests from law enforcement.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. The law we follow">
        <p>
          We comply with the child-protection laws of Nigeria, including the Child Rights Act 2003, the Cybercrimes
          (Prohibition, Prevention, etc.) Act 2015 and the Trafficking in Persons (Prohibition) Enforcement and
          Administration Act 2015, and with the Google Play and Apple App Store child safety policies.
        </p>
      </LegalSection>

      <LegalSection title="6. Child safety point of contact">
        <p>Our designated child safety contact can speak about these standards and how we enforce them:</p>
        <ul className={li}>
          <li>
            <strong className={strong}>Contact person:</strong> {SAFETY_LEAD.name}
          </li>
          <li>
            <strong className={strong}>Position:</strong> {SAFETY_LEAD.role}
          </li>
          <li>
            <strong className={strong}>Organisation:</strong> {COMPANY.legalName}, operator of myHoodora
          </li>
          <li>
            <strong className={strong}>Email:</strong> {SAFETY}
          </li>
          <li>
            <strong className={strong}>Location:</strong> Lagos, Nigeria
          </li>
        </ul>
      </LegalSection>
    </>
  );
}
