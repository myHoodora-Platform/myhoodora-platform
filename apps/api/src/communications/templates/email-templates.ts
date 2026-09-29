/**
 * Transactional email templates. Plain HTML (inline styles for email
 * clients) + a text part. Every dynamic value is escaped.
 */

const TEAL = "#147C73";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const ACCOUNT_FOOTER = "You're getting this because you have a myHoodora account.";

function layout(preheader: string, body: string, footer = ACCOUNT_FOOTER): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif;color:#171717">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:bold;color:${TEAL};padding-bottom:16px">myHoodora</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#737373;line-height:1.5">${esc(footer)} myHoodora · Stronger hoods across Nigeria.</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="background:${TEAL};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">${esc(label)}</a></p>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function welcomeVerifyEmail(p: { name?: string; verifyUrl?: string }): RenderedEmail {
  const hi = p.name ? `Hi ${esc(p.name.split(" ")[0]!)},` : "Hi neighbour,";
  const verify = p.verifyUrl
    ? `<p>First, please confirm this is your email address:</p>${button(p.verifyUrl, "Verify my email")}<p style="font-size:13px;color:#737373">This link works once and expires in 24 hours. If you didn't sign up, you can ignore this email.</p>`
    : "";
  return {
    subject: p.verifyUrl ? "Welcome to myHoodora: please verify your email" : "Welcome to myHoodora",
    html: layout(
      "Welcome to your neighbourhood network.",
      `<p>${hi}</p><p>Welcome to myHoodora, the place where neighbours help each other, stay safe and grow together.</p>${verify}<p>Next, confirm your address in the app to join your Hood and see what's happening on your street.</p>`,
    ),
    text: `${p.name ? `Hi ${p.name.split(" ")[0]},` : "Hi neighbour,"}\n\nWelcome to myHoodora.\n\n${p.verifyUrl ? `Verify your email (link expires in 24 hours):\n${p.verifyUrl}\n\n` : ""}Next, confirm your address in the app to join your Hood.`,
  };
}

export function verifyEmail(p: { name?: string; verifyUrl: string }): RenderedEmail {
  return {
    subject: "Verify your email for myHoodora",
    html: layout(
      "Confirm your email address.",
      `<p>${p.name ? `Hi ${esc(p.name.split(" ")[0]!)},` : "Hi,"}</p><p>Tap the button to confirm this is your email address.</p>${button(p.verifyUrl, "Verify my email")}<p style="font-size:13px;color:#737373">This link works once and expires in 24 hours. If you didn't ask for it, ignore this email.</p>`,
    ),
    text: `Verify your email for myHoodora (expires in 24 hours):\n${p.verifyUrl}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

export function accountActionEmail(p: { name?: string; headline: string; detail: string; helpUrl: string }): RenderedEmail {
  return {
    subject: p.headline,
    html: layout(p.headline, `<p>${p.name ? `Hi ${esc(p.name.split(" ")[0]!)},` : "Hi,"}</p><p>${esc(p.detail)}</p>${button(p.helpUrl, "Read the community guidelines")}`),
    text: `${p.headline}\n\n${p.detail}\n\n${p.helpUrl}`,
  };
}

/**
 * General message: a greeting, a few plain-text paragraphs (escaped, line
 * breaks kept) and an optional button. Used for support replies, business
 * application updates and public-form confirmations.
 */
export function messageEmail(p: {
  subject: string;
  name?: string;
  paragraphs: string[];
  cta?: { href: string; label: string };
  /** Why they're receiving it (public forms have no account). */
  footer?: string;
}): RenderedEmail {
  const hi = p.name ? `Hi ${p.name.split(" ")[0]},` : "Hi,";
  const html = p.paragraphs.map((t) => `<p>${esc(t).replace(/\n/g, "<br>")}</p>`).join("");
  return {
    subject: p.subject,
    html: layout(p.paragraphs[0]?.slice(0, 90) ?? p.subject, `<p>${esc(hi)}</p>${html}${p.cta ? button(p.cta.href, p.cta.label) : ""}`, p.footer),
    text: `${hi}\n\n${p.paragraphs.join("\n\n")}${p.cta ? `\n\n${p.cta.label}: ${p.cta.href}` : ""}\n\n— The myHoodora team`,
  };
}
