import { Global, Injectable, Module } from "@nestjs/common";

/** What a module does with the content one person authored when their account changes state. */
export interface AccountContentOwner {
  /** For logs, e.g. "posts". */
  name: string;
  /** They deactivated: take what they authored out of neighbours' view. Must be safe to repeat. */
  hide(uid: string): Promise<void>;
  /** They came back: put it back. Must be safe to repeat. */
  unhide(uid: string): Promise<void>;
}

/**
 * Content modules (posts, listings…) register here on init, the way they register with the
 * moderation registry. The users module then tells them when an account is deactivated or
 * restored without importing any of them (several of them import it).
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
    for (const owner of this.owners) await owner.hide(uid);
  }

  async unhide(uid: string): Promise<void> {
    for (const owner of this.owners) await owner.unhide(uid);
  }
}

@Global()
@Module({ providers: [AccountLifecycle], exports: [AccountLifecycle] })
export class AccountLifecycleModule {}
