import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Injects the Firebase-decoded user that was attached by FirebaseAuthGuard.
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: DecodedIdToken) { ... }
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): DecodedIdToken => {
        const request = ctx.switchToHttp().getRequest();
        return request.user as DecodedIdToken;
    },
);
