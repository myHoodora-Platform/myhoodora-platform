import { Injectable } from '@nestjs/common';
import { getFirebaseAdmin } from '../config/firebase.config';
import { DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class AuthService {
    /**
     * Verifies a Firebase ID token and returns the decoded payload.
     * The FirebaseAuthGuard does this automatically for protected routes;
     * use this method when you need to verify a token programmatically.
     */
    async verifyToken(idToken: string): Promise<DecodedIdToken> {
        return getFirebaseAdmin().auth().verifyIdToken(idToken, true);
    }

    /**
     * Revokes all refresh tokens for a given Firebase user UID.
     * Call this on logout if you want server-side session invalidation.
     */
    async revokeTokens(uid: string): Promise<void> {
        await getFirebaseAdmin().auth().revokeRefreshTokens(uid);
    }
}
