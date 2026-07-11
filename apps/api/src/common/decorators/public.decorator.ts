import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a controller or route handler as publicly accessible —
 * the FirebaseAuthGuard will skip token verification for these endpoints.
 *
 * @example
 * @Public()
 * @Get('health')
 * getHealth() { return { status: 'ok' }; }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
