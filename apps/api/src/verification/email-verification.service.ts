import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes } from "node:crypto";
import { Model, type ClientSession } from "mongoose";
import { CommunicationsService } from "../communications/communications.service";
import { verifyEmail, welcomeVerifyEmail } from "../communications/templates/email-templates";
import { getFirebaseAdmin } from "../config/firebase.config";
import { AccountLifecycle } from "../users/account-lifecycle";
import { User, UserDocument } from "../users/schemas/user.schema";
import { EmailVerification, EmailVerificationDocument } from "./email-verification.schema";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESENDS_PER_HOUR = 3;

/** Same message for invalid, expired and used tokens (no enumeration). */
const INVALID = "This link is invalid or has expired. Request a new one from the app.";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Email verification (OWASP Forgot-Password / token guidance):
 * 32 random bytes, SHA-256 at rest, 24 h expiry, single use, rate-limited
 * resend, generic failure message, raw token never logged or stored.
 */
@Injectable()
export class EmailVerificationService implements OnModuleInit {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectModel(EmailVerification.name) private readonly tokens: Model<EmailVerificationDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly comms: CommunicationsService,
    private readonly config: ConfigService,
    private readonly accounts: AccountLifecycle,
  ) {}

  onModuleInit() {
    this.accounts.register({
      name: "email-verification",
      purge: async (uid, dryRun) => ({ emailLinks: dryRun ? await this.tokens.countDocuments({ uid }).exec() : (await this.tokens.deleteMany({ uid }).exec()).deletedCount }),
    });
  }

  /** Create a token (inside the registration transaction). Returns the raw token for the email only. */
  async issue(uid: string, session?: ClientSession): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    await this.tokens.create([{ uid, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) }], { session });
    return raw;
  }

  verifyUrl(raw: string): string {
    return `${this.config.get<string>("appUrl")}/verify-email?token=${encodeURIComponent(raw)}`;
  }

  /** After registration commits: one welcome email, with a verify link if needed. Never on sign-in. */
  async sendWelcome(user: Pick<User, "uid" | "email" | "displayName">, rawToken?: string): Promise<void> {
    await this.comms.sendEmail({
      uid: user.uid,
      to: user.email,
      type: "welcome_verify",
      email: welcomeVerifyEmail({ name: user.displayName, verifyUrl: rawToken ? this.verifyUrl(rawToken) : undefined }),
      idempotencyKey: `welcome:${user.uid}`,
    });
  }

  /** POST /auth/email-verification/confirm */
  async confirm(raw: string): Promise<void> {
    if (!raw || raw.length < 20 || raw.length > 100) throw new BadRequestException(INVALID);
    // Atomic consume: only one request can flip consumedAt, so a token can't be replayed concurrently.
    const token = await this.tokens
      .findOneAndUpdate({ tokenHash: hashToken(raw), consumedAt: null, expiresAt: { $gt: new Date() } }, { $set: { consumedAt: new Date() } }, { returnDocument: "after" })
      .exec();
    if (!token) throw new BadRequestException(INVALID);

    await this.users.updateOne({ uid: token.uid, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } }).exec();
    // Invalidate any other outstanding links for this user.
    await this.tokens.updateMany({ uid: token.uid, consumedAt: null }, { $set: { consumedAt: new Date() } }).exec();
    try {
      await getFirebaseAdmin().auth().updateUser(token.uid, { emailVerified: true });
    } catch {
      // Our record is the source of truth; Firebase sync is best-effort.
      this.logger.warn("Couldn't sync emailVerified to Firebase (will not affect access).");
    }
  }

  /** POST /auth/email-verification/resend — always 202 to the client; rate-limited per user. */
  async resend(uid: string): Promise<void> {
    const user = await this.users.findOne({ uid }).exec();
    if (!user || user.emailVerifiedAt) return;
    const recent = await this.tokens.countDocuments({ uid, createdAt: { $gt: new Date(Date.now() - 3600_000) } }).exec();
    if (recent >= MAX_RESENDS_PER_HOUR) {
      throw new HttpException("You've asked for a few links already. Please wait an hour and try again.", HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.tokens.updateMany({ uid, consumedAt: null }, { $set: { consumedAt: new Date() } }).exec();
    const raw = await this.issue(uid);
    await this.comms.sendEmail({
      uid,
      to: user.email,
      type: "verify_email",
      email: verifyEmail({ name: user.displayName, verifyUrl: this.verifyUrl(raw) }),
      // New token → new key, so each resend is a distinct email.
      idempotencyKey: `verify:${uid}:${hashToken(raw).slice(0, 16)}`,
    });
  }
}
