import type { User } from "firebase/auth";
import type { AuthorizeOutcome, AuthorizeParams } from "@myhoodora/api-contract/oauth";
import { apiFetch } from "./client";

/** POST /oauth/authorize (docs/integrations/myhoodora-ai.md §4.1). A 400 means the request isn't valid; a 404 that the integration is off. */
export function authorizeForApp(user: User, params: AuthorizeParams & { decision?: "cancel" }): Promise<AuthorizeOutcome> {
  return apiFetch<AuthorizeOutcome>(user, "/oauth/authorize", { method: "POST", json: params });
}
