import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '../../config/firebase.config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type FirebaseRequest = Request & { user?: DecodedIdToken };

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
    private readonly logger = new Logger(FirebaseAuthGuard.name);

    constructor(private readonly reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Allow routes marked with @Public()
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractBearerToken(request);

        if (!token) {
            throw new UnauthorizedException('Missing Bearer token');
        }

        try {
            const decodedToken = await getFirebaseAdmin()
                .auth()
                .verifyIdToken(token, /** checkRevoked */ true);

            // Attach the decoded token so controllers can access it via @CurrentUser()
            const firebaseRequest = request as FirebaseRequest;
            firebaseRequest.user = decodedToken;
            return true;
        } catch (err: unknown) {
            this.logger.warn(`Firebase token verification failed: ${String(err)}`);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    private extractBearerToken(request: Request): string | null {
        const authHeader = request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        return authHeader.slice(7);
    }
}
