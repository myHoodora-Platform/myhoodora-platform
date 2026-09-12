import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { DecodedIdToken } from 'firebase-admin/auth';
import request from 'supertest';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { Public } from '../src/common/decorators/public.decorator';
import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { getFirebaseAdmin } from '../src/config/firebase.config';

// The guard talks to the real Firebase Admin SDK, so we stub out the SDK
// boundary rather than hitting a live Firebase project. Everything else
// (guard, decorators, controllers) runs for real.
jest.mock('../src/config/firebase.config', () => ({
  getFirebaseAdmin: jest.fn(),
}));

const verifyIdToken = jest.fn();
const revokeRefreshTokens = jest.fn().mockResolvedValue(undefined);

(getFirebaseAdmin as jest.Mock).mockReturnValue({
  auth: () => ({ verifyIdToken, revokeRefreshTokens }),
});

// Minimal stand-ins for a public and a protected route, exercised alongside
// the real AuthController so the revoke-on-logout flow is tested end to end.
@Controller()
class PublicTestController {
  @Public()
  @Get('public')
  getPublic() {
    return { status: 'ok' };
  }
}

@Controller()
class ProtectedTestController {
  @Get('protected')
  getProtected(@CurrentUser() user: DecodedIdToken) {
    return { uid: user.uid };
  }
}

@Module({
  controllers: [PublicTestController, ProtectedTestController, AuthController],
  providers: [
    AuthService,
    Reflector,
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
  ],
})
class AuthFixtureModule {}

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthFixtureModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a request with a valid Bearer token through to the route', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-123' } as DecodedIdToken);

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uid: 'user-123' });
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token', true);
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app.getHttpServer()).get('/protected');

    expect(res.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects an expired or otherwise invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'));

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  it('lets a @Public() route bypass the guard entirely', async () => {
    const res = await request(app.getHttpServer()).get('/public');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects a token on the next request after it has been revoked', async () => {
    const token = 'revocable-token';
    verifyIdToken.mockResolvedValue({ uid: 'user-456' } as DecodedIdToken);

    const beforeLogout = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(beforeLogout.status).toBe(200);

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(204);
    expect(revokeRefreshTokens).toHaveBeenCalledWith('user-456');

    // Firebase now rejects the same token: verifyIdToken(token, checkRevoked=true)
    // fails because its `iat` predates the user's new tokensValidAfterTime.
    verifyIdToken.mockRejectedValue(new Error('Firebase ID token has been revoked'));

    const afterLogout = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(afterLogout.status).toBe(401);
  });
});