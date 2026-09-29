import { Injectable } from "@nestjs/common";
import { getFirebaseAdmin } from "../config/firebase.config";

@Injectable()
export class AuthService {
  /** Server-side logout: revokes all refresh tokens for the user. */
  async revokeTokens(uid: string): Promise<void> {
    await getFirebaseAdmin().auth().revokeRefreshTokens(uid);
  }
}
