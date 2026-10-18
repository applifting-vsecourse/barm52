// Polls over real HTTP: the real controllers, validation pipes and services,
// with only the guard and the repositories faked. This is where the story's
// compatibility rules (K1–K3), status codes and usage log lines (Měření) are
// checked, because each depends on more than one layer agreeing.
import { request as httpRequest } from 'http';
import { Poll } from '@/modules/quack/domain/poll';
import { Quack } from '@/modules/quack/domain/quack';
import { PollRepository } from '@/modules/quack/repositories/poll.repository';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { PollsService } from '@/modules/quack/services/polls.service';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  ExecutionContext,
  INestApplication,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { PollsController } from './polls.controller';
import { QuacksController } from './quacks.controller';

jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const USAGE_LINE = (event: string): RegExp =>
  new RegExp(
    `^${event} user=u1 poll=q1 at=\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$`,
  );

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  quackId: 'q1',
  authorId: 'u1',
  endsAt: null,
  resultsVisibility: 'immediately',
  suggestions: 'not_allowed',
  options: [
    {
      id: 'o1',
      text: 'Zebra pizza',
      status: 'published',
      position: 0,
      createdById: 'u1',
      createdAt: new Date('2026-10-18T10:00:00Z'),
      votes: 0,
    },
  ],
  myVoteOptionId: null,
  ...overrides,
});

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'Zebra lunch?',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-10-18T10:00:00Z'),
  updatedAt: new Date('2026-10-18T10:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  poll: null,
  ...overrides,
});

