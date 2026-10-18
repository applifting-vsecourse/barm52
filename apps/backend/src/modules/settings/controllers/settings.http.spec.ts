// Settings over real HTTP: the real controller, validation pipe and service,
// with only the guard and the repository faked. The rules a save must meet,
// and which user it saves for, depend on all three agreeing.
import { request as httpRequest } from 'http';
import { UserSettings } from '@/modules/settings/domain/settings';
import {
  SettingsRepository,
  UsernameTakenError,
} from '@/modules/settings/repositories/settings.repository';
import { SettingsService } from '@/modules/settings/services/settings.service';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { SettingsController } from './settings.controller';

jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const SAVED: UserSettings = {
  username: 'CaffeinatedDuck',
  displayName: 'Caffeinated Duck',
  bio: null,
  defaultMood: null,
};

const aSave = (overrides: Record<string, unknown> = {}): object => ({
  username: 'CaffeinatedDuck',
  displayName: 'Caffeinated Duck',
  bio: 'Runs on espresso.',
  defaultMood: 'silly',
  ...overrides,
});

describe('settings over HTTP', () => {
  const repository = mock<SettingsRepository>();
  let app: INestApplication;
  let baseUrl: string;
  let session: { user: { id: string } } | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: repository },
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
    repository.getSettings.mockReset();
    repository.isUsernameTaken.mockReset();
    repository.updateSettings.mockReset();
    repository.getSettings.mockResolvedValue(SAVED);
    repository.isUsernameTaken.mockResolvedValue(false);
    repository.updateSettings.mockImplementation(
      async (_id, settings) => settings,
    );
  });

  // A plain request that closes its connection when done, so the test process
  // isn't held open. The body is whatever JSON came back.
  const send = (
    method: string,
    body?: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ status: number; body: any }> =>
    new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = httpRequest(
        `${baseUrl}/settings`,
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

  it("reads the signed-in user's settings", async () => {
    const response = await send('GET');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(SAVED);
    expect(repository.getSettings).toHaveBeenCalledWith('u1');
  });

  it('saves for the user in the session, trimmed', async () => {
    const response = await send(
      'PUT',
      aSave({ username: ' Duck_2.0 ', displayName: ' Duck ', bio: ' Hi ' }),
    );

    expect(response.status).toBe(200);
    expect(repository.updateSettings).toHaveBeenCalledWith('u1', {
      username: 'Duck_2.0',
      displayName: 'Duck',
      bio: 'Hi',
      defaultMood: 'silly',
    });
    expect(response.body.username).toBe('Duck_2.0');
  });

  it.each([
    ['an empty bio', { bio: '   ' }],
    ['a null bio', { bio: null }],
    ['no bio at all', { bio: undefined }],
  ])('stores %s as no bio', async (_case, overrides) => {
    await send('PUT', aSave(overrides));

    expect(repository.updateSettings.mock.calls[0][1].bio).toBeNull();
  });

  it('stores a null default mood as no mood', async () => {
    await send('PUT', aSave({ defaultMood: null }));

    expect(repository.updateSettings.mock.calls[0][1].defaultMood).toBeNull();
  });

  it.each([
    ['a username of 3 characters', { username: 'abc' }],
    ['a username of 30 characters', { username: 'a'.repeat(30) }],
    ['a bio of 160 characters', { bio: 'x'.repeat(160) }],
  ])('accepts %s', async (_case, overrides) => {
    expect((await send('PUT', aSave(overrides))).status).toBe(200);
  });

  it.each([
    [
      'a username of 2 characters',
      { username: 'ab' },
      'Username must be 3–30 characters',
    ],
    [
      'a username of 31 characters',
      { username: 'a'.repeat(31) },
      'Username must be 3–30 characters',
    ],
    [
      'a username with a space',
      { username: 'two words' },
      'Use only letters, numbers, underscores and dots',
    ],
    [
      'a username with @',
      { username: '@duck' },
      'Use only letters, numbers, underscores and dots',
    ],
    ['no username', { username: undefined }, undefined],
    [
      'an empty display name',
      { displayName: '  ' },
      'Display name is required',
    ],
    ['no display name', { displayName: undefined }, undefined],
    [
      'a bio of 161 characters',
      { bio: 'x'.repeat(161) },
      'Keep it under 160 characters',
    ],
    ['an unknown mood', { defaultMood: 'ecstatic' }, undefined],
    ['an unknown field', { email: 'someone@example.com' }, undefined],
    ['a user id', { id: 'u2' }, undefined],
  ])(
    'rejects %s with 400 and saves nothing',
    async (_case, overrides, message) => {
      const response = await send('PUT', aSave(overrides));

      expect(response.status).toBe(400);
      if (message) expect(response.body.message).toContain(message);
      expect(repository.updateSettings).not.toHaveBeenCalled();
    },
  );

  it("answers 409 for someone else's username, naming the field", async () => {
    repository.isUsernameTaken.mockResolvedValue(true);

    const response = await send('PUT', aSave({ username: 'breadcritic' }));

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      message: 'That username is taken',
      field: 'username',
    });
    expect(repository.isUsernameTaken).toHaveBeenCalledWith(
      'breadcritic',
      'u1',
    );
    expect(repository.updateSettings).not.toHaveBeenCalled();
  });

  it('answers 409 when the username is taken between the check and the save', async () => {
    repository.updateSettings.mockRejectedValue(new UsernameTakenError());

    const response = await send('PUT', aSave());

    expect(response.status).toBe(409);
    expect(response.body.field).toBe('username');
  });

  it.each(['GET', 'PUT'])(
    'answers %s with 401 without a session',
    async (method) => {
      session = undefined;

      const response = await send(
        method,
        method === 'PUT' ? aSave() : undefined,
      );

      expect(response.status).toBe(401);
      expect(repository.updateSettings).not.toHaveBeenCalled();
    },
  );
});
