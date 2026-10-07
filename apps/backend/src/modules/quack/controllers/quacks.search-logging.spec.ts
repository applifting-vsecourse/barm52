// The "Usage logging" section of story.md, requirements U1 to U5. Product reads
// "distinct users per day who searched" from the log, so this is the evidence
// that a search leaves exactly one line behind, that the line holds no query
// text, and that nothing else leaves one.
//
// The request goes through a real HTTP server, the real controller, validation
// pipe and service. Only the guard and the repository are faked, because the
// 400 and 401 cases are decided before the service is ever reached.
import { get } from 'http';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
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
import { QuacksController } from './quacks.controller';

// The guard pulls in BetterAuth, which this test has no use for.
jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const SEARCH_LINE =
  /^quack_search user=u1 at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('searching quacks leaves a usage log line', () => {
  const repository = mock<QuackRepository>();
  let app: INestApplication;
  let baseUrl: string;
  let session: { user: { id: string } } | undefined;
  let logged: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuacksController],
      providers: [
        QuacksService,
        { provide: QuackRepository, useValue: repository },
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
    repository.getQuacks.mockReset();
    repository.getQuacks.mockResolvedValue([]);
    // Everything any logger writes, at any level, so a query leaking into an
    // error or a debug line is caught too.
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

  // A plain request that closes its connection when it is done. fetch keeps
  // connections open for reuse, and that would hold the test process open.
  const request = (query: string): Promise<{ status: number }> =>
    new Promise((resolve, reject) => {
      get(`${baseUrl}/quacks${query}`, { agent: false }, (response) => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode ?? 0 }));
      }).on('error', reject);
    });
  const search = (q?: string): Promise<{ status: number }> =>
    request(q === undefined ? '' : `?q=${encodeURIComponent(q)}`);
  const searchLines = (): string[] =>
    logged.filter((line) => line.startsWith('quack_search'));

  it('writes one line with the user and the time, and none of the query (U1, U2)', async () => {
    const before = Date.now();

    const response = await search('zebra');

    expect(response.status).toBe(200);
    expect(repository.getQuacks).toHaveBeenCalledWith(['zebra']);
    expect(searchLines()).toHaveLength(1);
    const [line] = searchLines();
    expect(line).toMatch(SEARCH_LINE);
    const at = Date.parse(/ at=(\S+)$/.exec(line)![1]);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
    expect(logged.join('\n')).not.toContain('zebra');
  });

  it('keeps every word of a longer query out of the log (U2)', async () => {
    await search('@Giraffe  hippo');

    expect(repository.getQuacks).toHaveBeenCalledWith(['Giraffe', 'hippo']);
    expect(searchLines()).toHaveLength(1);
    expect(logged.join('\n').toLowerCase()).not.toMatch(/giraffe|hippo/);
  });

  it('writes the line when nothing matches (U3)', async () => {
    repository.getQuacks.mockResolvedValue([]);

    await search('zebra');

    expect(searchLines()).toHaveLength(1);
  });

  it('writes the line when the lookup then fails (U3)', async () => {
    repository.getQuacks.mockRejectedValue(new Error('database is down'));

    const response = await search('zebra');

    expect(response.status).toBe(500);
    expect(searchLines()).toHaveLength(1);
    expect(logged.join('\n')).not.toContain('zebra');
  });

  it('writes a line for every request, repeated or not (U5)', async () => {
    await search('zebra');
    await search('zebra');
    await search('zebra');

    expect(searchLines()).toHaveLength(3);
  });

  it.each([
    ['no query at all', undefined],
    ['an empty query', ''],
    ['a whitespace-only query', '   '],
    ['a query of only @ signs', '@'],
    ['a query of only @ signs and spaces', '@@ @'],
  ])('writes no line for %s (U4)', async (_description, q) => {
    const response = await search(q);

    expect(response.status).toBe(200);
    expect(repository.getQuacks).toHaveBeenCalledWith([]);
    expect(searchLines()).toHaveLength(0);
  });

  it('accepts a query of 100 characters and logs it (U4 boundary)', async () => {
    const response = await search('a'.repeat(100));

    expect(response.status).toBe(200);
    expect(searchLines()).toHaveLength(1);
  });

  it('writes no line for a query of 101 characters, which is rejected (U4)', async () => {
    const response = await search('a'.repeat(101));

    expect(response.status).toBe(400);
    expect(repository.getQuacks).not.toHaveBeenCalled();
    expect(searchLines()).toHaveLength(0);
  });

  // The controller reads ?q=a&q=b as one search, "a,b". It is the joined text
  // that the limit applies to, so repeating q gets nobody past it.
  it('applies the limit to a search given twice (U4)', async () => {
    const response = await request(`?q=${'a'.repeat(60)}&q=${'b'.repeat(60)}`);

    expect(response.status).toBe(400);
    expect(repository.getQuacks).not.toHaveBeenCalled();
    expect(searchLines()).toHaveLength(0);
  });

  // The list ignored every query parameter before there was a search, and it
  // still ignores the ones that are not `q`.
  it.each(['?foo=bar', '?foo=bar&page=2&q='])(
    'ignores query parameters it does not know: %s',
    async (query) => {
      const response = await request(query);

      expect(response.status).toBe(200);
      expect(repository.getQuacks).toHaveBeenCalledWith([]);
      expect(searchLines()).toHaveLength(0);
    },
  );

  it('still searches, and logs, when unknown parameters come along', async () => {
    const response = await request('?foo=bar&q=zebra&page=2');

    expect(response.status).toBe(200);
    expect(repository.getQuacks).toHaveBeenCalledWith(['zebra']);
    expect(searchLines()).toHaveLength(1);
    expect(logged.join('\n')).not.toContain('zebra');
  });

  it('writes no line without a valid session (U4)', async () => {
    session = undefined;

    const response = await search('zebra');

    expect(response.status).toBe(401);
    expect(repository.getQuacks).not.toHaveBeenCalled();
    expect(searchLines()).toHaveLength(0);
  });
});
