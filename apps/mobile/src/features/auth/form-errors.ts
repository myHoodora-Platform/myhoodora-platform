import { authErrorMessage } from "@myhoodora/api-contract/auth-errors";
import type { ZodSchema } from "zod";

/** First message per field, from a Zod schema, or null when the values are valid. */
export function fieldErrors<T extends Record<string, unknown>>(schema: ZodSchema<T>, values: T): Partial<Record<keyof T, string>> | null {
  const result = schema.safeParse(values);
  if (result.success) return null;
  const errors: Partial<Record<keyof T, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof T;
    errors[key] ??= issue.message;
  }
  return errors;
}

/** A Firebase sign-in failure in the web's wording. */
export function signInFailure(err: unknown): string {
  return authErrorMessage(err) || "Something went wrong. Please try again.";
}
