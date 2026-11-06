import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_EMAIL, publicPageMetadata } from "@/lib/site";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { DELETE_ACCOUNT_UPDATED } from "@/components/legal/delete-account";
import { DELETION_GRACE_DAYS } from "@myhoodora/api-contract/settings";
import { legalVersionLabel } from "@myhoodora/api-contract/legal";

export const metadata: Metadata = publicPageMetadata("/delete-account", {
  title: "Delete your account | myHoodora",
  description: "How to delete your myHoodora account and data, in the app, on the website or by email, and what is deleted.",
});

const li = "list-disc space-y-2 pl-5";
const steps = "list-decimal space-y-2 pl-5";
const strong = "text-foreground";
const link = "font-semibold text-primary hover:underline";

/**
 * Public and signed-out on purpose: Google Play's Data safety form asks for a web page where someone
 * can ask for their account to be deleted without the app (docs/mobile/play-store-release.md).
 */
export default function Page() {
  return (
    <LegalPage
      explore={["safety", "guidelines", "about"]}
      title="Delete your myHoodora account"
      updatedAt={legalVersionLabel(DELETE_ACCOUNT_UPDATED)}
      intro="You can delete your account and the data that goes with it at any time, from the app, from the website, or by email if you no longer have either."
    >
      <LegalSection title="In the app" id="in-the-app">
        <ol className={steps}>
          <li>
            Tap <strong className={strong}>Menu</strong>, then <strong className={strong}>Settings &amp; privacy</strong>.
          </li>
          <li>
            Under <strong className={strong}>Account</strong>, tap <strong className={strong}>Delete account</strong>.
          </li>
          <li>Choose a reason and confirm.</li>
        </ol>
      </LegalSection>

      <LegalSection title="On the website" id="on-the-website">
        <ol className={steps}>
          <li>
            <Link href="/login" className={link}>
              Log in
            </Link>{" "}
            with the same email address or Google account you use in the app.
          </li>
          <li>
            Open <strong className={strong}>Settings → Account</strong> and choose{" "}
            <strong className={strong}>Delete account</strong>.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="Without the app or the website" id="by-email">
        <p>
          Email{" "}
          <a href={`mailto:${PRIVACY_EMAIL}?subject=Delete%20my%20account`} className={link}>
            {PRIVACY_EMAIL}
          </a>{" "}
          from the email address on your account, with the subject &ldquo;Delete my account&rdquo;. We reply to confirm
          it&apos;s you, then delete the account the same way. We answer within 7 days.
        </p>
      </LegalSection>

      <LegalSection title="What happens next" id="what-happens">
        <ul className={li}>
          <li>
            Your profile, posts, comments and listings are hidden from neighbours straight away, emails and notifications
            stop, and you&apos;re signed out everywhere.
          </li>
          <li>
            For {DELETION_GRACE_DAYS} days you can change your mind: log in and choose to keep your account. After that
            the deletion can&apos;t be undone.
          </li>
          <li>
            Then we delete your profile, posts, comments, listings, photos and videos, address and location history,
            groups you created alone, notifications, push registrations, support conversations, join requests, ad views
            and clicks, email delivery records, and your sign-in.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What we keep" id="what-we-keep">
        <ul className={li}>
          <li>
            Messages you sent stay in the other person&apos;s copy of the conversation, shown as from &ldquo;Deleted
            User&rdquo;.
          </li>
          <li>Reports and moderation decisions keep only your account ID, so the safety record stays accurate.</li>
          <li>
            Some records may be kept longer where the law requires it, or to resolve disputes, prevent fraud and enforce
            our terms, and only for as long as needed.
          </li>
        </ul>
        <p>
          Only want a break? Choose <strong className={strong}>Deactivate account</strong> instead: nothing is deleted,
          and you can come back by logging in. More in our{" "}
          <Link href="/privacy#retention" className={link}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
