/**
 * Signing in to myHoodoraAI with a myHoodora account (docs/integrations/myhoodora-ai.md §4): what the
 * web page at /oauth/authorize sends to POST /oauth/authorize, and what it gets back.
 */

/** The web page that asks the signed-in person. */
export const AUTHORIZE_PATH = "/oauth/authorize";

/** The authorisation request's parameters (contract §4.1). Nothing else is passed on. */
export const AUTHORIZE_PARAMS = ["response_type", "client_id", "redirect_uri", "scope", "state", "nonce", "code_challenge", "code_challenge_method"] as const;

export type AuthorizeParams = Partial<Record<(typeof AUTHORIZE_PARAMS)[number], string>>;

/** What the person has to do on myHoodora first. `email` is handled on the page itself. */
export type AuthorizeStep = "age_check" | "terms" | "email" | "reactivate";

/**
 * `redirect`: go there (back to the app, with a code or an OAuth error). `step`: take the person
 * through it, then ask again. A 400 means the request itself isn't valid: show an error, go nowhere.
 */
export type AuthorizeOutcome = { kind: "redirect"; url: string } | { kind: "step"; step: AuthorizeStep };

/** The request's own parameters from a query string; anything else is dropped (the API refuses unknown fields). */
export function authorizeParamsFrom(search: { get(name: string): string | null }): AuthorizeParams {
  const params: AuthorizeParams = {};
  for (const name of AUTHORIZE_PARAMS) {
    const value = search.get(name);
    if (value !== null) params[name] = value;
  }
  return params;
}

/** True for the authorise page, with or without its query. */
export function isAuthorizePath(path: string): boolean {
  return path === AUTHORIZE_PATH || path.startsWith(`${AUTHORIZE_PATH}?`);
}
