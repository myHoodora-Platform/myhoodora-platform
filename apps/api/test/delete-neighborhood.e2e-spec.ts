import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import type { DecodedIdToken } from 'firebase-admin/auth';
import request from 'supertest';

import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { getFirebaseAdmin } from '../src/config/firebase.config';
import { NeighborhoodsController } from '../src/neighborhoods/neighborhoods.controller';
import { NeighborhoodsService } from '../src/neighborhoods/neighborhoods.service';
import { Neighborhood } from '../src/neighborhoods/schemas/neighborhood.schema';

jest.mock('../src/config/firebase.config', () => ({
  getFirebaseAdmin: jest.fn(),
}));

const verifyIdToken = jest.fn();
(getFirebaseAdmin as jest.Mock).mockReturnValue({
  auth: () => ({ verifyIdToken }),
});

const findByIdAndDeleteExec = jest.fn();
const neighborhoodModelMock = {
  findByIdAndDelete: jest.fn(() => ({ exec: findByIdAndDeleteExec })),
};

@Module({
  controllers: [NeighborhoodsController],
  providers: [
    NeighborhoodsService,
    Reflector,
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    {
      provide: getModelToken(Neighborhood.name),
      useValue: neighborhoodModelMock,
    },
  ],
})
class NeighborhoodsFixtureModule {}

describe('DELETE /neighborhoods/:id (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [NeighborhoodsFixtureModule],
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

  it('deletes an existing neighbourhood and returns 204', async () => {
    findByIdAndDeleteExec.mockResolvedValue({ _id: 'hood-1', name: 'Ikeja' });

    const res = await request(app.getHttpServer())
      .delete('/neighborhoods/hood-1')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(204);
    expect(neighborhoodModelMock.findByIdAndDelete).toHaveBeenCalledWith(
      'hood-1',
    );
  });

  it('returns 404 when the neighbourhood does not exist', async () => {
    findByIdAndDeleteExec.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .delete('/neighborhoods/missing-id')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).delete(
      '/neighborhoods/hood-1',
    );

    expect(res.status).toBe(401);
    expect(findByIdAndDeleteExec).not.toHaveBeenCalled();
  });
});
