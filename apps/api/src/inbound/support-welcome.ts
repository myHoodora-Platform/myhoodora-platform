/**
 * The team's welcome to every new neighbour (contract §18): a support conversation from "the
 * myHoodora team", sent a few minutes after they first finish onboarding, with an in-app
 * notification and a push. UsersService queues the job; InboundService runs it.
 */
export const SUPPORT_WELCOME_JOB = "support.welcome";

/** A support conversation of this kind is the welcome: there is one per person, ever. */
export const WELCOME_KIND = "welcome";

export const WELCOME_SUBJECT = "Welcome to myHoodora";

const firstName = (displayName?: string | null) => displayName?.trim().split(/\s+/)[0] || undefined;

/** Who the team is, how to reach them, and the next steps that matter for this person. */
export function welcomeMessage(person: { displayName?: string | null; verified: boolean }): string {
  const name = firstName(person.displayName);
  const steps = [
    ...(person.verified ? [] : ["Confirm your address, so you can post and message your neighbours."]),
    "Turn on notifications, so you hear about safety alerts on your street straight away.",
    "Say hello in your neighbourhood feed, or see what's for sale nearby.",
  ];
  return [
    `Hi${name ? ` ${name}` : ""}, welcome to myHoodora! 👋`,
    "This conversation is your direct line to the myHoodora team. If something isn't working, or you have a question about your account or your neighbourhood, reply here and someone on the team will get back to you.",
    `A few things to start with:\n${steps.map((s) => `• ${s}`).join("\n")}`,
    "We're glad you're here.\nThe myHoodora team",
  ].join("\n\n");
}

/** The notification and push: short enough for a lock screen. */
export function welcomePreview(displayName?: string | null): string {
  const name = firstName(displayName);
  return `Hi${name ? ` ${name}` : ""}, welcome! This is your direct line to the myHoodora team. Reply any time.`;
}
