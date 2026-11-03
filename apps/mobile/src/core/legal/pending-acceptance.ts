/**
 * "I agree" ticked on the email sign-up form, held in memory until the new account exists: the
 * accept-terms screen sends it straight away instead of asking again (as core/age/age-lock.ts does
 * for the age answer).
 */
let pending = false;

export function rememberLegalAcceptance(): void {
  pending = true;
}

export function legalAcceptancePending(): boolean {
  return pending;
}

export function clearLegalAcceptance(): void {
  pending = false;
}
