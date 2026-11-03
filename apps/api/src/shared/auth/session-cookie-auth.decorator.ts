import { SetMetadata } from "@nestjs/common";

export const SESSION_COOKIE_AUTH_KEY = "sessionCookieAuth";

/**
 * This route is called by the web server on a visitor's behalf and authenticates with their Firebase
 * **session cookie** (sent as the Bearer token) instead of an ID token. Opt-in per route: every other
 * route accepts ID tokens only, and neither credential is accepted in place of the other.
 */
export const SessionCookieAuth = () => SetMetadata(SESSION_COOKIE_AUTH_KEY, true);
