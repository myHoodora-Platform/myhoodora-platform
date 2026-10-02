/**
 * Log-safe forms of personal data. Never log tokens, keys, passwords, full
 * emails or addresses — use these helpers when an identifier is needed.
 */
export function maskEmail(email?: string | null): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${(user ?? "").slice(0, 1)}***@${domain}`;
}

export function shortId(id?: string | null): string {
  return id ? `${id.slice(0, 6)}…` : "—";
}
