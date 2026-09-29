import { Global, Injectable, Module } from "@nestjs/common";
import type { ClientSession } from "mongoose";

export const TARGET_TYPES = ["post", "comment", "listing", "message", "user", "group", "business"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** What moderation needs to know about a reported item, whatever it is. */
export interface TargetSnapshot {
  type: TargetType;
  id: string;
  preview: string;
  authorUid?: string;
  hoodId?: string;
  removed: boolean;
  /** Rendered context for the report detail page (kind-specific). */
  content: Record<string, unknown>;
}

export interface ModeratableContent {
  type: TargetType;
  load(id: string): Promise<TargetSnapshot | null>;
  /** Hide or restore; must be idempotent and accept the decision's session. */
  setRemoved(id: string, removed: boolean, actorUid: string, session?: ClientSession): Promise<void>;
}

/**
 * Content modules (posts, comments, listings…) register themselves here on
 * init. Moderation looks them up by type, so it never imports those modules.
 */
@Injectable()
export class ModerationRegistry {
  private readonly handlers = new Map<TargetType, ModeratableContent>();

  register(handler: ModeratableContent) {
    this.handlers.set(handler.type, handler);
  }

  get(type: TargetType): ModeratableContent | undefined {
    return this.handlers.get(type);
  }
}

@Global()
@Module({ providers: [ModerationRegistry], exports: [ModerationRegistry] })
export class ModerationRegistryModule {}