describe('polls over HTTP', () => {
  const quackRepository = mock<QuackRepository>();
  const pollRepository = mock<PollRepository>();
  let app: INestApplication;
  let baseUrl: string;
  let session: { user: { id: string } } | undefined;
  let logged: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuacksController, PollsController],
      providers: [
        QuacksService,
        PollsService,
        { provide: QuackRepository, useValue: quackRepository },
        { provide: PollRepository, useValue: pollRepository },
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
    session = { user: { id: 'u1' } };
    quackRepository.createQuack.mockReset();
    quackRepository.getQuacks.mockReset();
    pollRepository.getPoll.mockReset();
    pollRepository.castVote.mockReset();
    pollRepository.suggestOption.mockReset();
    pollRepository.decideSuggestion.mockReset();
    pollRepository.getPoll.mockResolvedValue(aPoll());
    logged = [];
    for (const level of [
      'log',
      'error',
      'warn',
      'debug',
      'verbose',
      'fatal',
    ] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args) => {
        logged.push(args.map(String).join(' '));
      });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // A plain request that closes its connection when done, so the test process
  // isn't held open. The body is whatever JSON came back.
  const send = (
    method: string,
    path: string,
    body?: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ status: number; body: any }> =>
    new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = httpRequest(
        `${baseUrl}${path}`,
        {
          method,
          agent: false,
          headers: payload ? { 'content-type': 'application/json' } : undefined,
        },
        (response) => {
          let text = '';
          response.on('data', (chunk) => (text += chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              body: text ? JSON.parse(text) : undefined,
            }),
          );
        },
      );
      req.on('error', reject);
      req.end(payload);
    });

  const linesOf = (event: string): string[] =>
    logged.filter((line) => line.startsWith(`${event} `));

  describe('creating a quack', () => {
    it('without a poll works as before and answers with poll: null (K1)', async () => {
      quackRepository.createQuack.mockResolvedValue(aQuack());

      const response = await send('POST', '/quacks', { text: 'hello' });

      expect(response.status).toBe(201);
      expect(response.body.poll).toBeNull();
      expect(linesOf('poll_created')).toHaveLength(0);
    });

    it('still rejects fields it does not know (K2)', async () => {
      const response = await send('POST', '/quacks', {
        text: 'hello',
        question: 'Lunch?',
      });

      expect(response.status).toBe(400);
      expect(quackRepository.createQuack).not.toHaveBeenCalled();
    });

    it('stores the poll with the author from the session and the end from the server clock (A3, X1.1)', async () => {
      quackRepository.createQuack.mockResolvedValue(
        aQuack({ poll: aPoll({ endsAt: new Date() }) }),
      );
      const before = Date.now();

      const response = await send('POST', '/quacks', {
        text: 'Zebra lunch?',
        poll: { options: [' Pizza ', 'Sushi'], length: '1h' },
      });

      expect(response.status).toBe(201);
      const stored = quackRepository.createQuack.mock.calls[0][0];
      expect(stored.userId).toBe('u1');
      expect(stored.poll?.options).toEqual(['Pizza', 'Sushi']);
      const endsAt = stored.poll!.endsAt!.getTime();
      expect(endsAt).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
      expect(endsAt).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000);
      expect(response.body.poll.options).toEqual([
        { id: 'o1', text: 'Zebra pizza', votes: 0 },
      ]);
    });

    it('gives settings left out their least restrictive value', async () => {
      quackRepository.createQuack.mockResolvedValue(aQuack({ poll: aPoll() }));

      await send('POST', '/quacks', {
        text: 'Lunch?',
        poll: { options: ['Pizza', 'Sushi'] },
      });

      expect(quackRepository.createQuack.mock.calls[0][0].poll).toEqual({
        options: ['Pizza', 'Sushi'],
        endsAt: null,
        resultsVisibility: 'immediately',
        suggestions: 'not_allowed',
      });
    });

    it.each([
      ['a duplicate answer', { options: ['Pizza', 'pizza'] }],
      ['a blank answer', { options: ['Pizza', ' '] }],
      ['a single answer', { options: ['Pizza'] }],
      ['an unknown poll field', { options: ['Pizza', 'Sushi'], votes: 5 }],
    ])('with %s answers 400 and creates nothing (A4)', async (_case, poll) => {
      const response = await send('POST', '/quacks', { text: 'Lunch?', poll });

      expect(response.status).toBe(400);
      expect(quackRepository.createQuack).not.toHaveBeenCalled();
      expect(linesOf('poll_created')).toHaveLength(0);
    });

    it('logs poll_created once stored, without the question or answers', async () => {
      quackRepository.createQuack.mockResolvedValue(aQuack({ poll: aPoll() }));

      await send('POST', '/quacks', {
        text: 'Zebra lunch?',
        poll: { options: ['Zebra pizza', 'Sushi'] },
      });

      expect(linesOf('poll_created')).toHaveLength(1);
      expect(linesOf('poll_created')[0]).toMatch(USAGE_LINE('poll_created'));
      expect(logged.join('\n').toLowerCase()).not.toContain('zebra');
    });

    it('logs nothing when storing fails', async () => {
      quackRepository.createQuack.mockRejectedValue(new Error('db down'));

      const response = await send('POST', '/quacks', {
        text: 'Lunch?',
        poll: { options: ['Pizza', 'Sushi'] },
      });

      expect(response.status).toBe(500);
      expect(linesOf('poll_created')).toHaveLength(0);
    });

    it('answers 401 without a session (A8)', async () => {
      session = undefined;

      const response = await send('POST', '/quacks', {
        text: 'Lunch?',
        poll: { options: ['Pizza', 'Sushi'] },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('listing', () => {
    it('still ignores query parameters other than q (K3)', async () => {
      quackRepository.getQuacks.mockResolvedValue([aQuack({ poll: aPoll() })]);

      const response = await send('GET', '/quacks?poll=1&page=2');

      expect(response.status).toBe(200);
      expect(response.body[0].poll.options[0].text).toBe('Zebra pizza');
    });

    it('never says who voted for what (B6)', async () => {
      quackRepository.getQuacks.mockResolvedValue([
        aQuack({ poll: aPoll({ myVoteOptionId: 'o1' }) }),
      ]);

      const response = await send('GET', '/quacks');

      expect(Object.keys(response.body[0].poll).sort()).toEqual([
        'canSuggest',
        'ended',
        'endsAt',
        'isAuthor',
        'myVoteOptionId',
        'options',
        'pendingSuggestions',
        'resultsVisibility',
        'resultsVisible',
        'suggestions',
        'totalVotes',
      ]);
      expect(Object.keys(response.body[0].poll.options[0]).sort()).toEqual([
        'id',
        'text',
        'votes',
      ]);
    });
  });

  describe('voting', () => {
    it('answers with the poll after the vote and logs poll_vote (C1, D2)', async () => {
      pollRepository.castVote.mockResolvedValue('changed');
      pollRepository.getPoll.mockResolvedValue(aPoll({ myVoteOptionId: 'o1' }));

      const response = await send('PUT', '/quacks/q1/poll/vote', {
        optionId: 'o1',
      });

      expect(response.status).toBe(200);
      expect(response.body.myVoteOptionId).toBe('o1');
      expect(pollRepository.castVote).toHaveBeenCalledWith(
        expect.objectContaining({
          quackId: 'q1',
          userId: 'u1',
          optionId: 'o1',
        }),
      );
      expect(linesOf('poll_vote')).toHaveLength(1);
      expect(linesOf('poll_vote')[0]).toMatch(USAGE_LINE('poll_vote'));
      expect(logged.join('\n').toLowerCase()).not.toContain('zebra');
    });

    it('succeeds and logs nothing for the answer already chosen (C3)', async () => {
      pollRepository.castVote.mockResolvedValue('unchanged');

      const response = await send('PUT', '/quacks/q1/poll/vote', {
        optionId: 'o1',
      });

      expect(response.status).toBe(200);
      expect(linesOf('poll_vote')).toHaveLength(0);
    });

    it('answers 404 for an answer outside the poll (C6)', async () => {
      pollRepository.castVote.mockResolvedValue('not_found');

      const response = await send('PUT', '/quacks/q1/poll/vote', {
        optionId: 'elsewhere',
      });

      expect(response.status).toBe(404);
      expect(linesOf('poll_vote')).toHaveLength(0);
    });

    it('answers 409 with reason poll_ended once the poll has ended (X1.3)', async () => {
      pollRepository.castVote.mockResolvedValue('ended');

      const response = await send('PUT', '/quacks/q1/poll/vote', {
        optionId: 'o1',
      });

      expect(response.status).toBe(409);
      expect(response.body.reason).toBe('poll_ended');
      expect(linesOf('poll_vote')).toHaveLength(0);
    });

    it.each([
      ['no answer', {}],
      ['an extra field', { optionId: 'o1', userId: 'someone-else' }],
    ])('answers 400 for %s', async (_case, body) => {
      const response = await send('PUT', '/quacks/q1/poll/vote', body);

      expect(response.status).toBe(400);
      expect(pollRepository.castVote).not.toHaveBeenCalled();
    });

    it('answers 401 without a session (C6)', async () => {
      session = undefined;

      const response = await send('PUT', '/quacks/q1/poll/vote', {
        optionId: 'o1',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('suggesting', () => {
    it('logs poll_option_suggested for someone other than the author', async () => {
      pollRepository.suggestOption.mockResolvedValue('added_by_other');

      const response = await send('POST', '/quacks/q1/poll/options', {
        text: ' Zebra tacos ',
      });

      expect(response.status).toBe(201);
      expect(pollRepository.suggestOption).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Zebra tacos' }),
      );
      expect(linesOf('poll_option_suggested')).toHaveLength(1);
      expect(linesOf('poll_option_suggested')[0]).toMatch(
        USAGE_LINE('poll_option_suggested'),
      );
      expect(logged.join('\n').toLowerCase()).not.toContain('zebra');
    });

    it('logs nothing for an answer the author adds', async () => {
      pollRepository.suggestOption.mockResolvedValue('added_by_author');

      await send('POST', '/quacks/q1/poll/options', { text: 'Tacos' });

      expect(linesOf('poll_option_suggested')).toHaveLength(0);
    });

    it.each([
      ['duplicate', 400, 'Answers must be different'],
      ['full', 400, 'This poll already has the maximum number of options'],
      ['limit_reached', 400, 'You already have an answer in this poll'],
      ['not_allowed', 403, undefined],
      ['not_found', 404, undefined],
      ['ended', 409, 'This poll has ended.'],
    ] as const)(
      'answers a %s suggestion with %i and logs nothing',
      async (outcome, status, message) => {
        pollRepository.suggestOption.mockResolvedValue(outcome);

        const response = await send('POST', '/quacks/q1/poll/options', {
          text: 'Tacos',
        });

        expect(response.status).toBe(status);
        if (message) expect(response.body.message).toBe(message);
        expect(linesOf('poll_option_suggested')).toHaveLength(0);
      },
    );

    it.each([' ', 'x'.repeat(81)])(
      'answers 400 for the text %j without asking the repository',
      async (text) => {
        const response = await send('POST', '/quacks/q1/poll/options', {
          text,
        });

        expect(response.status).toBe(400);
        expect(pollRepository.suggestOption).not.toHaveBeenCalled();
      },
    );
  });

  describe('deciding on a suggestion', () => {
    it.each([
      ['POST', '/quacks/q1/poll/options/s1/approve', 'approve'],
      ['DELETE', '/quacks/q1/poll/options/s1', 'reject'],
    ])(
      '%s %s hands the decision over and logs nothing',
      async (method, path, decision) => {
        pollRepository.decideSuggestion.mockResolvedValue('done');

        const response = await send(method, path);

        expect(response.status).toBe(200);
        expect(pollRepository.decideSuggestion).toHaveBeenCalledWith(
          expect.objectContaining({
            quackId: 'q1',
            optionId: 's1',
            userId: 'u1',
            decision,
          }),
        );
        expect(logged.filter((l) => l.startsWith('poll_'))).toHaveLength(0);
      },
    );

    it.each([
      ['forbidden', 403],
      ['suggestion_not_found', 404],
      ['not_found', 404],
      ['ended', 409],
    ] as const)('answers %s with %i (X3.7)', async (outcome, status) => {
      pollRepository.decideSuggestion.mockResolvedValue(outcome);

      const response = await send('POST', '/quacks/q1/poll/options/s1/approve');

      expect(response.status).toBe(status);
    });
  });
});
