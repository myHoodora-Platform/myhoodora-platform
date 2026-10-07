import { Global, Injectable, Module } from "@nestjs/common";

/** How long after deactivating someone can still come back by signing in. After it, the account is deleted for good. */
export const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Stands in for a deleted person wherever their uid would otherwise remain as a pointer to them: in
 * the conversations they took part in, which the other person keeps. Clients show it as "Deleted User".
 */
export const DELETED_USER_UID = "deleted-user";
export const DELETED_USER_NAME = "Deleted User";

/** What a module does with the content one person authored when their account changes state. */
export interface AccountContentOwner {
  /** For logs and reports, e.g. "posts". */
  name: string;
  /** They deactivated: take what they authored out of neighbours' view. Must be safe to repeat. */
  hide?(uid: string): Promise<void>;
  /** They came back: put it back. Must be safe to repeat. */
  unhide?(uid: string): Promise<void>;
  /**
   * The account is being deleted for good (AccountDeletionService): remove what this module holds
   * about the person, or cut its tie to them. Returns how many of each thing that is. With `dryRun`
   * it only counts and changes nothing. Must be safe to repeat: the job that calls it can run twice.
   */
  purge?(uid: string, dryRun: boolean): Promise<Record<string, number>>;
}

/**
 * Content modules (posts, listings…) register here on init, the way they register with the
 * moderation registry. The users module then tells them when an account is deactivated, restored
 * or deleted without importing any of them (several of them import it).
 *
 * Hiding is per document, not a join at read time: a feed that filtered authors out after
 * fetching a page would return short pages. Content that isn't hidden outright (a comment in
 * someone else's thread) loses the author's name instead: see UsersService.authorCards.
 */
@Injectable()
export class AccountLifecycle {
  private readonly owners: AccountContentOwner[] = [];

  register(owner: AccountContentOwner): void {
    this.owners.push(owner);
  }

  /** One after another: if one fails the caller hears about it, and running it again finishes the job. */
  async hide(uid: string): Promise<void> {
    for (const owner of this.owners) await owner.hide?.(uid);
  }

  async unhide(uid: string): Promise<void> {
    for (const owner of this.owners) await owner.unhide?.(uid);
  }

  /** Every module's part of deleting someone, in turn. The counts are for the log (and for the dry run, which is only that). */
  async purge(uid: string, dryRun: boolean): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const owner of this.owners) Object.assign(counts, await owner.purge?.(uid, dryRun));
    return counts;
  }
}

@Global()
@Module({ providers: [AccountLifecycle], exports: [AccountLifecycle] })
export class AccountLifecycleModule {}
