/**
 * Ids that make "submit" safe to repeat (docs/api-contract.md: `clientId` on POST /posts).
 *
 * A request that times out may still have reached the server, and the person will press the button
 * again. Sending the same id with the same draft tells the API it is the same submission, so it
 * returns the post it already created instead of making a second one.
 *
 * A draft that was edited in between is a different submission and gets a new id: the API ignores
 * the rest of a repeated request, so reusing the id would quietly discard the edit.
 */
export function submissionIds(newId: () => string = () => crypto.randomUUID()) {
  let last: { fingerprint: string; id: string } | null = null;
  return {
    /** The id for this draft: last time's if nothing in it changed (a retry), otherwise a new one. */
    for(draft: unknown): string {
      const fingerprint = JSON.stringify(draft);
      if (last?.fingerprint !== fingerprint) last = { fingerprint, id: newId() };
      return last.id;
    },
  };
}
