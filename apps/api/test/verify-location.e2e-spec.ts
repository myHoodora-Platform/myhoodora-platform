import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Types } from 'mongoose';
import request from 'supertest';

import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { getFirebaseAdmin } from '../src/config/firebase.config';
import { NeighborhoodsService } from '../src/neighborhoods/neighborhoods.service';
import { Neighborhood } from '../src/neighborhoods/schemas/neighborhood.schema';
import { User } from '../src/users/schemas/user.schema';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

// The guard talks to the real Firebase Admin SDK, so we stub out the SDK
// boundary rather than hitting a live Firebase project.
jest.mock('../src/config/firebase.config', () => ({
  getFirebaseAdmin: jest.fn(),
}));

const verifyIdToken = jest.fn();
(getFirebaseAdmin as jest.Mock).mockReturnValue({
  auth: () => ({ verifyIdToken }),
});

// Mongoose models are stubbed - there's no in-memory Mongo in this repo, so
// we exercise the controller/service/aggregation-shaping logic against
// mocked query builders.
const findOneAndUpdateExec = jest.fn();
const userModelMock = {
  findOneAndUpdate: jest.fn(() => ({ exec: findOneAndUpdateExec })),
};

const aggregateExec = jest.fn();
const neighborhoodModelMock = {
  aggregate: jest.fn(() => ({ exec: aggregateExec })),
};

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    NeighborhoodsService,
    Reflector,
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: getModelToken(User.name), useValue: userModelMock },
    {
      provide: getModelToken(Neighborhood.name),
      useValue: neighborhoodModelMock,
    },
  ],
})
class UsersFixtureModule {}

describe('POST /users/me/verify-location (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [UsersFixtureModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    verifyIdToken.mockResolvedValue({ uid: 'user-123' } as DecodedIdToken);
  });

  it('assigns the nearest neighborhood and marks the user verified when within radius', async () => {
    const neighborhoodId = new Types.ObjectId();
    aggregateExec.mockResolvedValue([
      { _id: neighborhoodId, distanceMeters: 250 },
    ]);
    findOneAndUpdateExec.mockResolvedValue({
      uid: 'user-123',
      neighborhoodId: neighborhoodId.toString(),
      verificationStatus: 'verified',
    });

    const res = await request(app.getHttpServer())
      .post('/users/me/verify-location')
      .set('Authorization', 'Bearer valid-token')
      .send({ lat: 37.7749, lng: -122.4194 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      verificationStatus: 'verified',
      neighborhoodId: neighborhoodId.toString(),
      distanceMeters: 250,
    });
    expect(userModelMock.findOneAndUpdate).toHaveBeenCalledWith(
      { uid: 'user-123' },
      expect.objectContaining({
        neighborhoodId: neighborhoodId.toString(),
        verificationStatus: 'verified',
        verifiedAt: expect.any(Date),
        lastKnownLocation: { lat: 37.7749, lng: -122.4194 },
      }),
      { new: true },
    );
  });

  it('leaves the user unverified with an outside_coverage reason when no hood matches', async () => {
    aggregateExec.mockResolvedValue([]);
    findOneAndUpdateExec.mockResolvedValue({
      uid: 'user-123',
      verificationStatus: 'unverified',
    });

    const res = await request(app.getHttpServer())
      .post('/users/me/verify-location')
      .set('Authorization', 'Bearer valid-token')
      .send({ lat: 0, lng: 0 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      verificationStatus: 'unverified',
      reason: 'outside_coverage',
    });
    expect(userModelMock.findOneAndUpdate).toHaveBeenCalledWith(
      { uid: 'user-123' },
      expect.objectContaining({
        verificationStatus: 'unverified',
        lastKnownLocation: { lat: 0, lng: 0 },
      }),
      { new: true },
    );
  });

  it('rejects a request with missing or invalid coordinates', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/me/verify-location')
      .set('Authorization', 'Bearer valid-token')
      .send({ lat: 'not-a-number', lng: -122.4194 });

    expect(res.status).toBe(400);
    expect(aggregateExec).not.toHaveBeenCalled();
    expect(userModelMock.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/me/verify-location')
      .send({ lat: 37.7749, lng: -122.4194 });

    expect(res.status).toBe(401);
    expect(aggregateExec).not.toHaveBeenCalled();
  });
});
