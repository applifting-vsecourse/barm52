// Deleting and the Mine filter over real HTTP: the real controller, validation
// pipes and service, with only the guard and the repository faked. The status
// codes are what the story promises a direct API caller, so they are checked
// here rather than in the service spec.
import { request as httpRequest } from 'http';
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { QuacksController } from './quacks.controller';

jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-10-20T10:00:00Z'),
  updatedAt: new Date('2026-10-20T10:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  poll: null,
  ...overrides,
});

describe('quacks over HTTP', () => {
  const quackRepository = mock<QuackRepository>();
  let app: INestApplication;
  let baseUrl: string;
  let session: { user: { id: string; role: string } } | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuacksController],
      providers: [
        QuacksService,
        { provide: QuackRepository, useValue: quackRepository },
      ],
    })
      .overrideGuard(AuthenticatedUserGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!session) throw new UnauthorizedException();
          context.switchToHttp().getRequest().session = session;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    session = { user: { id: 'u1', role: 'user' } };
    quackRepository.getQuacks.mockReset();
    quackRepository.getAuthorId.mockReset();
    quackRepository.deleteQuack.mockReset();
    quackRepository.getQuacks.mockResolvedValue([aQuack()]);
  });

  // A plain request that closes its connection when done, so the test process
  // isn't held open.
  const send = (
    method: string,
    path: string,
  ): Promise<{ status: number; body: string }> =>
    new Promise((resolve, reject) => {
      const req = httpRequest(
        `${baseUrl}${path}`,
        { method, agent: false },
        (response) => {
          let text = '';
          response.on('data', (chunk) => (text += chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode ?? 0, body: text }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });

  describe('DELETE /quacks/:id', () => {
    it('deletes your own quack and answers 204 with no body', async () => {
      quackRepository.getAuthorId.mockResolvedValue('u1');

      const response = await send('DELETE', '/quacks/q1');

      expect(response.status).toBe(204);
      expect(response.body).toBe('');
      expect(quackRepository.deleteQuack).toHaveBeenCalledWith('q1');
    });

    it("answers 403 for someone else's quack and deletes nothing", async () => {
      quackRepository.getAuthorId.mockResolvedValue('u2');

      const response = await send('DELETE', '/quacks/q1');

      expect(response.status).toBe(403);
      expect(quackRepository.deleteQuack).not.toHaveBeenCalled();
    });

    it('answers 404 for a quack that does not exist', async () => {
      quackRepository.getAuthorId.mockResolvedValue(null);

      const response = await send('DELETE', '/quacks/nope');

      expect(response.status).toBe(404);
      expect(quackRepository.deleteQuack).not.toHaveBeenCalled();
    });

    it('answers 401 when signed out and never looks the quack up', async () => {
      session = undefined;

      const response = await send('DELETE', '/quacks/q1');

      expect(response.status).toBe(401);
      expect(quackRepository.getAuthorId).not.toHaveBeenCalled();
      expect(quackRepository.deleteQuack).not.toHaveBeenCalled();
    });

    it('ignores a user id in the query: who you are comes from the session', async () => {
      quackRepository.getAuthorId.mockResolvedValue('u2');

      const response = await send('DELETE', '/quacks/q1?userId=u2');

      expect(response.status).toBe(403);
      expect(quackRepository.deleteQuack).not.toHaveBeenCalled();
    });
  });

  describe('GET /quacks?mine', () => {
    it("lists only the signed-in user's quacks for mine=true", async () => {
      const response = await send('GET', '/quacks?mine=true');

      expect(response.status).toBe(200);
      expect(quackRepository.getQuacks).toHaveBeenCalledWith([], 'u1', 'u1');
    });

    it.each(['/quacks', '/quacks?mine=false'])(
      'lists every quack for %s',
      async (path) => {
        const response = await send('GET', path);

        expect(response.status).toBe(200);
        expect(quackRepository.getQuacks).toHaveBeenCalledWith([], 'u1');
      },
    );

    it('rejects a mine that is not true or false', async () => {
      const response = await send('GET', '/quacks?mine=u2');

      expect(response.status).toBe(400);
      expect(quackRepository.getQuacks).not.toHaveBeenCalled();
    });

    it('still ignores query parameters it does not know', async () => {
      const response = await send('GET', '/quacks?page=2&userId=u2');

      expect(response.status).toBe(200);
      expect(quackRepository.getQuacks).toHaveBeenCalledWith([], 'u1');
    });
  });
});
